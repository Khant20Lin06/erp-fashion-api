import {
  WebhookDispatchConsumer,
  WEBHOOK_DISPATCH_CONSUMER_NAME,
} from './webhook-dispatch.consumer';
import { PAYMENT_CONFIRMED_EVENT_TYPE } from '../../payments/events/payment-confirmed.event';
import { PaymentDirection } from '../../payments/entities/payment-direction.enum';
import type { EventEnvelope } from '../../outbox/interfaces/event-envelope.interface';
import { QueueNames } from '../../queue/queue-names';
import { WebhookDelivery } from '../entities/webhook-delivery.entity';

describe('WebhookDispatchConsumer', () => {
  let consumer: WebhookDispatchConsumer;
  let processedEventRepository: { findOne: jest.Mock; insert: jest.Mock };
  let deliveryRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    findOneOrFail: jest.Mock;
  };
  let dataSource: { getRepository: jest.Mock };
  let kafkaConsumerService: { run: jest.Mock };
  let webhookSubscriptionsService: { findActiveForEvent: jest.Mock };
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

  const buildSubscription = (id: string) => ({
    id,
    companyId: 'company-1',
    url: 'https://example.com/hook',
    isActive: true,
  });

  beforeEach(() => {
    processedEventRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      insert: jest.fn().mockResolvedValue(undefined),
    };
    deliveryRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data: unknown) => data),
      save: jest.fn((data: unknown) =>
        Promise.resolve({ id: 'delivery-1', ...(data as object) }),
      ),
      findOneOrFail: jest.fn(),
    };
    dataSource = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === WebhookDelivery) return deliveryRepository;
        return processedEventRepository;
      }),
    };
    kafkaConsumerService = { run: jest.fn().mockResolvedValue(undefined) };
    webhookSubscriptionsService = {
      findActiveForEvent: jest.fn().mockResolvedValue([]),
    };
    queueService = { enqueue: jest.fn().mockResolvedValue(undefined) };

    consumer = new WebhookDispatchConsumer(
      kafkaConsumerService as never,
      dataSource as never,
      webhookSubscriptionsService as never,
      queueService as never,
    );
  });

  it('uses a fixed consumer group name, separate from notification/payment-audit consumers', () => {
    expect(WEBHOOK_DISPATCH_CONSUMER_NAME).toBe(
      'erp-webhook-dispatch-consumer',
    );
  });

  it("resolves subscriptions using the envelope's own companyId — never a client-supplied value", async () => {
    await consumer.handleMessage({
      topic: 'erp.payment.events',
      partition: 0,
      key: 'payment-1',
      value: JSON.stringify(buildEnvelope({ companyId: 'company-xyz' })),
    });

    expect(webhookSubscriptionsService.findActiveForEvent).toHaveBeenCalledWith(
      'company-xyz',
      PAYMENT_CONFIRMED_EVENT_TYPE,
    );
  });

  it('creates one WebhookDelivery and enqueues one job per matching active subscription', async () => {
    webhookSubscriptionsService.findActiveForEvent.mockResolvedValue([
      buildSubscription('wh-1'),
      buildSubscription('wh-2'),
    ]);

    await consumer.handleMessage({
      topic: 'erp.payment.events',
      partition: 0,
      key: 'payment-1',
      value: JSON.stringify(buildEnvelope()),
    });

    expect(deliveryRepository.save).toHaveBeenCalledTimes(2);
    expect(queueService.enqueue).toHaveBeenCalledTimes(2);
    expect(queueService.enqueue).toHaveBeenCalledWith(
      QueueNames.WEBHOOK_DELIVERY,
      expect.any(String),
      expect.objectContaining({ webhookDeliveryId: 'delivery-1' }),
      expect.any(Object),
    );
  });

  it('enqueues with a deterministic jobId derived from the delivery id', async () => {
    webhookSubscriptionsService.findActiveForEvent.mockResolvedValue([
      buildSubscription('wh-1'),
    ]);

    await consumer.handleMessage({
      topic: 'erp.payment.events',
      partition: 0,
      key: 'payment-1',
      value: JSON.stringify(buildEnvelope()),
    });

    const call = queueService.enqueue.mock.calls[0] as [
      string,
      string,
      unknown,
      { jobId: string },
    ];
    expect(call[3].jobId).toBe('webhook-delivery-delivery-1');
  });

  it('is idempotent: an already-existing WebhookDelivery for this (subscription, event) is reused, not duplicated', async () => {
    webhookSubscriptionsService.findActiveForEvent.mockResolvedValue([
      buildSubscription('wh-1'),
    ]);
    deliveryRepository.findOne.mockResolvedValue({ id: 'existing-delivery' });

    await consumer.handleMessage({
      topic: 'erp.payment.events',
      partition: 0,
      key: 'payment-1',
      value: JSON.stringify(buildEnvelope()),
    });

    expect(deliveryRepository.save).not.toHaveBeenCalled();
    expect(queueService.enqueue).toHaveBeenCalledWith(
      QueueNames.WEBHOOK_DELIVERY,
      expect.any(String),
      expect.objectContaining({ webhookDeliveryId: 'existing-delivery' }),
      expect.any(Object),
    );
  });

  it('no-ops (no subscription lookup) when already processed by this consumer', async () => {
    processedEventRepository.findOne.mockResolvedValue({
      id: 'existing-row',
      eventId: 'event-abc',
      consumerName: WEBHOOK_DISPATCH_CONSUMER_NAME,
    });

    await consumer.handleMessage({
      topic: 'erp.payment.events',
      partition: 0,
      key: 'payment-1',
      value: JSON.stringify(buildEnvelope()),
    });

    expect(
      webhookSubscriptionsService.findActiveForEvent,
    ).not.toHaveBeenCalled();
  });

  it('ignores an unsupported/unrecognized eventType instead of erroring', async () => {
    await consumer.handleMessage({
      topic: 'erp.payment.events',
      partition: 0,
      key: 'payment-1',
      value: JSON.stringify(
        buildEnvelope({ eventType: 'payment.something-else' }),
      ),
    });

    expect(
      webhookSubscriptionsService.findActiveForEvent,
    ).not.toHaveBeenCalled();
  });

  it('does NOT record processed_events when enqueue fails — Kafka redelivers', async () => {
    webhookSubscriptionsService.findActiveForEvent.mockResolvedValue([
      buildSubscription('wh-1'),
    ]);
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

  it('ignores unparseable/null message values instead of throwing', async () => {
    await expect(
      consumer.handleMessage({
        topic: 'erp.payment.events',
        partition: 0,
        key: 'payment-1',
        value: 'not json{{{',
      }),
    ).resolves.toBeUndefined();

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
