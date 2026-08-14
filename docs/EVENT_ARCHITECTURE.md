# EVENT_ARCHITECTURE.md

Event / Transactional Outbox / Kafka infrastructure implemented in Phase 18
(`src/modules/outbox/`, `src/modules/kafka/`). Adds asynchronous,
at-least-once event delivery on top of the existing synchronous,
transactional domain — without changing how any existing domain module
works. The one wired, end-to-end integration this phase ships is
`payment.confirmed`, added as a single additive call inside
`PaymentsService.create()` (see §9). Phase 17's synchronous Accounting
posting (`docs/ACCOUNTING_ARCHITECTURE.md`) is explicitly preserved
unchanged (see §11).

## 1. Source Of Truth Ordering (D1)

```text
business tables (Payment, Sale, PurchaseOrder, ...)
        |
        v
JournalEntry / JournalEntryLine   <- the sole accounting source of truth
        |
        v
OutboxEvent                        <- durable publish-intent record
        |
        v
Kafka                              <- transport only
        |
        v
consumers                          <- derived / integration behavior only
```

The relational database is authoritative at every step up to and including
`OutboxEvent`. Kafka is never the authoritative store for Payment, Sale,
PurchaseOrder, Accounting, Inventory, JournalEntry, or JournalEntryLine —
it moves already-committed facts, it does not hold facts of its own. A
consumer that lost all its Kafka history could, in principle, be
reconstructed by replaying `outbox_events` (this phase does not build that
replay tool, but the design does not preclude it).

## 2. The Transactional Outbox Guarantee (D2)

`OutboxService.create(manager, event)` writes an `OutboxEvent` row through
the **same `EntityManager`** as the business mutation it accompanies —
never through `TransactionService.run()` or `DataSource.transaction()`
itself. This mirrors `AccountingPostingService`'s own contract exactly
(every method takes the caller's `EntityManager`, never opens its own
transaction). The proof, worked through scenario by scenario:

- **Rollback -> no event.** If the caller's transaction throws for any
  reason after `OutboxService.create()` has run (e.g.
  `AccountingPostingService.postPayment()` fails a GL-mapping check that
  runs *before* the outbox call, or any later code in the same callback
  throws), the whole transaction rolls back, including the `INSERT` into
  `outbox_events` — there is no code path that leaves an `OutboxEvent` row
  behind without its business mutation.
- **Commit -> event exists.** If the transaction commits, the `OutboxEvent`
  row commits atomically with it — same statement batch, same commit point.
- **Publisher-crash -> event remains pending.** `OutboxPublisherService`
  claims a batch, then publishes to Kafka, then records the outcome as
  three logically separate steps (§4). If the process crashes between claim
  and publish, or between publish and recording the outcome, the row is
  simply left in `PENDING`/`FAILED` with an `available_at` that has already
  elapsed — the next tick (by this instance after restart, or any other
  running instance) claims it again. No event is lost.
- **Kafka-down -> event remains pending, business transaction unaffected.**
  The business transaction (e.g. `PaymentsService.create()`) never touches
  Kafka — it only writes a DB row. If Kafka is completely unreachable, the
  Payment/JournalEntry/OutboxEvent rows all still commit normally; only the
  *publish* step later fails, which the publisher records as a `FAILED`
  attempt with a backoff-advanced `available_at` (§5) and retries. The
  business operation the end user is waiting on never observes Kafka's
  state at all.
- **Kafka-publish-succeeds-but-DB-update-fails -> possible duplicate.** If
  `KafkaProducerService.publish()` succeeds but the subsequent `UPDATE
  outbox_events SET status = 'PUBLISHED', ...` fails or the process crashes
  in between, the row is still `PENDING`/`FAILED` and will be picked up and
  re-published on the next tick — the same event is now on the topic twice.
  This is the precise mechanism behind the at-least-once guarantee (§6), and
  it is exactly why every consumer must be idempotent (§8) rather than
  assuming single delivery.

## 3. Event Envelope (D8)

Every event this system emits — as an `outbox_events` row and, unchanged,
as the Kafka message body — has this shape:

```jsonc
{
  "eventId": "b3e1...uuid",       // stable identity, unchanged Outbox -> Kafka -> consumer
  "eventType": "payment.confirmed",
  "eventVersion": 1,
  "occurredAt": "2026-08-13T09:12:41.000Z",
  "aggregateType": "Payment",
  "aggregateId": "b7a2...uuid",   // = the Kafka partition key
  "companyId": "3f9c...uuid",
  "branchId": null,
  "source": "fashion-erp-api",
  "correlationId": "a1b2c3...",   // nullable
  "causationId": null,             // nullable
  "payload": { /* event-type-specific body */ }
}
```

`id` (the `outbox_events` row's own primary key) is deliberately **not**
part of the envelope — `eventId` is the wire identity (D7), generated once
by `OutboxService.create()` at insert time and carried unchanged through
every hop. `id` only ever appears in this codebase's own DB queries.

Defined in `src/modules/outbox/interfaces/event-envelope.interface.ts`
(`EventEnvelope<TPayload>`), reconstructed for publishing by
`OutboxEvent.toEnvelope()` and consumed as the same type by
`PaymentEventConsumer` — one shared type, never duplicated between producer
and consumer.

### correlationId / causationId

`correlationId` is populated from `RequestContextService.getRequestId()`
(`src/core/context/request-context.service.ts`) when the emitting call
happens inside an HTTP request — reusing the existing `X-Request-Id`
infrastructure (`RequestIdMiddleware` + `RequestContextMiddleware`, both
already wired in `AppModule`) rather than inventing a parallel mechanism.
`causationId` is reserved for a future "event that caused this event"
chain; no consumer in this phase re-emits events, so it is always `null`
today. Both are nullable at the type level for callers that have no request
context available (e.g. a future batch job).

## 4. Transactional Outbox: Table & Publisher

### `outbox_events`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | row identity |
| `event_id` | UUID, UNIQUE | envelope identity (D7) |
| `event_type` | varchar(150) | e.g. `payment.confirmed` |
| `event_version` | int, default 1 | D10 |
| `aggregate_type` | varchar(100) | e.g. `Payment` |
| `aggregate_id` | char(36), no FK | polymorphic — see §4.1 |
| `company_id` | char(36), FK -> companies | |
| `branch_id` | char(36), nullable, FK -> branches | |
| `source` | varchar(100) | always `fashion-erp-api` |
| `correlation_id` / `causation_id` | varchar(100), nullable | |
| `occurred_at` | timestamp | |
| `payload` | **JSON** | first JSON column in this schema |
| `status` | enum `PENDING/PUBLISHED/FAILED` | §4.2 |
| `attempt_count` | int, default 0 | |
| `available_at` | timestamp | next-eligible-dispatch time |
| `published_at` | timestamp, nullable | |
| `last_error` | varchar(1000), nullable | sanitized, §5 |
| `created_at` / `updated_at` | timestamp | |

Indexes: `UNIQUE(event_id)`, `(status, available_at)` (the publisher's claim
query), `(company_id, occurred_at)`, plus single-column `(company_id)` and
`(status)` (TypeORM `@Index()` on those columns individually, generated
alongside the composite indexes). No `(aggregate_type, aggregate_id)` index
— no query in this phase looks events up by aggregate, so one was not
speculatively added.

No `deleted_at` — `outbox_events` is an append-only log, matching
`StockMovement`/`JournalEntryLine` precedent (no soft-delete on an
immutable audit-style table anywhere in this codebase).

#### 4.1 Why `aggregate_id` has no FK

`aggregate_id` points to a different table depending on `aggregate_type`
(today, always `Payment` -> `payments.id`; a future `Sale`/`PurchaseOrder`
event would point elsewhere). A single FK column cannot express that — this
is the same polymorphic-pointer pattern already established by
`StockMovement.reference_id`, `PaymentAllocation.reference_id`, and
`JournalEntryLine.reference_id`.

#### 4.2 Status Lifecycle

```text
        create()                 publish success
PENDING ────────────► (claimed) ─────────────────► PUBLISHED
                          │
                          │ publish failure
                          ▼
                        FAILED ──── available_at elapses ────► (claimed again)
```

Three states only — no separate `PROCESSING`/`CLAIMED` state. The
publisher's claim step (`SELECT ... FOR UPDATE SKIP LOCKED`) and the
Kafka publish happen in two different short-lived phases (§4.3); the row's
`status` column is never used to represent "currently being published by
some instance" because the claim transaction commits (releasing all locks)
before the Kafka call ever starts. `FAILED` is **not** a terminal/abandoned
state — it means "the most recently attempted publish failed" and the row
remains eligible for another attempt once `available_at` elapses. There is
no dead-letter/exhausted terminal state in this phase's scope: retries
continue indefinitely, at the capped backoff interval, forever (see §5 for
exactly what happens at the cap). Building a DLQ or an "abandoned events"
admin UI is explicitly out of scope for Phase 18.

#### 4.3 OutboxPublisherService — Three Phases, Never Overlapping

`src/modules/outbox/services/outbox-publisher.service.ts`, driven by a
`setInterval` registered through `@nestjs/schedule`'s `SchedulerRegistry`
(interval length from `OUTBOX_POLL_INTERVAL_MS`, default 5000ms). Each tick:

1. **Short claim transaction.** `manager.createQueryBuilder(OutboxEvent, ...)
   .where('status IN (:...)', [PENDING, FAILED]).andWhere('availableAt <=
   NOW()').orderBy('availableAt', 'ASC').limit(batchSize)
   .setLock('pessimistic_write').setOnLocked('skip_locked').getMany()`,
   wrapped in `dataSource.transaction(...)`. TypeORM's MySQL driver emits
   this as `SELECT ... FOR UPDATE SKIP LOCKED` (confirmed directly against
   `node_modules/typeorm/query-builder/SelectQueryBuilder.js`, which special-
   cases `onLocked === 'skip_locked'` for MySQL-family drivers). The
   transaction commits immediately, releasing the row locks — it is **not**
   held open across the Kafka network call.
2. **Outside any DB transaction:** each claimed row is published to Kafka —
   topic resolved from `event_type` (`outbox-topic-resolver.ts`), key =
   `aggregate_id`, value = `JSON.stringify(event.toEnvelope())`.
3. **Per-event short update:** on success, `status = PUBLISHED,
   published_at = now()`; on failure, `attempt_count += 1`, `last_error` =
   sanitized message, `available_at` advanced by the backoff formula (§5),
   `status = FAILED`.

Safe for multiple concurrent publisher instances: `SKIP LOCKED` is the sole
safety mechanism, proven by a real `Promise.all()` concurrency test (two
claim attempts fired genuinely concurrently against the same pending rows,
asserting no row is claimed twice — see
`src/modules/outbox/services/outbox-publisher.concurrency.spec.ts`... /
integration test, §12).

## 5. Retry / Backoff

`src/modules/outbox/utils/backoff.ts`:

```text
computeBackoffMs(attemptCount) = min(1000 * 2^(attemptCount - 1), 300000)
```

1s, 2s, 4s, 8s, 16s, 32s, 64s, 128s, 256s, then capped at 300s (5 minutes)
forever. There is no dead/exhausted terminal state (§4.2) — once the cap is
reached, the row keeps retrying every 5 minutes indefinitely rather than
ever being marked permanently abandoned. Operators who need to know about a
long-failing row today would query `outbox_events WHERE status = 'FAILED'
AND attempt_count > N` directly; no admin endpoint for this is built in
this phase (explicitly optional/skipped — see §13).

`sanitizeErrorMessage()` is applied to every `last_error` write: it
redacts `user:pass@host` URL credentials, `Authorization:`/`Bearer` header
values, and `password=`/`secret=`/`token=`/`api_key=`-shaped key-value
pairs before truncating to 1000 characters (matching the column width).
`last_error` must never contain anything secret-shaped — this is asserted
directly in `src/modules/outbox/utils/backoff.spec.ts`.

## 6. Delivery Guarantee: At-Least-Once, Explicitly Not Exactly-Once (D6)

This system delivers every event **at least once** — never exactly-once,
and this is never claimed anywhere in code or docs. The specific mechanisms
that can cause duplicate delivery are enumerated in §2's "Kafka-publish-
succeeds-but-DB-update-fails" scenario and in normal Kafka consumer-group
behavior (redelivery after a crash before offset commit, or during a
rebalance). Because duplicate delivery is a normal, expected occurrence —
not a rare edge case — every consumer is required to be idempotent (§8).

## 7. Event Naming & Versioning (D9 / D10)

Dot notation, domain-meaningful: `payment.confirmed`. `eventVersion` is a
**separate integer column/field**, starting at 1 — never embedded in the
`eventType` string (so `payment.confirmed` stays `payment.confirmed`
forever; a breaking payload change ships as `eventVersion: 2` on the same
`eventType`, and a consumer that only understands v1 can detect and skip
or reject v2 explicitly rather than silently misinterpreting a new shape).

Only one event type exists in this phase: `payment.confirmed`
(`src/modules/payments/events/payment-confirmed.event.ts`).
`sale.confirmed`, `purchase_order.confirmed`,
`inventory.stock_movement.created`, and `journal_entry.posted` were all
considered and deliberately **not** built — see §10 for why.

## 8. Consumer Idempotency (D6)

`processed_events` (`src/modules/outbox/entities/processed-event.entity.ts`):

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `event_id` | varchar(36) | the envelope's `eventId`, as received |
| `consumer_name` | varchar(150) | fixed per consumer, e.g. `erp-payment-audit-consumer` |
| `processed_at` | timestamp | |
| `created_at` | timestamp | |

`UNIQUE(event_id, consumer_name)`. A given event may legitimately be
processed once **per distinct consumer** (a future second consumer of
`payment.confirmed` processes it once too, independently), but never twice
by the same consumer.

`PaymentEventConsumer.processIdempotently()`
(`src/modules/payments/consumers/payment-event.consumer.ts`) implements the
required order exactly:

```text
1. SELECT ... WHERE event_id = ? AND consumer_name = ?
2. if found: no-op, return (duplicate delivery)
3. else: perform the side effect (structured audit log line)
4. INSERT INTO processed_events (event_id, consumer_name, processed_at)
5. if the INSERT hits the UNIQUE constraint (a concurrent redelivery won
   the race): treat as already-processed, not an error
```

This is a durable, DB-table-backed check — never an in-memory `Set`, which
would not survive a process restart and would not be shared across
multiple running instances of the consumer.

## 9. Payment Integration — The One Mandatory Cross-Phase Change

`PaymentsService.create()` (`src/modules/payments/services/payments.service.ts`)
already ends its transaction with, in order: Payment + PaymentAllocation
rows created -> `AccountingPostingService.postPayment(...)` (Phase 17,
synchronous, same transaction) -> `return savedPayment`. Phase 18 adds
**exactly one call**, immediately after `postPayment()` and still before
the `return`:

```ts
await this.outboxService.create(manager, {
  eventType: PAYMENT_CONFIRMED_EVENT_TYPE,       // 'payment.confirmed'
  eventVersion: PAYMENT_CONFIRMED_EVENT_VERSION, // 1
  aggregateType: PAYMENT_AGGREGATE_TYPE,         // 'Payment'
  aggregateId: savedPayment.id,
  companyId: savedPayment.companyId,
  branchId: savedPayment.branchId,
  correlationId: this.requestContextService.getRequestId() ?? null,
  causationId: null,
  payload: paymentConfirmedPayload,
});
```

`paymentConfirmedPayload` is built from local variables already in scope
(`savedPayment`, `savedPayment.allocations`) — no redundant re-query.
Nothing else in `payments.service.ts` changed: idempotency handling, lock
ordering, and the post-transaction duplicate-key catch block are byte-for-
byte what Phase 16 established.

### `PaymentConfirmedEventPayload`

```ts
interface PaymentConfirmedEventPayload {
  paymentId: string;
  paymentNumber: string;
  direction: PaymentDirection;
  amount: string;
  currency: string;
  paymentMethodId: string;
  customerId: string | null;
  supplierId: string | null;
  paymentDate: string;      // ISO 8601
  allocationIds: string[];
}
```

Deliberately not a raw entity dump — no `idempotencyKey`, no
`createdBy`/`updatedBy` audit columns, no internal timestamps beyond
`paymentDate`. This is asserted directly by a unit test
(`payment-confirmed.event.spec.ts`) that constructs the payload and checks
excluded fields are genuinely absent.

## 10. Why Sale / PurchaseOrder / Inventory Were Not Touched

Per the locked scope for this phase: emit an event only where a real,
already-existing state transition exists **and** there is a safe, additive
insertion point, and default to Payment-only unless wiring another domain's
event is trivially safe. `SalesService`, `PurchaseOrdersService`, and the
Inventory services were **not modified** in this phase — no
`sale.confirmed`, `purchase_order.confirmed`, or
`inventory.stock_movement.created` event exists. Reasoning:

- Prior-phase analysis found zero real consumers for anything beyond
  Payment today — building producer infrastructure with no consumer is this
  codebase's own established anti-pattern (orphan infrastructure).
- Adding an outbox write to `SalesService`/`PurchaseOrdersService` would
  mean touching two more already-complex, already-tested transactional
  methods (`SalesService.applyPayment()`/`create()`,
  `PurchaseOrdersService.applyPayment()`/`create()`) purely speculatively,
  widening this phase's blast radius across Phase 12/13/14 code that has no
  functional need to change.
- Payment was explicitly named the mandatory, rock-solid path or none of
  the others were worth doing. Shipping one fully-tested event end-to-end
  is a stronger deliverable than five half-wired ones.

If a future phase needs `sale.confirmed`, the pattern is already proven:
inject `OutboxService`, call `outboxService.create(manager, event)` as the
last statement before a transaction's `return`, add one line to
`outbox-topic-resolver.ts`, and define the payload type next to
`SalesService` the same way `payment-confirmed.event.ts` lives next to
`PaymentsService`.

## 11. Kafka Is Not A Replacement For The Database Transaction

Every write that must be durable, consistent, and immediately visible to
the rest of this system — Payment, PaymentAllocation, Sale/PurchaseOrder
balance updates, JournalEntry/JournalEntryLine — happens exclusively inside
a MySQL transaction via `TransactionService.run()`, exactly as it did
before this phase. Kafka never participates in that transaction, is never
awaited before the transaction commits, and is never a condition for the
transaction's success. Concretely:

- `OutboxService.create()` only ever writes through the caller's
  `EntityManager` — it has no `DataSource` dependency and cannot open a
  transaction even by accident.
- `KafkaProducerService`/`KafkaConsumerService` are never injected into any
  domain service (`PaymentsService`, `SalesService`,
  `PurchaseOrdersService`, `AccountingPostingService`) — only
  `OutboxPublisherService`, `PaymentEventConsumer`, and `HealthController`
  reference them.
- The Kafka health check (`GET /health`) reports Kafka connectivity as an
  informational `kafka: 'up' | 'down'` field; the endpoint's overall
  `status` is always `'ok'` regardless, and no business endpoint anywhere
  checks Kafka's health before proceeding.
- No 2PC, no distributed transaction coordinator, no "publish inside the
  transaction" pattern exists anywhere in this codebase. This was
  considered and explicitly rejected: publishing before commit risks a
  consumer observing an event for a mutation that later rolls back; the
  transactional outbox (publish strictly after commit, via a separate
  process) is the only pattern used.

## 12. Why Phase 17's Synchronous Accounting Posting Is Preserved Unchanged

`AccountingPostingService.postPayment()` remains exactly what Phase 17
built: synchronous, invoked directly by `PaymentsService.create()` inside
the same transaction as the Payment/PaymentAllocation rows, with its own
fail-closed account-mapping validation and its own duplicate-source race
backstop. Phase 18 does not touch this file. Reasons this boundary is
non-negotiable, not merely convenient:

- **Correctness requires synchronicity here.** A Payment that cannot be
  posted to the General Ledger (e.g. a missing/inactive GL account mapping)
  must never be allowed to exist as a "confirmed" Payment at all — Phase 16/
  17's design is that Payment and its journal entry are created together or
  not at all. Routing this through Kafka would mean a Payment could commit
  successfully and *then* discover, asynchronously, that it cannot be
  posted — an inconsistent, partially-financial state this system has never
  allowed and Phase 18 does not introduce.
- **At-least-once delivery is wrong for ledger posting.** A Kafka consumer
  that posted journal entries would have to fully re-implement
  `AccountingPostingService`'s idempotency (the
  `UNIQUE(company_id, source_type, source_id)` backstop) as consumer-side
  idempotency, and would still only be *eventually* consistent — the
  General Ledger could legitimately lag behind Payment for an unbounded
  time while Kafka/the consumer catch up. No requirement of this phase
  called for that; it would be a strictly worse design for a system whose
  accounting correctness depends on GL entries existing atomically with
  their source Payment.
- **The locked spec forbids it explicitly.** No Kafka consumer in this
  codebase posts to `JournalEntry`/`JournalEntryLine`, and none is planned.
  `payment.confirmed` is purely additive telemetry about a Payment that has
  *already* been fully posted by the time the event is even written to
  `outbox_events` — the event is a downstream announcement of a completed,
  already-consistent fact, not a trigger for further financial mutation.

## 13. Explicitly Out Of Scope

Debezium, Kafka Connect, Schema Registry, Kafka Streams, CQRS, event
sourcing, distributed transactions/2PC, replacing TypeORM transactions with
Kafka, replacing `AccountingPostingService` with a Kafka consumer,
rebuilding Payment/Sale/Purchase around events, event-driven DB
replication, a separate event database, a workflow engine, Saga
orchestration, a distributed locking service, any exactly-once claim, a
dead-letter/exhausted-retry admin UI, and an operational read endpoint for
outbox pending/failed counts (considered, judged optional, skipped to keep
this phase's RBAC/API surface at zero new user-facing permissions).

## 14. Testing Notes

Real Docker MySQL (this repo's established discipline) plus a real, locally
running single-broker Kafka in KRaft mode
(`docker compose up -d kafka`, image `apache/kafka:3.9.0`) were used for
this phase's integration coverage — see the test suite's own report in the
Phase 18 final report for exactly which scenarios ran against the real
broker versus kafkajs's in-process test doubles, and why.
