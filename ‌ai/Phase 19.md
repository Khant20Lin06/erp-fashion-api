# Phase 19 — Redis

## Fashion ERP Backend

## Production-Ready Implementation Prompt

You are implementing **Phase 19 — Redis** of the Fashion ERP Backend.

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
```

Do NOT unnecessarily rewrite completed phases.

The existing repository is the primary source of truth.

---

# 2. PHASE 19 OBJECTIVE

Implement production-ready Redis infrastructure for the Fashion ERP Backend.

Redis MUST be treated as:

```text
High-Speed Infrastructure Layer
```

and NOT as the primary source of truth.

Primary source of truth:

```text
MySQL
```

Redis may be used for:

```text
Cache
Session-related temporary state
Rate limiting
Distributed locks
Idempotency support
BullMQ
Temporary state
Short-lived tokens/state where appropriate
Pub/Sub where explicitly required
Performance optimization
```

Do NOT move authoritative ERP data from MySQL into Redis.

---

# 3. CORE ARCHITECTURE

Target architecture:

```text
                    ┌─────────────────┐
                    │      MySQL      │
                    │ Source of Truth │
                    └────────┬────────┘
                             │
                             │
                    ┌────────▼────────┐
                    │   NestJS API    │
                    └────────┬────────┘
                             │
                 ┌───────────┼────────────┐
                 │           │            │
                 ▼           ▼            ▼
              Cache      Lock/State     BullMQ
                 │           │            │
                 └───────────┼────────────┘
                             │
                       ┌─────▼─────┐
                       │   Redis   │
                       └───────────┘
```

Redis failure must NOT corrupt MySQL business data.

---

# 4. FIRST STEP — INSPECT BEFORE CODING

Before modifying code, inspect the actual repository.

Search for:

```text
Redis
ioredis
redis
@nestjs/cache-manager
cache-manager
BullMQ
Queue
Worker
rate-limit
throttle
lock
mutex
idempotency
session
token
refresh
pubsub
```

Inspect:

```text
src/
modules/
common/
config/
database/
auth/
sales/
purchase/
inventory/
payment/
accounting/
outbox/
workers/
queues/
docker/
docker-compose
tests/
bruno/
```

Determine:

1. Is Redis already configured?
2. Is BullMQ already connected to Redis?
3. Is another Redis client already installed?
4. Is caching already implemented?
5. Is rate limiting already implemented?
6. Is there an existing distributed lock?
7. Is Redis used by Authentication?
8. Is Redis used by Outbox?
9. Is Redis configuration centralized?
10. Are there duplicate Redis connections?

Do NOT create duplicate Redis infrastructure.

---

# 5. REDIS RESPONSIBILITIES

Define Redis responsibilities clearly.

Recommended:

```text
Redis
├── Cache
├── BullMQ backend
├── Distributed Lock
├── Rate Limit
├── Idempotency support
├── Temporary state
└── Optional Pub/Sub
```

Do not use Redis for:

```text
Sales source of truth
Purchase source of truth
Inventory source of truth
Inventory ledger source of truth
Accounting source of truth
Payment source of truth
Customer source of truth
Supplier source of truth
User source of truth
```

---

# 6. REDIS FAILURE PRINCIPLE

The ERP backend must remain logically correct if Redis temporarily fails.

Example:

```text
Redis = DOWN
MySQL = UP
```

Expected:

```text
Create Sale
    ↓
MySQL transaction
    ↓
SUCCESS
```

Cache may fail.

Rate limit may temporarily degrade depending on security policy.

Async queues may be delayed.

But the authoritative business transaction must remain in MySQL.

---

# 7. REDIS MODULE

Create a centralized Redis infrastructure module following the existing project structure.

Conceptually:

```text
redis/
├── redis.module.ts
├── redis.service.ts
├── redis.constants.ts
├── redis.config.ts
├── redis.keys.ts
├── redis.types.ts
├── redis.health.ts
└── tests/
```

Adapt to the repository's existing folder conventions.

Do not blindly copy this structure.

---

# 8. REDIS CLIENT

Use a production-appropriate Redis client.

If the repository already uses:

```text
ioredis
```

reuse it.

If another client is already standardized, use that.

Do not install multiple Redis clients without a strong architectural reason.

---

# 9. CONNECTION MANAGEMENT

Redis configuration must be centralized.

Support:

```text
REDIS_URL
```

or equivalent configuration.

Potential configuration:

```text
REDIS_HOST
REDIS_PORT
REDIS_USERNAME
REDIS_PASSWORD
REDIS_DB
REDIS_TLS
```

Use whichever format is already established by the project.

Prefer:

```text
REDIS_URL
```

for Docker/production environments when appropriate.

---

# 10. CONFIGURATION VALIDATION

Validate Redis configuration at application startup.

Examples:

```text
REDIS_URL
REDIS_HOST
REDIS_PORT
```

Do not allow invalid Redis configuration to silently pass.

Use the existing configuration validation architecture.

---

# 11. ENVIRONMENT SEPARATION

Support:

```text
development
test
staging
production
```

Redis configuration must be environment-aware.

Do not hard-code:

```text
localhost
6379
password
```

inside application code.

---

# 12. CONNECTION POOL / CLIENT STRATEGY

Avoid creating a new Redis connection per request.

Use centralized long-lived connections.

Example conceptual architecture:

```text
NestJS Process
    │
    ├── Redis shared client
    ├── BullMQ connection
    └── optional subscriber connection
```

Important:

Redis Pub/Sub subscriber connections may require a dedicated connection.

Do not blindly reuse a Pub/Sub connection for normal commands.

---

# 13. REDIS CONNECTION TYPES

Understand that different workloads may require different connections.

Potential:

```text
Command Client
BullMQ Connection
Subscriber Client
Publisher Client
```

Do not create all of these unless needed.

Reuse safely where the Redis client/library supports it.

---

# 14. REDIS SERVICE

Create a reusable abstraction.

Conceptually:

```text
redisService.get()
redisService.set()
redisService.delete()
redisService.exists()
redisService.expire()
redisService.increment()
redisService.getOrSet()
```

Adapt names to the actual architecture.

Do not expose raw Redis access everywhere unless necessary.

---

# 15. RAW REDIS ACCESS

Avoid allowing every module to directly instantiate:

```text
new Redis(...)
```

Instead:

```text
Module
   ↓
RedisService
   ↓
Redis Client
```

This keeps:

```text
connection management
logging
metrics
error handling
configuration
```

centralized.

---

# 16. CACHE ARCHITECTURE

Implement a reusable cache abstraction.

Target:

```text
Application
    ↓
Cache Service
    ↓
Redis
```

Use cache only for data that is safe to regenerate.

Examples:

```text
Product details
Product pricing
Master data
Customer groups
Supplier groups
Branch configuration
Warehouse configuration
Dashboard summary
Permissions snapshot
```

Only cache according to actual access patterns.

---

# 17. CACHE-ASIDE PATTERN

Recommended:

```text
Request
   ↓
Check Redis
   │
   ├── HIT → return cached data
   │
   └── MISS
          ↓
       MySQL
          ↓
       Redis SET
          ↓
       return data
```

Do not make Redis authoritative.

---

# 18. CACHE INVALIDATION

When MySQL data changes:

```text
UPDATE Product
      ↓
Commit MySQL
      ↓
Invalidate Product Cache
```

Do not update Redis before the MySQL transaction is safely committed.

For important business transactions:

```text
MySQL = source of truth
Redis = derived state
```

---

# 19. CACHE CONSISTENCY

Do not assume cache is always perfectly synchronized.

If cache is stale:

```text
Invalidate
+
Reload
```

must restore correctness.

For highly sensitive data, use shorter TTL or no cache.

---

# 20. CACHE TTL

Every cache entry must have an explicit TTL.

Examples:

```text
Product cache       → 5 minutes
Master data         → 30 minutes
Dashboard summary   → 1 minute
Permission snapshot → 5 minutes
```

These are examples only.

Choose TTL based on actual business requirements.

Never create unlimited cache entries by default.

---

# 21. CACHE KEY STRATEGY

Create centralized key builders.

Example:

```text
erp:cache:product:{companyId}:{productId}
erp:cache:pricing:{companyId}:{priceListId}:{productId}
erp:cache:customer:{companyId}:{customerId}
```

Do NOT build random Redis keys throughout the codebase.

---

# 22. MULTI-TENANT CACHE KEYS

This is critical.

Cache keys MUST include appropriate tenant scope.

Example:

```text
company A
product 100
```

must not collide with:

```text
company B
product 100
```

Bad:

```text
product:100
```

Better:

```text
erp:company:A:product:100
```

or equivalent standardized key.

---

# 23. BRANCH / WAREHOUSE SCOPE

If cached data depends on:

```text
company
branch
warehouse
user
role
```

include the relevant scope in the cache key.

Do not return:

```text
Branch A data
```

to:

```text
Branch B user
```

because of an incomplete cache key.

---

# 24. RBAC CACHE

Phase 06 Dynamic RBAC may benefit from caching:

```text
user permissions
role permissions
data visibility rules
```

Example:

```text
erp:rbac:user:{userId}
```

If permissions change:

```text
Role updated
Permission updated
User role changed
```

invalidate the affected cache.

---

# 25. SECURITY OF RBAC CACHE

Never let a stale permission cache create a security vulnerability.

For security-sensitive permission changes:

```text
Permission Change
      ↓
Invalidate immediately
```

For critical operations, consider authoritative verification if necessary.

Do not rely blindly on long TTL.

---

# 26. USER ACCOUNT CACHE

If Phase 08 uses account-related temporary state:

```text
account lock
login attempts
OTP
password reset
temporary verification
```

Redis may be appropriate.

These are temporary states.

Do not store sensitive secrets unnecessarily.

---

# 27. OTP / VERIFICATION STATE

If OTP or verification codes are stored in Redis:

```text
SET key value EX TTL
```

Use short TTL.

Example:

```text
5 minutes
```

Do not persist OTP indefinitely.

Never log OTP values.

---

# 28. LOGIN ATTEMPTS

Redis can maintain temporary counters:

```text
login:attempts:{userId}
login:attempts:{ip}
```

with TTL.

Use atomic operations:

```text
INCR
EXPIRE
```

Avoid race-prone:

```text
GET
+
SET
```

for counters.

---

# 29. RATE LIMITING

Redis can provide distributed rate limiting.

Examples:

```text
login
refresh-token
password-reset
OTP
admin APIs
public APIs
```

Do not implement only in-memory rate limiting when multiple API instances may exist.

---

# 30. RATE LIMIT KEY

Keys may include:

```text
IP
userId
route
companyId
```

Example:

```text
erp:ratelimit:login:{ip}
```

Use the smallest identity that matches the security requirement.

---

# 31. DISTRIBUTED LOCK

Redis may be used for distributed locking.

Potential use cases:

```text
inventory synchronization
scheduled jobs
report generation
unique background tasks
cache rebuild
```

But do NOT use Redis locks as a replacement for MySQL transaction constraints.

---

# 32. REDIS LOCK SAFETY

A lock must have:

```text
unique lock token
TTL
safe release
```

Do not release a lock belonging to another process.

Bad:

```text
DEL lock:key
```

without verifying ownership.

Use token-based ownership.

---

# 33. LOCK TOKEN

Concept:

```text
SET lock:key randomToken NX EX 30
```

Only the owner holding:

```text
randomToken
```

may release the lock.

Use the Redis atomic compare-and-delete approach.

---

# 34. LOCK TTL

Never create an infinite distributed lock.

Example:

```text
LOCK_TTL_SECONDS
```

must be configurable.

---

# 35. LOCK EXTENSION

For long-running operations, consider lock renewal.

But do not automatically implement renewal unless the project has long-running Redis lock use cases.

Avoid unnecessary complexity.

---

# 36. REDIS + INVENTORY

Inventory is financially/business critical.

Redis can help with:

```text
temporary locks
cache
read optimization
idempotency
```

But the authoritative stock quantity remains:

```text
MySQL
+
Inventory Ledger
```

Do NOT make:

```text
Redis stock quantity
```

the source of truth.

---

# 37. REDIS + ACCOUNTING

Do not store authoritative:

```text
ledger balance
account balance
journal balance
```

only in Redis.

Accounting truth remains:

```text
MySQL
+
Double Entry Ledger
```

Redis may cache calculated summaries.

---

# 38. REDIS + PAYMENT

Payment status must remain authoritative in MySQL.

Redis may hold:

```text
temporary payment state
idempotency key
rate limits
temporary provider state
```

where appropriate.

---

# 39. REDIS + OUTBOX

Phase 18 Outbox uses:

```text
MySQL Outbox
```

as the durable source.

Redis/BullMQ is only the delivery mechanism.

Architecture:

```text
MySQL Outbox
      ↓
Publisher
      ↓
Redis/BullMQ
```

If Redis fails:

```text
Outbox remains PENDING
```

Do not delete the outbox event.

---

# 40. REDIS + BULLMQ

BullMQ requires Redis.

Ensure Redis configuration is compatible with the existing BullMQ architecture.

Do not create:

```text
Redis connection A
```

for BullMQ and another conflicting configuration without reason.

Centralize infrastructure configuration.

---

# 41. BULLMQ DATA

Do not put large ERP entities into BullMQ jobs.

Prefer:

```json
{
  "eventId": "uuid"
}
```

or compact identifiers.

Redis memory is finite.

---

# 42. IDEMPOTENCY

Redis may be used as a short-lived idempotency layer.

Example:

```text
erp:idempotency:{userId}:{requestId}
```

But for financial operations:

```text
Payment
Accounting
Sale confirmation
Inventory posting
```

do NOT rely exclusively on Redis idempotency.

Use MySQL unique constraints / durable records where business correctness requires durability.

---

# 43. FINANCIAL IDEMPOTENCY

For example:

```text
paymentId
idempotencyKey
```

should be backed by durable MySQL state.

Redis may accelerate duplicate detection.

It must not be the only protection.

---

# 44. CACHE STAMPEDE

Avoid thousands of requests simultaneously hitting MySQL after cache expiry.

Potential techniques:

```text
short lock
single-flight
staggered TTL
background refresh
```

Implement only where actual hot keys exist.

Do not overengineer every cache.

---

# 45. CACHE PENETRATION

Prevent repeated DB queries for invalid IDs.

Possible:

```text
negative cache
```

with very short TTL.

Example:

```text
product:not-found:{companyId}:{id}
```

Do not cache permanent nonexistence.

---

# 46. CACHE BREAKDOWN

For highly popular keys:

```text
product pricing
master data
dashboard summary
```

consider protecting cache misses.

Use distributed locking only when necessary.

---

# 47. CACHE KEY VERSIONING

Use a namespace/version.

Example:

```text
erp:v1:product:{companyId}:{id}
```

If cache schema changes:

```text
erp:v2:product:{companyId}:{id}
```

This avoids incompatible old cache values.

---

# 48. SERIALIZATION

Define consistent serialization.

Prefer:

```text
JSON
```

for normal application objects unless there is a specific performance requirement.

Handle:

```text
Date
Decimal
BigInt
```

carefully.

Especially:

```text
money
quantity
accounting amounts
```

must not silently lose precision.

---

# 49. MONEY VALUES

Do not serialize financial values in a way that introduces floating-point corruption.

Example:

Bad:

```text
0.1 + 0.2
```

Use the project's:

```text
Decimal
string
integer minor units
```

strategy.

Redis caching must preserve the exact representation.

---

# 50. CACHE DTOs, NOT ENTITIES

Prefer caching:

```text
response DTO
read model
projection
```

rather than TypeORM entities with:

```text
relations
lazy loaders
internal state
```

This avoids serialization problems.

---

# 51. INVALIDATION STRATEGY

For each cacheable resource document:

```text
Cache Key
TTL
Create behavior
Update behavior
Delete behavior
Invalidation trigger
Tenant scope
```

Do not create cache without knowing how it becomes stale.

---

# 52. EXAMPLE — PRODUCT

```text
GET Product
    ↓
Redis HIT
    ↓
return DTO
```

If MISS:

```text
MySQL
    ↓
DTO
    ↓
Redis SET EX 300
```

On update:

```text
UPDATE Product
    ↓
COMMIT
    ↓
DEL product cache
```

---

# 53. EXAMPLE — PERMISSION

```text
Check Permission
      ↓
Redis
      │
      ├── HIT → permission result
      │
      └── MISS → MySQL
                     ↓
                  Redis SET
```

When role/permission changes:

```text
invalidate affected users
```

Do not leave stale permissions indefinitely.

---

# 54. EXAMPLE — DASHBOARD

Dashboard data can be expensive.

Potential:

```text
GET /dashboard/summary
       ↓
Redis
       ↓
cached summary
```

TTL may be:

```text
30–60 seconds
```

depending on requirements.

Dashboard cache must still respect:

```text
company
branch
warehouse
user visibility
```

---

# 55. DATA VISIBILITY

This is critical for this ERP.

Never cache a response before applying:

```text
Dynamic RBAC
+
Data Visibility
+
Company Scope
+
Branch Scope
+
Warehouse Scope
```

Correct:

```text
User
 ↓
Authorization
 ↓
Data Scope
 ↓
Query
 ↓
Cache scoped result
```

Do NOT use one global cache for restricted data.

---

# 56. USER-SCOPED CACHE

If output depends on the user:

```text
erp:v1:user:{userId}:dashboard:{scopeHash}
```

or another safe strategy.

Avoid exposing one user's restricted result to another user.

---

# 57. CACHE AUTHORIZATION RULE

Never use:

```text
cached response
```

to bypass authorization.

Authorization must remain enforced.

---

# 58. REDIS HEALTH CHECK

Implement a health check.

Expected:

```text
Redis PING
    ↓
PONG
```

Health response should indicate:

```text
connected
latency
```

if supported by the existing health architecture.

---

# 59. REDIS FAILURE HANDLING

Decide behavior per feature.

Example:

```text
Cache:
Redis DOWN → fallback to MySQL

Rate Limit:
Redis DOWN → fail closed for security-critical endpoint
or controlled fallback depending on endpoint

BullMQ:
Redis DOWN → async jobs delayed

Distributed Lock:
Redis DOWN → operation may fail safely if lock is required
```

Do NOT use one global fallback rule for every Redis feature.

---

# 60. CACHE FAILURE

If cache read fails:

```text
Redis error
    ↓
log
    ↓
MySQL fallback
```

Do not crash the entire API for a cache miss/failure unless the operation specifically requires Redis.

---

# 61. BULLMQ FAILURE

If BullMQ cannot connect:

```text
Business transaction
```

must not be incorrectly rolled back solely because:

```text
Redis queue
```

is unavailable.

Phase 18 Outbox protects the event.

---

# 62. REDIS TIMEOUTS

Configure:

```text
connect timeout
command timeout
retry strategy
```

appropriately.

Do not allow Redis operations to hang API requests indefinitely.

---

# 63. RETRY STRATEGY

Redis client retry behavior must be carefully configured.

Avoid aggressive infinite retries that create:

```text
CPU spikes
connection storms
request hanging
```

Use bounded/reasonable retry behavior.

---

# 64. CIRCUIT BREAKER / DEGRADED MODE

If the project requires high availability, consider a Redis degraded mode.

Do not implement a complex circuit breaker unless necessary.

At minimum:

```text
Redis error
↓
fast failure
↓
fallback where safe
```

---

# 65. LOGGING

Log important Redis infrastructure events:

```text
connection
disconnect
reconnect
error
timeout
lock failure
cache failure
```

Do not log:

```text
password
OTP
tokens
Redis credentials
sensitive payload
```

---

# 66. METRICS PREPARATION

Prepare metrics:

```text
redis_connection_status
redis_command_latency
redis_cache_hit
redis_cache_miss
redis_cache_error
redis_lock_acquire
redis_lock_failure
redis_rate_limit
```

Phase 27 will provide full observability.

---

# 67. REDIS MEMORY

Design for finite memory.

Configure Docker/production Redis appropriately.

Do not allow unbounded application-generated keys.

Every cache key must have TTL unless it is intentionally persistent infrastructure state.

---

# 68. KEY EXPIRATION

Review keys periodically.

Potential categories:

```text
cache:*       → TTL required
otp:*         → TTL required
ratelimit:*   → TTL required
lock:*        → TTL required
idempotency:* → TTL or durable storage depending on purpose
bull:*        → BullMQ manages lifecycle
```

Do not manually delete BullMQ internal keys.

---

# 69. REDIS NAMESPACE

Use clear namespaces.

Example:

```text
erp:v1:cache:
erp:v1:lock:
erp:v1:ratelimit:
erp:v1:idempotency:
erp:v1:otp:
```

Do not mix unrelated application keys.

---

# 70. REDIS DATABASE NUMBER

Do not rely on Redis logical DB numbers as the primary namespace isolation mechanism.

Prefer key prefixes.

Example:

```text
erp:v1:
```

This works better with:

```text
Docker
managed Redis
BullMQ
monitoring
production
```

---

# 71. TEST ENVIRONMENT

Tests should use an isolated Redis instance/database.

Do not allow automated tests to delete developer production-like Redis keys.

Use:

```text
REDIS_TEST_URL
```

or test container according to the existing test architecture.

---

# 72. AUTOMATED TESTS

Implement tests for:

```text
Redis connection
GET
SET
DELETE
TTL
INCR
cache hit
cache miss
cache invalidation
tenant isolation
RBAC cache invalidation
rate limiting
distributed lock
lock ownership
lock expiry
idempotency
Redis failure
fallback behavior
BullMQ integration
Outbox integration
```

---

# 73. CACHE TEST

Test:

```text
First request
    ↓
MySQL
    ↓
Redis SET

Second request
    ↓
Redis HIT
    ↓
MySQL not called
```

---

# 74. CACHE INVALIDATION TEST

Test:

```text
GET Product
    ↓
Cache

UPDATE Product
    ↓
Commit
    ↓
Invalidate

GET Product
    ↓
MySQL
```

Expected:

```text
updated data
```

---

# 75. TENANT ISOLATION TEST

Create:

```text
Company A Product ID = 100
Company B Product ID = 100
```

Cache both.

Verify:

```text
Company A → A data
Company B → B data
```

Never:

```text
Company A → B data
```

---

# 76. RBAC CACHE TEST

Test:

```text
User
 ↓
Permission READ_SALE
```

Cache permission.

Then remove permission.

Expected:

```text
cache invalidated
```

and:

```text
READ_SALE
```

is denied.

---

# 77. DISTRIBUTED LOCK TEST

Run two concurrent processes:

```text
Process A
Process B
```

trying to acquire:

```text
lock:same-resource
```

Expected:

```text
A = acquired
B = rejected
```

After A releases:

```text
B
```

can acquire.

---

# 78. LOCK OWNERSHIP TEST

Scenario:

```text
A acquires lock token A
B attempts release using token B
```

Expected:

```text
lock remains
```

This is mandatory.

---

# 79. LOCK EXPIRATION TEST

Scenario:

```text
A acquires lock
A crashes
TTL expires
```

Expected:

```text
another process can eventually acquire
```

No permanent deadlock.

---

# 80. RATE LIMIT TEST

Example:

```text
5 requests / minute
```

After limit:

```text
429 Too Many Requests
```

according to the existing API error architecture.

Verify distributed behavior across multiple API instances if applicable.

---

# 81. REDIS FAILURE TEST

Stop Redis.

Test:

```text
GET Product
```

Expected:

```text
cache failure
↓
MySQL fallback
```

where the endpoint supports graceful degradation.

---

# 82. OUTBOX + REDIS FAILURE TEST

Stop Redis.

Create:

```text
Sale
```

Expected:

```text
MySQL Sale = SUCCESS
Outbox = PENDING
```

Redis returns.

Publisher:

```text
Outbox
 ↓
BullMQ
 ↓
PUBLISHED
```

---

# 83. BULLMQ TEST

Verify:

```text
BullMQ
 ↓
Redis
```

works using the centralized Redis configuration.

Do not create a second unrelated Redis server.

---

# 84. BRUNO

Add Phase 19 Bruno tests following the existing collection structure.

Potential:

```text
bruno/
└── phase-19-redis/
    ├── health/
    │   └── redis-health
    │
    ├── cache/
    │   ├── cache-hit
    │   ├── cache-miss
    │   └── cache-invalidation
    │
    ├── rate-limit/
    │   └── rate-limit-test
    │
    └── admin/
        └── redis-status
```

Do not expose dangerous Redis commands through HTTP.

NEVER create:

```text
GET /redis/:key
SET /redis
DELETE /redis/:key
FLUSHDB
FLUSHALL
```

as public/admin APIs.

---

# 85. SECURITY

Never expose Redis credentials through:

```text
API
Swagger
logs
error response
Bruno
```

Do not allow arbitrary key access through user input.

Never allow:

```text
FLUSHALL
FLUSHDB
CONFIG SET
EVAL
```

through application endpoints unless there is an extraordinary, controlled internal requirement.

Normally, there should be no such endpoint.

---

# 86. DOCKER REDIS

Ensure Docker infrastructure provides Redis.

Example:

```text
services:

  mysql:
    ...

  redis:
    image: redis:...
    ...

  api:
    ...

  worker:
    ...
```

Use a pinned Redis image version.

Do not use:

```text
redis:latest
```

for production.

---

# 87. REDIS PERSISTENCE

Decide whether Redis persistence is required per workload.

For:

```text
cache
```

persistence may not be required.

For:

```text
BullMQ
```

Redis persistence/recovery strategy may be important.

Do not assume all Redis data has the same durability requirement.

Document the decision.

---

# 88. REDIS EVICTION POLICY

For cache workloads, choose an appropriate eviction policy.

Do not blindly use:

```text
noeviction
```

or another policy without understanding BullMQ requirements.

Important:

```text
BullMQ data
```

must not be accidentally evicted because of an aggressive cache eviction policy.

If cache and BullMQ share Redis, carefully consider memory and eviction behavior.

---

# 89. CACHE + BULLMQ SHARING

If the same Redis instance is used for:

```text
Cache
+
BullMQ
```

ensure:

```text
memory limits
TTL
eviction policy
key namespace
monitoring
```

are safe.

If production scale requires separation later, architecture should allow:

```text
Redis Cache
Redis Queue
```

to be separated without rewriting business modules.

---

# 90. REDIS PREFIX

Use an application prefix where supported.

Example:

```text
erp
```

or:

```text
fashion-erp
```

But be careful not to interfere with BullMQ's own key naming.

---

# 91. REDIS COMMANDS

Use atomic Redis commands where correctness matters.

Examples:

```text
INCR
SET NX EX
EXPIRE
TTL
DEL
```

Avoid race-prone sequences when atomic alternatives exist.

---

# 92. MULTI / TRANSACTION

Redis MULTI/EXEC may be used where appropriate.

But do not assume Redis transactions provide:

```text
MySQL transaction + Redis transaction
```

atomicity.

They do not.

---

# 93. REDIS LOCK VS MYSQL LOCK

Use:

```text
MySQL transaction/locking
```

for database integrity.

Use:

```text
Redis distributed lock
```

for cross-process coordination where appropriate.

Do not replace:

```text
database constraints
```

with Redis locks.

---

# 94. UNIQUE CONSTRAINTS

For critical business operations, continue using MySQL constraints.

Examples:

```text
payment idempotency key
invoice number
SKU
account code
journal reference
```

Redis must not be the only protection.

---

# 95. CACHE WARMING

Do not implement global cache warming unless actual performance requirements justify it.

If needed, use:

```text
BullMQ
```

background jobs.

Do not block application startup while warming huge caches.

---

# 96. CACHE PRELOADING

Potential candidates:

```text
currency
units
tax configuration
product categories
system settings
```

Only if actual usage patterns justify it.

---

# 97. REDIS + REPORTS

Phase 22 Reports/Dashboard may use Redis for:

```text
dashboard summaries
expensive report snapshots
short-lived report results
```

But report correctness remains based on MySQL data.

---

# 98. REDIS + NOTIFICATIONS

Phase 21 Notifications may use:

```text
Redis
+
BullMQ
```

for queueing and temporary delivery state.

Outbox remains the durable event source.

---

# 99. REDIS + OBSERVABILITY

Phase 27 will monitor:

```text
memory
connections
latency
commands
errors
cache hit ratio
queue backlog
```

Prepare clean interfaces now.

---

# 100. NO OVERENGINEERING

Do NOT implement every possible Redis feature.

Phase 19 should provide the reusable foundation required by:

```text
Phase 20 — BullMQ Workers
Phase 21 — Notifications
Phase 22 — Reports / Dashboard
Phase 23 — API Security
Phase 26 — Performance
Phase 27 — Observability
```

Implement what the existing application actually needs.

---

# 101. REDIS MODULE API

The internal API should be simple.

Conceptually:

```text
RedisService
├── get
├── set
├── delete
├── exists
├── expire
├── increment
├── setIfNotExists
├── getOrSet
└── withLock
```

Do not expose unnecessary low-level commands.

---

# 102. CACHE SERVICE

Separate:

```text
RedisService
```

from:

```text
CacheService
```

Conceptually:

```text
RedisService
    ↓
low-level Redis infrastructure

CacheService
    ↓
application-level caching
```

This prevents business modules from becoming coupled to Redis commands.

---

# 103. LOCK SERVICE

Similarly:

```text
LockService
    ↓
Redis distributed lock implementation
```

Business modules should request:

```text
acquire(resource)
release(resource, token)
```

rather than manually writing Redis commands.

---

# 104. IDEMPOTENCY SERVICE

If required:

```text
IdempotencyService
    ↓
Redis
```

But financial operations should also have durable MySQL protection.

---

# 105. RATE LIMIT SERVICE

If required:

```text
RateLimitService
    ↓
Redis
```

Keep it separate from generic Redis access.

---

# 106. CLEAN ARCHITECTURE

Recommended dependency direction:

```text
Business Module
      │
      ├── CacheService
      ├── LockService
      ├── IdempotencyService
      └── RateLimitService
              │
              ▼
          RedisService
              │
              ▼
            Redis
```

Business modules should not depend directly on Redis internals.

---

# 107. ERROR HANDLING

Create typed/application-level errors for:

```text
RedisUnavailable
RedisTimeout
LockNotAcquired
CacheError
RateLimitExceeded
```

if consistent with the existing error architecture.

Do not expose raw Redis error messages to API clients.

---

# 108. TYPESCRIPT

Use strong types.

Avoid:

```text
any
```

for Redis payloads unless unavoidable.

Define:

```text
CacheValue
RedisKey
RedisTTL
LockToken
IdempotencyKey
```

or equivalent domain types where useful.

---

# 109. ESLINT / TYPECHECK

Before completion run:

```text
npm run lint
npm run typecheck
npm run test
npm run build
```

Use the actual package scripts discovered from the repository.

Do not assume these exact commands exist.

---

# 110. DATABASE

Redis implementation must not modify business database schema unnecessarily.

If Redis-specific durable metadata is required:

```text
```

justify it before adding a table.

Do not move data from MySQL to Redis simply to avoid database queries.

---

# 111. MIGRATION

If no MySQL migration is required, explicitly document:

```text
Phase 19 requires no business database migration.
```

If a durable idempotency table is needed:

```text
create a proper TypeORM migration
```

Do not use:

```text
synchronize=true
```

for production.

---

# 112. DOCUMENTATION

Create/update architecture documentation covering:

```text
Redis responsibilities
Cache strategy
Key naming
TTL strategy
Tenant isolation
RBAC cache invalidation
Distributed locks
Rate limiting
Idempotency
BullMQ relationship
Outbox relationship
Failure handling
Docker configuration
Production considerations
```

---

# 113. FINAL REDIS ARCHITECTURE

The final architecture should conceptually be:

```text
                           Fashion ERP
                                │
                    ┌───────────┴───────────┐
                    │                       │
                  MySQL                  NestJS
               Source of Truth             │
                                           │
                         ┌─────────────────┼──────────────────┐
                         │                 │                  │
                         ▼                 ▼                  ▼
                      Cache              Locks            Security
                         │                 │                  │
                         └─────────────────┼──────────────────┘
                                           │
                                           ▼
                                         Redis
                                           │
                           ┌───────────────┼───────────────┐
                           │               │               │
                           ▼               ▼               ▼
                        BullMQ          Temporary       Rate Limit
                                         State
                           │
                           ▼
                         Workers
                           │
                           ▼
                    Async Processing
```

And for Outbox:

```text
Business Transaction
       │
       ├── MySQL Business Data
       │
       └── MySQL Outbox Event
                │
              COMMIT
                │
                ▼
        Outbox Publisher
                │
                ▼
          Redis / BullMQ
                │
                ▼
             Workers
```

---

# 114. PHASE 19 DEFINITION OF DONE

Phase 19 is complete only when:

```text
[ ] Existing Redis implementation inspected
[ ] Existing BullMQ implementation inspected
[ ] Existing Outbox implementation inspected

[ ] Central Redis configuration implemented
[ ] Redis client implemented
[ ] Connection lifecycle implemented
[ ] Environment configuration implemented
[ ] Configuration validation implemented

[ ] RedisService implemented
[ ] CacheService implemented
[ ] LockService implemented where needed
[ ] RateLimitService implemented where needed
[ ] Idempotency support implemented where needed

[ ] Cache-aside pattern implemented
[ ] Cache TTL implemented
[ ] Cache key strategy implemented
[ ] Cache versioning implemented
[ ] Tenant-aware cache keys implemented
[ ] Branch-aware cache keys implemented where needed
[ ] RBAC cache invalidation implemented where needed

[ ] Redis distributed locking implemented safely
[ ] Lock token ownership implemented
[ ] Lock TTL implemented
[ ] Lock release verified

[ ] Rate limiting implemented where required
[ ] Atomic counters used where required

[ ] Redis + BullMQ integration verified
[ ] Redis + Outbox integration verified
[ ] Redis failure does not destroy MySQL business data

[ ] Financial operations do not depend solely on Redis
[ ] Inventory source of truth remains MySQL
[ ] Accounting source of truth remains MySQL
[ ] Payment source of truth remains MySQL

[ ] Redis health check implemented
[ ] Redis error handling implemented
[ ] Redis timeout configured
[ ] Redis retry behavior configured

[ ] Docker Redis configured
[ ] Redis version pinned
[ ] Production memory strategy documented
[ ] Cache/BullMQ memory interaction reviewed

[ ] Automated tests implemented
[ ] Cache tests
[ ] Tenant isolation tests
[ ] RBAC invalidation tests
[ ] Lock tests
[ ] Rate-limit tests
[ ] Redis failure tests
[ ] Outbox + Redis failure tests
[ ] BullMQ integration tests

[ ] Bruno Phase 19 collection implemented
[ ] No dangerous Redis HTTP endpoints

[ ] Documentation updated
[ ] ESLint passes
[ ] Typecheck passes
[ ] Tests pass
[ ] Build passes
[ ] Docker validation passes
```

---

# 115. FINAL AI RULES

Before saying:

```text
Phase 19 completed
```

you MUST inspect the actual repository and verify the implementation.

Run the real project commands for:

```text
tests
typecheck
lint
build
Docker
Redis
BullMQ
Bruno
```

Do not claim success based only on generated code.

Do not rewrite completed phases unnecessarily.

Do not create duplicate Redis clients or duplicate infrastructure.

Most importantly:

```text
MySQL = Source of Truth
Redis = Derived / Temporary / High-Speed Infrastructure
```

Never make Redis the authoritative source for:

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

For critical financial/business operations:

```text
MySQL Transaction
+
Database Constraints
+
Durable Idempotency
```

remain the final correctness mechanism.

Redis should improve:

```text
Performance
Scalability
Concurrency
Async Processing
Rate Limiting
Temporary State
```

without compromising ERP data integrity.

Final principle:

```text
                    MYSQL
                SOURCE OF TRUTH
                      │
          ┌───────────┴───────────┐
          │                       │
      Business Data            Outbox
          │                       │
          └───────────┬───────────┘
                      │
                    COMMIT
                      │
                      ▼
                    REDIS
          ┌───────────┼───────────┐
          │           │           │
        Cache       Lock       BullMQ
          │           │           │
          └───────────┼───────────┘
                      │
                      ▼
                 Async Workers
```

Redis is an optimization and coordination layer — **not the ERP database**.
