/**
 * The single event envelope shape every OutboxEvent/Kafka message uses
 * (Phase 18 D8, LOCKED). Producers (OutboxService.create() callers) supply
 * everything except `eventId`/`occurredAt`/`source`/`eventVersion` default,
 * which OutboxService itself fills in deterministically so every event this
 * service ever emits is shaped identically regardless of caller.
 *
 * Field notes:
 * - eventId: UUID, generated once at outbox-insert time, immutable from
 *   then on through Outbox -> Kafka -> consumer. This is the consumer-side
 *   idempotency key (processed_events.event_id), NOT the OutboxEvent row's
 *   own primary key `id` (D7).
 * - eventType: dot notation, domain-meaningful (D9) — e.g. "payment.confirmed".
 * - eventVersion: separate integer field, starts at 1 (D10) — never embedded
 *   in the eventType string.
 * - aggregateType/aggregateId: the domain entity this event is about, e.g.
 *   ("Payment", payment.id). aggregateId also doubles as the Kafka partition
 *   key so all events for one aggregate stay strictly ordered.
 * - companyId/branchId: tenancy scoping carried on every event so a consumer
 *   never has to join back to the source table just to know which company/
 *   branch an event belongs to.
 * - source: fixed string identifying the emitting service ("fashion-erp-api").
 * - correlationId/causationId: nullable. correlationId is populated from
 *   RequestContextService.getRequestId() when the emitting call happens
 *   inside an HTTP request (reusing the existing X-Request-Id
 *   infrastructure rather than inventing a parallel mechanism); causationId
 *   is reserved for a future "event that caused this event" chain and is
 *   null for every event this phase emits (no consumer yet re-emits events).
 * - payload: the domain-specific event body (e.g. PaymentConfirmedEventPayload).
 */
export interface EventEnvelope<TPayload = Record<string, unknown>> {
  eventId: string;
  eventType: string;
  eventVersion: number;
  occurredAt: string;
  aggregateType: string;
  aggregateId: string;
  companyId: string;
  branchId: string | null;
  source: string;
  correlationId: string | null;
  causationId: string | null;
  payload: TPayload;
}

/** Fixed source identifier stamped on every event this service emits (D8). */
export const EVENT_SOURCE = 'fashion-erp-api';

/** D10: eventVersion starts at 1 for every event type's first shape. */
export const DEFAULT_EVENT_VERSION = 1;
