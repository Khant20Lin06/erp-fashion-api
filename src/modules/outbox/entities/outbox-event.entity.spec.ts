import { OutboxEvent } from './outbox-event.entity';
import { OutboxEventStatus } from './outbox-event-status.enum';

describe('OutboxEvent.toEnvelope()', () => {
  const buildRow = (overrides: Partial<OutboxEvent> = {}): OutboxEvent => {
    const row = new OutboxEvent();
    Object.assign(row, {
      id: 'row-1',
      eventId: 'b3e1e6a0-1111-4b2f-9c3a-abcdef012345',
      eventType: 'payment.confirmed',
      eventVersion: 1,
      aggregateType: 'Payment',
      aggregateId: 'payment-1',
      companyId: 'company-1',
      branchId: null,
      source: 'fashion-erp-api',
      correlationId: 'req-1',
      causationId: null,
      occurredAt: new Date('2026-08-13T09:00:00.000Z'),
      payload: { paymentId: 'payment-1' },
      status: OutboxEventStatus.Pending,
      attemptCount: 0,
      availableAt: new Date('2026-08-13T09:00:00.000Z'),
      publishedAt: null,
      lastError: null,
      createdAt: new Date('2026-08-13T09:00:00.000Z'),
      updatedAt: new Date('2026-08-13T09:00:00.000Z'),
      ...overrides,
    });
    return row;
  };

  it('produces every envelope field from the row, with occurredAt as an ISO string', () => {
    const envelope = buildRow().toEnvelope();

    expect(envelope).toEqual({
      eventId: 'b3e1e6a0-1111-4b2f-9c3a-abcdef012345',
      eventType: 'payment.confirmed',
      eventVersion: 1,
      occurredAt: '2026-08-13T09:00:00.000Z',
      aggregateType: 'Payment',
      aggregateId: 'payment-1',
      companyId: 'company-1',
      branchId: null,
      source: 'fashion-erp-api',
      correlationId: 'req-1',
      causationId: null,
      payload: { paymentId: 'payment-1' },
    });
  });

  it('never includes the row´s own id (id != eventId) in the envelope', () => {
    const envelope = buildRow().toEnvelope();
    const serialized = JSON.stringify(envelope);

    expect(serialized).not.toContain('"row-1"');
    expect(envelope.eventId).not.toBe('row-1');
  });

  it('uses aggregateId as the field a Kafka producer would key on for partitioning', () => {
    const envelope = buildRow({ aggregateId: 'payment-xyz' }).toEnvelope();
    // The OutboxPublisher keys Kafka messages by event.aggregateId directly
    // (see outbox-publisher.service.ts); this asserts the envelope's own
    // aggregateId — the value that partition key is derived from — is
    // exactly the row's aggregateId, unmodified.
    expect(envelope.aggregateId).toBe('payment-xyz');
  });

  it('carries a null branchId/correlationId/causationId through as null, not undefined or omitted', () => {
    const envelope = buildRow({
      branchId: null,
      correlationId: null,
      causationId: null,
    }).toEnvelope();

    expect(envelope.branchId).toBeNull();
    expect(envelope.correlationId).toBeNull();
    expect(envelope.causationId).toBeNull();
    expect('branchId' in envelope).toBe(true);
  });
});
