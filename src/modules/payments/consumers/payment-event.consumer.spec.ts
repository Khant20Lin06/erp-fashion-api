import {
  PaymentEventConsumer,
  PAYMENT_AUDIT_CONSUMER_NAME,
} from './payment-event.consumer';
import { PAYMENT_CONFIRMED_EVENT_TYPE } from '../events/payment-confirmed.event';
import type { EventEnvelope } from '../../outbox/interfaces/event-envelope.interface';

describe('PaymentEventConsumer', () => {
  let consumer: PaymentEventConsumer;
  let repository: { findOne: jest.Mock; insert: jest.Mock };
  let dataSource: { getRepository: jest.Mock };
  let kafkaConsumerService: { run: jest.Mock };
  let configService: { get: jest.Mock };

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
    payload: { paymentId: 'payment-1' },
    ...overrides,
  });

  beforeEach(() => {
    repository = {
      findOne: jest.fn().mockResolvedValue(null),
      insert: jest.fn().mockResolvedValue(undefined),
    };
    dataSource = { getRepository: jest.fn().mockReturnValue(repository) };
    kafkaConsumerService = { run: jest.fn().mockResolvedValue(undefined) };
    configService = {
      get: jest.fn().mockReturnValue({
        brokers: ['localhost:9094'],
        clientId: 'fashion-erp-api',
        groupId: PAYMENT_AUDIT_CONSUMER_NAME,
      }),
    };

    consumer = new PaymentEventConsumer(
      kafkaConsumerService as never,
      dataSource as never,
      configService as never,
    );
  });

  it('uses a fixed, meaningful consumer group name, not a random/per-process id', () => {
    expect(PAYMENT_AUDIT_CONSUMER_NAME).toBe('erp-payment-audit-consumer');
  });

  it('checks processed_events BEFORE performing the side effect, then inserts a processed_events row', async () => {
    const callOrder: string[] = [];
    repository.findOne.mockImplementation(() => {
      callOrder.push('findOne');
      return Promise.resolve(null);
    });
    repository.insert.mockImplementation(() => {
      callOrder.push('insert');
      return Promise.resolve(undefined);
    });

    const envelope = buildEnvelope();
    await consumer.handleMessage({
      topic: 'erp.payment.events',
      partition: 0,
      key: 'payment-1',
      value: JSON.stringify(envelope),
    });

    expect(callOrder).toEqual(['findOne', 'insert']);
    expect(repository.findOne).toHaveBeenCalledWith({
      where: {
        eventId: 'event-abc',
        consumerName: PAYMENT_AUDIT_CONSUMER_NAME,
      },
    });
    expect(repository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'event-abc',
        consumerName: PAYMENT_AUDIT_CONSUMER_NAME,
      }),
    );
  });

  it('no-ops (does not insert again) when processed_events already has a row for this event+consumer', async () => {
    repository.findOne.mockResolvedValue({
      id: 'existing-row',
      eventId: 'event-abc',
      consumerName: PAYMENT_AUDIT_CONSUMER_NAME,
    });

    await consumer.handleMessage({
      topic: 'erp.payment.events',
      partition: 0,
      key: 'payment-1',
      value: JSON.stringify(buildEnvelope()),
    });

    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('redelivering the same event a second time results in exactly one processed_events insert attempt succeeding logically (idempotent overall)', async () => {
    // First delivery: not yet processed.
    repository.findOne.mockResolvedValueOnce(null);
    await consumer.handleMessage({
      topic: 'erp.payment.events',
      partition: 0,
      key: 'payment-1',
      value: JSON.stringify(buildEnvelope()),
    });
    expect(repository.insert).toHaveBeenCalledTimes(1);

    // Second (redelivered) message for the SAME eventId: now found.
    repository.findOne.mockResolvedValueOnce({
      id: 'existing-row',
      eventId: 'event-abc',
      consumerName: PAYMENT_AUDIT_CONSUMER_NAME,
    });
    await consumer.handleMessage({
      topic: 'erp.payment.events',
      partition: 0,
      key: 'payment-1',
      value: JSON.stringify(buildEnvelope()),
    });

    // insert() was still only ever called once across both deliveries.
    expect(repository.insert).toHaveBeenCalledTimes(1);
  });

  it('treats a duplicate-key race on insert as already-processed rather than throwing', async () => {
    repository.findOne.mockResolvedValue(null);
    const duplicateError = Object.assign(new Error('Duplicate entry'), {
      code: 'ER_DUP_ENTRY',
      errno: 1062,
    });
    repository.insert.mockRejectedValue(duplicateError);

    await expect(
      consumer.handleMessage({
        topic: 'erp.payment.events',
        partition: 0,
        key: 'payment-1',
        value: JSON.stringify(buildEnvelope()),
      }),
    ).resolves.toBeUndefined();
  });

  it('re-throws a non-duplicate-key error from the insert (a genuine infra failure should block offset commit)', async () => {
    repository.findOne.mockResolvedValue(null);
    repository.insert.mockRejectedValue(new Error('connection lost'));

    await expect(
      consumer.handleMessage({
        topic: 'erp.payment.events',
        partition: 0,
        key: 'payment-1',
        value: JSON.stringify(buildEnvelope()),
      }),
    ).rejects.toThrow('connection lost');
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

    expect(repository.findOne).not.toHaveBeenCalled();
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
