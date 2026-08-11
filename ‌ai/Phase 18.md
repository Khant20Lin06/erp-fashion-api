# Phase 18 — Outbox Pattern

## Fashion ERP Backend

## Production-Ready Implementation Prompt

You are implementing **Phase 18 — Outbox Pattern** of the Fashion ERP Backend.

Tech Stack:

* NestJS
* TypeScript
* MySQL
* TypeORM
* Redis
* BullMQ
* Docker
* REST API
* Bruno API Testing

Frontend:

* GitHub: https://github.com/Khant20Lin06/Fashion-ERP
* Frontend: https://fashion-erp.vercel.app/

---

# 1. COMPLETED PHASES

The following phases are already completed:

```text
Phase 00 — AI Rules / Source of Truth
Phase 01 — Project Foundation
Phase 02 — Docker / Infrastructure
Phase 03 — Database Architecture
Phase 04 — Core / Shared Infrastructure
Phase 05 — Authentication
Phase 06 — Dynamic RBAC + Data Visibility
Phase 07 — Organization / Company / Branch / Warehouse
Phase 08 — User / Employee / Account Management
Phase 09 — Master Data
Phase 10 — Product / Variant / Pricing
Phase 11 — Customer / Supplier
Phase 12 — Sales
Phase 13 — Purchase
Phase 14 — Inventory
Phase 15 — Inventory Ledger
Phase 16 — Payment
Phase 17 — Accounting / Double Entry
```

Do NOT unnecessarily rewrite completed phases.

The existing repository is the primary source of truth.

---

# 2. PHASE 18 OBJECTIVE

Implement a production-ready:

```text
Transactional Outbox Pattern
```

for the Fashion ERP backend.

The main goal is to guarantee that:

```text
Business Transaction
+
Domain Event
```

are committed atomically in the same MySQL transaction.

The system must prevent this dangerous situation:

```text
Business DB transaction = SUCCESS
Event publishing       = FAILED
```

which would result in lost events.

The desired architecture is:

```text
Business Operation
        │
        ▼
MySQL Transaction
        │
        ├── Business Data
        │
        └── Outbox Event
        │
        ▼
      COMMIT
        │
        ▼
Outbox Publisher / Dispatcher
        │
        ▼
Redis / BullMQ
        │
        ▼
Workers / Consumers
        │
        ├── Notifications
        ├── Cache Invalidation
        ├── Reports
        ├── Integrations
        └── Other Async Tasks
```

---

# 3. CRITICAL RULE

The Outbox Pattern MUST NOT become the source of truth for business data.

The source of truth remains:

```text
MySQL Business Tables
+
Posted Accounting Journals
```

Outbox is the reliable bridge between:

```text
Database Transaction
        ↓
Asynchronous Event Processing
```

---

# 4. FIRST STEP — INSPECT BEFORE CODING

Before writing code, inspect the actual repository.

Review:

```text
Phase 03 — Database Architecture
Phase 04 — Core / Shared Infrastructure
Phase 05 — Authentication
Phase 06 — Dynamic RBAC + Data Visibility
Phase 07 — Organization / Company / Branch / Warehouse
Phase 08 — User / Employee / Account Management
Phase 09 — Master Data
Phase 10 — Product / Variant / Pricing
Phase 11 — Customer / Supplier
Phase 12 — Sales
Phase 13 — Purchase
Phase 14 — Inventory
Phase 15 — Inventory Ledger
Phase 16 — Payment
Phase 17 — Accounting
```

Inspect:

```text
entities
services
repositories
controllers
transactions
event modules
event emitters
domain events
application events
audit log
Redis
BullMQ
queues
workers
configuration
logging
database migrations
tests
```

Do NOT create duplicate infrastructure if equivalent functionality already exists.

---

# 5. CHECK EXISTING EVENT ARCHITECTURE

Search the repository for:

```text
EventEmitter
EventEmitter2
DomainEvent
DomainEvents
EventBus
ApplicationEvent
EventBusService
publish
emit
queue
BullMQ
Queue
Worker
Processor
Job
```

Determine whether the project already has:

```text
domain event infrastructure
```

or:

```text
application event infrastructure
```

If it exists, integrate with it.

Do not create a competing event architecture.

---

# 6. WHY OUTBOX IS REQUIRED

Without Outbox:

```text
BEGIN
  Create Sale
COMMIT

emit(SALE_CREATED)
      ↓
Redis down
      ↓
Event lost
```

With Outbox:

```text
BEGIN

Create Sale

Create Outbox Event

COMMIT
```

Then:

```text
Outbox Publisher
      ↓
Reads pending event
      ↓
Publishes to queue
      ↓
Marks event processed
```

The event cannot disappear simply because Redis/BullMQ is temporarily unavailable.

---

# 7. TRANSACTIONAL OUTBOX ARCHITECTURE

Use:

```text
Business Service
       │
       ▼
TypeORM Transaction
       │
       ├── Business Entity
       │
       └── Outbox Entity
       │
       ▼
     COMMIT
```

The business entity and outbox record MUST be created using the same:

```text
EntityManager / QueryRunner transaction
```

Do NOT:

```text
save business data
COMMIT
save outbox
```

as two independent transactions.

---

# 8. OUTBOX ENTITY

Create an Outbox entity appropriate to the existing architecture.

Conceptually:

```text
OutboxEvent
├── id
├── eventId
├── eventType
├── aggregateType
├── aggregateId
├── payload
├── metadata
├── status
├── occurredAt
├── availableAt
├── publishedAt
├── processedAt
├── retryCount
├── lastError
├── lockedAt
├── lockedBy
├── createdAt
└── updatedAt
```

Do not blindly copy this schema.

Adapt field names and conventions to the existing project.

---

# 9. EVENT ID

Every outbox event must have a unique:

```text
eventId
```

Prefer UUID/ULID according to existing project conventions.

Example:

```text
evt_01J...
```

or:

```text
UUID
```

The event ID is important for:

```text
idempotency
debugging
tracing
retry
deduplication
```

---

# 10. EVENT TYPE

Use explicit event types.

Examples:

```text
SALE_CREATED
SALE_CONFIRMED
SALE_CANCELLED
SALE_RETURNED

PURCHASE_CREATED
PURCHASE_CONFIRMED
PURCHASE_CANCELLED
PURCHASE_RETURNED

PAYMENT_CREATED
PAYMENT_CONFIRMED
PAYMENT_REFUNDED

INVENTORY_MOVEMENT_CREATED
INVENTORY_ADJUSTED

JOURNAL_POSTED
JOURNAL_REVERSED

CUSTOMER_CREATED
CUSTOMER_UPDATED

SUPPLIER_CREATED
SUPPLIER_UPDATED

USER_CREATED
USER_UPDATED

ACCOUNT_CREATED
ACCOUNT_DEACTIVATED
```

Use actual business events supported by the existing implementation.

Do not create meaningless CRUD events for every database update.

---

# 11. AGGREGATE TYPE

Every event should identify its aggregate.

Examples:

```text
SALE
PURCHASE
PAYMENT
INVENTORY
JOURNAL
CUSTOMER
SUPPLIER
USER
ACCOUNT
```

Example:

```text
eventType    = SALE_CONFIRMED
aggregateType = SALE
aggregateId  = saleId
```

---

# 12. EVENT PAYLOAD

The payload should contain the minimum information required by consumers.

Example:

```json
{
  "eventId": "uuid",
  "eventType": "SALE_CONFIRMED",
  "aggregateType": "SALE",
  "aggregateId": "sale-id",
  "companyId": "company-id",
  "branchId": "branch-id"
}
```

Do NOT blindly serialize the entire database entity.

Avoid putting:

```text
password
passwordHash
accessToken
refreshToken
sensitive PII
large binary data
```

into event payloads.

---

# 13. EVENT METADATA

Metadata may contain:

```text
correlationId
causationId
requestId
userId
employeeId
companyId
branchId
source
ip
userAgent
```

Only include fields appropriate to the project's privacy/security architecture.

---

# 14. CORRELATION ID

Support:

```text
correlationId
```

for tracing a business operation across:

```text
HTTP Request
        ↓
Service
        ↓
Database
        ↓
Outbox
        ↓
BullMQ
        ↓
Worker
```

This becomes very important in Phase 27 Observability.

---

# 15. CAUSATION ID

Where appropriate support:

```text
causationId
```

Example:

```text
SALE_CONFIRMED
       ↓
PAYMENT_CONFIRMED
       ↓
JOURNAL_POSTED
```

This allows event chains to be traced.

Do not overengineer if the current architecture does not require it.

---

# 16. OUTBOX STATUS

Use an explicit lifecycle.

Recommended:

```text
PENDING
PROCESSING
PUBLISHED
FAILED
DEAD
```

or a simpler state machine if appropriate.

Important:

```text
PENDING
   ↓
PROCESSING
   ↓
PUBLISHED
```

Failure:

```text
PROCESSING
   ↓
FAILED
   ↓
PENDING
```

After retry limit:

```text
FAILED
   ↓
DEAD
```

---

# 17. STATUS RULES

Never allow clients to directly change:

```text
status
retryCount
publishedAt
processedAt
lockedAt
lockedBy
lastError
```

These are server-controlled fields.

---

# 18. OUTBOX CREATION

Provide a reusable service.

Conceptually:

```text
OutboxService.create(...)
```

or:

```text
OutboxRepository.insert(...)
```

But it MUST support the current transaction manager.

Example:

```text
transactionManager.save(order)
transactionManager.save(outboxEvent)
```

Both must use the same transaction.

---

# 19. TRANSACTION CONTEXT

Do not write:

```text
businessRepository.save()
outboxRepository.save()
```

with unrelated connections if the operation must be atomic.

Instead:

```text
queryRunner.manager.save(businessEntity)
queryRunner.manager.save(outboxEvent)
```

or use the project's existing transactional abstraction.

---

# 20. TRANSACTION EXAMPLE

Example:

```text
BEGIN

Create Sale
Create Sale Items
Create Inventory Reservation
Create Accounting Draft/Posting where applicable
Create OutboxEvent(SALE_CONFIRMED)

COMMIT
```

If any step fails:

```text
ROLLBACK
```

including:

```text
Sale
Inventory
Accounting
Outbox
```

according to the transaction boundary.

---

# 21. OUTBOX MUST NOT PUBLISH INSIDE TRANSACTION

Do NOT do:

```text
BEGIN

save sale

publish Redis event

save outbox

COMMIT
```

This creates unnecessary coupling and failure complexity.

Correct:

```text
BEGIN

save sale
save outbox

COMMIT

publish asynchronously
```

---

# 22. PUBLISHER

Implement an Outbox Publisher/Dispatcher.

Responsibilities:

```text
find pending events
claim events
publish to BullMQ
update status
handle retry
```

Do not make controllers responsible for publishing outbox records.

---

# 23. PUBLISHER INTERVAL

Use a configurable polling mechanism.

Example:

```text
OUTBOX_POLL_INTERVAL_MS
```

Do not hard-code polling intervals.

Potential default:

```text
1000 ms
```

but choose based on the actual architecture.

---

# 24. BATCH PROCESSING

Do not fetch the entire outbox table.

Use batches.

Example concept:

```text
batchSize = 100
```

Make configurable:

```text
OUTBOX_BATCH_SIZE
```

Use pagination/keyset or another efficient strategy appropriate to MySQL.

---

# 25. EVENT CLAIMING

Multiple application instances may run simultaneously.

Example:

```text
API Instance A
API Instance B
Worker Instance C
```

They must not publish the same outbox event multiple times unnecessarily.

Implement safe event claiming using MySQL transaction/locking appropriate to the MySQL version.

Consider:

```text
SELECT ... FOR UPDATE SKIP LOCKED
```

if supported by the project's MySQL version and transaction design.

Otherwise implement another safe claim mechanism.

Do NOT assume a single application instance.

---

# 26. CONCURRENCY

Scenario:

```text
Instance A → Event #100
Instance B → Event #100
```

Expected:

```text
one owner claims the event
```

The other instance must skip it.

---

# 27. LOCK TIMEOUT

A processing lock must not remain forever.

Example:

```text
lockedAt = 10:00
worker crashes
```

At:

```text
10:05
```

the event should become reclaimable according to configurable timeout.

Use:

```text
OUTBOX_LOCK_TIMEOUT_SECONDS
```

Do not leave permanently stuck:

```text
PROCESSING
```

records.

---

# 28. BULLMQ INTEGRATION

Phase 20 will contain dedicated BullMQ workers.

Phase 18 should prepare the bridge:

```text
Outbox
   ↓
BullMQ
```

Do not put heavy worker business logic inside the Outbox Publisher.

Publisher responsibility:

```text
Outbox Event
      ↓
Queue Job
```

Worker responsibility:

```text
Queue Job
      ↓
Business Side Effect
```

---

# 29. QUEUE DESIGN

Use a consistent queue strategy.

Example:

```text
events
notifications
reports
integrations
```

or:

```text
erp-events
```

Follow existing project conventions.

Do not create dozens of queues without reason.

---

# 30. BULLMQ JOB DATA

A job should contain enough information to identify the event.

Prefer:

```json
{
  "eventId": "uuid"
}
```

rather than copying a huge payload into Redis.

The worker can retrieve the outbox event if needed.

If the event payload is required immediately, pass a compact immutable snapshot.

Choose based on reliability/performance requirements.

---

# 31. BULLMQ JOB ID

Use the outbox event ID as a deterministic job ID where compatible with the queue design.

Example:

```text
jobId = eventId
```

This provides an additional duplicate protection mechanism.

Do not rely on this alone for exactly-once processing.

---

# 32. IMPORTANT — AT-LEAST-ONCE DELIVERY

The Outbox architecture should assume:

```text
AT-LEAST-ONCE DELIVERY
```

not:

```text
EXACTLY-ONCE DELIVERY
```

This means consumers MUST be idempotent.

Example:

```text
Event E001
```

may be delivered twice:

```text
E001
E001
```

The final business result should still be correct.

---

# 33. IDEMPOTENCY

Every important consumer should support:

```text
eventId
```

based idempotency.

Possible approaches:

```text
processed_events table
```

or:

```text
unique(eventId, consumerName)
```

or an equivalent mechanism.

Choose the architecture that fits the project.

---

# 34. PROCESSED EVENT RECORD

If using a processed-events table:

```text
ProcessedEvent
├── id
├── eventId
├── consumer
├── processedAt
├── status
└── metadata
```

Unique constraint:

```text
(eventId, consumer)
```

Example:

```text
SALE_CONFIRMED
Consumer = notification-service
```

can be processed once.

Another consumer:

```text
SALE_CONFIRMED
Consumer = reporting-service
```

can independently process the same event.

---

# 35. DO NOT CLAIM EXACTLY ONCE

Never document the system as:

```text
exactly-once delivery
```

unless the actual architecture guarantees it.

Use:

```text
at-least-once delivery
+
idempotent consumers
```

---

# 36. RETRY

When publishing fails:

```text
retryCount += 1
```

and calculate the next retry time.

Use exponential backoff.

Example:

```text
1st retry → 1s
2nd       → 2s
3rd       → 4s
4th       → 8s
...
```

Do not hard-code blindly.

Make retry configuration environment-driven.

---

# 37. RETRY CONFIGURATION

Support:

```text
OUTBOX_MAX_RETRIES
OUTBOX_RETRY_DELAY_MS
OUTBOX_BACKOFF_TYPE
OUTBOX_LOCK_TIMEOUT_SECONDS
OUTBOX_BATCH_SIZE
OUTBOX_POLL_INTERVAL_MS
```

Use safe defaults.

Validate environment configuration at startup.

---

# 38. DEAD LETTER / DEAD EVENTS

After maximum retries:

```text
FAILED
    ↓
DEAD
```

Do not silently delete the event.

Keep the event for investigation.

Record:

```text
lastError
retryCount
failedAt
```

if appropriate.

---

# 39. DEAD EVENT REPROCESSING

Prepare an administrative mechanism for reprocessing dead events.

Potential:

```http
POST /internal/outbox/:id/retry
```

Do NOT expose this publicly without strong authentication and permission.

Potential permission:

```text
outbox.read
outbox.retry
outbox.replay
```

---

# 40. OUTBOX API

Outbox is primarily internal infrastructure.

Do NOT expose ordinary CRUD endpoints such as:

```text
POST /outbox
PATCH /outbox/:id
DELETE /outbox/:id
```

to normal users.

If APIs are needed, expose only controlled administrative operations.

---

# 41. OUTBOX CLEANUP

Do NOT immediately delete successfully processed events.

Outbox records are useful for:

```text
debugging
audit
replay
incident investigation
observability
```

Prepare a retention policy.

Example:

```text
PUBLISHED events older than 30 days
```

may eventually be archived/deleted.

But this should be configurable.

---

# 42. CLEANUP JOB

Cleanup should happen asynchronously.

Potential:

```text
BullMQ cleanup job
```

or scheduled process.

Do not make every API request responsible for cleanup.

---

# 43. RETENTION CONFIGURATION

Support:

```text
OUTBOX_RETENTION_DAYS
```

Do not hard-code a permanent deletion policy.

---

# 44. FAILED EVENTS

Failed/dead events should generally be retained longer than successful events.

Example:

```text
PUBLISHED → normal retention
FAILED    → longer retention
DEAD      → manual investigation
```

---

# 45. EVENT PAYLOAD VERSIONING

Prepare for event schema changes.

Add:

```text
eventVersion
```

Example:

```text
SALE_CONFIRMED
version = 1
```

Later:

```text
SALE_CONFIRMED
version = 2
```

Consumers should know how to interpret the version.

---

# 46. EVENT CONTRACT

Define a consistent event envelope.

Example:

```json
{
  "eventId": "uuid",
  "eventType": "SALE_CONFIRMED",
  "eventVersion": 1,
  "aggregateType": "SALE",
  "aggregateId": "sale-id",
  "occurredAt": "2026-08-09T10:00:00Z",
  "correlationId": "uuid",
  "causationId": "uuid",
  "companyId": "company-id",
  "branchId": "branch-id",
  "payload": {}
}
```

Adapt to project conventions.

---

# 47. EVENT IMMUTABILITY

Once an outbox event has been created:

```text
eventType
aggregateType
aggregateId
payload
occurredAt
```

must be treated as immutable.

Do not let ordinary application code modify published event payloads.

---

# 48. OUTBOX EVENT ORDERING

Do not promise global ordering.

The system may need ordering per aggregate.

Example:

```text
SALE_CREATED
SALE_CONFIRMED
SALE_CANCELLED
```

For the same:

```text
aggregateId = SALE-001
```

preserve ordering where business correctness requires it.

Do not assume events across different aggregates must be globally ordered.

---

# 49. AGGREGATE ORDERING

If required:

```text
aggregateId
+
sequence
```

can be used.

Example:

```text
SALE-001
sequence 1 → CREATED
sequence 2 → CONFIRMED
sequence 3 → PAID
```

Only implement explicit sequence tracking if actual business requirements require strict ordering.

Avoid unnecessary complexity.

---

# 50. ACCOUNTING EVENTS

Phase 17 Accounting should integrate with Outbox.

Examples:

```text
JOURNAL_POSTED
JOURNAL_REVERSED
PERIOD_LOCKED
```

Critical rule:

```text
Journal posting
+
Outbox event
```

must occur in the same MySQL transaction.

Example:

```text
BEGIN

POST Journal
Create OutboxEvent(JOURNAL_POSTED)

COMMIT
```

---

# 51. PAYMENT EVENTS

Phase 16 Payment should emit:

```text
PAYMENT_CONFIRMED
PAYMENT_REFUNDED
```

through Outbox.

Example:

```text
BEGIN

Update Payment
Create Accounting Journal
Create Outbox Event

COMMIT
```

Do not:

```text
commit payment
then try to create event separately
```

---

# 52. SALES EVENTS

Phase 12 should integrate:

```text
SALE_CREATED
SALE_CONFIRMED
SALE_CANCELLED
SALE_RETURNED
```

where appropriate.

Use the actual lifecycle already implemented.

Do not invent states.

---

# 53. PURCHASE EVENTS

Phase 13:

```text
PURCHASE_CREATED
PURCHASE_CONFIRMED
PURCHASE_CANCELLED
PURCHASE_RETURNED
```

where applicable.

---

# 54. INVENTORY EVENTS

Phase 14/15:

```text
INVENTORY_MOVEMENT_CREATED
INVENTORY_ADJUSTED
STOCK_RESERVED
STOCK_RELEASED
```

Only use events that actually exist in the current domain model.

---

# 55. USER / AUTH EVENTS

Potential events:

```text
USER_CREATED
USER_UPDATED
USER_DISABLED
ROLE_ASSIGNED
PERMISSION_CHANGED
```

Be careful with security-sensitive payloads.

Never include:

```text
password
passwordHash
refreshToken
OTP
secret
```

---

# 56. CUSTOMER / SUPPLIER EVENTS

Potential:

```text
CUSTOMER_CREATED
CUSTOMER_UPDATED
CUSTOMER_STATUS_CHANGED

SUPPLIER_CREATED
SUPPLIER_UPDATED
SUPPLIER_STATUS_CHANGED
```

Only emit meaningful domain events.

---

# 57. AUDIT LOG INTEGRATION

Outbox should work with the existing Audit Log.

Important distinction:

```text
Audit Log
    ↓
"What user/system action happened?"

Outbox
    ↓
"What event must be delivered reliably?"
```

Do not replace Audit Log with Outbox.

---

# 58. SECURITY

Outbox payloads may contain sensitive information.

Never expose them through normal APIs.

If administrative endpoints exist:

```text
authentication
+
permission
+
company scope
```

must apply.

---

# 59. DATA VISIBILITY

Outbox administrative views must respect:

```text
company
branch
organization
```

unless the user is explicitly authorized for global infrastructure visibility.

Do not leak another company's event payload.

---

# 60. MULTI-TENANCY

For every business event, preserve:

```text
companyId
```

and:

```text
branchId
```

when applicable.

This is important for:

```text
debugging
worker processing
data visibility
event consumers
```

---

# 61. FAILURE SCENARIO

Test:

```text
MySQL = UP
Redis = DOWN
```

Create a Sale.

Expected:

```text
Sale = committed
Outbox = PENDING
```

Later:

```text
Redis = UP
```

Publisher runs:

```text
PENDING
   ↓
BullMQ
   ↓
PUBLISHED
```

The event must not be lost.

---

# 62. PUBLISH FAILURE

Scenario:

```text
Outbox = PENDING
BullMQ = unavailable
```

Expected:

```text
event remains durable
retry later
```

Do not mark:

```text
PUBLISHED
```

before successful queue submission according to the selected delivery semantics.

---

# 63. WORKER FAILURE

Scenario:

```text
BullMQ job received
Worker starts
Worker crashes
```

Expected:

```text
job/event can be retried
```

The system must not permanently lose the event.

---

# 64. DUPLICATE DELIVERY

Scenario:

```text
Worker processes E001
Worker crashes before acknowledging
E001 is delivered again
```

Expected:

```text
idempotent consumer
```

No duplicate business side effect.

---

# 65. PUBLISHER CRASH WINDOW

Important scenario:

```text
Publisher publishes event to BullMQ
Publisher crashes
Publisher does NOT update Outbox status
```

On restart:

```text
same event may publish again
```

This is acceptable.

Therefore:

```text
consumers MUST be idempotent
```

Do NOT attempt fragile distributed two-phase commit.

---

# 66. OUTBOX VS DISTRIBUTED TRANSACTION

Do NOT implement:

```text
2-phase commit
distributed transaction
```

between:

```text
MySQL
Redis
BullMQ
```

Use:

```text
MySQL Transactional Outbox
+
At-Least-Once Delivery
+
Idempotent Consumers
```

---

# 67. DATABASE INDEXES

Review and create indexes for actual queries.

At minimum consider:

```text
eventId
status
availableAt
createdAt
aggregateType
aggregateId
lockedAt
```

Potential composite indexes:

```text
(status, availableAt)
(status, lockedAt)
```

Do not create unnecessary indexes.

---

# 68. UNIQUE CONSTRAINTS

At minimum:

```text
eventId UNIQUE
```

If processed event tracking is implemented:

```text
(eventId, consumer) UNIQUE
```

---

# 69. PAYLOAD STORAGE

MySQL JSON is acceptable for:

```text
payload
metadata
```

if consistent with the project's MySQL version and TypeORM configuration.

Do not store giant payloads.

---

# 70. PAYLOAD SIZE

Avoid event payloads containing:

```text
entire Sale entity
all Sale Items
entire Customer
all Product details
binary files
large report results
```

Prefer:

```text
IDs
essential immutable values
scope information
event metadata
```

---

# 71. EVENT SNAPSHOT VS REFETCH

Choose deliberately.

Option A:

```text
event contains enough immutable data
```

Option B:

```text
event contains aggregateId
worker refetches current data
```

For events where historical state matters, prefer immutable snapshots or versioned data.

Do not accidentally process a later state as if it were the original event.

---

# 72. OUTBOX SERVICE API

Design a reusable internal API.

Example:

```text
outboxService.add(
  transactionManager,
  {
    eventType,
    aggregateType,
    aggregateId,
    payload,
    metadata
  }
)
```

The exact API must match the project's architecture.

---

# 73. TRANSACTION DECORATOR / UTILITY

If the project already has:

```text
transaction utility
```

reuse it.

Otherwise create a clean reusable transaction abstraction.

Do not duplicate:

```text
QueryRunner boilerplate
```

through every module.

---

# 74. DOMAIN EVENT SEPARATION

Keep clear separation:

```text
Domain Event
    ↓
Business meaning

Outbox Event
    ↓
Durable persistence of event

BullMQ Job
    ↓
Asynchronous delivery/execution
```

Do not make these concepts indistinguishable.

---

# 75. OUTBOX MODULE

Create a module appropriate to existing architecture.

Conceptually:

```text
outbox/
├── entities/
├── repositories/
├── services/
├── publisher/
├── processors/
├── dto/
├── enums/
├── constants/
└── tests/
```

Follow existing project folder conventions.

---

# 76. PUBLISHER IMPLEMENTATION

Publisher should:

```text
1. Find eligible PENDING/FAILED events
2. Claim events safely
3. Publish to BullMQ
4. Mark published
5. Record timestamp
6. Release processing state
7. Retry failures
8. Log errors
```

All operations must be safe under multiple instances.

---

# 77. PUBLISH STATUS TIMING

Be careful about:

```text
mark PUBLISHED
```

If queue publishing returns success, mark:

```text
PUBLISHED
```

But recognize the crash window:

```text
BullMQ accepted
process crashes
status update not committed
```

This may cause duplicate publishing.

That is acceptable under:

```text
at-least-once
```

and must be handled by consumers.

---

# 78. BULLMQ JOB OPTIONS

Use appropriate:

```text
attempts
backoff
removeOnComplete
removeOnFail
jobId
```

Do not remove failed jobs too aggressively if debugging is required.

Avoid duplicating retry logic unnecessarily between:

```text
Outbox
+
BullMQ
```

Define which layer owns which retry responsibility.

---

# 79. RETRY RESPONSIBILITY

Recommended separation:

```text
Outbox Publisher
    ↓
retry delivery to queue

BullMQ
    ↓
retry worker execution

Consumer idempotency
    ↓
protect against duplicate side effects
```

Keep these concerns distinct.

---

# 80. OBSERVABILITY PREPARATION

Every important outbox action should log:

```text
eventId
eventType
aggregateType
aggregateId
status
retryCount
correlationId
```

Do not log sensitive payload data unnecessarily.

This will integrate with Phase 27 Observability.

---

# 81. METRICS PREPARATION

Prepare metrics such as:

```text
outbox_pending_count
outbox_failed_count
outbox_dead_count
outbox_publish_success
outbox_publish_failure
outbox_processing_duration
outbox_retry_count
```

Do not require a full metrics platform yet if Phase 27 handles it.

Create clean instrumentation points.

---

# 82. HEALTH CHECK

Prepare an internal health indicator for:

```text
outbox backlog
```

Example:

```text
PENDING > threshold
```

may indicate a problem.

Do not expose internal event payloads through health endpoints.

---

# 83. BACKLOG

If:

```text
PENDING events = 100,000
```

the publisher should process in batches.

Do not attempt:

```text
SELECT * FROM outbox
```

and load everything into memory.

---

# 84. ORDERING + BATCHES

Do not assume batch processing preserves global order.

If an aggregate requires ordering:

```text
SALE-001
```

must process:

```text
event 1
event 2
event 3
```

according to the required business semantics.

Use aggregate-level sequencing only if necessary.

---

# 85. ADMIN REPLAY

A controlled replay should:

```text
select event
validate event state
create/requeue delivery
preserve original eventId
record replay attempt
audit action
```

Do not create a modified copy that silently changes history.

---

# 86. EVENT REPLAY SAFETY

Replay must still respect:

```text
idempotency
```

because replay intentionally produces another delivery.

---

# 87. EVENT VERSIONING

Consumers must reject or safely handle unsupported versions.

Example:

```text
eventVersion = 2
consumer supports = 1
```

Expected behavior:

```text
controlled failure
+
retry/dead-letter
+
clear error
```

not silent corruption.

---

# 88. MIGRATION

Create a proper TypeORM migration.

Do not rely on:

```text
synchronize=true
```

for production.

Migration should create:

```text
outbox_events
```

and any optional:

```text
processed_events
```

table.

---

# 89. TEST DATABASE

Tests should use an isolated database according to the project's testing architecture.

Do not allow tests to destroy developer/production data.

---

# 90. AUTOMATED TESTS

Implement tests for:

```text
Outbox creation
Same transaction
Rollback
Event uniqueness
Event payload
Event metadata
Publisher
Batch processing
Concurrency
Locking
Lock timeout
Retry
Backoff
Dead events
Replay
Idempotency
BullMQ integration
Accounting integration
Sales integration
Purchase integration
Payment integration
Inventory integration
Audit integration
Company scope
Branch scope
Security
```

---

# 91. TRANSACTIONAL ATOMICITY TEST

Test:

```text
BEGIN

Create Sale
Create Outbox

ROLLBACK
```

Expected:

```text
Sale does not exist
Outbox does not exist
```

Then:

```text
BEGIN

Create Sale
Create Outbox

COMMIT
```

Expected:

```text
Sale exists
Outbox exists
```

---

# 92. REDIS DOWN TEST

Simulate:

```text
Redis/BullMQ unavailable
```

Create:

```text
Sale
```

Expected:

```text
Sale committed
Outbox PENDING
```

After Redis returns:

```text
Outbox published
```

---

# 93. DUPLICATE PUBLISH TEST

Simulate:

```text
Publisher A
Publisher B
```

processing the same event.

Expected:

```text
safe claiming
```

and no uncontrolled duplicate business effects.

---

# 94. CRASH WINDOW TEST

Simulate:

```text
publish succeeds
status update fails
```

Expected:

```text
event may be republished
consumer handles duplicate safely
```

Document this behavior.

---

# 95. RETRY TEST

Simulate:

```text
BullMQ unavailable
```

Expected:

```text
retryCount increments
next attempt scheduled
```

After max retries:

```text
DEAD
```

---

# 96. LOCK RECOVERY TEST

Simulate:

```text
PROCESSING
lockedAt = old timestamp
worker crashed
```

Expected:

```text
event becomes reclaimable
```

---

# 97. IDEMPOTENCY TEST

Process:

```text
eventId = E001
consumer = notification
```

twice.

Expected:

```text
one side effect
```

---

# 98. COMPANY ISOLATION TEST

Create:

```text
Company A Event
Company B Event
```

Verify administrative access follows:

```text
Dynamic RBAC
+
Data Visibility
```

---

# 99. SECURITY TEST

Verify normal user cannot:

```text
modify outbox
delete outbox
replay arbitrary event
mark event published
change retry count
```

---

# 100. BRUNO

Add Bruno collection:

```text
bruno/
└── phase-18-outbox/
    ├── health/
    │
    ├── admin/
    │   ├── list-pending
    │   ├── event-detail
    │   ├── retry
    │   └── replay
    │
    └── integration/
        ├── create-sale-event
        ├── create-payment-event
        ├── create-journal-event
        └── duplicate-event
```

Follow the project's existing Bruno conventions.

Do not expose endpoints that the architecture does not need.

---

# 101. API DOCUMENTATION

Document internal/admin APIs in Swagger if they exist.

Document:

```text
authentication
permissions
request
response
error cases
```

Do not expose sensitive payloads unnecessarily.

---

# 102. ENVIRONMENT VARIABLES

Add only required configuration.

Potential:

```text
OUTBOX_ENABLED=true
OUTBOX_POLL_INTERVAL_MS=1000
OUTBOX_BATCH_SIZE=100
OUTBOX_MAX_RETRIES=10
OUTBOX_RETRY_DELAY_MS=1000
OUTBOX_LOCK_TIMEOUT_SECONDS=300
OUTBOX_RETENTION_DAYS=30
```

Use the actual project's configuration naming conventions.

Validate all values.

---

# 103. DOCKER

Ensure the architecture works with:

```text
API container
Worker container
MySQL container
Redis container
```

Potential architecture:

```text
                ┌─────────────┐
                │   MySQL     │
                │             │
                │ Business DB │
                │ Outbox      │
                └──────┬──────┘
                       │
                       ▼
                ┌─────────────┐
                │ API /       │
                │ Publisher   │
                └──────┬──────┘
                       │
                       ▼
                ┌─────────────┐
                │   Redis     │
                │  BullMQ     │
                └──────┬──────┘
                       │
                       ▼
                ┌─────────────┐
                │   Worker    │
                └─────────────┘
```

Do not require separate services unless the current architecture benefits from it.

---

# 104. API / WORKER SEPARATION

If the project already has:

```text
API process
Worker process
```

reuse it.

If not, prepare the application for:

```text
API mode
WORKER mode
```

without duplicating code.

---

# 105. NO BUSINESS LOGIC IN PUBLISHER

Publisher must NOT perform:

```text
sales calculation
inventory calculation
accounting calculation
payment calculation
```

It only delivers events.

---

# 106. NO DIRECT REDIS DEPENDENCY IN BUSINESS TRANSACTION

Business transaction:

```text
Sale
+
Outbox
```

must succeed even if:

```text
Redis is unavailable
```

That is one of the primary reasons for the Outbox Pattern.

---

# 107. EVENT PROCESSING FAILURE

If consumer fails:

```text
Outbox
```

should remain traceable.

Do not delete the original event just because a consumer failed.

---

# 108. MULTIPLE CONSUMERS

The same event may be consumed by:

```text
Notification Worker
Report Worker
Integration Worker
Audit Worker
```

Each consumer should have independent idempotency.

One consumer failing should not destroy the event for other consumers.

---

# 109. CONSUMER FAILURE IS NOT PUBLISH FAILURE

Distinguish:

```text
Outbox → BullMQ delivery
```

from:

```text
BullMQ → Worker execution
```

Publisher success does not mean:

```text
business side effect completed
```

It means:

```text
event delivered to queue
```

Keep status semantics clear.

---

# 110. OUTBOX STATUS SEMANTICS

Define precisely:

```text
PENDING
```

Event stored but not yet published.

```text
PROCESSING
```

Publisher currently owns it.

```text
PUBLISHED
```

Successfully handed to the queue.

```text
FAILED
```

Publishing failed but can retry.

```text
DEAD
```

Publishing permanently stopped after configured retry policy.

If worker-level failures are tracked separately, do not overload Outbox status with worker business state.

---

# 111. BUSINESS INTEGRITY EXAMPLE

For a sale:

```text
BEGIN

Sale = CONFIRMED

Inventory Ledger = CREATED

Accounting Journal = POSTED

Outbox Event =
SALE_CONFIRMED

COMMIT
```

Then:

```text
Publisher
    ↓
BullMQ
    ↓
Notification Worker
    ↓
Customer Notification
```

If notification fails:

```text
Sale remains confirmed
Inventory remains correct
Accounting remains correct
Outbox event remains durable
Notification retries
```

This separation is critical.

---

# 112. DO NOT USE OUTBOX TO HIDE TRANSACTION BUGS

Do not use:

```text
Outbox
```

as a replacement for proper database transactions.

For example:

```text
Sale saved
Inventory failed
```

must rollback when the business operation requires atomicity.

Outbox only guarantees:

```text
business transaction
+
event persistence
```

are atomic.

---

# 113. FINAL ARCHITECTURE

```text
                         HTTP REQUEST
                              │
                              ▼
                       Business Service
                              │
                              ▼
                     TypeORM Transaction
                              │
             ┌────────────────┼─────────────────┐
             │                │                 │
             ▼                ▼                 ▼
           SALES          INVENTORY          ACCOUNTING
             │                │                 │
             └────────────────┼─────────────────┘
                              │
                              ▼
                       OUTBOX EVENT
                              │
                              ▼
                            COMMIT
                              │
                              ▼
                     OUTBOX PUBLISHER
                              │
                              ▼
                           BullMQ
                              │
             ┌────────────────┼────────────────┐
             ▼                ▼                ▼
        Notification       Reports         Integration
          Worker           Worker            Worker
             │                │                │
             └────────────────┼────────────────┘
                              ▼
                       Idempotent Consumers
```

---

# 114. PHASE 18 DEFINITION OF DONE

Phase 18 is complete only when:

```text
[ ] Existing event architecture inspected
[ ] Existing transaction architecture inspected
[ ] Existing BullMQ/Redis architecture inspected

[ ] OutboxEvent entity implemented
[ ] TypeORM migration implemented
[ ] Unique eventId implemented
[ ] Event type implemented
[ ] Aggregate type implemented
[ ] Aggregate ID implemented
[ ] Payload implemented
[ ] Metadata implemented
[ ] Event version implemented
[ ] Correlation ID supported
[ ] Causation ID supported where needed

[ ] Transactional outbox implemented
[ ] Business data + Outbox saved atomically
[ ] Rollback behavior tested

[ ] Outbox Publisher implemented
[ ] Batch processing implemented
[ ] Safe event claiming implemented
[ ] Concurrency protection implemented
[ ] Lock timeout implemented

[ ] BullMQ integration implemented
[ ] Deterministic job ID considered
[ ] At-least-once delivery documented
[ ] Idempotent consumer strategy implemented/prepared

[ ] Retry implemented
[ ] Exponential backoff implemented
[ ] Max retry implemented
[ ] Dead event state implemented
[ ] Replay mechanism implemented where appropriate

[ ] Outbox cleanup/retention prepared
[ ] Event versioning prepared

[ ] Sales integration
[ ] Purchase integration
[ ] Payment integration
[ ] Inventory integration
[ ] Accounting integration

[ ] Audit Log integration
[ ] Company scope
[ ] Branch scope
[ ] Security
[ ] Data Visibility

[ ] Redis failure tested
[ ] BullMQ failure tested
[ ] Publisher crash window tested
[ ] Worker failure tested
[ ] Duplicate delivery tested
[ ] Idempotency tested
[ ] Concurrency tested

[ ] Bruno tests
[ ] Automated tests
[ ] Typecheck
[ ] ESLint
[ ] Build

[ ] Docker API works
[ ] Docker worker works
[ ] MySQL migration works
[ ] Redis integration works

[ ] No business logic duplicated
[ ] No sensitive payload leakage
[ ] No exactly-once claim
[ ] Financial/accounting integrity preserved
```

---

# 115. FINAL AI RULES

Before saying:

```text
Phase 18 completed
```

you MUST inspect the actual repository and verify the implementation.

Run the real:

```text
tests
typecheck
lint
build
database migrations
Bruno tests
Docker validation
```

Do not claim success based only on generated code.

Do not rewrite completed phases unnecessarily.

Do not create a second event architecture if one already exists.

Do not use Redis as the source of truth.

Do not require Redis for the business transaction to succeed.

Do not publish events before the database transaction commits.

Do not claim exactly-once delivery.

Use:

```text
Transactional Outbox
+
At-Least-Once Delivery
+
Idempotent Consumers
```

The core guarantee must be:

```text
┌──────────────────────────────────────┐
│          ONE MYSQL TRANSACTION       │
│                                      │
│   Business Data                      │
│        +                             │
│   Outbox Event                       │
│                                      │
│        ↓                             │
│      COMMIT                          │
└──────────────────┬───────────────────┘
                   │
                   ▼
             BullMQ / Redis
                   │
                   ▼
          Idempotent Workers
```

If the business transaction succeeds, the event must be durable.

If Redis/BullMQ fails, the event must remain recoverable.

If a worker processes the same event twice, the final business result must remain correct.
