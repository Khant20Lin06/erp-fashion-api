import {
  OutboxPublisherService,
  OUTBOX_PUBLISHER_INTERVAL_NAME,
} from './outbox-publisher.service';
import { OutboxEvent } from '../entities/outbox-event.entity';
import { OutboxEventStatus } from '../entities/outbox-event-status.enum';
import {
  KafkaProducerService,
  KafkaPublishRequest,
} from '../../kafka/kafka-producer.service';
import { PAYMENT_EVENTS_TOPIC } from '../outbox-topics';
import type { EventEnvelope } from '../interfaces/event-envelope.interface';

interface OutboxUpdatePayload {
  status?: OutboxEventStatus;
  publishedAt?: Date;
  attemptCount?: number;
  lastError?: string | null;
  availableAt?: Date;
}

describe('OutboxPublisherService', () => {
  let publisher: OutboxPublisherService;
  let dataSource: {
    transaction: jest.Mock;
    getRepository: jest.Mock;
  };
  let kafkaProducer: jest.Mocked<Pick<KafkaProducerService, 'publish'>>;
  let configService: { get: jest.Mock };
  let schedulerRegistry: { addInterval: jest.Mock; deleteInterval: jest.Mock };
  let repository: {
    update: jest.Mock<Promise<void>, [string, OutboxUpdatePayload]>;
  };

  const buildEvent = (overrides: Partial<OutboxEvent> = {}): OutboxEvent => {
    const row = new OutboxEvent();
    Object.assign(row, {
      id: 'row-1',
      eventId: 'event-1',
      eventType: 'payment.confirmed',
      eventVersion: 1,
      aggregateType: 'Payment',
      aggregateId: 'payment-42',
      companyId: 'company-1',
      branchId: null,
      source: 'fashion-erp-api',
      correlationId: null,
      causationId: null,
      occurredAt: new Date('2026-08-13T09:00:00.000Z'),
      payload: { paymentId: 'payment-42' },
      status: OutboxEventStatus.Pending,
      attemptCount: 0,
      availableAt: new Date('2026-08-13T08:59:00.000Z'),
      publishedAt: null,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });
    return row;
  };

  beforeEach(() => {
    repository = {
      update: jest
        .fn<Promise<void>, [string, OutboxUpdatePayload]>()
        .mockResolvedValue(undefined),
    };
    dataSource = {
      transaction: jest.fn(),
      getRepository: jest.fn().mockReturnValue(repository),
    };
    kafkaProducer = { publish: jest.fn().mockResolvedValue(undefined) };
    configService = {
      get: jest.fn().mockReturnValue({ pollIntervalMs: 5000, batchSize: 50 }),
    };
    schedulerRegistry = { addInterval: jest.fn(), deleteInterval: jest.fn() };

    publisher = new OutboxPublisherService(
      dataSource as never,
      kafkaProducer as unknown as KafkaProducerService,
      configService as never,
      schedulerRegistry as never,
    );
  });

  describe('publishing', () => {
    it('publishes with the topic resolved from eventType and the key set to aggregateId (partition key)', async () => {
      const event = buildEvent();
      dataSource.transaction.mockResolvedValue([event]);

      await publisher.tick();

      expect(kafkaProducer.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: PAYMENT_EVENTS_TOPIC,
          key: 'payment-42',
        }),
      );
    });

    it('publishes the full envelope (via toEnvelope()) as the message value, not a raw entity dump', async () => {
      const event = buildEvent();
      dataSource.transaction.mockResolvedValue([event]);

      await publisher.tick();

      const [[call]]: [[KafkaPublishRequest]] = kafkaProducer.publish.mock
        .calls as [[KafkaPublishRequest]];
      const value = JSON.parse(call.value) as EventEnvelope;
      expect(value.eventId).toBe('event-1');
      expect(value.eventType).toBe('payment.confirmed');
      expect(value.aggregateId).toBe('payment-42');
      expect(value.payload).toEqual({ paymentId: 'payment-42' });
    });

    it('marks a successfully published event PUBLISHED with a published_at timestamp', async () => {
      const event = buildEvent();
      dataSource.transaction.mockResolvedValue([event]);

      await publisher.tick();

      expect(repository.update).toHaveBeenCalledTimes(1);
      const [rowId, updatePayload] = repository.update.mock.calls[0];
      expect(rowId).toBe('row-1');
      expect(updatePayload.status).toBe(OutboxEventStatus.Published);
      expect(updatePayload.publishedAt).toBeInstanceOf(Date);
    });
  });

  describe('failure handling', () => {
    it('increments attempt_count, records a sanitized last_error, and advances available_at on publish failure', async () => {
      const event = buildEvent({ attemptCount: 0 });
      dataSource.transaction.mockResolvedValue([event]);
      kafkaProducer.publish.mockRejectedValue(
        new Error('connect ECONNREFUSED mysql://root:hunter2@broker:9092'),
      );

      const before = Date.now();
      await publisher.tick();

      expect(repository.update).toHaveBeenCalledWith(
        'row-1',
        expect.objectContaining({
          status: OutboxEventStatus.Failed,
          attemptCount: 1,
        }),
      );
      const [, updatePayload] = repository.update.mock.calls[0];
      expect(updatePayload.lastError).not.toContain('hunter2');
      expect(updatePayload.availableAt?.getTime()).toBeGreaterThan(before);
    });

    it('never lets a publish failure propagate out of tick() (one bad event does not stop the batch)', async () => {
      const event = buildEvent();
      dataSource.transaction.mockResolvedValue([event]);
      kafkaProducer.publish.mockRejectedValue(new Error('kafka unavailable'));

      await expect(publisher.tick()).resolves.toBeUndefined();
    });
  });

  describe('re-entrancy guard', () => {
    it('skips a tick that starts while a previous tick is still running', async () => {
      let resolveClaim: (value: OutboxEvent[]) => void = () => undefined;
      dataSource.transaction.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveClaim = resolve;
        }),
      );

      const firstTick = publisher.tick();
      const secondTick = publisher.tick(); // should return immediately, re-entrancy guarded

      resolveClaim([]);
      await Promise.all([firstTick, secondTick]);

      // Only the first tick's claim transaction should have run — the
      // second call to tick() must have returned early instead of issuing
      // a second concurrent claim query from the SAME publisher instance.
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('lifecycle (start/onModuleDestroy)', () => {
    // start() calls the REAL Node setInterval() — only its dependencies
    // (schedulerRegistry, dataSource, kafkaProducer, configService) are
    // jest mocks. schedulerRegistry.deleteInterval() is itself a mock, so
    // calling it does NOT clear the real underlying timer start() created.
    // Without fake timers here, every test below would leak a live
    // interval that keeps firing this.tick() against stale mocked
    // dependencies for the rest of the Jest worker process's life —
    // harmless to test outcomes (interval.unref() keeps it from blocking
    // process exit, and tick() catches its own errors), but noisy
    // ("Outbox publisher tick failed: ..." stderr spam) and a genuine
    // timer leak. jest.useFakeTimers() replaces the global timer
    // implementation for this describe block only, so start()'s
    // setInterval() call is captured by Jest instead of the real event
    // loop and is automatically discarded when real timers are restored.
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('registers the polling interval under a fixed, exported name', () => {
      publisher.start();

      expect(schedulerRegistry.addInterval).toHaveBeenCalledWith(
        OUTBOX_PUBLISHER_INTERVAL_NAME,
        expect.anything(),
      );
    });

    it('deletes the registered interval on onModuleDestroy() after start()', () => {
      publisher.start();
      publisher.onModuleDestroy();

      expect(schedulerRegistry.deleteInterval).toHaveBeenCalledWith(
        OUTBOX_PUBLISHER_INTERVAL_NAME,
      );
    });

    it('does nothing on onModuleDestroy() if start() was never called (never registers a phantom deletion)', () => {
      publisher.onModuleDestroy();

      expect(schedulerRegistry.deleteInterval).not.toHaveBeenCalled();
    });

    it('is safe to call onModuleDestroy() twice in a row (does not throw, does not double-delete)', () => {
      publisher.start();
      publisher.onModuleDestroy();
      schedulerRegistry.deleteInterval.mockClear();

      expect(() => publisher.onModuleDestroy()).not.toThrow();
      expect(schedulerRegistry.deleteInterval).not.toHaveBeenCalled();
    });

    it('does not throw if SchedulerRegistry.deleteInterval() itself throws (e.g. a test already removed it)', () => {
      publisher.start();
      schedulerRegistry.deleteInterval.mockImplementation(() => {
        throw new Error('No Interval found');
      });

      expect(() => publisher.onModuleDestroy()).not.toThrow();
    });
  });
});
