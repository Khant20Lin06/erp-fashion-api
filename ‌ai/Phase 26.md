# Phase 26 — Performance

## Fashion ERP Backend

## Production-Grade Performance Engineering Prompt

You are implementing **Phase 26 — Performance** of the Fashion ERP Backend.

The goal of this phase is to make the backend **measurably fast, scalable, predictable, and production-ready**.

Do NOT perform random micro-optimizations.

Performance work must be:

```text
Measure
↓
Identify Bottleneck
↓
Optimize
↓
Measure Again
↓
Compare
↓
Document
```

The actual repository implementation is the **source of truth**.

Do NOT invent modules, endpoints, tables, indexes, Redis keys, queues, or business rules that do not exist.

---

# 1. EXISTING STACK

The backend uses:

```text
NestJS
TypeScript
MySQL
TypeORM
Redis
BullMQ
Docker
JWT
Dynamic RBAC
Data Visibility
Audit Log
Outbox Pattern
REST API
```

Completed phases:

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
Phase 20 — BullMQ Workers
Phase 21 — Notifications
Phase 22 — Reports / Dashboard
Phase 23 — API Security
Phase 24 — Automated Testing
Phase 25 — Bruno API Testing
```

---

# 2. FIRST STEP — PERFORMANCE AUDIT

Before changing code, inspect the entire repository.

Inspect:

```text
src/
test/
package.json
ormconfig*
data-source*
.env*
docker-compose*
Dockerfile*
README*
```

Search for:

```text
TypeORM
Repository
EntityManager
QueryBuilder
find
findOne
findAndCount
relations
leftJoin
leftJoinAndSelect
select
order
where
pagination
Redis
cache
BullMQ
Queue
Worker
Processor
transaction
```

Also inspect:

```text
Controllers
Services
Repositories
Entities
DTOs
Guards
Interceptors
Middleware
Exception filters
```

Create a performance baseline before optimization.

---

# 3. PERFORMANCE PRINCIPLES

Follow these principles:

```text
Do not optimize without measurement.

Do not add Redis to every endpoint.

Do not add indexes blindly.

Do not use caching to hide bad SQL.

Do not increase database connections blindly.

Do not move everything to BullMQ.

Do not optimize only average latency.

Measure p50 / p95 / p99.

Measure throughput.

Measure error rate.

Measure database performance.

Measure memory.

Measure CPU.

Measure queue latency.

Measure cache hit/miss behavior.
```

---

# 4. PERFORMANCE TARGETS

Define practical targets for the current architecture.

Do not claim that a target has been achieved until it is measured.

Recommended initial targets:

```text
Simple authenticated API:
p95 < 300ms

Typical CRUD API:
p95 < 500ms

Complex report API:
p95 < 1500ms

Error rate:
< 1%

Health endpoint:
p95 < 100ms
```

These are initial engineering targets, not guaranteed requirements.

If the project has different documented SLAs, follow those instead.

---

# 5. BASELINE METRICS

Before optimization, record:

```text
CPU
Memory
API latency
p50
p95
p99
Requests/sec
Error rate
Database query count
Database query duration
Redis latency
Cache hit rate
Queue waiting time
Queue processing time
```

Create:

```text
docs/performance/
```

and document baseline measurements.

---

# 6. PERFORMANCE TEST ENVIRONMENT

Performance testing must use a controlled environment.

Prefer:

```text
Docker
+
MySQL
+
Redis
+
BullMQ
+
NestJS
```

Use representative data volumes.

Do not benchmark an empty database and call the result production performance.

---

# 7. REPRESENTATIVE DATASET

Create or document a performance dataset.

Consider:

```text
Companies
Branches
Warehouses
Users
Roles
Permissions
Customers
Suppliers
Products
Variants
Prices
Sales
Sale Items
Purchases
Purchase Items
Inventory records
Inventory Ledger records
Payments
Journal Entries
Journal Lines
Audit Logs
Outbox Events
```

Use realistic relationships.

---

# 8. DATA SCALE

Test at multiple scales where practical:

```text
Small
Medium
Large
```

Example:

```text
10K products
100K inventory ledger records
100K sales
500K sale items
1M audit logs
```

Do not blindly create these numbers if they are inappropriate for the project.

Document the actual dataset used.

---

# 9. DATABASE INDEX AUDIT

Inspect all TypeORM entities and existing MySQL indexes.

Check:

```text
Primary keys
Foreign keys
Unique constraints
Composite indexes
Filtering columns
Sorting columns
Join columns
Visibility columns
Status columns
Date columns
Tenant/company columns
Branch columns
Warehouse columns
Sales account columns
```

---

# 10. INDEXING RULE

Add an index only when there is a real query pattern that benefits from it.

Do not create indexes on every column.

For every new index document:

```text
Table
Columns
Query pattern
Reason
Expected benefit
Potential write/storage cost
```

---

# 11. COMPOSITE INDEXES

Pay particular attention to common ERP filters such as:

```text
companyId
branchId
warehouseId
salesAccountId
status
createdAt
updatedAt
```

Evaluate composite indexes based on actual queries.

Example concept:

```text
(company_id, branch_id, created_at)
```

Do not automatically add this exact index without query evidence.

---

# 12. INDEX ORDER

Analyze composite index column order.

Consider:

```text
Equality filters
Range filters
Sorting
Selectivity
```

Use actual MySQL query plans.

---

# 13. EXPLAIN ANALYZE

Use MySQL query analysis.

For slow queries inspect:

```text
EXPLAIN
EXPLAIN ANALYZE
```

Look for:

```text
full table scan
large row examination
filesort
temporary table
poor join strategy
missing index
```

Fix the underlying query where possible.

---

# 14. N+1 QUERY DETECTION

Search the codebase for N+1 patterns.

Typical examples:

```text
Load sales
↓
Loop sales
↓
Query customer
↓
Loop items
↓
Query product
↓
Loop items
↓
Query variant
```

Replace with appropriate:

```text
JOIN
QueryBuilder
batch query
relation loading
projection
```

according to actual requirements.

---

# 15. TYPEORM PERFORMANCE

Audit TypeORM usage.

Look for:

```text
find()
findOne()
findAndCount()
relations
eager loading
lazy loading
QueryBuilder
select
```

Avoid loading entire entities when only a few fields are required.

Prefer projections:

```text
SELECT required columns
```

instead of:

```text
SELECT *
```

where appropriate.

---

# 16. SELECT PROJECTION

For list endpoints, return only fields required by the API.

Avoid unnecessarily loading:

```text
large text
JSON columns
relations
audit metadata
unused fields
```

---

# 17. RELATION LOADING

Review every frequently used relation.

Determine whether it should use:

```text
JOIN
separate batch query
explicit relation query
```

Avoid blindly using:

```text
relations: [...]
```

for every request.

---

# 18. PAGINATION

All large collection endpoints must have controlled pagination.

Verify:

```text
page
limit
offset
```

or cursor pagination where appropriate.

Do not allow:

```text
limit=100000
```

or equivalent unrestricted queries.

---

# 19. PAGINATION LIMIT

Define a safe maximum.

Example:

```text
defaultLimit = 20
maxLimit = 100
```

Use the actual project convention if one exists.

---

# 20. OFFSET PAGINATION

Identify endpoints where OFFSET becomes expensive for large datasets.

Especially:

```text
Sales
Purchases
Inventory Ledger
Audit Logs
Payments
Journal Entries
```

---

# 21. CURSOR PAGINATION

Evaluate cursor/keyset pagination for very large datasets.

Typical candidates:

```text
Audit logs
Inventory ledger
Sales history
Payments
Notifications
```

Use cursor pagination only where it provides a measurable benefit.

---

# 22. SORTING PERFORMANCE

Audit:

```text
ORDER BY
```

for large tables.

Ensure common sort fields have appropriate indexes where justified.

Avoid arbitrary database sorting on unindexed large datasets.

---

# 23. FILTER PERFORMANCE

Audit filters used by:

```text
Reports
Sales
Purchase
Inventory
Customer
Supplier
Accounting
Audit logs
```

Ensure common filters can use indexes.

---

# 24. DATA VISIBILITY PERFORMANCE

This project has Dynamic RBAC + Data Visibility.

Do not optimize away authorization conditions.

A query such as:

```text
companyId
branchId
warehouseId
salesAccountId
```

must remain enforced.

Optimize the visibility query itself.

---

# 25. VISIBILITY QUERY DESIGN

Analyze queries such as:

```text
WHERE company_id = ?
AND branch_id = ?
AND warehouse_id = ?
```

and determine whether appropriate composite indexes exist.

Performance optimization must never weaken data isolation.

---

# 26. RBAC PERFORMANCE

Analyze:

```text
User
→ Roles
→ Permissions
→ Scope
```

for repeated database queries.

Identify whether permission checks cause:

```text
multiple queries/request
```

or excessive joins.

---

# 27. RBAC CACHING

If appropriate, cache stable permission information in Redis.

Potential cache concept:

```text
rbac:user:{userId}
```

Do not use this exact key unless compatible with the project's conventions.

Cache:

```text
permissions
roles
scope
```

only when safe.

---

# 28. RBAC CACHE INVALIDATION

If RBAC is cached, invalidate when:

```text
role changed
permission changed
role-permission changed
user-role changed
scope changed
user disabled
```

Never allow stale permissions to create a security vulnerability.

---

# 29. REDIS AUDIT

Review all Redis usage from Phase 19.

Measure:

```text
connection latency
command latency
memory
hit rate
miss rate
key count
TTL behavior
```

---

# 30. CACHE STRATEGY

Classify data into:

```text
Cacheable
Non-cacheable
Short TTL
Long TTL
Invalidation required
```

Potential cache candidates:

```text
Master data
Product metadata
Pricing
Permissions
Dashboard aggregates
```

Potential non-cacheable candidates:

```text
financial balances
inventory quantity
payment state
transactional state
```

unless the architecture has a safe consistency strategy.

---

# 31. CACHE-ASIDE

Where appropriate:

```text
Request
↓
Redis GET
↓
Hit → return
↓
Miss
↓
Database
↓
Redis SET
↓
Return
```

Use TTL.

Do not cache everything forever.

---

# 32. CACHE INVALIDATION

Document invalidation rules.

Example:

```text
Product updated
→ invalidate product cache

Price updated
→ invalidate pricing cache

Permission updated
→ invalidate user permission cache
```

---

# 33. CACHE STAMPEDE

Identify high-traffic cache keys.

Prevent many requests from simultaneously rebuilding the same cache.

Possible approaches:

```text
locking
single-flight
short jitter
BullMQ warmup
```

Choose based on actual needs.

---

# 34. REDIS MEMORY

Check:

```text
TTL
key size
serialized object size
duplicate data
```

Avoid storing huge API responses unnecessarily.

---

# 35. BULLMQ PERFORMANCE

Review all queues from Phase 20.

Measure:

```text
waiting jobs
active jobs
completed jobs
failed jobs
retry count
processing time
queue latency
```

---

# 36. WORKER CONCURRENCY

Review worker concurrency.

Do not blindly increase concurrency.

Consider:

```text
CPU
DB connections
Redis connections
external API limits
job type
transaction duration
```

---

# 37. JOB DESIGN

Slow operations should be asynchronous where appropriate.

Potential examples:

```text
large report generation
notifications
emails
PDF generation
bulk processing
reconciliation
data export
```

Do not move synchronous business-critical transactions into BullMQ merely for speed.

---

# 38. QUEUE BACKPRESSURE

Verify that high job volume does not overwhelm:

```text
database
Redis
workers
memory
```

---

# 39. JOB RETRY PERFORMANCE

Audit:

```text
attempts
backoff
dead-letter behavior
```

Avoid aggressive retries that create a retry storm.

---

# 40. DATABASE CONNECTION POOL

Inspect TypeORM/MySQL connection configuration.

Evaluate:

```text
connectionLimit
pool size
idle connections
queueing
connection acquisition time
```

Do not blindly increase pool size.

---

# 41. POOL SIZING

Consider total concurrency:

```text
API instances
Workers
Background jobs
Admin/report traffic
```

The total number of DB connections must remain within MySQL capacity.

---

# 42. TRANSACTION PERFORMANCE

Audit long transactions.

Look for:

```text
large loops inside transaction
network calls inside transaction
queue operations inside transaction
unnecessary queries
```

Keep transaction scope as small as safely possible.

---

# 43. INVENTORY TRANSACTION PERFORMANCE

Inventory operations are critical.

Measure:

```text
stock update
stock movement
transfer
ledger write
```

Ensure correctness is preserved.

Do not sacrifice transaction safety for latency.

---

# 44. ACCOUNTING TRANSACTION PERFORMANCE

Audit:

```text
journal creation
posting
payment posting
reversal
ledger update
```

Maintain:

```text
atomicity
double-entry integrity
```

while optimizing.

---

# 45. CONCURRENCY

Identify race-condition-sensitive operations:

```text
Inventory
Payments
Invoice numbering
Accounting posting
Stock transfer
Order confirmation
```

Measure concurrent behavior.

---

# 46. LOCK CONTENTION

Inspect:

```text
database locks
row locks
transaction duration
deadlocks
```

For MySQL.

Do not remove locks simply to improve performance.

---

# 47. DEADLOCK HANDLING

If deadlocks are possible, document and safely handle retry strategy.

Do not blindly retry every transaction indefinitely.

---

# 48. API RESPONSE SIZE

Measure large API responses.

Potential problems:

```text
huge lists
deep relations
duplicate data
large JSON fields
unnecessary metadata
```

Reduce payload size where appropriate.

---

# 49. COMPRESSION

Evaluate HTTP compression if not already configured.

Use it when response payloads are large enough to justify CPU overhead.

---

# 50. HTTP KEEP-ALIVE

Verify production HTTP connection behavior.

Do not optimize at the expense of correctness.

---

# 51. SERIALIZATION PERFORMANCE

Inspect expensive serialization:

```text
large entities
nested DTOs
circular relations
transformers
class-transformer
```

Avoid unnecessary transformations on high-volume endpoints.

---

# 52. DTO PERFORMANCE

Do not instantiate/process unnecessary DTO layers for huge datasets if measurable overhead exists.

Optimize only after profiling.

---

# 53. VALIDATION PERFORMANCE

Review global validation configuration.

Examples:

```text
whitelist
forbidNonWhitelisted
transform
```

Keep security validation enabled.

Optimize only if validation becomes measurable bottleneck.

---

# 54. AUTH PERFORMANCE

Measure:

```text
login
JWT verification
refresh
protected API
```

Avoid database lookups on every request when a safe architecture allows otherwise.

---

# 55. JWT STRATEGY

Do not remove security checks for performance.

If permission/scope data is encoded or cached, ensure revocation and permission changes remain safe.

---

# 56. REPORT PERFORMANCE

Reports are likely to be expensive.

Identify:

```text
Sales reports
Purchase reports
Inventory reports
Financial reports
Dashboard aggregates
```

Use:

```text
aggregation
proper indexes
optimized SQL
precomputed summaries
caching
async jobs
```

only where justified.

---

# 57. DASHBOARD PERFORMANCE

Dashboard APIs should not execute dozens of independent heavy queries on every request.

Measure query count.

Where appropriate:

```text
aggregate queries
parallel queries
cached aggregates
materialized summary tables
```

But do not introduce unnecessary complexity.

---

# 58. COUNT PERFORMANCE

Audit:

```text
COUNT(*)
COUNT(DISTINCT ...)
findAndCount()
```

on large tables.

`findAndCount()` may execute expensive count queries.

Use alternatives where the UI does not require exact total counts.

---

# 59. SEARCH PERFORMANCE

If the system has search functionality, inspect:

```text
LIKE '%term%'
```

on large tables.

Evaluate:

```text
prefix search
indexes
FULLTEXT
dedicated search system
```

based on actual requirements.

Do not introduce Elasticsearch/OpenSearch unless justified.

---

# 60. BULK OPERATIONS

Identify bulk operations:

```text
bulk product import
bulk inventory adjustment
bulk customer import
bulk update
bulk notifications
```

Avoid:

```text
for (...) {
  await repository.save(...)
}
```

for huge datasets.

Use appropriate batch operations.

---

# 61. BULK INSERT / UPDATE

Where safe, evaluate:

```text
insert()
update()
upsert()
batch operations
```

instead of thousands of individual queries.

Preserve validation and business rules.

---

# 62. AUDIT LOG PERFORMANCE

Audit log creation should not unnecessarily slow critical transactions.

If the architecture supports it, evaluate:

```text
Outbox
async processing
batch insertion
```

while preserving audit requirements.

---

# 63. OUTBOX PERFORMANCE

Measure:

```text
outbox insert latency
polling/processing
worker throughput
retry behavior
cleanup
```

Avoid unbounded outbox growth.

---

# 64. OUTBOX INDEXES

Review indexes for:

```text
status
createdAt
processedAt
aggregate/type
```

based on actual queries.

---

# 65. LOGGING PERFORMANCE

Inspect application logging.

Avoid excessive:

```text
debug logs
large request bodies
large response bodies
SQL logging
```

in production.

---

# 66. SQL LOGGING

SQL query logging may severely impact performance.

Use it for:

```text
development
profiling
debugging
```

but do not leave verbose SQL logging enabled in production without justification.

---

# 67. PROFILING

Use appropriate profiling tools.

Possible tools:

```text
Node.js profiler
Clinic.js
0x
MySQL performance schema
EXPLAIN ANALYZE
Docker stats
```

Use only tools appropriate to the environment.

---

# 68. NODE.JS CPU PROFILING

Identify:

```text
CPU-heavy functions
serialization
large loops
JSON processing
report generation
```

Do not guess CPU bottlenecks.

---

# 69. MEMORY PROFILING

Check for:

```text
large arrays
large cached objects
unbounded maps
event listeners
queue payloads
memory leaks
```

---

# 70. STREAMING

For large exports or files, evaluate streaming instead of loading the entire dataset into memory.

Potential candidates:

```text
CSV export
large report
data export
```

---

# 71. LOAD TESTING

Phase 26 must include controlled load testing.

Use an appropriate tool already present in the project, or add a lightweight tool if needed.

Possible tools:

```text
k6
autocannon
Artillery
```

Do not introduce multiple load-testing frameworks unnecessarily.

---

# 72. LOAD TEST SCENARIOS

At minimum test:

```text
Health
Login
Authenticated API
Product list
Customer list
Sales list
Sales creation
Inventory query
Dashboard/report
```

Use actual endpoints.

---

# 73. LOAD TEST LEVELS

Run gradually:

```text
Baseline
Low load
Medium load
High load
```

Example:

```text
10 concurrent users
25
50
100
```

Adjust based on the environment.

Do not claim production capacity from a local laptop benchmark.

---

# 74. PERFORMANCE METRICS

Record:

```text
Requests/sec
Average latency
p50
p90
p95
p99
Max latency
Error rate
CPU
Memory
DB connections
Redis latency
```

---

# 75. BOTTLENECK CLASSIFICATION

For every major performance problem classify:

```text
CPU-bound
Memory-bound
Database-bound
Redis-bound
Network-bound
Queue-bound
Lock-bound
Serialization-bound
```

Then optimize the correct layer.

---

# 76. BEFORE / AFTER REPORT

Create:

```text
docs/performance/performance-report.md
```

Include:

```text
Baseline
Problem
Root cause
Optimization
Before metrics
After metrics
Improvement %
Trade-offs
Remaining bottlenecks
```

---

# 77. PERFORMANCE REGRESSION TESTS

Important performance characteristics should be protected against regressions.

Examples:

```text
query count
response time threshold
payload size
pagination behavior
```

Do not make tests excessively timing-sensitive in CI.

Use generous thresholds for CI and stricter thresholds for dedicated performance environments.

---

# 78. QUERY COUNT TESTING

For important endpoints, detect unexpected query explosion.

Example:

```text
GET /sales
```

should not suddenly change from:

```text
5 queries
```

to:

```text
505 queries
```

because of an N+1 regression.

---

# 79. PERFORMANCE + SECURITY

Never optimize by removing:

```text
RBAC
Data Visibility
Validation
Audit
Transactions
Authorization
```

Security and correctness are higher priority than raw latency.

---

# 80. PERFORMANCE + ACCOUNTING

Never optimize accounting by:

```text
skipping ledger entries
skipping journal validation
skipping transaction boundaries
```

Financial correctness is mandatory.

---

# 81. PERFORMANCE + INVENTORY

Never optimize inventory by:

```text
removing stock locks
removing ledger writes
ignoring concurrent updates
```

Inventory correctness is mandatory.

---

# 82. PERFORMANCE + CACHE CONSISTENCY

Never allow cached values to silently override authoritative financial or inventory state.

The source of truth remains the database unless the architecture explicitly defines otherwise.

---

# 83. DOCKER PERFORMANCE

Measure containers:

```text
API
MySQL
Redis
Worker
```

Inspect:

```text
CPU
memory
network
restart behavior
```

Do not blindly assign huge resources.

---

# 84. MYSQL CONFIGURATION

Review production-relevant MySQL settings.

Do not change global MySQL configuration without evidence.

Document recommendations separately from code changes.

---

# 85. REDIS CONFIGURATION

Review:

```text
maxmemory
eviction
persistence
connection limits
```

Do not change production Redis policy blindly.

---

# 86. BULLMQ CONFIGURATION

Review:

```text
concurrency
attempts
backoff
removeOnComplete
removeOnFail
job retention
```

Prevent unbounded Redis growth.

---

# 87. API RATE LIMITING

Ensure performance protection exists where appropriate.

Rate limiting should prevent abusive traffic from exhausting:

```text
CPU
DB
Redis
workers
```

This complements Phase 23 API Security.

---

# 88. GRACEFUL SHUTDOWN

Verify API and workers handle shutdown gracefully.

Avoid:

```text
active transaction corruption
lost jobs
unfinished requests
```

---

# 89. HEALTH CHECK PERFORMANCE

Health endpoints should be lightweight.

Do not make health checks execute expensive reports or large database queries.

---

# 90. PERFORMANCE DOCUMENTATION

Create or update:

```text
docs/performance/
├── baseline.md
├── database.md
├── redis.md
├── bullmq.md
├── api.md
├── load-testing.md
└── performance-report.md
```

Only create files that are useful; avoid unnecessary duplication.

---

# 91. PERFORMANCE DASHBOARD

If observability from Phase 27 is not implemented yet, document the metrics that Phase 27 should expose.

Do not duplicate the observability implementation unnecessarily.

---

# 92. PHASE 27 BOUNDARY

Phase 26 focuses on:

```text
Performance Engineering
Benchmarking
Profiling
Query Optimization
Caching Strategy
Load Testing
Capacity Baseline
```

Phase 27 focuses on:

```text
Observability
Metrics
Tracing
Logs
Alerts
Dashboards
```

Do not turn Phase 26 into a full observability implementation.

---

# 93. NO PREMATURE MICROSERVICES

Do not split the application into microservices for performance unless profiling proves the modular monolith cannot meet requirements.

Prefer optimizing:

```text
Database
Indexes
Queries
Caching
Workers
Concurrency
Pagination
```

first.

---

# 94. NO PREMATURE KAFKA

Do not introduce Kafka merely for performance.

Existing:

```text
Outbox
Redis
BullMQ
```

may already be sufficient.

Only recommend Kafka if actual scale/requirements justify it.

---

# 95. NO PREMATURE ELASTICSEARCH

Do not introduce Elasticsearch/OpenSearch just to improve search without measuring the current search workload.

---

# 96. PERFORMANCE PRIORITY ORDER

Use this priority:

```text
1. Correctness
2. Security
3. Database query efficiency
4. Indexing
5. N+1 elimination
6. Pagination
7. API payload optimization
8. Redis caching
9. BullMQ asynchronous processing
10. Concurrency tuning
11. Infrastructure tuning
12. Micro-optimizations
```

---

# 97. FINAL PERFORMANCE CHECKLIST

Phase 26 is complete only when:

```text
[ ] Repository performance audit completed
[ ] Baseline metrics recorded
[ ] Representative dataset prepared/documented
[ ] Database indexes audited
[ ] Slow queries identified
[ ] EXPLAIN/EXPLAIN ANALYZE used
[ ] N+1 queries audited
[ ] TypeORM usage optimized where necessary
[ ] SELECT projections reviewed
[ ] Pagination reviewed
[ ] Cursor pagination evaluated
[ ] Sorting reviewed
[ ] Filtering reviewed
[ ] Data visibility queries optimized
[ ] RBAC query performance reviewed
[ ] Redis usage audited
[ ] Cache strategy documented
[ ] Cache invalidation documented
[ ] Cache stampede risks reviewed
[ ] BullMQ performance reviewed
[ ] Worker concurrency reviewed
[ ] Queue backpressure reviewed
[ ] DB connection pool reviewed
[ ] Transaction performance reviewed
[ ] Lock contention reviewed
[ ] Deadlock strategy reviewed
[ ] API response size reviewed
[ ] Serialization reviewed
[ ] Bulk operations reviewed
[ ] Audit log performance reviewed
[ ] Outbox performance reviewed
[ ] Logging overhead reviewed
[ ] Node profiling performed where necessary
[ ] Memory profiling performed where necessary
[ ] Load testing implemented
[ ] Smoke load tests executed
[ ] Sales load tested
[ ] Inventory load tested
[ ] Report/dashboard load tested
[ ] p50/p95/p99 recorded
[ ] Error rate recorded
[ ] CPU/memory recorded
[ ] Before/after comparison documented
[ ] Performance regression strategy documented
[ ] Docker resource usage reviewed
[ ] Production performance recommendations documented
[ ] No security rules removed
[ ] No accounting correctness removed
[ ] No inventory correctness removed
[ ] No premature microservices introduced
[ ] Phase 27 boundary maintained
```

---

# 98. FINAL PERFORMANCE ARCHITECTURE

The final architecture should follow:

```text
                         Client
                           │
                           ▼
                    NestJS API Layer
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
           Auth/RBAC    Redis Cache   Validation
              │            │
              └──────┬─────┘
                     │
                     ▼
                 Services
                     │
          ┌──────────┼──────────┐
          │          │          │
          ▼          ▼          ▼
       TypeORM     BullMQ     Outbox
          │          │          │
          ▼          ▼          ▼
        MySQL      Workers    Events
          │
          ▼
     Optimized Queries
          │
     ┌────┼────┐
     ▼    ▼    ▼
   Index  Join  Aggregation
```

Performance engineering loop:

```text
Real Request
     │
     ▼
Measure
     │
     ▼
Find Bottleneck
     │
     ├── CPU
     ├── Memory
     ├── MySQL
     ├── Redis
     ├── BullMQ
     ├── Network
     └── Lock
     │
     ▼
Optimize
     │
     ▼
Benchmark Again
     │
     ▼
Compare
     │
     ▼
Document
```

---

# 99. FINAL RULE

Do not report:

```text
"Performance optimized"
```

without measurements.

Every meaningful optimization must answer:

```text
What was slow?

Why was it slow?

What was changed?

What was the baseline?

What is the result now?

What trade-off was introduced?

Did correctness remain unchanged?

Did security remain unchanged?

Did data visibility remain unchanged?

Did accounting remain correct?

Did inventory remain correct?
```

The objective of Phase 26 is not:

```text
"Make everything faster."
```

The objective is:

```text
Make the Fashion ERP Backend
measurably faster,
more scalable,
more predictable,
and more efficient
without sacrificing
security, data isolation,
inventory correctness,
accounting correctness,
or maintainability.
```
