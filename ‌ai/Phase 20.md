# Phase 20 — BullMQ Workers

## Fashion ERP Backend

## Production-Ready Implementation Prompt

You are implementing **Phase 20 — BullMQ Workers** of the Fashion ERP Backend.

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
Phase 18 — Outbox Pattern
Phase 19 — Redis
```

Do NOT unnecessarily rewrite completed phases.

The actual repository is the primary source of truth.

---

# 2. PHASE 20 OBJECTIVE

Implement a production-ready asynchronous job-processing architecture using:

```text
NestJS
+
BullMQ
+
Redis
+
MySQL
+
Outbox Pattern
```

The goal is to move non-request-critical and asynchronous work out of the HTTP request lifecycle.

Target:

```text
HTTP Request
     ↓
Business Transaction
     ↓
MySQL Transaction
     ↓
Outbox Event
     ↓
COMMIT
     ↓
BullMQ
     ↓
Redis
     ↓
Worker
     ↓
Background Processing
```

---

# 3. IMPORTANT ARCHITECTURE RULE

BullMQ is NOT the source of truth.

Redis is NOT the source of truth.

BullMQ is:

```text
Job Queue / Asynchronous Processing Infrastructure
```

The source of truth remains:

```text
MySQL
```

Especially for:

```text
Sales
Purchase
Inventory
Inventory Ledger
Payment
Accounting
Customer
Supplier
User
Employee
Account
```

---

# 4. WHY BULLMQ IS NEEDED

Use BullMQ for tasks such as:

```text
Notifications
Emails
Push Notifications
Report Generation
Dashboard Aggregation
Data Synchronization
Outbox Event Processing
Webhook Delivery
Audit/Activity Processing
Image Processing
Import/Export
Scheduled Tasks
Cleanup Jobs
Retryable External API Calls
```

Do NOT move every service method into BullMQ.

Use background jobs only where asynchronous processing provides real value.

---

# 5. FIRST STEP — INSPECT REPOSITORY

Before writing code, inspect the actual repository.

Search for:

```text
BullMQ
bullmq
@nestjs/bullmq
@nestjs/bull
Queue
Worker
Processor
Job
Redis
ioredis
Outbox
OutboxEvent
event
notification
email
report
cron
scheduler
webhook
retry
```

Inspect:

```text
src/
common/
config/
modules/
outbox/
redis/
workers/
queues/
notifications/
reports/
sales/
purchase/
inventory/
payment/
accounting/
docker/
docker-compose*
tests/
bruno/
```

Determine:

1. Is BullMQ already installed?
2. Is Redis already configured?
3. Is BullMQ already connected to Redis?
4. Does Phase 18 already contain an Outbox Publisher?
5. Are there existing queues?
6. Are there existing background workers?
7. Are there duplicate Redis connections?
8. Are there existing scheduled jobs?
9. Are there existing notification services?
10. Are there existing retry mechanisms?

Reuse existing infrastructure where appropriate.

Do not create duplicate queue infrastructure.

---

# 6. TARGET ARCHITECTURE

Target:

```text
                         ┌─────────────────┐
                         │     MySQL       │
                         │ Source of Truth │
                         └────────┬────────┘
                                  │
                         Business Transaction
                                  │
                                  ▼
                         ┌─────────────────┐
                         │  Outbox Event   │
                         └────────┬────────┘
                                  │
                               COMMIT
                                  │
                                  ▼
                         ┌─────────────────┐
                         │ Outbox Publisher│
                         └────────┬────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │     BullMQ      │
                         │     Redis       │
                         └────────┬────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
                    ▼             ▼             ▼
                 Worker A      Worker B      Worker C
                    │             │             │
                    ▼             ▼             ▼
               Notification    Reports      Webhooks
```

---

# 7. API VS WORKER RESPONSIBILITY

HTTP API should handle:

```text
Authentication
Authorization
Validation
Business command
Database transaction
Response
```

Worker should handle:

```text
Long-running tasks
Retryable tasks
External API calls
Notifications
Reports
Heavy processing
Asynchronous side effects
```

Do not keep HTTP requests waiting for slow background work.

---

# 8. JOB DESIGN PRINCIPLE

Jobs should contain identifiers and minimal data.

Prefer:

```json
{
  "eventId": "uuid",
  "entityId": "uuid",
  "companyId": "uuid"
}
```

Avoid putting huge objects into Redis/BullMQ.

Bad:

```json
{
  "entireSaleObject": "...huge payload..."
}
```

Better:

```json
{
  "saleId": "uuid",
  "companyId": "uuid"
}
```

Worker can load authoritative data from MySQL.

---

# 9. JOB DATA VS SOURCE OF TRUTH

Example:

```text
Queue Job
    ↓
saleId
    ↓
Worker
    ↓
MySQL
    ↓
Load current sale
```

Do not assume the job payload is authoritative.

The job may be delayed or retried.

Therefore the worker should fetch current state where appropriate.

---

# 10. QUEUE ARCHITECTURE

Create queues based on business responsibility.

Potential architecture:

```text
queues/
├── outbox
├── notification
├── email
├── report
├── webhook
├── sync
├── import
├── export
└── maintenance
```

Do NOT create every queue immediately.

Create queues required by actual Phase 18+ functionality.

---

# 11. QUEUE NAMING

Use centralized queue names.

Example:

```text
erp.outbox
erp.notification
erp.email
erp.report
erp.webhook
erp.sync
erp.import
erp.export
```

Avoid scattered string literals.

Use constants/enums according to existing project conventions.

---

# 12. JOB NAMING

Each queue should have clear job names.

Example:

```text
notification.send
email.send
report.generate
webhook.deliver
outbox.publish
inventory.sync
data.export
```

Do not use vague names such as:

```text
process
run
task
job1
```

---

# 13. QUEUE MODULE

Create a centralized queue infrastructure module following the existing architecture.

Conceptually:

```text
queue/
├── queue.module.ts
├── queue.constants.ts
├── queue.types.ts
├── queue.config.ts
└── queues/
```

Adapt to the actual repository structure.

Do not blindly create this exact structure if the repository already has an established pattern.

---

# 14. BULLMQ CONNECTION

Use the Redis infrastructure from Phase 19.

Do NOT create an unrelated Redis connection.

Conceptually:

```text
Redis Infrastructure
       │
       ▼
BullMQ
       │
       ├── Queue
       ├── Worker
       └── QueueEvents
```

If BullMQ requires dedicated connections, configure them correctly.

---

# 15. QUEUE PRODUCER

Create a reusable way for application services to enqueue jobs.

Conceptually:

```text
Application Service
       ↓
QueueService
       ↓
BullMQ Queue
       ↓
Redis
```

Business modules should not manually configure Redis connections.

---

# 16. WORKER ARCHITECTURE

Workers should be separated from API request handling.

Conceptually:

```text
API Process
    │
    └── Producers

Worker Process
    │
    ├── Outbox Worker
    ├── Notification Worker
    ├── Email Worker
    ├── Report Worker
    └── Webhook Worker
```

If the existing NestJS architecture supports worker mode, implement accordingly.

---

# 17. API PROCESS VS WORKER PROCESS

Prefer production architecture:

```text
                    Docker
                      │
             ┌────────┴────────┐
             │                 │
             ▼                 ▼
          API Container     Worker Container
             │                 │
             │                 │
             └───────┬─────────┘
                     │
                  Redis
                     │
                   MySQL
```

API and worker should be independently scalable.

Example:

```text
api replicas = 3
worker replicas = 2
```

---

# 18. WORKER CONCURRENCY

Configure worker concurrency explicitly.

Example:

```text
notification → 10
email → 5
report → 2
webhook → 10
```

These are examples only.

Choose values based on actual workload.

Do not use unlimited concurrency.

---

# 19. CONCURRENCY SAFETY

When increasing worker concurrency, consider:

```text
MySQL connection pool
Redis connection capacity
External API limits
CPU
Memory
Business transaction locks
```

Do not set:

```text
concurrency = 1000
```

without justification.

---

# 20. JOB ATTEMPTS

Configure retry attempts for retryable jobs.

Example:

```text
attempts: 3
```

But retry count should depend on the job.

Potential:

```text
Email → 5
Webhook → 5
Report → 2
Notification → 3
```

Do not blindly retry non-retryable business errors.

---

# 21. EXPONENTIAL BACKOFF

Use exponential backoff for temporary failures.

Conceptually:

```text
Attempt 1 → immediate
Attempt 2 → delay
Attempt 3 → longer delay
Attempt 4 → longer delay
```

Avoid retry storms.

---

# 22. RETRYABLE VS NON-RETRYABLE ERRORS

Retry:

```text
Network timeout
Temporary external API failure
Connection failure
HTTP 429
HTTP 5xx
Temporary Redis failure
```

Usually do not retry:

```text
Invalid input
Entity does not exist
Permission denied
Business rule violation
Malformed payload
Permanent 4xx
```

Implement explicit error classification where appropriate.

---

# 23. DEAD LETTER / FAILED JOBS

Failed jobs must remain inspectable.

Use BullMQ failed-job functionality.

Do not silently delete failed jobs.

Need to support:

```text
failed
retry
remove
inspect
```

according to operational requirements.

---

# 24. FAILED JOB RETENTION

Do not retain millions of completed/failed jobs forever.

Configure:

```text
removeOnComplete
removeOnFail
```

with reasonable limits.

Example concept:

```text
completed → retain last N
failed → retain last N
```

Exact values should depend on production requirements.

---

# 25. JOB TIMEOUT

Long-running jobs must have reasonable execution limits.

Do not allow a worker to hang indefinitely.

For example:

```text
report generation
external API call
webhook delivery
file processing
```

must have timeout handling.

---

# 26. JOB IDEMPOTENCY

Every important job must be safe to retry.

Example:

```text
Webhook job
    ↓
attempt 1
    ↓
external API succeeds
    ↓
worker crashes before acknowledgement
    ↓
attempt 2
```

The second attempt must not create unintended duplicate business effects.

---

# 27. JOB JOB-ID

Use deterministic job IDs where duplicate jobs should be prevented.

Example:

```text
jobId = `${eventId}`
```

or:

```text
jobId = `${entityId}:${operation}:${version}`
```

depending on business requirements.

Do not use deterministic IDs blindly when multiple legitimate jobs are expected.

---

# 28. OUTBOX + BULLMQ

Phase 18 Outbox is the durable event source.

Architecture:

```text
Business Transaction
      │
      ├── Business Data
      │
      └── Outbox Event
             │
           COMMIT
             │
             ▼
      Outbox Publisher
             │
             ▼
          BullMQ
             │
             ▼
          Worker
```

This prevents:

```text
MySQL transaction succeeds
but queue event is permanently lost
```

---

# 29. OUTBOX PUBLISHER

Inspect Phase 18 implementation.

Do NOT duplicate the publisher.

If it already exists:

```text
reuse it
```

If incomplete:

```text
complete only what is required
```

The publisher should:

1. Find unpublished events
2. Publish to BullMQ
3. Mark event appropriately
4. Handle retries
5. Avoid duplicate publication where possible
6. Preserve event durability

---

# 30. OUTBOX EVENT PAYLOAD

Prefer:

```json
{
  "eventId": "uuid",
  "eventType": "sale.confirmed",
  "aggregateId": "uuid",
  "companyId": "uuid"
}
```

Worker loads current data from MySQL.

Do not store giant snapshots unless event semantics explicitly require them.

---

# 31. EVENT TYPES

Potential events:

```text
sale.created
sale.confirmed
sale.cancelled

purchase.created
purchase.received
purchase.cancelled

inventory.received
inventory.issued
inventory.adjusted

payment.created
payment.completed
payment.failed

customer.created
supplier.created

user.created
user.updated

role.updated
permission.updated
```

Use only event types actually supported by the current codebase.

Do not invent business events merely to fill the queue.

---

# 32. EVENT VERSIONING

Events should be versionable.

Example:

```text
sale.confirmed.v1
sale.confirmed.v2
```

or metadata:

```json
{
  "eventType": "sale.confirmed",
  "version": 1
}
```

Choose one consistent strategy.

---

# 33. WORKER TRANSACTION RULE

A worker that modifies MySQL must use appropriate transactions.

Example:

```text
Worker
  ↓
Load MySQL
  ↓
Validate current state
  ↓
MySQL transaction
  ↓
Commit
```

Do not perform half of a business operation and then mark the job successful.

---

# 34. WORKER + ACCOUNTING

Accounting jobs are sensitive.

Do not allow a worker retry to create duplicate journal entries.

Use:

```text
unique business reference
+
MySQL constraints
+
idempotency
+
transaction
```

Redis/BullMQ alone is NOT enough.

---

# 35. WORKER + INVENTORY

Inventory jobs must respect:

```text
Inventory Ledger
Stock constraints
Warehouse scope
Company scope
Transaction locking
Idempotency
```

Do not let two workers incorrectly post the same stock movement.

---

# 36. WORKER + PAYMENT

Payment jobs must be idempotent.

Example:

```text
paymentId
providerTransactionId
idempotencyKey
```

must be protected by durable MySQL state.

---

# 37. WORKER + NOTIFICATIONS

Notifications are ideal BullMQ jobs.

Example:

```text
sale.confirmed
     ↓
Notification Queue
     ↓
Notification Worker
     ↓
Push / In-App / Email
```

Notification failure must not rollback the original Sale transaction.

---

# 38. WORKER + EMAIL

Email sending should be asynchronous.

API:

```text
Create Sale
   ↓
MySQL COMMIT
   ↓
Queue email job
   ↓
Return response
```

Worker:

```text
Email Worker
   ↓
Send email
   ↓
Success / Retry / Failed
```

---

# 39. WORKER + WEBHOOK

External webhook delivery should be retryable.

Implement:

```text
attempt count
backoff
timeout
HTTP status classification
failed state
```

Do not retry permanent failures forever.

---

# 40. WEBHOOK IDEMPOTENCY

Send an idempotency/event identifier.

Example:

```text
X-Event-ID: <eventId>
```

or equivalent.

This helps receivers deduplicate events.

---

# 41. REPORT WORKER

Reports may be expensive.

Use:

```text
API
 ↓
Create Report Job
 ↓
Return jobId
```

Then:

```text
Worker
 ↓
Generate report
 ↓
Store result
 ↓
Update status
```

Do not keep HTTP request open for large reports.

---

# 42. REPORT STATUS

Potential:

```text
PENDING
PROCESSING
COMPLETED
FAILED
```

Store authoritative job/report state in MySQL when the frontend needs durable tracking.

Do not rely only on BullMQ job state for long-term business/user-visible status.

---

# 43. IMPORT / EXPORT

For large data:

```text
CSV import
Excel import
CSV export
Excel export
```

use BullMQ.

Example:

```text
Upload
 ↓
Create Import Record
 ↓
Queue Job
 ↓
Worker
 ↓
Process
 ↓
Update Import Record
```

---

# 44. FILE PROCESSING

Do not load very large files entirely into memory.

Use streaming/chunk processing where appropriate.

Workers should have memory limits.

---

# 45. SCHEDULED JOBS

If scheduled jobs are required, use BullMQ's supported scheduling mechanisms compatible with the installed BullMQ version.

Potential:

```text
daily cleanup
daily report
stock synchronization
notification reminder
```

Do not create a separate cron infrastructure if BullMQ can safely handle the requirement.

---

# 46. SCHEDULED JOB SAFETY

Scheduled jobs must be idempotent.

If two workers start simultaneously:

```text
same scheduled task
```

they must not create duplicate business effects.

Use:

```text
jobId
distributed lock
database uniqueness
```

where appropriate.

---

# 47. CLEANUP JOBS

Potential cleanup:

```text
expired sessions
temporary state
old cache metadata
old files
old logs
old temporary records
```

But do not delete:

```text
financial records
accounting records
inventory ledger
audit logs
```

unless explicit retention policy allows it.

---

# 48. AUDIT LOG

Audit logs are important.

If audit logging is asynchronous:

```text
Business transaction
   ↓
Audit event
   ↓
Queue
   ↓
Worker
```

ensure the audit event itself cannot be lost if audit is legally/business critical.

If audit must be guaranteed, prefer durable MySQL/outbox architecture.

Do not rely on Redis-only audit jobs.

---

# 49. QUEUE PRIORITY

If required, support priorities.

Potential:

```text
High:
payment webhook
security notification

Normal:
email
notification

Low:
report
analytics
cleanup
```

Do not add priorities without real operational need.

---

# 50. QUEUE SEPARATION

Do not put every workload into one queue.

Bad:

```text
erp.queue
```

for:

```text
email
report
payment
webhook
import
```

A large report could block critical notifications.

Separate queues by workload when needed.

---

# 51. PAYMENT / FINANCIAL JOB PRIORITY

If financial background jobs exist, ensure they cannot be starved by heavy jobs.

Potential architecture:

```text
critical queue
normal queue
bulk queue
```

Use actual project requirements.

---

# 52. WORKER RESOURCE ISOLATION

Heavy jobs should not consume all worker resources.

Example:

```text
Report Worker
Import Worker
Export Worker
```

may be separated from:

```text
Notification Worker
Webhook Worker
```

so heavy workloads do not block latency-sensitive tasks.

---

# 53. WORKER DATABASE CONNECTIONS

Worker processes use MySQL.

Configure connection pools appropriately.

Do not copy API connection pool settings blindly.

Example:

```text
API:
many short requests

Worker:
fewer long-running transactions
```

Tune separately when production requires it.

---

# 54. WORKER SHUTDOWN

Implement graceful shutdown.

When container receives:

```text
SIGTERM
```

worker should:

```text
stop accepting new jobs
finish active jobs where possible
close Redis connections
close MySQL connections
exit
```

Do not abruptly terminate active business jobs.

---

# 55. JOB LOCK / STALLED JOBS

BullMQ supports stalled job detection.

Configure worker behavior appropriately.

Understand:

```text
lockDuration
stalled detection
heartbeat
```

Do not blindly customize internals unless required.

---

# 56. STALLED JOB HANDLING

If a worker crashes:

```text
Worker A
   ↓
Job processing
   ↓
Worker crashes
```

BullMQ should eventually allow another worker to process the job.

But the job itself must be idempotent.

---

# 57. WORKER HEARTBEAT

Long-running jobs must not appear stalled because the worker blocks the event loop.

Avoid CPU-heavy synchronous operations inside a worker.

For CPU-heavy work consider:

```text
worker_threads
separate process
chunking
```

when justified.

---

# 58. ERROR LOGGING

Worker logs must include:

```text
queue
jobId
jobName
attempt
eventId
entityId
companyId
error type
duration
```

Do not log:

```text
password
token
OTP
payment secrets
PII unnecessarily
```

---

# 59. CORRELATION ID

Propagate:

```text
requestId
correlationId
eventId
```

where appropriate.

Example:

```text
HTTP Request
   ↓
requestId
   ↓
Outbox Event
   ↓
BullMQ Job
   ↓
Worker logs
```

This makes debugging much easier.

---

# 60. JOB METADATA

Useful metadata:

```json
{
  "eventId": "uuid",
  "correlationId": "uuid",
  "companyId": "uuid",
  "createdAt": "timestamp"
}
```

Keep payload small.

---

# 61. OBSERVABILITY PREPARATION

Phase 27 will provide full observability.

Prepare metrics for:

```text
jobs_added
jobs_completed
jobs_failed
jobs_retried
job_duration
queue_depth
worker_active
worker_stalled
```

Do not implement a huge observability system in Phase 20.

Provide clean integration points.

---

# 62. HEALTH CHECK

Health checks should distinguish:

```text
API
MySQL
Redis
BullMQ infrastructure
```

If Redis is down:

```text
BullMQ
```

may be unavailable.

Expose this clearly in internal health/monitoring.

Do not expose sensitive infrastructure information publicly.

---

# 63. DOCKER ARCHITECTURE

Production-oriented:

```text
services:

  api:
    ...

  worker:
    ...

  mysql:
    ...

  redis:
    ...
```

Worker should run the worker entrypoint.

Example concept:

```text
api:
  npm run start:prod

worker:
  npm run worker:prod
```

Use the project's actual commands.

---

# 64. LOCAL DEVELOPMENT

Developer should be able to run:

```text
MySQL
Redis
API
Worker
```

using Docker Compose or the project's established local environment.

Avoid requiring manual Redis setup if Docker is already part of the architecture.

---

# 65. WORKER ENTRYPOINT

If a separate worker process is needed, create a clean worker bootstrap.

Example concept:

```text
src/
├── main.ts
└── worker.ts
```

But follow the actual NestJS architecture.

Do not create duplicate application initialization unnecessarily.

---

# 66. WORKER CONFIGURATION

Support environment variables for:

```text
WORKER_CONCURRENCY
QUEUE_PREFIX
JOB_ATTEMPTS
JOB_BACKOFF
JOB_TIMEOUT
```

only where useful.

Do not create dozens of environment variables for trivial settings.

---

# 67. CONFIGURATION VALIDATION

Validate worker configuration.

Examples:

```text
WORKER_CONCURRENCY > 0
JOB_ATTEMPTS >= 1
JOB_TIMEOUT > 0
```

Use existing configuration validation.

---

# 68. SECURITY

Workers are privileged infrastructure.

Do not expose worker internals through public HTTP APIs.

Do not allow arbitrary job creation from clients.

For example, do NOT create:

```text
POST /jobs
{
  "queue": "..."
}
```

where users can execute arbitrary jobs.

Only trusted application services should enqueue jobs.

---

# 69. RBAC

If an admin UI eventually allows:

```text
retry failed job
cancel job
```

protect those endpoints with:

```text
Dynamic RBAC
+
Data Visibility
+
Audit Log
```

Do not expose job control publicly.

---

# 70. TENANT ISOLATION

Worker jobs must carry appropriate tenant scope.

Example:

```json
{
  "companyId": "company-A",
  "entityId": "..."
}
```

Worker must not accidentally process:

```text
Company A job
```

using:

```text
Company B context
```

---

# 71. WORKER AUTHORIZATION

Do not trust:

```text
companyId
```

alone.

The worker should retrieve authoritative data and verify scope where necessary.

---

# 72. JOB DATA VALIDATION

Validate job payload before processing.

Example:

```text
eventId must be UUID
companyId must be UUID
entityId must be UUID
```

If invalid:

```text
non-retryable failure
```

Do not retry malformed jobs forever.

---

# 73. JOB VERSION COMPATIBILITY

If deployment changes job payload structure:

```text
old jobs
```

may still exist in Redis.

Worker should remain compatible during rolling deployment where practical.

Do not deploy a breaking payload change without considering queued jobs.

---

# 74. DEPLOYMENT SAFETY

Before deploying new worker code:

```text
existing queued jobs
```

must be considered.

Potential strategy:

```text
v1 worker
v2 worker
```

or backward-compatible payloads.

---

# 75. JOB RETRY + BUSINESS STATE

When retrying:

```text
Worker
 ↓
Load current state
 ↓
Check whether operation already completed
 ↓
Skip or continue safely
```

Example:

```text
payment already processed
```

should not create a second payment.

---

# 76. EXACTLY-ONCE WARNING

Do NOT claim:

```text
exactly once processing
```

just because BullMQ is used.

Real systems generally provide:

```text
at-least-once processing
```

and business operations must therefore be idempotent.

---

# 77. AT-LEAST-ONCE DESIGN

Design workers assuming:

```text
same job may execute more than once
```

Therefore:

```text
Job
 ↓
Check state
 ↓
Perform idempotent operation
 ↓
Commit
```

---

# 78. TRANSACTION + JOB COMPLETION

Important sequence:

```text
Worker
 ↓
MySQL transaction
 ↓
COMMIT
 ↓
Job completed
```

Do not acknowledge job success before critical database changes are committed.

---

# 79. EXTERNAL API + JOB COMPLETION

For external API calls:

```text
Worker
 ↓
External API
 ↓
Update MySQL
 ↓
COMMIT
 ↓
Job success
```

If external API succeeded but MySQL update failed:

```text
retry
```

must not duplicate external side effects.

Use provider idempotency keys when supported.

---

# 80. WEBHOOK DELIVERY

Use event ID as idempotency key where supported.

Example:

```text
eventId = 8b...
```

Send:

```text
Idempotency-Key: 8b...
```

or equivalent.

---

# 81. EMAIL DUPLICATION

Email jobs may be retried.

If duplicate email is unacceptable, maintain durable send state:

```text
notificationId
emailId
eventId
```

in MySQL where appropriate.

Do not rely solely on BullMQ jobId.

---

# 82. NOTIFICATION DUPLICATION

Use a durable notification record where business requirements need it.

Example:

```text
Notification
├── id
├── userId
├── eventId
├── type
├── status
└── sentAt
```

Worker checks status before sending.

Adapt to existing Phase 21 implementation later.

---

# 83. REPORT JOB STATE

For user-visible reports, use MySQL record:

```text
ReportJob
├── id
├── requestedBy
├── companyId
├── status
├── progress
├── resultPath
├── error
├── createdAt
├── completedAt
```

Only add this if report functionality requires durable state.

Do not create it merely for Phase 20 if Phase 22 owns report design.

---

# 84. PROGRESS TRACKING

For long jobs:

```text
0%
25%
50%
75%
100%
```

Do not write progress to MySQL on every loop iteration.

Throttle progress updates.

Redis can hold temporary progress, while durable user-facing state can be stored in MySQL.

---

# 85. BATCH PROCESSING

For large jobs:

```text
100,000 products
```

do not process all records in one huge transaction.

Use chunks:

```text
500
1000
```

depending on workload.

Keep transactions reasonably small.

---

# 86. MEMORY MANAGEMENT

Avoid:

```text
SELECT * FROM huge_table
```

and loading everything into memory.

Use:

```text
pagination
cursor
streaming
batch processing
```

where appropriate.

---

# 87. QUEUE BACKPRESSURE

Workers must not process faster than downstream systems can handle.

Examples:

```text
External API rate limit
Email provider
Payment provider
Database
```

Use:

```text
concurrency
limiter
backoff
queue separation
```

where appropriate.

---

# 88. RATE LIMITING EXTERNAL PROVIDERS

BullMQ can control external API throughput.

Example:

```text
Webhook provider:
100 requests/minute
```

Configure appropriate limiter according to provider requirements.

Do not hard-code arbitrary values.

---

# 89. WORKER RETRY STORM

Avoid this:

```text
1000 jobs fail
   ↓
1000 immediate retries
   ↓
external API overloaded
```

Use:

```text
exponential backoff
jitter where appropriate
rate limits
```

---

# 90. JOB CLEANUP

Define lifecycle:

```text
waiting
active
completed
failed
delayed
```

Do not keep unlimited history.

Operationally important failed jobs should remain inspectable.

---

# 91. ADMIN JOB MANAGEMENT

If an internal admin endpoint/UI is needed later:

```text
View Queue
View Job
Retry Job
Remove Job
```

protect with:

```text
Super Admin
+
appropriate Dynamic Permission
```

and audit all destructive actions.

Do not implement arbitrary job execution.

---

# 92. BRUNO TESTING

Add Phase 20 Bruno tests according to the existing collection structure.

Potential:

```text
bruno/
└── phase-20-bullmq/
    ├── health/
    │   └── queue-health
    │
    ├── notifications/
    │   └── enqueue-notification
    │
    ├── reports/
    │   └── create-report-job
    │
    └── admin/
        ├── list-failed-jobs
        └── retry-job
```

Only create APIs that actually exist.

Do not expose queue internals just for testing.

---

# 93. AUTOMATED TESTS

Implement tests for:

```text
Queue registration
Job creation
Job payload validation
Worker processing
Successful job
Failed job
Retry
Backoff
Non-retryable error
Idempotency
Duplicate job
Concurrent jobs
Tenant isolation
Outbox → Queue
Queue → Worker
Worker → MySQL
Worker shutdown
Stalled job behavior
Redis failure
MySQL failure
External API failure
```

---

# 94. OUTBOX INTEGRATION TEST

Test:

```text
Create Sale
 ↓
MySQL transaction
 ↓
Outbox created
 ↓
COMMIT
 ↓
Publisher
 ↓
BullMQ
 ↓
Worker
```

Verify every stage.

---

# 95. OUTBOX FAILURE TEST

Simulate:

```text
MySQL transaction succeeds
Redis unavailable
```

Expected:

```text
Sale = committed
Outbox = durable
Queue publication = pending/retry
```

When Redis recovers:

```text
Outbox
 ↓
BullMQ
 ↓
Worker
```

must continue.

---

# 96. DUPLICATE OUTBOX TEST

Simulate publishing the same event twice.

Expected:

```text
same eventId
```

does not create duplicate business effects.

---

# 97. WORKER FAILURE TEST

Simulate:

```text
Worker starts
 ↓
processes job
 ↓
crashes
```

Verify BullMQ retry/stalled handling.

Then verify business operation remains idempotent.

---

# 98. MYSQL FAILURE TEST

Simulate worker processing while MySQL is unavailable.

Expected:

```text
job fails
 ↓
retry according to policy
```

Do not mark the job successful.

---

# 99. REDIS FAILURE TEST

Stop Redis.

Verify:

```text
queue operations fail safely
```

and:

```text
MySQL business data
```

remains intact.

---

# 100. EXTERNAL API FAILURE TEST

Simulate:

```text
HTTP 500
HTTP 429
timeout
connection refused
HTTP 400
```

Verify classification:

```text
500 → retry
429 → retry/backoff
timeout → retry
400 → usually no retry
```

according to actual business requirements.

---

# 101. SECURITY TESTS

Verify users cannot:

```text
create arbitrary jobs
execute arbitrary queues
access another company's jobs
retry unauthorized jobs
read sensitive job payloads
```

---

# 102. PERFORMANCE TEST

Test reasonable concurrency.

Measure:

```text
job throughput
job latency
Redis latency
MySQL latency
worker CPU
worker memory
queue depth
```

Do not optimize before measuring.

---

# 103. DOCKER TEST

Verify:

```text
docker compose up
```

starts:

```text
MySQL
Redis
API
Worker
```

and worker successfully connects to:

```text
Redis
MySQL
```

---

# 104. WORKER LOG EXAMPLE

Use structured logging.

Conceptually:

```text
[worker]
queue=notification
jobId=123
jobName=notification.send
attempt=2
companyId=abc
eventId=xyz
durationMs=250
status=completed
```

Follow the project's existing logger.

---

# 105. NO SENSITIVE LOGGING

Never log:

```text
password
access token
refresh token
OTP
payment secret
API key
Redis password
full sensitive payload
```

---

# 106. TYPESCRIPT

Use strong types.

Avoid:

```text
any
```

for:

```text
Job
JobData
WorkerResult
QueueOptions
EventPayload
```

Create typed contracts.

---

# 107. JOB CONTRACTS

Create explicit job contracts.

Example:

```typescript
interface NotificationJobData {
  eventId: string;
  companyId: string;
  userId: string;
  notificationId: string;
}
```

Adapt to the actual entities.

---

# 108. DOMAIN EVENTS VS JOBS

Do not confuse:

```text
Domain Event
```

with:

```text
BullMQ Job
```

Domain Event:

```text
Business fact
```

BullMQ Job:

```text
Processing instruction
```

Example:

```text
Domain Event:
sale.confirmed

Job:
send-sale-confirmation-notification
```

---

# 109. EVENT FLOW

Recommended:

```text
Sale Service
    ↓
MySQL Transaction
    ↓
Outbox Event:
sale.confirmed
    ↓
Outbox Publisher
    ↓
BullMQ
    ↓
Notification Worker
    ↓
Notification
```

This separation keeps business logic clean.

---

# 110. DO NOT PUT BUSINESS TRANSACTION IN QUEUE

Do not design:

```text
POST /sale
   ↓
Queue
   ↓
Worker creates Sale
```

if the API is expected to return authoritative Sale creation immediately.

Instead:

```text
POST /sale
   ↓
MySQL transaction
   ↓
Sale created
   ↓
Outbox event
   ↓
Queue side effects
```

---

# 111. BUSINESS COMMAND VS ASYNC SIDE EFFECT

Synchronous:

```text
Create Sale
Confirm Sale
Post Payment
Post Journal
Create Inventory Ledger
```

unless product requirements explicitly require asynchronous command processing.

Asynchronous:

```text
Send Email
Send Notification
Generate Report
Send Webhook
Export File
Sync External API
```

This is the default architecture.

---

# 112. FINANCIAL INTEGRITY

Never use BullMQ to bypass:

```text
MySQL transactions
database constraints
inventory locks
accounting double-entry rules
payment idempotency
```

BullMQ is infrastructure, not a replacement for domain correctness.

---

# 113. PHASE 20 DOCUMENTATION

Create/update:

```text
docs/architecture/bullmq.md
```

or the repository's equivalent.

Document:

```text
Queue architecture
Worker architecture
Queue naming
Job naming
Retry strategy
Backoff
Concurrency
Idempotency
Outbox integration
Redis integration
Failure handling
Docker deployment
Scaling
Monitoring
```

---

# 114. FINAL ARCHITECTURE

The intended architecture should look like:

```text
                         ┌──────────────────┐
                         │      Client      │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │    NestJS API    │
                         └────────┬─────────┘
                                  │
                          Business Transaction
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
              Business Data               Outbox Event
                    │                           │
                    └─────────────┬─────────────┘
                                  │
                                COMMIT
                                  │
                                  ▼
                         ┌──────────────────┐
                         │ Outbox Publisher │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │     BullMQ       │
                         │     Redis        │
                         └────────┬─────────┘
                                  │
                 ┌────────────────┼────────────────┐
                 │                │                │
                 ▼                ▼                ▼
            Notification       Report           Webhook
               Worker          Worker            Worker
                 │                │                │
                 └────────────────┼────────────────┘
                                  │
                                  ▼
                              MySQL /
                          External Services
```

---

# 115. PHASE 20 DEFINITION OF DONE

Phase 20 is complete only when:

```text
[ ] Existing Redis architecture inspected
[ ] Existing Outbox architecture inspected
[ ] Existing BullMQ implementation inspected

[ ] BullMQ infrastructure configured
[ ] Redis connection reused correctly
[ ] Queue naming centralized
[ ] Job naming centralized
[ ] Typed job contracts implemented

[ ] Queue producer implemented
[ ] Worker architecture implemented
[ ] API/Worker separation implemented
[ ] Worker graceful shutdown implemented

[ ] Concurrency configured
[ ] Retry strategy configured
[ ] Exponential backoff configured
[ ] Retryable/non-retryable errors classified
[ ] Failed job handling implemented
[ ] Completed job retention configured
[ ] Failed job retention configured

[ ] Job timeout strategy implemented
[ ] Idempotency implemented
[ ] Duplicate job handling implemented
[ ] Stalled job handling verified

[ ] Outbox → BullMQ integration verified
[ ] BullMQ → Worker integration verified
[ ] Worker → MySQL integration verified

[ ] Notification queue implemented where required
[ ] Email queue implemented where required
[ ] Report queue implemented where required
[ ] Webhook queue implemented where required
[ ] Import/export queues implemented where required

[ ] Tenant isolation verified
[ ] Company scope verified
[ ] Branch scope verified
[ ] Warehouse scope verified where applicable

[ ] Accounting jobs protected against duplicates
[ ] Inventory jobs protected against duplicates
[ ] Payment jobs protected against duplicates

[ ] External API retry handling implemented
[ ] HTTP 429 handling implemented
[ ] HTTP 5xx handling implemented
[ ] Timeout handling implemented

[ ] Worker structured logging implemented
[ ] Correlation ID support implemented
[ ] Metrics integration prepared

[ ] Docker API + Worker verified
[ ] Worker environment configuration verified
[ ] Worker graceful shutdown verified

[ ] Automated tests implemented
[ ] Queue tests
[ ] Worker tests
[ ] Retry tests
[ ] Idempotency tests
[ ] Outbox integration tests
[ ] Duplicate event tests
[ ] Redis failure tests
[ ] MySQL failure tests
[ ] External API failure tests
[ ] Tenant isolation tests
[ ] Security tests

[ ] Bruno tests added where APIs exist

[ ] Documentation updated
[ ] ESLint passes
[ ] Typecheck passes
[ ] Tests pass
[ ] Build passes
[ ] Docker validation passes
```

---

# 116. FINAL AI RULES

Before saying:

```text
Phase 20 completed
```

you MUST inspect the actual repository and verify the implementation.

Run the real project commands discovered from package.json.

Verify:

```text
Lint
Typecheck
Unit Tests
Integration Tests
Build
Docker
Redis
BullMQ
Worker
Outbox
Bruno
```

Do not claim success based only on generated code.

Do not rewrite completed phases unnecessarily.

Do not create duplicate Redis infrastructure.

Do not create duplicate Outbox infrastructure.

Do not create arbitrary queues without business justification.

Most importantly:

```text
MYSQL
   =
SOURCE OF TRUTH

REDIS
   =
INFRASTRUCTURE

BULLMQ
   =
ASYNC JOB PROCESSING

OUTBOX
   =
DURABLE EVENT SOURCE
```

The critical ERP rule is:

```text
Business Transaction
        ↓
MySQL Transaction
        ↓
COMMIT
        ↓
Outbox
        ↓
BullMQ
        ↓
Worker
        ↓
Async Side Effect
```

Never:

```text
BullMQ
   ↓
pretend business transaction succeeded
```

Never assume:

```text
BullMQ = exactly once
```

Design for:

```text
AT-LEAST-ONCE PROCESSING
+
IDEMPOTENT BUSINESS OPERATIONS
+
MYSQL CONSTRAINTS
+
TRANSACTIONS
```

Final principle:

```text
                    FASHION ERP
                         │
                  ┌──────┴──────┐
                  │             │
                 API          WORKERS
                  │             │
                  ▼             ▼
               MySQL         BullMQ
                  │             │
                  │           Redis
                  │             │
                  └──────┬──────┘
                         │
                       Outbox
                         │
                         ▼
                  Reliable Async
                    Processing
```

BullMQ should make the ERP **more scalable and reliable**, not move business correctness away from MySQL.
