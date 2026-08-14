/**
 * Lifecycle of an OutboxEvent row (Phase 18, D-locked design — see
 * docs/EVENT_ARCHITECTURE.md "Transactional Outbox"). Three states only —
 * no separate PROCESSING/CLAIMED state, because OutboxPublisher claims a
 * batch inside a short transaction that commits immediately (SELECT ... FOR
 * UPDATE SKIP LOCKED, then release), rather than holding a long-lived lock
 * while the Kafka network call is in flight. FAILED is NOT a terminal/
 * abandoned state — it means "the most recent publish attempt failed" and
 * the row remains eligible for another attempt once `available_at` (backoff)
 * elapses. There is no dead-letter/exhausted state in this phase's scope;
 * retries continue indefinitely at the capped backoff interval (see
 * OutboxPublisher's backoff calculation).
 */
export enum OutboxEventStatus {
  Pending = 'PENDING',
  Published = 'PUBLISHED',
  Failed = 'FAILED',
}
