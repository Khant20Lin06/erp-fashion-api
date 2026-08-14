import {
  NotificationEventConsumer,
  NOTIFICATION_CONSUMER_NAME,
} from './notification-event.consumer';
import { PAYMENT_CONFIRMED_EVENT_TYPE } from '../../payments/events/payment-confirmed.event';
import { PaymentDirection } from '../../payments/entities/payment-direction.enum';
import type { EventEnvelope } from '../../outbox/interfaces/event-envelope.interface';
import { NotificationChannel } from '../entities/notification-channel.enum';
import { NotificationStatus } from '../entities/notification-status.enum';
import { QueueNames } from '../../queue/queue-names';

describe('NotificationEventConsumer', () => {
  let consumer: NotificationEventConsumer;
  let processedEventRepository: { findOne: jest.Mock; insert: jest.Mock };
  let dataSource: { getRepository: jest.Mock };
  let kafkaConsumerService: { run: jest.Mock };
  let notificationsService: { createPending: jest.Mock };
  let queueService: { enqueue: jest.Mock };

  const buildEnvelope = (
    overrides: Partial<EventEnvelope> = {},
  ): EventEnvelope => ({
    eventId: 'event-abc',
    eventType: PAYMENT_CONFIRMED_EVENT_TYPE,
    eventVersion: 1,
    occurredAt: '2026-08-13T09:00:00.000Z',
    aggregateType: 'Payment',
    aggregateId: 'payment-1',
    companyId: 'company-1',
    branchId: null,
    source: 'fashion-erp-api',
    correlationId: null,
    causationId: null,
    payload: {
      paymentId: 'payment-1',
      paymentNumber: 'PAY-0001',
      direction: PaymentDirection.Receipt,
      amount: '100.00',
      currency: 'USD',
      paymentMethodId: 'pm-1',
      customerId: 'cust-1',
      supplierId: null,
      paymentDate: '2026-08-13T09:00:00.000Z',
      allocationIds: [],
    },
    ...overrides,
  });

  const buildNotification = () => ({
    id: 'notif-1',
    companyId: 'company-1',
    status: NotificationStatus.Pending,
  });

  beforeEach(() => {
    processedEventRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      insert: jest.fn().mockResolvedValue(undefined),
    };
    dataSource = {
      getRepository: jest.fn().mockReturnValue(processedEventRepository),
    };
    kafkaConsumerService = { run: jest.fn().mockResolvedValue(undefined) };
    notificationsService = {
      createPending: jest.fn().mockResolvedValue(buildNotification()),
    };
    queueService = { enqueue: jest.fn().mockResolvedValue(undefined) };

    consumer = new NotificationEventConsumer(
      kafkaConsumerService as never,
      dataSource as never,
      notificationsService as never,
      queueService as never,
    );
  });

  it('uses a fixed, meaningful consumer group name, separate from the payment-audit consumer group', () => {
    expect(NOTIFICATION_CONSUMER_NAME).toBe('erp-notification-consumer');
    expect(NOTIFICATION_CONSUMER_NAME).not.toBe('erp-payment-audit-consumer');
  });

  it('checks processed_events BEFORE creating a Notification, then creates it, enqueues a job, and records processed_events — in that order', async () => {
    const callOrder: string[] = [];
    processedEventRepository.findOne.mockImplementation(() => {
      callOrder.push('processedEvents.findOne');
      return Promise.resolve(null);
    });
    notificationsService.createPending.mockImplementation(() => {
      callOrder.push('createPending');
      return Promise.resolve(buildNotification());
    });
    queueService.enqueue.mockImplementation(() => {
      callOrder.push('enqueue');
      return Promise.resolve(undefined);
    });
    processedEventRepository.insert.mockImplementation(() => {
      callOrder.push('processedEvents.insert');
      return Promise.resolve(undefined);
    });

    await consumer.handleMessage({
      topic: 'erp.payment.events',
      partition: 0,
      key: 'payment-1',
      value: JSON.stringify(buildEnvelope()),
    });

    expect(callOrder).toEqual([
      'processedEvents.findOne',
      'createPending',
      'enqueue',
      'processedEvents.insert',
    ]);
  });

  it('creates the Notification with the correct company scope, channel, and source event id', async () => {
    await consumer.handleMessage({
      topic: 'erp.payment.events',
      partition: 0,
      key: 'payment-1',
      value: JSON.stringify(buildEnvelope()),
    });

    expect(notificationsService.createPending).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-1',
        channel: NotificationChannel.InApp,
        sourceEventId: 'event-abc',
        eventType: PAYMENT_CONFIRMED_EVENT_TYPE,
      }),
    );
  });

  it('enqueues on the notifications queue with only the notification id (never the full payload) and a deterministic jobId', async () => {
    await consumer.handleMessage({
      topic: 'erp.payment.events',
      partition: 0,
      key: 'payment-1',
      value: JSON.stringify(buildEnvelope()),
    });

    expect(queueService.enqueue).toHaveBeenCalledWith(
      QueueNames.NOTIFICATIONS,
      expect.any(String),
      { notificationId: 'notif-1' },
      expect.any(Object),
    );
    const enqueueCall = queueService.enqueue.mock.calls[0] as [
      string,
      string,
      { notificationId: string },
      { jobId: string },
    ];
    expect(enqueueCall[3].jobId).toContain('notif-1');
  });

  it('no-ops (does not create a Notification or enqueue) when already processed', async () => {
    processedEventRepository.findOne.mockResolvedValue({
      id: 'existing-row',
      eventId: 'event-abc',
      consumerName: NOTIFICATION_CONSUMER_NAME,
    });

    await consumer.handleMessage({
      topic: 'erp.payment.events',
      partition: 0,
      key: 'payment-1',
      value: JSON.stringify(buildEnvelope()),
    });

    expect(notificationsService.createPending).not.toHaveBeenCalled();
    expect(queueService.enqueue).not.toHaveBeenCalled();
  });

  it('does NOT record processed_events when enqueue fails — so Kafka redelivers and this consumer gets another chance', async () => {
    queueService.enqueue.mockRejectedValue(new Error('Redis unreachable'));

    await expect(
      consumer.handleMessage({
        topic: 'erp.payment.events',
        partition: 0,
        key: 'payment-1',
        value: JSON.stringify(buildEnvelope()),
      }),
    ).rejects.toThrow('Redis unreachable');

    expect(processedEventRepository.insert).not.toHaveBeenCalled();
  });

  it('treats a duplicate-key race on the processed_events insert as already-processed rather than throwing', async () => {
    const duplicateError = Object.assign(new Error('Duplicate entry'), {
      code: 'ER_DUP_ENTRY',
      errno: 1062,
    });
    processedEventRepository.insert.mockRejectedValue(duplicateError);

    await expect(
      consumer.handleMessage({
        topic: 'erp.payment.events',
        partition: 0,
        key: 'payment-1',
        value: JSON.stringify(buildEnvelope()),
      }),
    ).resolves.toBeUndefined();
  });

  it('ignores messages with an unrecognized eventType instead of erroring', async () => {
    await consumer.handleMessage({
      topic: 'erp.payment.events',
      partition: 0,
      key: 'payment-1',
      value: JSON.stringify(
        buildEnvelope({ eventType: 'payment.something-else' }),
      ),
    });

    expect(notificationsService.createPending).not.toHaveBeenCalled();
  });

  it('ignores unparseable message values instead of throwing', async () => {
    await expect(
      consumer.handleMessage({
        topic: 'erp.payment.events',
        partition: 0,
        key: 'payment-1',
        value: 'not json{{{',
      }),
    ).resolves.toBeUndefined();
  });

  it('ignores messages with a null value instead of throwing', async () => {
    await expect(
      consumer.handleMessage({
        topic: 'erp.payment.events',
        partition: 0,
        key: 'payment-1',
        value: null,
      }),
    ).resolves.toBeUndefined();
  });
});
