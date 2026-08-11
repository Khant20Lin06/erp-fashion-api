# Phase 27 — Observability

## Fashion ERP Backend

## Production-Grade Observability Implementation Prompt

You are implementing **Phase 27 — Observability** of the Fashion ERP Backend.

The goal of this phase is to make the backend:

```text
Observable
Debuggable
Traceable
Measurable
Alertable
Production-ready
```

The system must allow engineers to answer:

```text
What happened?

When did it happen?

Which user caused it?

Which request caused it?

Which endpoint was involved?

Which database query was slow?

Which queue/job was involved?

Which service failed?

How many users were affected?

Is the system currently healthy?

Where is the bottleneck?
```

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
Phase 26 — Performance
```

---

# 2. SOURCE OF TRUTH

Before implementation:

```text
Inspect the existing repository.

Do not invent architecture.

Do not duplicate existing logging.

Do not create duplicate audit systems.

Do not replace existing libraries without reason.

Do not break existing modules.

Do not change business logic unnecessarily.
```

Inspect:

```text
src/
test/
package.json
Dockerfile*
docker-compose*
.env*
README*
```

Especially inspect:

```text
Logger
Exception filters
Interceptors
Middleware
Guards
Auth
Audit Log
Outbox
Redis
BullMQ
Database
Health checks
Configuration
```

---

# 3. OBSERVABILITY PILLARS

Implement the three primary observability pillars:

```text
1. Logs
2. Metrics
3. Traces
```

Also implement:

```text
4. Health checks
5. Error tracking
6. Alerting strategy
7. Correlation IDs
8. Request context
9. Queue monitoring
10. Database monitoring
```

---

# 4. OBSERVABILITY ARCHITECTURE

Target architecture:

```text
                         Client
                           │
                           ▼
                    NestJS API
                           │
                    Correlation ID
                           │
             ┌─────────────┼─────────────┐
             │             │             │
             ▼             ▼             ▼
           Logs          Metrics       Traces
             │             │             │
             └─────────────┼─────────────┘
                           │
                           ▼
                    Observability
                       Backend
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
       Dashboard        Alerts          Analysis
```

For:

```text
BullMQ
MySQL
Redis
```

also collect operational telemetry.

---

# 5. LOGGING

Implement structured logging.

Logs must preferably be machine-readable.

Recommended format:

```json
{
  "timestamp": "...",
  "level": "info",
  "service": "fashion-erp-api",
  "environment": "production",
  "message": "...",
  "requestId": "...",
  "userId": "...",
  "companyId": "...",
  "branchId": "...",
  "module": "...",
  "action": "..."
}
```

Adapt fields to the actual architecture.

---

# 6. LOG LEVELS

Define clear levels:

```text
fatal
error
warn
info
debug
```

Use appropriate levels.

Do not log everything as `info`.

---

# 7. PRODUCTION LOGGING

Production should avoid excessive debug logging.

Default production behavior should prioritize:

```text
error
warn
important info
security events
business-critical events
```

---

# 8. DEVELOPMENT LOGGING

Development can provide more detailed information.

But never expose:

```text
password
JWT
refresh token
API secret
database password
payment credentials
private keys
```

---

# 9. PII / SENSITIVE DATA

Never log sensitive values.

Audit all logging statements for:

```text
password
passwordHash
accessToken
refreshToken
authorization header
cookie
secret
API key
payment credentials
personal sensitive data
```

Redact where necessary.

---

# 10. REQUEST ID

Every HTTP request should have a unique request ID.

Example:

```text
X-Request-ID
```

Behavior:

```text
Client provides request ID
        │
        ▼
Validate/use safely
        │
        ▼
Otherwise generate UUID
        │
        ▼
Attach to request context
        │
        ▼
Return in response
        │
        ▼
Include in logs
```

Do not trust arbitrary client-provided IDs without validation.

---

# 11. CORRELATION ID

Support correlation across:

```text
HTTP Request
↓
Service
↓
Database
↓
Outbox
↓
BullMQ Job
↓
Notification
```

The same logical operation should be traceable across asynchronous boundaries.

---

# 12. ASYNC CONTEXT

Use an appropriate mechanism such as:

```text
AsyncLocalStorage
```

or an equivalent solution already used by the project.

The context should provide access to:

```text
requestId
correlationId
userId
companyId
branchId
```

where available.

---

# 13. USER CONTEXT

When authenticated:

```text
userId
```

should be available in observability context.

Where appropriate:

```text
role
companyId
branchId
accountId
```

may be recorded.

Do not log unnecessary sensitive information.

---

# 14. REQUEST LOGGING

Capture:

```text
HTTP method
route
status code
duration
requestId
userId if available
```

Example conceptual event:

```text
POST /api/v1/sales
status=201
duration=143ms
requestId=...
userId=...
```

Do not log full request bodies by default.

---

# 15. RESPONSE LOGGING

Record:

```text
status code
duration
requestId
```

Do not log full response bodies in production by default.

---

# 16. ERROR LOGGING

Every unexpected application error should contain enough context to debug.

Include:

```text
timestamp
error name
message
stack trace
requestId
route
method
status
userId
module
environment
```

Do not expose internal stack traces to API clients in production.

---

# 17. ERROR RESPONSE

API clients should receive a safe error response.

Example conceptual structure:

```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "requestId": "..."
}
```

Do not expose:

```text
SQL
stack trace
filesystem path
internal service details
secrets
```

---

# 18. GLOBAL EXCEPTION FILTER

Review the existing global exception handling.

Integrate observability without breaking:

```text
HTTP errors
validation errors
authorization errors
database errors
business errors
unexpected errors
```

Differentiate expected business errors from unexpected system errors.

---

# 19. BUSINESS ERROR VS SYSTEM ERROR

Examples:

Business:

```text
Insufficient stock
Invalid payment state
Credit limit exceeded
Permission denied
```

System:

```text
Database unavailable
Redis unavailable
Unexpected exception
Out-of-memory
Network failure
```

Observability should classify them appropriately.

---

# 20. ERROR TRACKING

Implement a production-grade error tracking strategy.

Possible technologies:

```text
Sentry
OpenTelemetry-compatible backend
centralized logging system
```

Do not introduce multiple error tracking platforms unnecessarily.

If the project already has an error tracking solution, integrate with it.

---

# 21. METRICS

Implement application metrics.

At minimum:

```text
HTTP request count
HTTP request duration
HTTP error count
Active requests
```

---

# 22. HTTP METRICS

Track:

```text
requests_total
request_duration
errors_total
```

Recommended labels:

```text
method
route
status_code
```

Avoid high-cardinality labels such as:

```text
userId
requestId
orderId
customerId
```

---

# 23. LATENCY METRICS

Track latency distribution.

Prefer:

```text
histogram
```

rather than only average latency.

Track:

```text
p50
p90
p95
p99
```

where supported by the metrics system.

---

# 24. ERROR RATE

Measure:

```text
5xx rate
4xx rate
```

Do not treat every 4xx as a system failure.

Differentiate:

```text
client errors
authorization errors
validation errors
server errors
```

---

# 25. BUSINESS METRICS

Because this is an ERP, technical metrics alone are insufficient.

Where appropriate, track business-level metrics such as:

```text
sales_created_total
sales_completed_total
sales_cancelled_total
purchase_created_total
inventory_adjustments_total
payments_created_total
journal_entries_posted_total
notifications_sent_total
```

Use actual business events from the codebase.

Do not invent events that do not exist.

---

# 26. BUSINESS METRIC RULE

Business metrics must not expose sensitive data.

Do not use:

```text
customer name
phone number
email
address
user ID
```

as metric labels.

---

# 27. INVENTORY METRICS

Useful metrics may include:

```text
inventory_transaction_total
inventory_adjustment_total
stock_transfer_total
inventory_operation_duration
inventory_conflict_total
```

Only implement events supported by the actual inventory architecture.

---

# 28. ACCOUNTING METRICS

Potential metrics:

```text
journal_posted_total
journal_reversal_total
accounting_operation_duration
accounting_error_total
```

Do not change accounting behavior merely to generate metrics.

---

# 29. QUEUE METRICS

BullMQ observability should include:

```text
jobs_waiting
jobs_active
jobs_completed
jobs_failed
jobs_delayed
job_processing_duration
job_waiting_duration
retry_count
```

Track per queue where practical.

---

# 30. QUEUE FAILURE

Alert on:

```text
high failure rate
large waiting queue
long processing time
repeated retries
stuck jobs
```

---

# 31. QUEUE CORRELATION

When a job is created, preserve:

```text
requestId
correlationId
user context if appropriate
```

Do not place sensitive authentication tokens inside job payloads.

---

# 32. JOB LOGGING

Worker logs should contain:

```text
queue
jobId
jobName
attempt
duration
status
correlationId
```

---

# 33. REDIS METRICS

Observe:

```text
Redis latency
connection count
memory usage
cache hits
cache misses
evictions
errors
```

Use the capabilities of the selected Redis setup.

---

# 34. CACHE METRICS

Track:

```text
cache_hit_total
cache_miss_total
cache_error_total
cache_set_total
cache_invalidation_total
```

Do not create high-cardinality labels.

---

# 35. MYSQL METRICS

Observe:

```text
connection usage
query duration
slow queries
errors
transactions
deadlocks
```

Where practical.

---

# 36. DATABASE QUERY OBSERVABILITY

Identify slow queries.

Possible threshold:

```text
> 500ms
```

but use an environment-appropriate threshold.

Do not log every SQL query in production.

---

# 37. QUERY COUNT

Important endpoints should expose enough information to identify query explosions.

Use:

```text
development
testing
profiling
```

for detailed query analysis.

Do not enable excessive SQL logging in production.

---

# 38. OPEN TELEMETRY

Evaluate whether OpenTelemetry is appropriate for:

```text
tracing
metrics
context propagation
```

If introducing OpenTelemetry:

```text
Use it consistently.
Do not create a partial implementation that duplicates another tracing system.
```

---

# 39. DISTRIBUTED TRACING

Even if the system is currently a modular monolith, tracing should be designed to support future components:

```text
API
Worker
Redis
MySQL
External services
```

---

# 40. TRACE STRUCTURE

Conceptually:

```text
HTTP Request
    │
    ├── Auth
    ├── RBAC
    ├── Service
    │      ├── Database
    │      ├── Redis
    │      └── Outbox
    │
    └── BullMQ
           └── Worker
```

Each important operation should be traceable.

---

# 41. TRACE ATTRIBUTES

Useful attributes:

```text
http.method
http.route
http.status_code
service.name
deployment.environment
db.system
db.operation
messaging.system
messaging.destination
```

Avoid sensitive attributes.

---

# 42. TRACE SAMPLING

Do not necessarily trace 100% of production traffic.

Evaluate:

```text
100% development
lower sampling production
100% errors
higher sampling slow requests
```

Use appropriate production settings.

---

# 43. SLOW REQUEST DETECTION

Define a slow-request threshold.

Example:

```text
> 1 second
```

Do not assume this is universally correct.

Use Phase 26 benchmark results to choose the threshold.

Slow requests should include:

```text
requestId
route
duration
traceId if available
user context where safe
```

---

# 44. HEALTH CHECKS

Implement production health checks.

At minimum:

```text
Liveness
Readiness
```

---

# 45. LIVENESS

Liveness should answer:

```text
Is the process alive?
```

It should remain lightweight.

Do not fail liveness because a temporary external dependency is unavailable.

---

# 46. READINESS

Readiness should answer:

```text
Can this instance safely receive traffic?
```

Check appropriate dependencies:

```text
MySQL
Redis
```

and any truly required services.

---

# 47. DEPENDENCY HEALTH

Do not make health checks excessively expensive.

Use lightweight connectivity checks.

---

# 48. HEALTH ENDPOINTS

Typical structure:

```text
GET /health/live
GET /health/ready
```

Use the project's existing route conventions if different.

---

# 49. HEALTH SECURITY

Health endpoints must not expose:

```text
database credentials
Redis credentials
environment secrets
internal hostnames
stack traces
```

---

# 50. DOCKER HEALTHCHECK

Where appropriate, integrate:

```text
Docker HEALTHCHECK
```

with the application health endpoints.

---

# 51. READINESS DURING DEPLOYMENT

During deployment:

```text
Container starts
↓
Application initializes
↓
Dependencies available
↓
Readiness = healthy
↓
Traffic accepted
```

If dependencies are unavailable:

```text
Readiness = unhealthy
```

---

# 52. ALERTING

Define alerts for important production failures.

Examples:

```text
High 5xx rate
High p95 latency
Database unavailable
Redis unavailable
Queue backlog
Queue failure spike
High memory
High CPU
Deadlocks
Outbox backlog
```

---

# 53. ALERT PRIORITY

Classify alerts:

```text
Critical
High
Medium
Low
```

Example:

```text
Critical:
API unavailable
Database unavailable

High:
5xx spike
Queue backlog
Inventory processing failures

Medium:
High latency
Redis cache degradation

Low:
Cache hit-rate degradation
```

Adjust based on actual architecture.

---

# 54. ALERT FATIGUE

Do not create dozens of noisy alerts.

Every alert must answer:

```text
What happened?

Why does it matter?

What should the engineer do?
```

---

# 55. DASHBOARD

Create an observability dashboard specification.

Sections:

```text
System Health
API
Database
Redis
BullMQ
Business
Errors
Infrastructure
```

---

# 56. SYSTEM HEALTH DASHBOARD

Show:

```text
API availability
5xx rate
p95 latency
CPU
Memory
DB health
Redis health
Queue health
```

---

# 57. API DASHBOARD

Show:

```text
Requests/sec
p50
p95
p99
4xx
5xx
Top slow endpoints
Top failing endpoints
```

---

# 58. DATABASE DASHBOARD

Show:

```text
Connection usage
Slow queries
Query duration
Deadlocks
Errors
Transaction duration
```

---

# 59. REDIS DASHBOARD

Show:

```text
Memory
Connections
Latency
Hit rate
Miss rate
Evictions
Errors
```

---

# 60. BULLMQ DASHBOARD

Show:

```text
Waiting
Active
Completed
Failed
Delayed
Retries
Processing latency
Queue latency
```

---

# 61. BUSINESS DASHBOARD

Where appropriate:

```text
Sales volume
Purchase volume
Inventory operations
Payments
Accounting operations
Notifications
```

Do not duplicate Phase 22's business reporting system.

Phase 27 should focus on operational observability.

---

# 62. OBSERVABILITY VS REPORTING

Do not confuse:

```text
Phase 22 — Reports / Dashboard
```

with:

```text
Phase 27 — Observability
```

Phase 22:

```text
Business users
Sales
Inventory
Accounting
KPIs
Reports
```

Phase 27:

```text
Developers
DevOps
System health
Errors
Latency
Queues
Infrastructure
```

---

# 63. AUDIT LOG INTEGRATION

Existing Audit Log should answer:

```text
Who changed business data?
What changed?
When?
```

Observability should answer:

```text
What happened technically?
Which request?
Which trace?
Which service?
Which error?
```

Do not merge the two systems unnecessarily.

---

# 64. AUDIT LOG CORRELATION

Where appropriate, audit events can include:

```text
requestId
correlationId
```

This allows:

```text
Business Audit
       ↕
Technical Trace
```

without duplicating information.

---

# 65. SECURITY EVENTS

Observe security-relevant events:

```text
login failure
account lock
permission denied
token failure
suspicious rate
admin operation
```

Do not log credentials.

---

# 66. AUTH OBSERVABILITY

Measure:

```text
login success
login failure
refresh success
refresh failure
authentication error
authorization denial
```

Do not expose passwords or tokens.

---

# 67. RBAC OBSERVABILITY

Track:

```text
authorization_denied_total
permission_check_duration
```

Potentially distinguish:

```text
permission
scope
resource
```

but avoid high-cardinality labels.

---

# 68. DATA VISIBILITY OBSERVABILITY

For failures involving:

```text
company
branch
warehouse
sales account
```

capture enough context to debug the authorization decision.

Do not expose unauthorized records in logs.

---

# 69. REQUEST → DATABASE → QUEUE CORRELATION

A complete trace should ideally allow:

```text
POST /sales
      │
      ▼
requestId=ABC
      │
      ▼
Create Sale
      │
      ├── MySQL transaction
      │
      ├── Inventory operation
      │
      ├── Accounting operation
      │
      └── Outbox event
              │
              ▼
          BullMQ Job
              │
              ▼
            Worker
```

---

# 70. PERFORMANCE INTEGRATION

Use Phase 26 metrics.

Observability should make it possible to detect:

```text
Slow API
↓
Slow service
↓
Slow SQL
↓
Missing index
```

or:

```text
Slow API
↓
Queue backlog
↓
Worker saturation
```

---

# 71. PERFORMANCE REGRESSION DETECTION

Create operational visibility for:

```text
p95 increase
p99 increase
error increase
query duration increase
queue latency increase
```

---

# 72. RESOURCE UTILIZATION

Monitor:

```text
CPU
Memory
Disk
Network
```

where infrastructure monitoring is available.

---

# 73. CONTAINER OBSERVABILITY

For Docker containers monitor:

```text
API
Worker
MySQL
Redis
```

Observe:

```text
CPU
memory
restart count
health
```

---

# 74. LOG RETENTION

Define a retention strategy.

Consider:

```text
Development
Staging
Production
```

Do not retain logs indefinitely without a reason.

---

# 75. LOG ROTATION

Production logs must not fill disk storage.

Use:

```text
rotation
centralized logging
retention
compression
```

where appropriate.

---

# 76. STRUCTURED LOG SEARCH

Logs should be searchable by:

```text
requestId
correlationId
traceId
userId
module
route
error
```

where safe.

---

# 77. ENVIRONMENT SEPARATION

Observability configuration must distinguish:

```text
development
test
staging
production
```

Examples:

```text
LOG_LEVEL
TRACE_SAMPLE_RATE
METRICS_ENABLED
```

Use actual project configuration conventions.

---

# 78. CONFIGURATION

Do not hardcode:

```text
monitoring URL
Sentry DSN
OTLP endpoint
credentials
sampling rate
```

Use environment configuration/secrets.

---

# 79. SECRET MANAGEMENT

Never commit:

```text
Sentry DSN if sensitive
API tokens
OTLP credentials
database credentials
Redis credentials
```

Use environment variables or secret management.

---

# 80. OBSERVABILITY FAILURE

Observability must not crash the ERP application.

If:

```text
metrics backend unavailable
trace exporter unavailable
logging backend unavailable
```

the business API should remain functional where possible.

Use safe fallbacks.

---

# 81. EXPORTER FAILURE

Telemetry exporters should fail gracefully.

Do not allow:

```text
telemetry failure
```

to become:

```text
business transaction failure
```

unless explicitly required.

---

# 82. TELEMETRY OVERHEAD

Measure observability overhead.

Do not introduce instrumentation that significantly increases:

```text
CPU
memory
latency
network
```

---

# 83. HIGH CARDINALITY

Avoid metric labels such as:

```text
userId
requestId
saleId
customerId
productId
```

High-cardinality values belong in logs/traces, not metrics.

---

# 84. NAMING CONVENTION

Define consistent metric names.

Example:

```text
http_requests_total
http_request_duration_seconds
http_errors_total
bullmq_jobs_total
bullmq_job_duration_seconds
redis_cache_hits_total
redis_cache_misses_total
```

Follow the selected metrics system's conventions.

---

# 85. TRACE NAMING

Use meaningful span names.

Prefer:

```text
HTTP POST /sales
DB SELECT sales
BullMQ process notification
```

instead of:

```text
function1
service2
query3
```

---

# 86. DATABASE TRACE SECURITY

Do not include:

```text
password
tokens
PII
full SQL with secrets
```

in traces.

Parameterized query metadata is preferred where supported.

---

# 87. OBSERVABILITY TESTING

Add tests for:

```text
request ID
error logging
health endpoints
metrics
trace context
queue correlation
```

Do not over-test implementation details of logging libraries.

---

# 88. HEALTH TESTING

Verify:

```text
MySQL available → ready
MySQL unavailable → not ready

Redis available → ready if required
Redis unavailable → behavior matches architecture
```

---

# 89. ERROR TESTING

Trigger controlled errors and verify:

```text
API returns safe response
requestId returned
error logged
trace generated where enabled
sensitive data not leaked
```

---

# 90. QUEUE TESTING

Verify:

```text
job created
correlation ID propagated
worker logs context
failure recorded
retry recorded
```

---

# 91. LOAD + OBSERVABILITY

Run Phase 26 load tests while observing:

```text
CPU
Memory
DB
Redis
API latency
queue
errors
```

Observability should help explain performance degradation.

---

# 92. DOCUMENTATION

Create:

```text
docs/observability/
```

Recommended:

```text
architecture.md
logging.md
metrics.md
tracing.md
health-checks.md
alerts.md
dashboards.md
troubleshooting.md
```

Only create useful documents.

---

# 93. TROUBLESHOOTING RUNBOOK

Create:

```text
docs/observability/troubleshooting.md
```

Include procedures for:

```text
API slow
API 5xx spike
Database unavailable
Redis unavailable
BullMQ backlog
Worker failing
Outbox backlog
High CPU
High memory
Deadlocks
```

For each:

```text
Symptoms
Where to look
Metrics
Logs
Traces
Likely causes
Immediate actions
Long-term fix
```

---

# 94. INCIDENT FLOW

Recommended workflow:

```text
Alert
 ↓
Check Dashboard
 ↓
Identify affected component
 ↓
Find request/trace
 ↓
Inspect logs
 ↓
Inspect database/Redis/queue
 ↓
Identify root cause
 ↓
Mitigate
 ↓
Fix
 ↓
Document
```

---

# 95. PRODUCTION DEBUGGING EXAMPLE

The system reports:

```text
p95 POST /sales = 2.4s
```

Observability should allow:

```text
POST /sales
    │
    ▼
Trace
    │
    ├── RBAC 20ms
    ├── Sale service 80ms
    ├── MySQL 1.9s
    │      └── slow query
    │
    └── Outbox 20ms
```

Then engineer can investigate the SQL problem.

---

# 96. ANOTHER DEBUGGING EXAMPLE

If notifications are delayed:

```text
Notification delay
        │
        ▼
BullMQ queue
        │
        ├── Waiting = 25,000
        ├── Active = 10
        └── Failed = 2,500
```

Then inspect:

```text
Worker CPU
Worker errors
Retry count
Redis
External notification provider
```

---

# 97. OBSERVABILITY SECURITY

Ensure observability itself does not become a security vulnerability.

Protect:

```text
metrics endpoint
admin dashboards
trace backend
log backend
```

where required.

Do not expose internal telemetry publicly without protection.

---

# 98. METRICS ENDPOINT

If using a Prometheus-style endpoint such as:

```text
/metrics
```

protect it appropriately according to deployment architecture.

Do not expose sensitive information.

---

# 99. NO BUSINESS LOGIC CHANGES

Phase 27 should primarily add:

```text
logging
metrics
tracing
health
telemetry
alerts
documentation
```

Do not rewrite Sales, Purchase, Inventory, Payment, or Accounting business logic unnecessarily.

---

# 100. PHASE 26 BOUNDARY

Phase 26:

```text
Performance
Benchmarking
Load testing
Query optimization
Caching optimization
Capacity testing
```

Phase 27:

```text
Observability
Logs
Metrics
Traces
Health
Errors
Alerts
Dashboards
Troubleshooting
```

Use Phase 26 results as inputs.

---

# 101. PHASE 28 BOUNDARY

Phase 28 will focus on:

```text
Docker Production
Production container architecture
Production deployment configuration
Container security
Resource configuration
Production Docker setup
```

Do not turn Phase 27 into a complete production deployment implementation.

---

# 102. FINAL CHECKLIST

Phase 27 is complete only when:

```text
[ ] Repository observability audit completed
[ ] Existing logger reviewed
[ ] Structured logging implemented
[ ] Log levels defined
[ ] Sensitive data redaction implemented
[ ] Request ID implemented
[ ] Correlation ID implemented
[ ] Async context implemented
[ ] User context available safely
[ ] Global error logging implemented
[ ] Safe production error responses verified
[ ] Error tracking strategy implemented
[ ] HTTP metrics implemented
[ ] Latency histogram implemented
[ ] Error metrics implemented
[ ] Business metrics implemented where appropriate
[ ] RBAC metrics reviewed
[ ] Data visibility observability reviewed
[ ] Redis metrics implemented/reviewed
[ ] Cache metrics implemented/reviewed
[ ] BullMQ metrics implemented
[ ] Worker observability implemented
[ ] Queue correlation implemented
[ ] MySQL monitoring implemented/reviewed
[ ] Slow query monitoring reviewed
[ ] Distributed tracing evaluated
[ ] OpenTelemetry evaluated/implemented where appropriate
[ ] Trace context propagated
[ ] Async trace propagation reviewed
[ ] Trace sampling configured
[ ] Slow request detection implemented
[ ] Liveness health check implemented
[ ] Readiness health check implemented
[ ] Docker health check integrated where appropriate
[ ] Alert strategy documented
[ ] Critical alerts defined
[ ] Dashboard specification created
[ ] Logging retention strategy documented
[ ] Log rotation/centralized logging reviewed
[ ] Environment-specific configuration implemented
[ ] Telemetry failure does not break business logic
[ ] Observability overhead reviewed
[ ] High-cardinality metrics avoided
[ ] Observability security reviewed
[ ] Metrics endpoint protected where required
[ ] Observability tests added
[ ] Health tests added
[ ] Error tests added
[ ] Queue observability tests added
[ ] Load tests observed using telemetry
[ ] Troubleshooting runbook created
[ ] Incident flow documented
[ ] Phase 26 integration verified
[ ] Phase 28 boundary maintained
```

---

# 103. FINAL ACCEPTANCE CRITERIA

Do not report:

```text
"Observability completed"
```

unless the system can answer these questions:

```text
1. Is the API healthy?

2. What is the current request rate?

3. What is p95/p99 latency?

4. Which endpoint is slow?

5. Which endpoint is failing?

6. Which request caused the failure?

7. Which user initiated it?

8. Which company/branch context was involved?

9. Which database operation was slow?

10. Is MySQL healthy?

11. Is Redis healthy?

12. Are BullMQ queues healthy?

13. Are workers failing?

14. Is the outbox backlog growing?

15. Is CPU too high?

16. Is memory too high?

17. Are there deadlocks?

18. Are authorization failures increasing?

19. Are inventory operations failing?

20. Are accounting operations failing?

21. Can an engineer trace one request from API → DB → Outbox → BullMQ → Worker?

22. Can an engineer investigate an incident without guessing?
```

The objective of Phase 27 is:

```text
Not just "logging".

Not just "monitoring".

Not just "metrics".

Build a complete operational visibility layer
for the Fashion ERP Backend.

Every important request,
error,
database operation,
queue job,
security event,
and production incident
should be observable,
correlatable,
diagnosable,
and actionable.
```
