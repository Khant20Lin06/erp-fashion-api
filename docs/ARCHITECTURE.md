# ARCHITECTURE.md

# System Architecture & Engineering Boundaries

This document defines the architectural structure, boundaries, responsibilities, and dependency rules of the application.

AI MUST read and follow this document before creating or modifying architectural components.

This document describes HOW the system is structured.

Business behavior belongs to:

```text
DOMAIN_RULES.md
```

API behavior belongs to:

```text
API_CONTRACTS.md
```

Database rules belong to:

```text
DATABASE_RULES.md
```

Security behavior belongs to:

```text
SECURITY_RULES.md
```

Testing strategy belongs to:

```text
TESTING_RULES.md
```

AI behavior belongs to:

```text
AI_RULES.md
```

---

# 1. ARCHITECTURAL OBJECTIVE

The system must be:

```text
Modular
Maintainable
Testable
Secure
Scalable
Observable
Consistent
Domain-oriented
```

The architecture should minimize:

```text
Coupling
Hidden dependencies
Circular dependencies
Business logic duplication
Infrastructure leakage
Uncontrolled side effects
```

---

# 2. PRIMARY TECHNOLOGY STACK

The default backend architecture uses:

```text
Runtime
    Node.js

Language
    TypeScript

Framework
    NestJS

Database
    MySQL

ORM
    TypeORM

Cache / Infrastructure
    Redis

Background Jobs
    BullMQ

Containerization
    Docker

API
    REST

Testing
    Unit + Integration + E2E
```

Actual versions are defined by the project's package configuration.

AI MUST NOT upgrade major dependencies during unrelated feature work.

---

# 3. HIGH-LEVEL ARCHITECTURE

The default architecture is:

```text
                    Client
                      │
                      ▼
                API / HTTP Layer
                      │
                      ▼
                Controller Layer
                      │
                      ▼
              Application Service
                      │
                      ▼
                Domain Logic
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
    Repository Layer        External Services
          │                       │
          ▼                       ▼
       MySQL                  APIs / Providers

                      │
                      ▼
                  Events / Jobs
                      │
                      ▼
                  BullMQ Worker
                      │
              ┌───────┴───────┐
              ▼               ▼
            Redis           MySQL
```

The exact implementation may evolve, but architectural responsibilities must remain clear.

---

# 4. ARCHITECTURAL LAYERS

The application should separate responsibilities into:

```text
Presentation
Application
Domain
Infrastructure
```

Conceptually:

```text
Presentation
    ↓
Application
    ↓
Domain
    ↓
Infrastructure
```

Dependencies must point toward stable business abstractions rather than allowing infrastructure concerns to spread throughout the application.

---

# 5. PRESENTATION LAYER

The Presentation Layer handles communication with external clients.

Typical components:

```text
Controllers
DTOs
Guards
Pipes
Interceptors
HTTP-specific serializers
```

Responsibilities:

```text
Receive requests
Validate request structure
Authenticate requests
Authorize requests
Call application services
Transform application results into API responses
```

Presentation code must not contain complex business logic.

---

# 6. CONTROLLER RULE

Controllers should be thin.

A controller should generally:

```text
Receive request
    ↓
Validate / authorize
    ↓
Call service
    ↓
Return response
```

Avoid putting:

```text
Database queries
Complex calculations
Inventory rules
Accounting rules
Permission algorithms
Large business workflows
```

directly inside controllers.

Bad:

```typescript
@Post()
async createSale(@Body() dto: CreateSaleDto) {
  // 200 lines of business logic
}
```

Prefer:

```typescript
@Post()
async createSale(@Body() dto: CreateSaleDto) {
  return this.salesService.create(dto);
}
```

---

# 7. DTO RESPONSIBILITY

DTOs define the boundary between external input/output and the application.

Request DTOs are responsible for:

```text
Input shape
Validation
Transformation where appropriate
```

Response DTOs are responsible for:

```text
Output shape
Sensitive-field protection
API contract consistency
```

Do not automatically expose database entities as API responses.

---

# 8. APPLICATION LAYER

The Application Layer coordinates use cases.

Examples:

```text
CreateSale
CancelSale
ReturnSale
ApprovePurchase
TransferStock
CreateCustomer
AssignRole
GenerateReport
```

Application services coordinate:

```text
Validation
Authorization context
Domain operations
Repositories
Transactions
Events
Queues
External services
```

They should orchestrate rather than contain unrelated infrastructure details.

---

# 9. USE CASE ORIENTATION

For complex business operations, prefer explicit use-case-oriented methods.

Example:

```text
CreateSale
CompleteSale
CancelSale
ReturnSale
AdjustStock
TransferStock
ApprovePurchase
```

rather than creating one enormous service that handles every operation.

---

# 10. DOMAIN LAYER

The Domain Layer represents business concepts and business rules.

Examples:

```text
Sale
SaleItem
Product
Inventory
Warehouse
Customer
Supplier
Purchase
Payment
Return
AccountingEntry
User
Role
Permission
Organization
Branch
```

Domain behavior should be understandable without depending heavily on HTTP.

---

# 11. DOMAIN LOGIC RULE

Critical business rules should not exist only inside controllers.

For example:

```text
A completed sale cannot be edited.
```

should be enforced by backend/domain behavior, not only:

```text
Frontend button disabled
```

The server is the final enforcement point.

---

# 12. DOMAIN INDEPENDENCE

Domain logic should avoid direct dependency on:

```text
HTTP request objects
Express/Fastify objects
Controller classes
Redis clients
BullMQ implementation
ORM-specific details
```

unless the architecture explicitly requires it.

---

# 13. INFRASTRUCTURE LAYER

Infrastructure contains implementation details for external systems.

Examples:

```text
TypeORM repositories
Redis
BullMQ
Email providers
Payment providers
Object storage
External APIs
Logging
Messaging
```

Infrastructure should implement interfaces/abstractions required by the application/domain where appropriate.

---

# 14. REPOSITORY RESPONSIBILITY

Repositories are responsible for persistence operations.

Examples:

```text
find
findOne
create
save
update
delete
query
```

Repositories should not become the primary location for complex business rules.

Bad:

```text
SaleRepository
    ↓
decides whether a sale is legally refundable
```

Prefer:

```text
SaleService / Domain
    ↓
decides refund eligibility

Repository
    ↓
persists the result
```

---

# 15. DATABASE ACCESS

Application/domain code should not randomly access the database.

Prefer:

```text
Service / Use Case
        ↓
Repository
        ↓
TypeORM
        ↓
MySQL
```

This makes database behavior easier to test and maintain.

---

# 16. TYPEORM RULE

TypeORM is an infrastructure concern.

Entities may use TypeORM decorators, but application logic should avoid becoming tightly coupled to TypeORM APIs unnecessarily.

Use:

```text
Repository
QueryBuilder
Transactions
EntityManager
```

according to the project's database architecture.

---

# 17. ENTITY RESPONSIBILITY

Database entities represent persistence structures.

Do not automatically assume:

```text
Database Entity
    =
Domain Entity
    =
API Response
```

These are different architectural concerns.

When complexity grows, use appropriate mapping between them.

---

# 18. DATABASE RULES

All database behavior must follow:

```text
DATABASE_RULES.md
```

This includes:

```text
Primary keys
Foreign keys
Indexes
Constraints
Transactions
Soft deletes
Migrations
Naming
Relationships
Pagination
Query optimization
```

---

# 19. MODULE STRUCTURE

The preferred project organization is feature/domain oriented.

Example:

```text
src/
│
├── modules/
│   │
│   ├── auth/
│   ├── users/
│   ├── organizations/
│   ├── roles/
│   ├── permissions/
│   │
│   ├── products/
│   ├── inventory/
│   ├── warehouses/
│   │
│   ├── customers/
│   ├── suppliers/
│   │
│   ├── purchases/
│   ├── sales/
│   ├── returns/
│   ├── payments/
│   │
│   ├── accounting/
│   ├── reports/
│   └── dashboard/
│
├── common/
├── config/
├── database/
├── jobs/
└── main.ts
```

Actual module names may differ according to the project.

---

# 20. FEATURE MODULE RULE

Each major business capability should be isolated into a module.

Example:

```text
sales/
├── controllers/
├── dto/
├── entities/
├── repositories/
├── services/
├── use-cases/
├── events/
└── tests/
```

The exact structure may be simplified for smaller modules.

Do not create unnecessary folders purely for aesthetics.

---

# 21. MODULE RESPONSIBILITY

A module should own its business capability.

For example:

```text
Sales Module
    owns sales behavior

Inventory Module
    owns inventory behavior

Accounting Module
    owns accounting behavior
```

Do not spread one business rule across many unrelated modules without a clear reason.

---

# 22. MODULE COMMUNICATION

Modules should communicate through explicit interfaces/services/events.

Avoid reaching directly into another module's internal implementation.

Bad:

```text
SalesController
    ↓
InventoryRepository
```

Prefer:

```text
SalesService
    ↓
InventoryService / Inventory Use Case
```

or an explicit domain/event mechanism where appropriate.

---

# 23. MODULE PUBLIC API

Each module should expose only what other modules need.

Conceptually:

```text
Module Internal
    ↓
Public Service / Interface
    ↓
Other Module
```

Avoid exposing internal repositories and implementation details unnecessarily.

---

# 24. CIRCULAR DEPENDENCY

Avoid circular dependencies.

Bad:

```text
Sales
 ↓
Inventory
 ↓
Sales
```

If a circular dependency appears, consider:

```text
Shared abstraction
Domain event
Application service
Orchestration layer
Refactoring ownership
```

Do not solve every circular dependency with `forwardRef()` without understanding the underlying architecture.

---

# 25. SHARED MODULES

Shared infrastructure may live under:

```text
src/common/
```

Examples:

```text
logging
errors
pagination
validation
decorators
guards
utilities
types
```

Shared modules must not become a dumping ground for unrelated business logic.

---

# 26. COMMON VS DOMAIN LOGIC

Do not place business-specific logic into generic utilities.

Bad:

```text
common/utils.ts
    calculateSaleDiscount()
```

if the discount belongs specifically to the Sales domain.

Prefer:

```text
sales/domain/
```

or the project's equivalent.

---

# 27. CONFIGURATION ARCHITECTURE

Configuration should be centralized.

Conceptually:

```text
Environment
    ↓
Configuration Module
    ↓
Application Components
```

Do not read `process.env` randomly throughout the codebase when centralized configuration is available.

---

# 28. ENVIRONMENT CONFIGURATION

Separate:

```text
Development
Testing
Staging
Production
```

Environment-specific values must not be hardcoded into application logic.

---

# 29. AUTHENTICATION ARCHITECTURE

Authentication should be centralized.

Conceptually:

```text
Request
    ↓
Authentication Guard
    ↓
Authenticated User Context
    ↓
Authorization
    ↓
Application Service
```

Business services should receive authenticated context rather than directly parsing HTTP authorization headers.

---

# 30. AUTHORIZATION ARCHITECTURE

Authorization should follow:

```text
User
 ↓
Role
 ↓
Permission
 ↓
Data Visibility / Scope
 ↓
Resource
```

The exact implementation belongs to:

```text
SECURITY_RULES.md
DOMAIN_RULES.md
```

---

# 31. DATA VISIBILITY ARCHITECTURE

Data access is not only:

```text
Can user read this entity?
```

It may also be:

```text
Which records can the user read?
```

Conceptually:

```text
Authentication
    ↓
Permission
    ↓
Organization Scope
    ↓
Branch Scope
    ↓
Warehouse Scope
    ↓
Resource Ownership
    ↓
Database Query
```

Visibility filters must be enforced server-side.

---

# 32. TENANT ARCHITECTURE

If the system is multi-tenant:

```text
Organization
    ↓
Users
    ↓
Roles / Permissions
    ↓
Business Data
```

Tenant boundaries must be enforced at the data-access level.

A service must never accidentally query all tenants when the request is scoped to one organization.

---

# 33. REQUEST CONTEXT

Authenticated request context may contain information such as:

```text
userId
organizationId
roles
permissions
branch scope
warehouse scope
requestId
```

Only trusted server-generated/authenticated values should be used for security decisions.

---

# 34. TRANSACTION ARCHITECTURE

Transactions should be controlled at the application/use-case boundary where a business operation requires atomicity.

Example:

```text
Create Sale
    ↓
BEGIN TRANSACTION
    ↓
Create Sale
    ↓
Create Sale Items
    ↓
Update Inventory
    ↓
Create Payment
    ↓
COMMIT
```

On failure:

```text
ROLLBACK
```

Do not scatter transaction boundaries randomly across low-level repositories.

---

# 35. EVENT ARCHITECTURE

Use events when one business operation needs to notify other components without tightly coupling them.

Example:

```text
SaleCompleted
    ↓
Inventory Update
    ↓
Accounting Entry
    ↓
Notification
    ↓
Analytics
```

Events should represent meaningful business events.

Avoid creating events for every trivial method call.

---

# 36. DOMAIN EVENTS

Domain events should describe business facts.

Good:

```text
SaleCompleted
PaymentReceived
StockAdjusted
PurchaseApproved
ReturnCompleted
```

Avoid infrastructure-focused names such as:

```text
RepositoryUpdated
DatabaseRowChanged
```

unless required by infrastructure.

---

# 37. EVENT CONSISTENCY

Events must not create inconsistent business state.

For important operations consider:

```text
Transaction
+
Outbox Pattern
+
Reliable Event Publishing
```

when required by the system's reliability requirements.

Do not introduce an event-based architecture without understanding delivery guarantees.

---

# 38. BULLMQ ARCHITECTURE

BullMQ is intended for asynchronous/background processing.

Example:

```text
HTTP Request
    ↓
Application Service
    ↓
Queue
    ↓
BullMQ
    ↓
Worker
    ↓
Use Case
```

Use queues for work that does not need to block the request unnecessarily.

---

# 39. QUEUE RESPONSIBILITY

Appropriate queue tasks may include:

```text
Email
Reports
Large exports
Notifications
Data processing
External synchronization
Scheduled jobs
Heavy calculations
```

Do not put simple synchronous operations into queues merely because queues exist.

---

# 40. WORKER ARCHITECTURE

Workers should call application/domain logic rather than duplicating business rules.

Prefer:

```text
Worker
 ↓
Use Case
 ↓
Domain
 ↓
Repository
```

Avoid:

```text
Worker
 ↓
custom business logic
```

that behaves differently from the HTTP path.

---

# 41. REDIS ARCHITECTURE

Redis may be used for:

```text
Cache
Distributed locks
Rate limiting
BullMQ infrastructure
Temporary state
```

Redis is not automatically the system of record.

Persistent business data belongs in MySQL unless the architecture explicitly states otherwise.

---

# 42. CACHE ARCHITECTURE

Caching should follow:

```text
Request
 ↓
Authorization
 ↓
Cache lookup
 ↓
Database if needed
 ↓
Cache result
```

Cache keys must respect authorization and tenant boundaries.

---

# 43. CACHE INVALIDATION

Every cache must have an invalidation strategy.

Before adding a cache, define:

```text
Key
TTL
Invalidation event
Stale-data tolerance
Scope
```

If these cannot be defined, reconsider whether caching is appropriate.

---

# 44. EXTERNAL SERVICE ARCHITECTURE

External providers should be isolated behind service interfaces.

Example:

```text
Application
    ↓
PaymentService Interface
    ↓
PaymentProviderAdapter
    ↓
External Provider
```

Do not spread provider-specific SDK calls throughout business modules.

---

# 45. PAYMENT PROVIDER EXAMPLE

Prefer:

```text
PaymentService
    ↓
PaymentProvider interface
    ↓
Provider A Adapter
```

instead of:

```text
SalesService
    ↓
Provider A SDK
```

This makes provider replacement and testing easier.

---

# 46. EMAIL ARCHITECTURE

Email sending should be abstracted.

Example:

```text
Application
    ↓
Notification / Email Service
    ↓
Email Provider
```

Do not put SMTP/provider-specific logic into business services.

---

# 47. FILE STORAGE ARCHITECTURE

File storage should be abstracted when multiple storage providers may be used.

Example:

```text
Application
    ↓
FileStorageService
    ↓
Local / S3 / Object Storage
```

Business logic should not depend directly on filesystem implementation details.

---

# 48. API VERSIONING

API versioning should be explicit when required.

Example:

```text
/api/v1/...
/api/v2/...
```

Do not introduce breaking API behavior into an existing version without explicit approval.

---

# 49. ERROR ARCHITECTURE

Use a consistent error architecture.

Conceptually:

```text
Domain Error
    ↓
Application Error
    ↓
HTTP Exception / Response
```

Do not leak low-level infrastructure errors directly to clients.

---

# 50. ERROR OWNERSHIP

The layer that understands the error should define its meaning.

Example:

```text
Domain
    ↓
SaleAlreadyCompleted

Application / Presentation
    ↓
Appropriate HTTP response
```

Avoid exposing database-specific exceptions as business errors.

---

# 51. VALIDATION ARCHITECTURE

Validation should occur at multiple boundaries where appropriate:

```text
External Input
    ↓
DTO Validation
    ↓
Application Validation
    ↓
Domain Invariants
    ↓
Database Constraints
```

Each layer has a different responsibility.

Do not rely on only one validation layer for all correctness.

---

# 52. DATABASE CONSTRAINTS

Important invariants should be protected by database constraints when appropriate.

Examples:

```text
UNIQUE
FOREIGN KEY
NOT NULL
CHECK
INDEX
```

Application validation alone may not protect against concurrent requests.

---

# 53. CONCURRENCY ARCHITECTURE

For shared mutable state:

```text
Request A
Request B
    ↓
Same Resource
```

the architecture must consider race conditions.

Possible tools:

```text
Transactions
Row locks
Unique constraints
Optimistic locking
Distributed locks
Idempotency keys
```

Use the simplest mechanism that correctly satisfies the requirement.

---

# 54. OBSERVABILITY ARCHITECTURE

Critical operations should be observable through:

```text
Logs
Metrics
Tracing
Audit logs
Job status
```

Observability must not expose sensitive information.

---

# 55. REQUEST ID

Requests should have a correlation/request identifier where appropriate.

Conceptually:

```text
HTTP Request
    ↓
requestId
    ↓
Service
    ↓
Database / Queue / External API
```

This helps trace failures across asynchronous workflows.

---

# 56. JOB IDENTITY

Background jobs should have identifiable job IDs.

Logs should make it possible to determine:

```text
Which job?
Which operation?
Which resource?
Which request?
```

without exposing sensitive information.

---

# 57. SCHEDULED JOBS

Scheduled tasks should use the same application/domain services as normal operations where possible.

Avoid duplicating business rules inside cron jobs.

---

# 58. CRON ARCHITECTURE

Prefer:

```text
Scheduler
    ↓
Use Case
    ↓
Domain
    ↓
Repository
```

rather than:

```text
Cron
    ↓
Direct database manipulation
```

unless the task is explicitly an infrastructure maintenance operation.

---

# 59. REPORTING ARCHITECTURE

Reports should be treated as read operations with potentially large data access.

Conceptually:

```text
Report Controller
    ↓
Report Service
    ↓
Authorized Query
    ↓
Aggregation
    ↓
Response / Export
```

Reports must respect visibility rules.

---

# 60. DASHBOARD ARCHITECTURE

Dashboard queries must follow authorization and tenant boundaries.

Do not create:

```text
/dashboard
```

that bypasses the normal permission system.

---

# 61. SEARCH ARCHITECTURE

Search should be implemented through explicit application services.

Search must respect:

```text
authorization
tenant scope
visibility
pagination
filter allowlists
sorting allowlists
```

---

# 62. PAGINATION ARCHITECTURE

Large list endpoints should use pagination.

Possible approaches:

```text
Offset pagination
Cursor pagination
Keyset pagination
```

The project should use a consistent strategy appropriate to the data.

---

# 63. BULK OPERATION ARCHITECTURE

Bulk operations should be explicit use cases.

Example:

```text
BulkUpdateSales
BulkImportProducts
BulkStockAdjustment
```

They must consider:

```text
Validation
Authorization
Transactions
Partial failure
Idempotency
Performance
Auditability
```

---

# 64. IMPORT ARCHITECTURE

Large imports should generally use:

```text
Upload
    ↓
Validation
    ↓
Queue
    ↓
Worker
    ↓
Processing
    ↓
Result
```

Do not process very large imports synchronously unless justified.

---

# 65. EXPORT ARCHITECTURE

Large exports may use:

```text
Request
    ↓
Authorization
    ↓
Queue
    ↓
Worker
    ↓
File generation
    ↓
Secure storage
    ↓
Authorized download
```

Export files must respect data visibility.

---

# 66. AUDIT ARCHITECTURE

Audit logging should be centralized enough to remain consistent.

Important business/security actions should record:

```text
actor
action
resource
resourceId
timestamp
result
requestId
```

Do not store secrets in audit records.

---

# 67. SECURITY ARCHITECTURE

Security responsibilities should be layered:

```text
Transport Security
        ↓
Authentication
        ↓
Authorization
        ↓
Data Visibility
        ↓
Input Validation
        ↓
Business Rules
        ↓
Database Constraints
```

No single layer should be considered the only security mechanism.

---

# 68. DEPENDENCY DIRECTION

Preferred dependency direction:

```text
Presentation
      ↓
Application
      ↓
Domain
      ↓
Infrastructure
```

Infrastructure details should not leak upward unnecessarily.

---

# 69. FORBIDDEN DEPENDENCIES

Avoid:

```text
Domain
    ↓
Controller

Domain
    ↓
HTTP request

Domain
    ↓
Redis

Domain
    ↓
BullMQ

Controller
    ↓
Raw SQL

Controller
    ↓
Direct filesystem

Business Service
    ↓
Provider-specific SDK everywhere
```

unless explicitly justified by architecture.

---

# 70. DEPENDENCY INVERSION

When higher-level business logic requires infrastructure functionality, prefer abstractions.

Example:

```text
Application
    ↓
PaymentGateway interface
    ↓
StripeAdapter / OtherAdapter
```

The business logic should not be forced to know every infrastructure implementation.

---

# 71. INTERFACE OWNERSHIP

Interfaces should be owned by the layer that needs the abstraction.

For example:

```text
Application requires payment
    ↓
Application defines PaymentGateway interface
    ↓
Infrastructure implements it
```

Avoid creating interfaces everywhere without a real abstraction need.

---

# 72. OVER-ENGINEERING RULE

Do not introduce:

```text
Microservices
Event sourcing
CQRS
Repository abstractions
Complex factories
Dependency inversion layers
```

merely because they are considered advanced architecture.

Use them only when they solve a real problem.

---

# 73. MODULAR MONOLITH PRINCIPLE

The default architecture should favor a modular monolith unless there is a strong requirement for microservices.

Conceptually:

```text
One Application
│
├── Auth
├── Sales
├── Inventory
├── Purchase
├── Accounting
├── Reports
└── Other Modules
```

Modules must remain logically isolated even when deployed together.

---

# 74. MICROservice DECISION

Do not split a module into a microservice simply because the module is large.

Consider:

```text
Independent scaling
Independent deployment
Team ownership
Failure isolation
Operational complexity
Network boundaries
Data ownership
```

A microservice decision requires architectural justification.

---

# 75. DATABASE OWNERSHIP

In a modular monolith, modules may share one database while maintaining logical ownership of tables.

A module should be the primary owner of its business data.

Other modules should access that data through explicit application interfaces where practical.

---

# 76. SHARED DATABASE RULE

Do not allow every module to freely modify every table.

Example:

```text
Sales
    ↓
owns sales tables

Inventory
    ↓
owns inventory tables
```

Cross-module changes should go through explicit business operations.

---

# 77. EVENTUAL CONSISTENCY

If asynchronous events are used, determine whether the workflow is:

```text
Strongly consistent
```

or:

```text
Eventually consistent
```

Do not assume asynchronous processing is immediately reflected everywhere.

---

# 78. TRANSACTION + QUEUE BOUNDARY

Do not assume a database transaction automatically includes a BullMQ enqueue operation.

Example:

```text
BEGIN
    Update database
    Add queue job
COMMIT
```

can have failure scenarios.

For critical workflows consider reliable patterns such as:

```text
Outbox Pattern
```

when justified.

---

# 79. API → QUEUE BOUNDARY

When an API creates a job:

```text
API
    ↓
Validate
    ↓
Authorize
    ↓
Persist required state
    ↓
Queue
```

The job should contain enough information to process the operation safely without carrying unnecessary sensitive data.

---

# 80. WORKER → DATABASE BOUNDARY

Workers must use the same database/domain architecture as normal application code.

Do not create a second business implementation just for workers.

---

# 81. TEST ARCHITECTURE

Architecture should support:

```text
Unit Tests
Integration Tests
E2E Tests
```

Dependencies should be replaceable/mocked where appropriate.

Do not make the entire application necessary to test a small domain rule.

---

# 82. UNIT TEST BOUNDARY

Unit tests should focus on:

```text
Domain rules
Application logic
Pure functions
Use cases
```

without requiring unnecessary infrastructure.

---

# 83. INTEGRATION TEST BOUNDARY

Integration tests should verify:

```text
Database
Repositories
Redis where relevant
Queues where relevant
External service adapters
```

Use real infrastructure where the behavior being tested depends on it.

---

# 84. E2E TEST BOUNDARY

E2E tests should verify complete workflows:

```text
HTTP
 ↓
Authentication
 ↓
Authorization
 ↓
Application
 ↓
Database
```

and important asynchronous workflows where required.

---

# 85. DEPLOYMENT ARCHITECTURE

The application should be deployable consistently across environments.

Conceptually:

```text
Docker
    ↓
Application
    ↓
MySQL
    ↓
Redis
    ↓
BullMQ Workers
```

Actual production topology may differ.

---

# 86. CONTAINER RESPONSIBILITY

Containers should have clear responsibilities.

Possible services:

```text
api
worker
mysql
redis
```

Do not combine unrelated infrastructure responsibilities without a reason.

---

# 87. API AND WORKER DEPLOYMENT

API and worker processes may share the same codebase but should have distinct runtime responsibilities.

Example:

```text
API Container
    ↓
HTTP traffic

Worker Container
    ↓
BullMQ jobs
```

They should share application/domain code where appropriate.

---

# 88. HEALTH CHECKS

Services should expose appropriate health/readiness information.

Health checks should distinguish between:

```text
Process alive
Application ready
Database available
Redis available
Critical dependency available
```

Do not expose sensitive infrastructure details through public health endpoints.

---

# 89. GRACEFUL SHUTDOWN

The application should gracefully close:

```text
HTTP server
Database connections
Redis connections
Queue workers
External connections
```

during shutdown.

Workers should avoid abandoning active critical jobs without proper handling.

---

# 90. SCALABILITY PRINCIPLE

The architecture should allow horizontal scaling where appropriate.

Stateless API instances are preferred where possible.

Do not rely on local process memory for shared critical state.

Use:

```text
MySQL
Redis
Queue
Shared storage
```

when shared state is required.

---

# 91. STATE OWNERSHIP

Every important state should have a clear owner.

Example:

```text
Persistent business state
    → MySQL

Cache state
    → Redis

Job state
    → BullMQ/Redis

Temporary request state
    → Request context
```

Do not maintain multiple conflicting sources of truth.

---

# 92. SINGLE SOURCE OF TRUTH

For each business concept, identify the authoritative source.

Example:

```text
Product master data
    → Product tables

Inventory balance
    → Inventory architecture

User permissions
    → RBAC system

Payment status
    → Payment domain/provider verification
```

Caches and projections must not silently become authoritative.

---

# 93. DATA FLOW

Every important workflow should have an understandable data flow.

Example:

```text
Client
  ↓
Controller
  ↓
DTO Validation
  ↓
Authentication
  ↓
Authorization
  ↓
Use Case
  ↓
Domain Rules
  ↓
Transaction
  ↓
Repository
  ↓
MySQL
  ↓
Event / Queue
  ↓
Worker
```

The exact flow may differ per feature.

---

# 94. ARCHITECTURAL CHANGE RULE

Before changing architecture, identify:

```text
Why is the current architecture insufficient?
What problem does the new architecture solve?
What modules are affected?
What migration is required?
What risks exist?
How will it be tested?
```

Do not change architecture for style alone.

---

# 95. ADR REQUIREMENT

Create an Architecture Decision Record when making significant decisions such as:

```text
Database strategy
Authentication architecture
RBAC architecture
Multi-tenancy strategy
Event architecture
Queue architecture
Payment architecture
Storage architecture
Microservice split
CQRS
Event sourcing
Major infrastructure changes
```

---

# 96. ARCHITECTURAL REVIEW CHECKLIST

Before completing a major feature:

```text
[ ] Correct module
[ ] Correct layer
[ ] Clear ownership
[ ] No unnecessary coupling
[ ] No circular dependency
[ ] Business logic in correct location
[ ] Database access follows architecture
[ ] Security boundary preserved
[ ] Tenant boundary preserved
[ ] Queue boundary correct
[ ] External services isolated
[ ] Transactions correct
[ ] Idempotency considered
[ ] Tests support architecture
[ ] Documentation updated
```

---

# 97. AI ARCHITECTURE RULES

AI MUST:

```text
Read architecture before changing structure.

Inspect existing patterns before creating new ones.

Keep controllers thin.

Keep business logic in the appropriate application/domain layer.

Keep infrastructure concerns isolated.

Respect module boundaries.

Avoid circular dependencies.

Avoid unnecessary abstractions.

Avoid unnecessary dependencies.

Prefer modular monolith architecture unless requirements justify otherwise.

Use explicit interfaces where they provide meaningful boundaries.

Preserve transaction boundaries.

Consider concurrency.

Consider idempotency.

Respect tenant/data visibility boundaries.

Reuse existing application services in workers where appropriate.
```

---

# 98. AI MUST NOT

AI MUST NOT:

```text
Move business logic into controllers for convenience.

Access the database randomly from controllers.

Bypass services to modify another module's data.

Create circular dependencies as a shortcut.

Add microservices without architectural justification.

Add CQRS/event sourcing without a real requirement.

Introduce Redis as a source of truth without approval.

Duplicate business logic inside workers.

Expose ORM entities directly when this violates API boundaries.

Mix infrastructure-specific SDK calls throughout business logic.

Change architecture during unrelated feature work.

Perform large refactors without approval.

Silently change module ownership.
```

---

# 99. ARCHITECTURE CHANGE REPORT

For architectural changes, AI should report:

```text
## Problem

[What architectural problem exists]

## Current Architecture

[Relevant existing design]

## Proposed Architecture

[New design]

## Reason

[Why the change is necessary]

## Affected Modules

[List]

## Database Impact

[Impact]

## API Impact

[Impact]

## Security Impact

[Impact]

## Migration

[Required migration]

## Tests

[Required tests]

## Risks

[Known risks]

## Human Approval Required

[Yes/No + reason]
```

---

# 100. FINAL ARCHITECTURE PRINCIPLE

The architecture exists to make the system:

```text
Easy to understand
Easy to change
Hard to break
Hard to misuse
Easy to test
Secure by default
```

The goal is not:

```text
Maximum abstraction
Maximum patterns
Maximum folders
Maximum technologies
```

The goal is:

```text
Clear boundaries
+
Clear ownership
+
Correct dependencies
+
Reliable data flow
+
Maintainable code
```

When adding new code, always ask:

```text
Which module owns this?

Which layer owns this responsibility?

Who is allowed to call it?

What data does it access?

What security boundary does it cross?

Does it require a transaction?

Can it be retried?

Can it run concurrently?

Does it need a queue?

Does it create a new architectural dependency?
```

If the answer is unclear:

```text
Inspect the existing architecture.
Do not guess.
```
