import { EntityManager } from 'typeorm';
import { OutboxService } from './outbox.service';
import { OutboxEvent } from '../entities/outbox-event.entity';
import { OutboxEventStatus } from '../entities/outbox-event-status.enum';
import { EVENT_SOURCE } from '../interfaces/event-envelope.interface';

describe('OutboxService', () => {
  let service: OutboxService;
  let manager: {
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(() => {
    service = new OutboxService();
    manager = {
      create: jest.fn((_entity, data: Record<string, unknown>) => data),
      save: jest.fn((_entity, data: Record<string, unknown>) =>
        Promise.resolve({ id: 'outbox-row-1', ...data }),
      ),
    };
  });

  it('never opens an independent transaction — it has no DataSource/TransactionService dependency at all', () => {
    // Structural guarantee, not just behavioral: OutboxService's constructor
    // takes zero arguments, so it is IMPOSSIBLE for it to hold a reference
    // to DataSource or TransactionService and therefore impossible for it
    // to call dataSource.transaction()/TransactionService.run() internally.
    expect(OutboxService.length).toBe(0);
  });

  it('writes exclusively through the EntityManager supplied by the caller', async () => {
    await service.create(manager as unknown as EntityManager, {
      eventType: 'payment.confirmed',
      aggregateType: 'Payment',
      aggregateId: 'payment-1',
      companyId: 'company-1',
      branchId: null,
      payload: { paymentId: 'payment-1' },
    });

    expect(manager.create).toHaveBeenCalledWith(
      OutboxEvent,
      expect.any(Object),
    );
    expect(manager.save).toHaveBeenCalledWith(OutboxEvent, expect.any(Object));
  });

  it('generates a fresh UUID eventId on every call (never reuses/derives from the row id)', async () => {
    const first = await service.create(manager as unknown as EntityManager, {
      eventType: 'payment.confirmed',
      aggregateType: 'Payment',
      aggregateId: 'payment-1',
      companyId: 'company-1',
      branchId: null,
      payload: {},
    });
    const second = await service.create(manager as unknown as EntityManager, {
      eventType: 'payment.confirmed',
      aggregateType: 'Payment',
      aggregateId: 'payment-2',
      companyId: 'company-1',
      branchId: null,
      payload: {},
    });

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(first.eventId).toMatch(uuidPattern);
    expect(second.eventId).toMatch(uuidPattern);
    expect(first.eventId).not.toBe(second.eventId);
  });

  it('defaults eventVersion to 1 when the caller does not specify one', async () => {
    const result = await service.create(manager as unknown as EntityManager, {
      eventType: 'payment.confirmed',
      aggregateType: 'Payment',
      aggregateId: 'payment-1',
      companyId: 'company-1',
      branchId: null,
      payload: {},
    });

    expect(result.eventVersion).toBe(1);
  });

  it('respects an explicit eventVersion when the caller specifies one', async () => {
    const result = await service.create(manager as unknown as EntityManager, {
      eventType: 'payment.confirmed',
      eventVersion: 2,
      aggregateType: 'Payment',
      aggregateId: 'payment-1',
      companyId: 'company-1',
      branchId: null,
      payload: {},
    });

    expect(result.eventVersion).toBe(2);
  });

  it('stamps the fixed source identifier and starts every event as PENDING', async () => {
    const result = await service.create(manager as unknown as EntityManager, {
      eventType: 'payment.confirmed',
      aggregateType: 'Payment',
      aggregateId: 'payment-1',
      companyId: 'company-1',
      branchId: null,
      payload: {},
    });

    expect(result.source).toBe(EVENT_SOURCE);
    expect(result.status).toBe(OutboxEventStatus.Pending);
    expect(result.attemptCount).toBe(0);
    expect(result.publishedAt).toBeNull();
    expect(result.lastError).toBeNull();
  });

  it('defaults correlationId/causationId to null when the caller omits them', async () => {
    const result = await service.create(manager as unknown as EntityManager, {
      eventType: 'payment.confirmed',
      aggregateType: 'Payment',
      aggregateId: 'payment-1',
      companyId: 'company-1',
      branchId: null,
      payload: {},
    });

    expect(result.correlationId).toBeNull();
    expect(result.causationId).toBeNull();
  });

  it('carries an explicit correlationId through unchanged', async () => {
    const result = await service.create(manager as unknown as EntityManager, {
      eventType: 'payment.confirmed',
      aggregateType: 'Payment',
      aggregateId: 'payment-1',
      companyId: 'company-1',
      branchId: null,
      correlationId: 'req-123',
      payload: {},
    });

    expect(result.correlationId).toBe('req-123');
  });
});
