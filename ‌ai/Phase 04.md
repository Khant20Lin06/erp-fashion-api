# PHASE 04 — CORE / SHARED INFRASTRUCTURE

# Fashion ERP Backend

You are implementing:

**Phase 04 — Core / Shared Infrastructure**

for the Fashion ERP Backend.

You MUST follow:

```text
Phase 00 — AI Rules / Source of Truth
Phase 01 — Project Foundation
Phase 02 — Docker / Infrastructure
Phase 03 — Database Architecture
```

These phases are authoritative.

Do not silently change architectural decisions established by previous phases.

---

# 1. PHASE OBJECTIVE

Build the reusable **Core / Shared Infrastructure layer** that will be used by all future modules.

The purpose of this phase is to establish common infrastructure for:

```text
Authentication
RBAC
Data Visibility
Company / Branch / Warehouse
User / Employee
Master Data
Product
Customer / Supplier
Sales
Purchase
Inventory
Payment
Accounting
Outbox
Redis
BullMQ
Notifications
Reports
Testing
```

This phase is NOT a business module.

Do not implement Sales, Purchase, Inventory, Accounting, or RBAC business logic here.

The goal is to create a consistent application foundation.

---

# 2. FIRST ACTION — INSPECT THE REPOSITORY

Before changing anything, inspect the existing repository.

Review:

```text
package.json
src/
test/
.env
.env.example
Dockerfile
docker-compose.yml
tsconfig.json
nest-cli.json
README.md
Phase 01 implementation
Phase 02 implementation
Phase 03 implementation
```

Also inspect:

```text
database/
common/
core/
shared/
config/
modules/
```

if they already exist.

Determine:

1. Existing global modules
2. Existing configuration system
3. Existing exception filters
4. Existing validation pipes
5. Existing interceptors
6. Existing guards
7. Existing decorators
8. Existing middleware
9. Existing logging
10. Existing database utilities
11. Existing BaseEntity
12. Existing transaction utilities
13. Existing response format
14. Existing error format
15. Existing tests

Do not duplicate existing infrastructure.

Do not rewrite working code unnecessarily.

---

# 3. CORE ARCHITECTURE

Establish a clear separation between:

```text
core/
shared/
common/
modules/
```

Use the existing Phase 01–03 structure if already established.

A reasonable conceptual architecture is:

```text
src/
├── core/
│   ├── config/
│   ├── database/
│   ├── errors/
│   ├── logging/
│   ├── request-context/
│   ├── transaction/
│   └── ...
│
├── shared/
│   ├── decorators/
│   ├── dto/
│   ├── guards/
│   ├── interceptors/
│   ├── pipes/
│   ├── filters/
│   ├── types/
│   └── utils/
│
└── modules/
    └── ...
```

The exact structure may follow the existing repository.

Do not create unnecessary layers.

---

# 4. CORE VS SHARED RULE

Use this conceptual rule:

```text
Core
=
application-wide infrastructure
that has architectural significance

Shared
=
reusable utilities/components
used by multiple modules
```

Examples of Core:

```text
configuration
request context
database transaction infrastructure
logging
application lifecycle
```

Examples of Shared:

```text
decorators
DTO helpers
pagination types
response types
common utilities
pipes
guards
interceptors
```

Do not force every utility into `core`.

---

# 5. NO BUSINESS LOGIC

Do NOT put business logic inside Core/Shared.

Never put:

```text
calculateSaleTotal()
approvePurchase()
adjustInventory()
postJournalEntry()
assignSalesAccount()
```

inside:

```text
common/
shared/
core/
```

Business logic belongs to the relevant domain module.

---

# 6. GLOBAL MODULE STRATEGY

Only truly global infrastructure should be global.

Examples:

```text
ConfigModule
DatabaseModule
CoreModule
Logging infrastructure
Request context
```

Do not make every business module global.

Avoid excessive global state.

---

# 7. APPLICATION BOOTSTRAP

Review `main.ts`.

Establish centralized application bootstrap configuration.

The bootstrap should consistently configure:

```text
validation
exception handling
serialization
security headers where appropriate
logging
request context
API prefix/versioning if established
```

Do not scatter bootstrap configuration across multiple files without reason.

---

# 8. GLOBAL API PREFIX

If the project architecture requires a global API prefix, standardize it.

Example:

```text
/api
```

Do not randomly add prefixes to individual controllers.

If Phase 01 already established a prefix, preserve it.

---

# 9. API VERSIONING

Evaluate whether API versioning should be enabled.

A reasonable strategy may be:

```text
/api/v1
```

or URI/header versioning.

If Phase 01 already established versioning, preserve it.

Do not introduce multiple incompatible versioning strategies.

Document the decision.

---

# 10. VALIDATION PIPE

Configure a global NestJS validation mechanism.

Use:

```text
ValidationPipe
```

with appropriate options.

At minimum evaluate:

```text
transform
whitelist
forbidNonWhitelisted
```

The goal is to prevent unexpected request fields from silently entering application logic.

Do not blindly enable every option without understanding their effect.

---

# 11. DTO VALIDATION

Future DTOs should use:

```text
class-validator
class-transformer
```

if those libraries are part of the established stack.

Validation must occur at the API boundary.

Do not rely only on database constraints for user input validation.

---

# 12. VALIDATION VS BUSINESS RULES

Keep these concepts separate.

Validation:

```text
email format
required field
string length
number format
UUID format
```

Business rule:

```text
sales staff can only access assigned accounts
cannot confirm already cancelled sale
cannot issue payment above allowed amount
```

Validation belongs to DTO/boundary infrastructure.

Business rules belong to domain/application services.

---

# 13. TRANSFORM INPUT

Configure DTO transformation carefully.

For example:

```text
string → number
string → boolean
string → UUID-compatible value
```

Do not silently transform ambiguous values in dangerous ways.

Be especially careful with:

```text
"false"
"0"
""
null
undefined
```

---

# 14. UNKNOWN REQUEST FIELDS

Prevent unexpected request fields from being accepted silently.

The application should not accidentally accept:

```json
{
  "email": "...",
  "role": "super-admin",
  "isAdmin": true
}
```

when the DTO only expects:

```text
email
```

This is especially important for future Auth/RBAC modules.

---

# 15. EXCEPTION ARCHITECTURE

Establish a centralized exception handling strategy.

Application errors should be consistently converted into API responses.

Handle at least:

```text
BadRequest
Unauthorized
Forbidden
NotFound
Conflict
UnprocessableEntity where appropriate
InternalServerError
```

Do not expose raw internal errors.

---

# 16. ERROR RESPONSE FORMAT

Establish one consistent API error structure.

Example:

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Resource not found",
    "details": null
  },
  "meta": {
    "requestId": "..."
  }
}
```

This is an example.

If Phase 01 already established another format, preserve it.

The final structure must be documented.

---

# 17. ERROR CODE STRATEGY

Do not make clients depend on English error messages.

Prefer stable machine-readable codes.

Examples:

```text
AUTH_INVALID_CREDENTIALS
AUTH_ACCOUNT_DISABLED
RESOURCE_NOT_FOUND
VALIDATION_FAILED
DUPLICATE_RESOURCE
FORBIDDEN
INSUFFICIENT_PERMISSION
BUSINESS_RULE_VIOLATION
```

Do not create dozens of meaningless codes.

Error codes should represent stable application semantics.

---

# 18. DATABASE ERROR MAPPING

Prepare centralized mapping for common database errors.

Examples:

```text
duplicate key
foreign key violation
constraint violation
connection error
deadlock
```

Do not return raw MySQL/TypeORM error messages to API consumers.

The database implementation must remain an internal detail.

---

# 19. REQUEST ID

Establish a request correlation ID.

Every incoming HTTP request should have a request ID.

If a trusted incoming request ID exists, evaluate whether it can be reused safely.

Otherwise generate one.

Example:

```text
requestId
```

The ID must appear in:

```text
logs
error responses
```

where appropriate.

---

# 20. REQUEST CONTEXT

Implement a request context mechanism that future modules can use.

It should be capable of carrying contextual information such as:

```text
requestId
userId
companyId
branchId
warehouseId
locale
```

However, only populate values when they are actually known.

Do not invent user/company context before authentication exists.

---

# 21. REQUEST CONTEXT IMPLEMENTATION

Evaluate using an async context mechanism such as:

```text
AsyncLocalStorage
```

or a well-supported NestJS-compatible approach.

The context should be:

```text
request-scoped
safe
non-global mutable state
```

Do not store request-specific data in ordinary global variables.

---

# 22. FUTURE AUTH PREPARATION

The Request Context must later support:

```text
authenticated user
```

after Phase 05.

Do not implement authentication in Phase 04.

The architecture should allow Phase 05 to add:

```text
userId
sessionId
authentication state
```

without redesigning the entire Core layer.

---

# 23. FUTURE RBAC PREPARATION

Phase 06 will need:

```text
user
roles
permissions
data scope
company
branch
warehouse
account
```

The Core infrastructure should allow authorization guards/decorators to read context.

Do NOT implement RBAC logic now.

---

# 24. CURRENT USER ABSTRACTION

Create a reusable abstraction/decorator strategy for future authenticated-user access.

Conceptually:

```typescript
@CurrentUser()
```

or equivalent.

However, if authentication does not yet exist, do not fake authentication.

The abstraction should be prepared cleanly for Phase 05.

---

# 25. AUTH CONTEXT TYPE

Define a clear type/interface for authenticated request context.

Future fields may include:

```text
userId
employeeId
companyId
branchId
warehouseId
roleIds
permission context
```

Do not hard-code future values as if they already exist.

Use optional/contextual properties where appropriate.

---

# 26. AUTHORIZATION VS CONTEXT

Do not mix:

```text
authentication
```

with:

```text
authorization
```

Authentication:

```text
Who is this user?
```

Authorization:

```text
What can this user do?
```

Data visibility:

```text
Which records can this user access?
```

Phase 04 only provides infrastructure for these future concerns.

---

# 27. RESPONSE STANDARDIZATION

Decide whether successful API responses should use a consistent envelope.

Example:

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

If Phase 01 already defined a response contract, preserve it.

Do not wrap every response unnecessarily if the existing architecture intentionally uses raw REST resources.

Document the decision.

---

# 28. RESPONSE INTERCEPTOR

If a response envelope is selected, implement it centrally through an interceptor.

Do not manually write:

```text
success: true
```

inside every controller.

Avoid duplicate response wrapping.

---

# 29. ERROR RESPONSE MUST NOT BE WRAPPED TWICE

Ensure the response interceptor does not transform error responses into nested success envelopes.

Bad:

```json
{
  "success": true,
  "data": {
    "success": false
  }
}
```

This must never happen.

---

# 30. SERIALIZATION

Review NestJS serialization behavior.

Future entities may contain sensitive fields such as:

```text
passwordHash
refreshTokenHash
internal metadata
```

Prepare serialization so sensitive internal fields are not accidentally returned.

Do not implement authentication fields before Phase 05.

---

# 31. ENTITY VS RESPONSE DTO

Do not expose TypeORM entities directly as the permanent API contract.

Future modules should prefer response DTOs when API shape differs from persistence shape.

Core infrastructure should make this approach easy.

---

# 32. PASSWORD / SECRET SAFETY

Phase 05 owns password handling.

Phase 04 must still establish a principle:

Never log:

```text
password
passwordHash
accessToken
refreshToken
API keys
database passwords
secrets
```

Do not add password functionality now.

---

# 33. LOGGING

Establish structured application logging.

Logs should be suitable for:

```text
development
Docker
production
```

The logging architecture should support future observability.

---

# 34. LOG LEVELS

Support appropriate levels such as:

```text
debug
log/info
warn
error
```

Do not log everything at error level.

Do not print sensitive data.

---

# 35. STRUCTURED LOGGING

Prefer structured logs where practical.

Conceptually:

```json
{
  "level": "info",
  "message": "Request completed",
  "requestId": "...",
  "method": "GET",
  "path": "/api/v1/...",
  "statusCode": 200,
  "durationMs": 25
}
```

The exact format may follow the project's logging library.

---

# 36. HTTP REQUEST LOGGING

Establish centralized request logging.

Useful fields:

```text
requestId
method
path
statusCode
duration
userId when authenticated
```

Do not log request bodies by default.

Request bodies may contain:

```text
passwords
tokens
financial data
PII
```

---

# 37. ERROR LOGGING

When an internal error occurs, logs should contain enough information for debugging.

At minimum consider:

```text
requestId
error code
stack trace
route
method
```

Do not expose stack traces to API clients in production.

---

# 38. ENVIRONMENT-AWARE LOGGING

Development may use readable logs.

Production should support structured logs suitable for aggregation.

Do not hard-code one logging behavior for every environment.

---

# 39. LOGGER ABSTRACTION

Use NestJS Logger or an appropriately selected logging abstraction.

Do not scatter direct `console.log()` throughout production code.

Avoid:

```typescript
console.log(password);
console.log(token);
console.log(req.body);
```

---

# 40. CONFIGURATION ACCESS

Centralize configuration access.

Do not repeatedly use:

```text
process.env.X
```

throughout business code.

Prefer the configuration architecture established in Phase 01.

---

# 41. CONFIG VALIDATION

Review environment configuration validation.

Important categories include:

```text
database
application
authentication
external services
Redis
queue
```

Only validate variables that exist at the current phase.

Do not require future Redis/BullMQ secrets before those phases exist unless already established by Phase 02.

---

# 42. ENVIRONMENT TYPES

Support explicit environments:

```text
development
test
staging
production
```

Do not infer critical behavior from arbitrary strings.

---

# 43. UTILITY FUNCTIONS

Create shared utilities only when they are truly generic.

Good examples:

```text
UUID validation
date helpers
pagination calculations
safe object utilities
```

Bad examples:

```text
calculateSaleDiscount()
calculateInventoryCost()
```

Business logic belongs to domain modules.

---

# 44. DATE/TIME UTILITY

If date utilities are created, establish a consistent timezone philosophy.

Do not mix:

```text
local Date
UTC Date
string timestamps
```

without clear conversion rules.

Do not create a giant custom date library.

---

# 45. ID VALIDATION

Provide reusable validation for identifiers if needed.

Examples:

```text
UUID
```

Do not duplicate UUID validation logic across every DTO.

---

# 46. PAGINATION CONTRACT

Create a shared pagination DTO/type if appropriate.

Possible parameters:

```text
page
limit
sort
order
```

or cursor-based parameters later.

The shared pagination layer must NOT know about specific business entities.

---

# 47. PAGINATION SAFETY

Pagination must have maximum limits.

Never allow:

```text
limit=100000000
```

to trigger huge database queries.

Establish reasonable configurable defaults/maxima.

---

# 48. SORTING SAFETY

Never concatenate arbitrary user-provided sort fields directly into SQL.

Bad:

```text
ORDER BY ${req.query.sort}
```

Future modules must whitelist sortable fields.

Core/shared infrastructure should provide utilities or patterns that encourage safe sorting.

---

# 49. FILTERING

Do not build a giant universal dynamic SQL filter engine in Phase 04.

Business modules should define their supported filters explicitly.

---

# 50. TRANSACTION INFRASTRUCTURE

Build a reusable transaction abstraction for future application services.

It should support:

```text
start
execute
commit
rollback
```

through TypeORM.

---

# 51. TRANSACTION API

A conceptual API may look like:

```typescript
transactionService.run(async (manager) => {
  // database operations
});
```

The exact implementation may differ.

Do not hide TypeORM transaction semantics so deeply that debugging becomes difficult.

---

# 52. TRANSACTION MANAGER RULE

Inside a transaction:

All related repository operations must use the transaction manager/repositories associated with that transaction.

Do NOT accidentally call a global repository inside a transaction and assume it participates in the transaction.

---

# 53. TRANSACTION NESTING

Do not blindly create nested database transactions.

Evaluate whether nested service calls should participate in an existing transaction.

A future architecture may use transaction context propagation.

Prepare for it, but do not overengineer.

---

# 54. TRANSACTION ERROR HANDLING

If a transactional operation throws:

```text
rollback
propagate controlled error
```

Do not swallow the exception.

---

# 55. DEADLOCK RETRY PREPARATION

Document that future high-contention workflows may require bounded retry for:

```text
deadlock
serialization-like conflicts
temporary DB failures
```

Do not implement unlimited retries.

---

# 56. BASE ENTITY

If Phase 03 established a BaseEntity, review it and standardize it.

A common base entity may contain:

```text
id
createdAt
updatedAt
deletedAt
```

Only if those fields were established by Phase 03.

Do not add unrelated fields.

---

# 57. BASE ENTITY DECORATORS

Use TypeORM decorators consistently.

Ensure:

```text
CreateDateColumn
UpdateDateColumn
DeleteDateColumn
```

behave correctly with MySQL and migrations.

Do not rely on `synchronize`.

---

# 58. SOFT DELETE INFRASTRUCTURE

If soft delete is part of Phase 03:

Provide reusable patterns for:

```text
softRemove
restore
withDeleted
```

where appropriate.

Do not make soft deletion mandatory for immutable ledger entities.

---

# 59. AUDIT FOUNDATION

Prepare shared audit infrastructure.

At minimum establish conventions for:

```text
created_at
updated_at
deleted_at
```

Future user-based audit fields may be added after authentication exists.

---

# 60. AUDIT CONTEXT PREPARATION

Future services should be able to determine:

```text
current user
request ID
```

when available.

This will later allow:

```text
created_by
updated_by
deleted_by
```

or audit events.

Do not create fake user IDs.

---

# 61. DATA ACCESS CONTEXT

Prepare an abstraction for future data scope.

Conceptually:

```text
RequestContext
    ├── userId
    ├── companyId
    ├── branchId
    ├── warehouseId
    └── salesAccountId
```

Only fields actually established by later modules should be populated.

---

# 62. DATA SCOPE IS NOT RBAC

Do not implement:

```text
if role === "sales_staff"
```

inside Core.

Core should provide context/infrastructure.

Phase 06 will implement:

```text
Role
Permission
Scope
```

---

# 63. AUTHORIZATION DECORATOR PREPARATION

If useful, define a clean decorator/metadata mechanism for future authorization.

Example:

```typescript
@RequirePermission("sales.read")
```

But do NOT implement the permission database lookup in Phase 04.

The decorator should only establish metadata if implemented.

---

# 64. PERMISSION STRING CONVENTION

Do not hard-code a full permission catalog now.

However, document a future convention such as:

```text
resource.action
```

Examples:

```text
sales.read
sales.create
sales.update
sales.delete
inventory.read
inventory.adjust
payment.create
```

Phase 06 owns the actual permission model.

---

# 65. DATA SCOPE METADATA PREPARATION

Future authorization may need:

```text
own
account
branch
warehouse
company
all
```

Do not implement the complete system now.

Keep the Core infrastructure generic enough to support it.

---

# 66. DECORATOR RULE

Do not create dozens of decorators before there is a real need.

Only create reusable decorators with clear architectural purpose.

---

# 67. GUARD RULE

Do not create an `AuthGuard` in Phase 04 that pretends authentication exists.

Phase 05 owns authentication.

If a placeholder abstraction is necessary, keep it minimal and clearly marked.

---

# 68. INTERCEPTOR RULE

Interceptors should handle cross-cutting concerns such as:

```text
response transformation
request timing
logging
```

Do not put business logic into interceptors.

---

# 69. PIPE RULE

Pipes should handle:

```text
validation
transformation
parsing
```

Do not put authorization decisions into generic pipes.

---

# 70. FILTER RULE

Exception filters should handle:

```text
error → API response
```

Do not place business decisions into exception filters.

---

# 71. MIDDLEWARE RULE

Middleware should be used for cross-cutting request concerns.

Examples:

```text
request ID
raw request metadata
```

Do not use middleware for domain authorization.

---

# 72. API CONTRACT

Document the standard API behavior:

```text
success response
error response
request ID
validation errors
pagination
HTTP status codes
```

Future modules must follow this contract.

---

# 73. HTTP STATUS CODE CONVENTION

Establish appropriate conventions.

Examples:

```text
200 OK
201 Created
204 No Content
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity where appropriate
500 Internal Server Error
```

Do not use `200` for every operation.

---

# 74. NOT FOUND VS FORBIDDEN

Do not casually expose sensitive resource existence.

Future authorization modules may need to decide whether a user should receive:

```text
404
```

instead of:

```text
403
```

for inaccessible resources.

Phase 06 owns the final data-visibility behavior.

---

# 75. CONFLICT ERRORS

Use `409 Conflict` where a request violates a resource state/uniqueness conflict.

Examples:

```text
duplicate code
duplicate email
invalid state transition
```

Do not convert all business errors into `400`.

---

# 76. CORRELATION ID

Use a consistent name:

```text
requestId
```

or the existing project convention.

Do not alternate between:

```text
requestId
request_id
correlationId
traceId
```

without purpose.

Future observability may introduce trace IDs separately.

---

# 77. REQUEST METADATA

The request context should not retain entire request/response objects.

Store only necessary metadata.

Avoid memory leaks.

---

# 78. SECURITY HEADERS

Review whether basic HTTP security headers should be configured at bootstrap or infrastructure level.

Do not duplicate security middleware.

Detailed API security belongs to:

```text
Phase 23 — API Security
```

---

# 79. CORS

If CORS is configured, it must be environment-aware.

Do not use:

```text
origin: "*"
```

as a production security strategy if credentials/authenticated browser requests are involved.

Phase 23 will perform the complete security review.

---

# 80. HEALTH CHECK FOUNDATION

If appropriate, establish a health-check infrastructure.

A minimal health endpoint may eventually check:

```text
application
database
```

Do not add Redis/BullMQ checks before those infrastructure phases exist unless already available.

---

# 81. LIVENESS VS READINESS

If health checks are implemented, distinguish conceptually:

```text
liveness
=
application process is alive

readiness
=
application can serve traffic
```

Database readiness should not necessarily be treated identically to process liveness.

---

# 82. HEALTH ENDPOINT SECURITY

Do not expose sensitive environment/database information from health endpoints.

Bad:

```json
{
  "dbPassword": "...",
  "databaseUrl": "..."
}
```

Never expose secrets.

---

# 83. APPLICATION CONSTANTS

Create shared constants only for stable architectural values.

Do not create:

```text
constants.ts
```

with hundreds of unrelated business constants.

Business constants belong to domain modules.

---

# 84. TYPE DEFINITIONS

Shared TypeScript types should be:

```text
small
focused
reusable
```

Avoid a giant:

```text
types.ts
```

file containing the entire application type system.

---

# 85. RESULT TYPES

If the architecture uses explicit result/error types, standardize them.

Do not introduce a functional-programming abstraction unnecessarily if the project does not need it.

Prefer consistency over novelty.

---

# 86. UTILITY ERROR HANDLING

Avoid returning:

```text
null
undefined
false
```

for every possible failure.

Use meaningful errors where appropriate.

---

# 87. DATABASE REPOSITORY ERRORS

Database errors should remain distinguishable from:

```text
validation errors
authorization errors
business rule errors
```

This distinction will be important for future Sales/Inventory/Accounting modules.

---

# 88. CORE TESTING

Every Core infrastructure component must have tests where meaningful.

At minimum consider:

```text
validation
exception mapping
request ID
request context
transaction helper
pagination
error codes
response formatting
```

---

# 89. REQUEST CONTEXT TEST

Verify that:

```text
Request A
```

cannot leak context into:

```text
Request B
```

This is critical if `AsyncLocalStorage` is used.

---

# 90. TRANSACTION TEST

Verify:

```text
operation A succeeds
operation B fails
        ↓
rollback
```

The database must not contain partial changes.

---

# 91. TRANSACTION SUCCESS TEST

Verify:

```text
operation A succeeds
operation B succeeds
        ↓
commit
```

All expected changes must persist.

---

# 92. ERROR RESPONSE TEST

Verify that internal errors do not expose:

```text
SQL
database credentials
stack trace
file paths
TypeORM internals
```

in production-style responses.

---

# 93. VALIDATION TEST

Verify unknown request fields are handled according to the chosen validation policy.

Test:

```json
{
  "validField": "x",
  "unexpectedField": "y"
}
```

---

# 94. PAGINATION TEST

Verify:

```text
default page
default limit
maximum limit
invalid page
invalid limit
```

are handled correctly.

---

# 95. LOGGING TEST

Do not assert exact formatting unless necessary.

Verify sensitive values are not logged.

At minimum ensure the logging architecture does not accidentally print:

```text
password
token
secret
database password
```

---

# 96. HEALTH CHECK TEST

If health checks are implemented:

Verify:

```text
healthy application
database unavailable
```

produce appropriate readiness behavior.

---

# 97. NO REDUNDANT DEPENDENCIES

Before adding packages, check whether the functionality already exists in:

```text
NestJS
TypeORM
class-validator
class-transformer
```

or existing project dependencies.

Do not add packages simply because they are popular.

---

# 98. DEPENDENCY RULE

Any new dependency must have a clear reason.

Document:

```text
package
purpose
why existing dependency is insufficient
```

Avoid dependency bloat.

---

# 99. CORE MODULE DEPENDENCY DIRECTION

Prefer:

```text
Core
  ↓
Shared infrastructure
  ↓
Business modules
```

Do not allow:

```text
Core
  ↓
Sales module
  ↓
Core
```

circular architectural dependencies.

---

# 100. BUSINESS MODULE ISOLATION

Future modules should be able to import shared infrastructure without importing unrelated business modules.

For example:

```text
Sales
```

may use:

```text
Database
Logger
RequestContext
TransactionService
```

but should not need to import:

```text
PurchaseService
InventoryController
AccountingController
```

just to use Core functionality.

---

# 101. CIRCULAR DEPENDENCY DETECTION

Check for circular dependencies after implementation.

Use existing tooling or appropriate static analysis if available.

Do not solve architectural circular dependencies with random `forwardRef()`.

Use `forwardRef()` only when the dependency relationship is genuinely required.

---

# 102. MODULE EXPORT STRATEGY

Core modules should export only what other modules genuinely need.

Do not export every provider.

Example:

```text
DatabaseModule
    ↓
exports database infrastructure

LoggingModule
    ↓
exports logger
```

Keep internal providers private where possible.

---

# 103. GLOBAL LOGGER

If a global logger is used, ensure future modules can inject it without creating multiple competing logger instances.

---

# 104. CORE DOCUMENTATION

Create or update documentation covering:

```text
Core architecture
Shared architecture
Request context
Validation
Error handling
Response format
Logging
Transaction usage
Pagination
Health checks
Future authorization integration
```

---

# 105. DEVELOPER USAGE EXAMPLES

Documentation should show future developers how to use:

```text
CurrentUser
RequestContext
TransactionService
pagination
error classes
logger
```

where those abstractions exist.

Keep examples minimal and accurate.

---

# 106. TRANSACTION USAGE EXAMPLE

Provide a conceptual example:

```typescript
return this.transactionService.run(async (manager) => {
  // repository operations using this transaction manager
});
```

The example must clearly demonstrate that transaction-bound repositories must use the supplied manager.

---

# 107. ERROR USAGE EXAMPLE

Provide examples such as:

```typescript
throw new AppException(
  "RESOURCE_NOT_FOUND",
  "Resource not found",
);
```

or the project's actual error abstraction.

Do not hard-code future business-specific errors into Core.

---

# 108. PAGINATION USAGE EXAMPLE

Document how future controllers/services should receive pagination input.

Example concept:

```text
GET /resources?page=1&limit=20
```

and how the service should enforce the maximum limit.

---

# 109. REQUEST CONTEXT USAGE

Document:

```text
How to get requestId
How to access authenticated user later
How company/branch context will be added later
```

Do not pretend Phase 05/06 data already exists.

---

# 110. DATA SCOPE PREPARATION

The Core layer must remain neutral about business ownership.

It should support future context such as:

```text
company
branch
warehouse
sales account
```

without implementing rules like:

```text
sales staff can only see own sales
```

That rule belongs to Phase 06.

---

# 111. FUTURE RBAC INTEGRATION

Phase 06 should be able to implement:

```text
@RequirePermission("sales.read")
```

and:

```text
DataScope = OWN
DataScope = ACCOUNT
DataScope = BRANCH
DataScope = COMPANY
DataScope = ALL
```

without rewriting the Core architecture.

---

# 112. FUTURE AUTH INTEGRATION

Phase 05 should be able to add:

```text
JWT
access token
refresh token
user session
authentication guard
```

without modifying unrelated Core utilities.

---

# 113. FUTURE OUTBOX INTEGRATION

Phase 18 should be able to use the transaction infrastructure for:

```text
business change
+
outbox event
```

inside the same database transaction.

---

# 114. FUTURE REDIS INTEGRATION

Phase 19 should be able to add Redis without redesigning:

```text
RequestContext
logging
configuration
health checks
```

---

# 115. FUTURE BULLMQ INTEGRATION

Phase 20 should be able to use Core configuration/logging/error handling.

Do not couple Core directly to BullMQ.

---

# 116. FUTURE OBSERVABILITY

Phase 27 should be able to extend:

```text
requestId
logs
timings
trace context
metrics
```

without replacing the entire logging architecture.

---

# 117. NO PREMATURE MICRO-SERVICES

Do not create separate microservice infrastructure.

This project is currently designed as a modular backend.

Core infrastructure should support a:

```text
Modular Monolith
```

architecture.

---

# 118. MODULAR MONOLITH RULE

Business modules should have clear boundaries.

Conceptually:

```text
Auth
RBAC
Organization
Users
Master Data
Products
Customers
Sales
Purchase
Inventory
Payments
Accounting
```

Core/Shared provides reusable infrastructure.

It does not own business domains.

---

# 119. NO GOD MODULE

Do not create:

```text
CoreModule
```

that contains every application service.

CoreModule should only coordinate infrastructure.

---

# 120. NO GOD SERVICE

Do not create:

```text
CommonService
UtilityService
AppService
```

containing hundreds of unrelated functions.

Keep abstractions focused.

---

# 121. NAMING CONVENTION

Use consistent names:

```text
*.module.ts
*.service.ts
*.guard.ts
*.pipe.ts
*.filter.ts
*.interceptor.ts
*.decorator.ts
*.dto.ts
*.types.ts
*.exception.ts
```

Follow the existing project convention where different.

---

# 122. FILE SIZE

Do not create giant files.

If a file becomes difficult to understand, split it according to responsibility.

Do not split tiny one-function utilities into unnecessary files purely for theoretical cleanliness.

---

# 123. COMMENTS

Comments should explain:

```text
why
```

not:

```text
what the code obviously does
```

Example of useful comment:

```text
// Request context is stored with AsyncLocalStorage so concurrent
// requests cannot share user/company state.
```

Avoid obvious comments.

---

# 124. TODO RULE

Do not fill the codebase with vague:

```text
TODO: implement later
```

If something belongs to another phase, document it specifically.

Example:

```text
Phase 05 will attach authenticated user information to RequestContext.
```

---

# 125. ARCHITECTURAL DECISIONS

If you must choose between multiple valid implementations:

1. Inspect existing architecture.
2. Prefer consistency.
3. Prefer the simplest solution that satisfies requirements.
4. Avoid speculative abstraction.
5. Document the decision.

Do not silently choose a major architectural direction.

---

# 126. REQUIRED IMPLEMENTATION AREAS

Implement or standardize, as appropriate:

```text
1. Core module structure
2. Global validation
3. Exception handling
4. Error response contract
5. Error codes
6. Request ID
7. Request context
8. Logging
9. Response standardization
10. Serialization strategy
11. Transaction service
12. Pagination infrastructure
13. Shared decorators
14. Shared types
15. Health check foundation if appropriate
16. Configuration integration
17. Audit foundation
18. Base entity integration
```

Only implement items that fit the existing architecture.

---

# 127. DO NOT IMPLEMENT

Do NOT implement:

```text
Authentication
JWT
Password login
Refresh tokens
Roles
Permissions
RBAC database
Company module
Branch module
Warehouse module
Employee module
Sales Account module
Product module
Customer module
Supplier module
Sales
Purchase
Inventory
Inventory Ledger
Payment
Accounting
Outbox
Redis
BullMQ
Notifications
Reports
```

These belong to later phases.

---

# 128. QUALITY REQUIREMENT

Code must be:

```text
TypeScript strict
typed
testable
modular
maintainable
production-oriented
```

Do not use:

```text
any
```

unless there is a documented technical reason.

Avoid unsafe type assertions.

---

# 129. TEST REQUIREMENT

Every important Core abstraction must have tests.

At minimum:

```text
Validation
Exception handling
Request ID
Request context
Transaction
Pagination
Error codes
Response transformation
```

where applicable.

---

# 130. BUILD REQUIREMENT

After implementation run the project's actual:

```text
build
lint
unit tests
E2E tests
```

commands.

Do not invent commands.

Use the package manager already established by the project.

---

# 131. INTEGRATION TEST

Verify the application can:

```text
start
connect to MySQL
accept a request
generate request ID
validate input
return standardized response
handle errors
log request
```

without breaking Phase 01–03 behavior.

---

# 132. DATABASE TRANSACTION INTEGRATION TEST

Verify the Core transaction helper works with the actual MySQL database.

Test:

```text
successful transaction
failed transaction
rollback
```

Do not test only with mocks.

---

# 133. REQUEST CONTEXT CONCURRENCY TEST

If AsyncLocalStorage or equivalent is used, verify two concurrent requests do not leak:

```text
requestId
user context
```

into each other.

---

# 134. ERROR SECURITY TEST

Verify API responses do not expose:

```text
SQL statements
database passwords
stack traces
file system paths
environment variables
tokens
```

---

# 135. DOCUMENTATION QUALITY

Documentation must distinguish:

```text
Implemented now
```

from:

```text
Planned for future phases
```

Never describe planned features as implemented.

---

# 136. PHASE 05 READINESS

After Phase 04, Phase 05 must be able to implement Authentication using:

```text
RequestContext
CurrentUser abstraction
exception handling
validation
logging
database transaction support
```

without restructuring Core.

---

# 137. PHASE 06 READINESS

After Phase 04, Phase 06 must be able to implement:

```text
Dynamic RBAC
Role
Permission
User-specific permission
Data scope
Company scope
Branch scope
Warehouse scope
Sales account scope
```

without changing the fundamental Core architecture.

---

# 138. FUTURE DATA VISIBILITY EXAMPLE

The architecture must eventually support:

```text
Super Admin
    ↓
all company data
```

```text
Sales Manager
    ↓
sales overall / allowed scope
```

```text
Sales Staff
    ↓
assigned sales account
    ↓
only permitted sales records
```

This is NOT implemented in Phase 04.

Only the infrastructure required to support this later should be established.

---

# 139. IMPORTANT SECURITY PRINCIPLE

Never rely only on frontend filtering for data visibility.

For example, do NOT assume:

```text
Frontend hides other sales
=
security
```

Future Phase 06 must enforce visibility server-side.

Core infrastructure must make server-side enforcement possible.

---

# 140. IMPORTANT ERP PRINCIPLE

The Core layer must support:

```text
authorization
+
data visibility
+
auditability
+
transactions
```

without putting business-specific rules into shared utilities.

---

# 141. FINAL QUALITY GATE

Before declaring Phase 04 complete, verify:

```text
Core structure                     ✓
Shared structure                   ✓
Global validation                  ✓
Exception handling                 ✓
Error response contract            ✓
Error codes                        ✓
Request ID                         ✓
Request context                    ✓
Logging                            ✓
Response standardization           ✓
Serialization strategy             ✓
Transaction service                ✓
Pagination                         ✓
Base entity integration             ✓
Soft delete support                ✓
Audit foundation                   ✓
Configuration integration          ✓
Health check foundation            ✓
Tests                               ✓
Build                               ✓
Lint                                ✓
E2E                                 ✓
Phase 05 readiness                  ✓
Phase 06 readiness                  ✓
```

Only mark an item as passed if it was actually verified.

---

# 142. REQUIRED FINAL RESPONSE

After implementation, return exactly this report structure:

```text
## Phase 04 — Core / Shared Infrastructure

### Status
[Completed / Partially Completed / Blocked]

### 1. Repository Analysis
- Existing Core infrastructure
- Existing Shared infrastructure
- Existing bootstrap configuration
- Important findings

### 2. Architecture
- Core structure
- Shared structure
- Dependency direction

### 3. Global Application Configuration
- Validation
- Exception handling
- Response format
- API prefix/versioning
- Serialization

### 4. Request Context
- Request ID
- Async context
- Current user preparation
- Future company/branch/warehouse scope preparation

### 5. Error Handling
- Error classes
- Error codes
- HTTP mapping
- Database error mapping

### 6. Logging
- Logger
- Request logging
- Error logging
- Sensitive data protection

### 7. Transaction Infrastructure
- Transaction service
- Transaction manager usage
- Rollback behavior
- Tests

### 8. Pagination
- DTO
- Maximum limit
- Sorting safety

### 9. Base Entity / Audit
- Base entity
- timestamps
- soft delete
- audit preparation

### 10. Shared Utilities
- decorators
- pipes
- guards
- interceptors
- types
- utilities

### 11. Health Checks
- liveness
- readiness
- database check

### 12. Files Created
- ...

### 13. Files Modified
- ...

### 14. Dependencies Added
- package
- purpose

### 15. Tests Executed
- ...

### 16. Build / Lint Results
- ...

### 17. Security Verification
- ...

### 18. Known Issues
- ...

### 19. Architectural Decisions
- ...

### 20. Phase 05 Readiness
- Ready / Not Ready
- Explanation

### 21. Phase 06 Readiness
- Ready / Not Ready
- Explanation
```

Never claim something was implemented if it was only planned.

Never claim tests passed if they were not executed.

Never claim database transaction behavior works if it was only mocked.

Never implement future business modules just to make Phase 04 appear complete.

The goal is to create a **clean, reusable Core / Shared Infrastructure layer for a production-oriented NestJS Modular Monolith ERP backend**.
