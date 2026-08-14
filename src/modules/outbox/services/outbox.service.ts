import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EntityManager } from 'typeorm';
import { OutboxEvent } from '../entities/outbox-event.entity';
import { OutboxEventStatus } from '../entities/outbox-event-status.enum';
import { CreateOutboxEventInput } from '../dto/create-outbox-event.input';
import {
  DEFAULT_EVENT_VERSION,
  EVENT_SOURCE,
} from '../interfaces/event-envelope.interface';

/**
 * Transactional Outbox writer (Phase 18, D2/D3 LOCKED — the single most
 * important safety property of this whole phase). `create()` NEVER calls
 * `dataSource.transaction()` or `TransactionService.run()` — it only ever
 * writes through the `EntityManager` it is handed by the caller, exactly
 * mirroring AccountingPostingService's contract (every method takes the
 * caller's EntityManager and never opens its own transaction). This is what
 * makes the outbox row durable-with-the-business-mutation: if the caller's
 * transaction (e.g. PaymentsService.create()'s TransactionService.run()
 * call) rolls back for any reason, this INSERT rolls back with it — there
 * is no way for an OutboxEvent row to exist without its accompanying
 * business mutation, and no way for the business mutation to commit without
 * the OutboxEvent row also committing.
 *
 * eventId/occurredAt/source/eventVersion are derived here rather than left
 * to each caller, so every event this service ever emits is shaped
 * identically (D7/D8/D10).
 */
@Injectable()
export class OutboxService {
  async create<TPayload extends Record<string, unknown>>(
    manager: EntityManager,
    event: CreateOutboxEventInput<TPayload>,
  ): Promise<OutboxEvent> {
    const now = new Date();
    const row = manager.create(OutboxEvent, {
      eventId: randomUUID(),
      eventType: event.eventType,
      eventVersion: event.eventVersion ?? DEFAULT_EVENT_VERSION,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      companyId: event.companyId,
      branchId: event.branchId,
      source: EVENT_SOURCE,
      correlationId: event.correlationId ?? null,
      causationId: event.causationId ?? null,
      occurredAt: now,
      payload: event.payload,
      status: OutboxEventStatus.Pending,
      attemptCount: 0,
      availableAt: now,
      publishedAt: null,
      lastError: null,
    });
    return manager.save(OutboxEvent, row);
  }
}
