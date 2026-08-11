# PHASE 01 — PROJECT FOUNDATION

# Fashion ERP Backend

You are implementing **Phase 01 — Project Foundation** of the Fashion ERP Backend.

You MUST follow the rules defined in:

**Phase 00 — AI Rules / Source of Truth**

Phase 00 is the master engineering instruction and has higher priority than assumptions made in this phase.

---

# 1. PHASE OBJECTIVE

Build a clean, production-oriented NestJS foundation for the Fashion ERP Backend.

This phase must establish the technical foundation required by all future phases.

The goal is to create a stable application foundation before implementing:

* Authentication
* RBAC
* Users
* Products
* Sales
* Purchases
* Inventory
* Accounting
* Redis
* BullMQ
* Reports

Do NOT implement those business modules in this phase.

---

# 2. TECHNOLOGY REQUIREMENTS

Use:

* NestJS
* TypeScript
* Node.js
* npm or the package manager already established by the repository
* Jest
* Supertest
* Swagger / OpenAPI

Future infrastructure will use:

* MySQL
* TypeORM
* Redis
* BullMQ
* Docker

Do not replace the required stack.

Do not add unnecessary dependencies.

Before installing any package, inspect the existing project first.

---

# 3. FIRST ACTION — INSPECT THE REPOSITORY

Before changing anything, inspect the existing repository.

Check:

```text
package.json
package-lock.json / lockfile
tsconfig.json
tsconfig.build.json
nest-cli.json
src/
test/
.env
.env.example
.gitignore
README.md
Docker files if present
existing configuration
existing modules
existing tests
```

Also check the current Git state if available.

Determine:

1. Is this already a NestJS project?
2. Which NestJS version is being used?
3. Which Node.js version is expected?
4. Which package manager is being used?
5. Which dependencies already exist?
6. Which configuration already exists?
7. Whether TypeORM/MySQL/Redis/BullMQ are already partially configured.
8. Whether any existing application code must be preserved.

Do not recreate an existing NestJS project.

Do not delete existing functionality without a reason.

---

# 4. FOUNDATION SCOPE

This phase should establish:

```text
Project
├── Configuration
├── Environment validation
├── Application bootstrap
├── Global validation
├── Global exception handling
├── Request correlation ID
├── Structured logging foundation
├── API versioning
├── API prefix
├── Swagger
├── Health check
├── Basic response/error conventions
└── Testing foundation
```

---

# 5. APPLICATION BOOTSTRAP

Create a clean `main.ts` bootstrap.

The application should establish, where appropriate:

```text
NestFactory
    ↓
Application Configuration
    ↓
Global Prefix
    ↓
API Versioning
    ↓
Validation Pipe
    ↓
Exception Handling
    ↓
Logging
    ↓
Swagger
    ↓
Application Listen
```

Keep `main.ts` readable.

Do not put business logic into `main.ts`.

---

# 6. API PREFIX

Establish a consistent global API prefix.

Preferred:

```text
/api
```

Combined with versioning:

```text
/api/v1
```

Do not create inconsistent route prefixes between modules.

Document the decision.

---

# 7. API VERSIONING

Enable API versioning from the beginning.

Preferred API contract:

```text
/api/v1/...
```

The implementation should use NestJS's supported versioning mechanism rather than manually duplicating version strings throughout controllers.

Future breaking changes must be able to introduce:

```text
v2
```

without rewriting the entire API architecture.

---

# 8. ENVIRONMENT CONFIGURATION

Create a centralized configuration system.

Use NestJS configuration infrastructure.

Configuration should not be scattered across the application.

Conceptually:

```text
src/
└── config/
    ├── app.config.ts
    ├── database.config.ts
    ├── redis.config.ts
    └── ...
```

Only create files that are actually needed in this phase.

Future phases may extend configuration.

---

# 9. ENVIRONMENT VARIABLES

Create or update:

```text
.env.example
```

Do NOT commit real secrets.

Example variables may include:

```text
NODE_ENV=
PORT=
API_PREFIX=
API_VERSION=
APP_NAME=
```

Do not add fake credentials.

Do not add real passwords.

Do not hard-code secrets.

Future phases will add:

```text
DATABASE_URL
DB_HOST
DB_PORT
DB_USERNAME
DB_PASSWORD
DB_DATABASE

REDIS_URL

JWT_SECRET
JWT_REFRESH_SECRET
```

Only add variables now that are actually required by the foundation.

Do not pretend that infrastructure is configured if it is not.

---

# 10. ENVIRONMENT VALIDATION

Environment variables must be validated at application startup.

The application should fail fast if a required environment variable is invalid.

Validation should detect:

* invalid port
* invalid environment name
* invalid URLs
* missing required configuration

Do not allow the application to silently start with broken configuration.

Use a clear validation error.

---

# 11. NODE ENVIRONMENTS

Support at least:

```text
development
test
staging
production
```

The configuration system should behave predictably for each environment.

Do not accidentally expose development-only behavior in production.

---

# 12. GLOBAL VALIDATION PIPE

Configure NestJS global validation.

Use appropriate settings such as:

```text
transform
whitelist
forbidNonWhitelisted
```

The exact configuration should be chosen based on security and project requirements.

The objective is:

```text
HTTP Request
    ↓
DTO
    ↓
Validation
    ↓
Controller
```

Invalid input should be rejected before business logic executes.

---

# 13. DTO VALIDATION FOUNDATION

Establish the foundation for DTO validation.

The application must be able to support future DTOs such as:

```text
CreateUserDto
UpdateUserDto
CreateProductDto
CreateSaleDto
CreatePurchaseDto
```

Do not implement those business DTOs yet.

Create only the infrastructure required for validation.

---

# 14. GLOBAL EXCEPTION HANDLING

Create a centralized exception handling strategy.

The API should return a predictable error format.

Example conceptual structure:

```json
{
  "success": false,
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "path": "/api/v1/example",
  "timestamp": "..."
}
```

The exact response structure may be adjusted to fit existing repository conventions.

Do not expose internal implementation details.

Do not expose:

* stack traces
* SQL statements
* database credentials
* internal file paths
* secrets

to production API clients.

---

# 15. ERROR CODE STRATEGY

Establish a consistent error code concept.

Examples:

```text
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
CONFLICT
RATE_LIMITED
INTERNAL_ERROR
```

Do not create hundreds of unnecessary codes during this phase.

The system should be extensible for future domain-specific error codes.

---

# 16. HTTP STATUS CODE CONVENTION

Use HTTP status codes correctly.

Examples:

```text
200 OK
201 CREATED
204 NO CONTENT
400 BAD REQUEST
401 UNAUTHORIZED
403 FORBIDDEN
404 NOT FOUND
409 CONFLICT
422 UNPROCESSABLE ENTITY
429 TOO MANY REQUESTS
500 INTERNAL SERVER ERROR
```

Do not use `200 OK` for every error.

Do not invent custom HTTP status codes.

---

# 17. REQUEST CORRELATION ID

Establish a request correlation ID / request ID mechanism.

Every incoming request should have a traceable identifier.

Conceptually:

```text
HTTP Request
    ↓
Request ID
    ↓
Controller
    ↓
Service
    ↓
Logs
```

If the client provides an appropriate request ID, determine whether it should be reused safely.

Otherwise generate one.

Do not trust arbitrary user-controlled values without validation.

The request ID should be available to logs and error responses where appropriate.

---

# 18. LOGGING FOUNDATION

Establish structured logging.

The logging system should support useful fields such as:

```text
timestamp
level
requestId
method
path
statusCode
duration
environment
```

Do not log sensitive data.

Never log:

```text
password
passwordHash
JWT secret
refresh token
API secret
database password
```

Be careful with request bodies because future APIs will contain sensitive information.

---

# 19. LOG LEVELS

Support sensible log levels:

```text
debug
info
warn
error
```

Production logging should not become unusably verbose.

Do not log every internal detail.

---

# 20. REQUEST LOGGING

Create a foundation for HTTP request logging.

At minimum, consider:

```text
Request started
Request completed
Request failed
```

Useful information:

```text
requestId
HTTP method
route
status code
duration
```

Do not log full authentication headers.

Do not log bearer tokens.

---

# 21. HEALTH CHECK

Create a basic health endpoint.

Preferred concept:

```text
GET /api/v1/health
```

The response should clearly indicate whether the application is alive.

Example:

```json
{
  "status": "ok"
}
```

Do not falsely report database or Redis health if those services are not actually configured yet.

If infrastructure health checks are introduced in this phase, they must reflect real connectivity.

Otherwise keep this phase limited to application liveness.

---

# 22. HEALTH CHECK DESIGN

Keep health checks extensible.

Future phases may add:

```text
MySQL
Redis
BullMQ
External APIs
```

Do not create fake health indicators.

A service should only be reported as healthy if it is actually checked.

---

# 23. SWAGGER / OPENAPI

Set up Swagger/OpenAPI.

Preferred URL:

```text
/api/docs
```

or an equivalent consistent route.

The Swagger documentation should include:

* API title
* description
* version
* bearer authentication placeholder for future authentication
* API prefix
* versioned routes

Do not implement JWT authentication yet unless it already exists in the repository.

The Swagger setup should be ready for Phase 05.

---

# 24. SWAGGER INFORMATION

Use a professional API description.

The API should be identified as:

```text
Fashion ERP Backend API
```

Document that this is the backend API for the Fashion ERP system.

Do not include fake business endpoints.

---

# 25. RESPONSE CONVENTION

Establish a predictable response philosophy.

Do not create unnecessary response wrappers everywhere if the existing project already has a clear convention.

If introducing a standard format, ensure it works for:

```text
success
pagination
errors
```

Future APIs should be able to consistently return:

```text
data
meta
error
```

where appropriate.

Do not over-engineer generic response classes during this phase.

---

# 26. HEALTH RESPONSE

The health endpoint should be simple and machine-readable.

Example:

```json
{
  "status": "ok",
  "service": "fashion-erp-backend",
  "environment": "development"
}
```

Only expose non-sensitive information.

Do not expose:

```text
database password
Redis credentials
JWT secrets
server filesystem paths
```

---

# 27. SECURITY HEADERS

If appropriate for the existing project, establish a basic security-header foundation.

Use a well-maintained NestJS-compatible approach.

Do not add unnecessary security packages if the framework or existing dependencies already provide the functionality.

Do not break Swagger or local development without understanding the impact.

---

# 28. CORS

Establish a configurable CORS strategy.

Do not use:

```text
origin: "*"
```

as a production security assumption.

Development may use a broader configuration if necessary.

Production origins should be configurable through environment variables.

Do not hard-code frontend production URLs unless they already exist as project requirements.

---

# 29. SHUTDOWN / GRACEFUL TERMINATION

Establish the foundation for graceful application shutdown.

The application should be able to close resources cleanly when appropriate.

Future infrastructure includes:

```text
MySQL
Redis
BullMQ Workers
```

so the foundation should not make graceful shutdown difficult.

Do not invent worker shutdown logic yet.

---

# 30. TESTING FOUNDATION

Ensure the project has a working Jest setup.

At minimum establish:

```text
unit test capability
e2e test capability
```

Do not create hundreds of tests in this phase.

Create enough tests to prove that the foundation works.

---

# 31. REQUIRED FOUNDATION TESTS

Create tests for at least:

### Application bootstrap

The application starts successfully.

### Health endpoint

```text
GET /api/v1/health
```

returns the expected status.

### Validation

An invalid DTO/request is rejected when a sample validation route or test fixture is used.

### Error handling

An HTTP error produces the expected error response structure.

### API prefix/version

Verify the expected API route structure.

### Swagger

Verify Swagger configuration does not break application startup.

Only implement test routes if necessary, and remove temporary test-only routes from production code.

---

# 32. E2E TEST RULE

E2E tests should use a controlled test environment.

Do not accidentally connect E2E tests to a production database.

Do not delete arbitrary databases.

Do not run destructive test commands against development or production infrastructure.

---

# 33. TEST ENVIRONMENT

Prepare configuration for:

```text
NODE_ENV=test
```

Test configuration must be isolated from production.

If MySQL is not yet implemented in this phase, do not invent a fake database test setup.

The database integration test foundation will be expanded in Phase 03.

---

# 34. LINTING

Inspect the existing lint configuration.

If ESLint already exists:

* preserve it
* improve only when justified

If ESLint is missing and the project requires it:

* establish a reasonable TypeScript/NestJS configuration

Do not spend this phase on subjective formatting debates.

---

# 35. TYPESCRIPT

Maintain strict TypeScript settings where possible.

Do not weaken:

```text
strict
```

merely to make existing code compile.

Avoid unnecessary:

```typescript
any
```

If an exception is required, document the reason.

---

# 36. PACKAGE MANAGEMENT

Use the package manager already established by the repository.

Do not switch:

```text
npm → pnpm
npm → yarn
pnpm → npm
```

without a real requirement.

Do not delete lockfiles unnecessarily.

Do not install duplicate libraries for the same responsibility.

---

# 37. DEPENDENCY POLICY

Before adding a package:

1. Check existing dependencies.
2. Check whether NestJS already provides the capability.
3. Check whether the capability can be implemented simply.
4. Consider maintenance/security.
5. Add only if justified.

After installing dependencies:

* update lockfile
* verify build
* verify tests

---

# 38. FOLDER STRUCTURE

Establish a clean foundation without prematurely creating all future modules.

A reasonable starting point may be:

```text
src/
├── config/
├── common/
│   ├── filters/
│   ├── interceptors/
│   ├── pipes/
│   ├── decorators/
│   └── ...
├── health/
├── app.module.ts
└── main.ts
```

Do not create empty folders for every future module unless the repository already uses that convention.

Future business modules will be added phase-by-phase.

---

# 39. COMMON INFRASTRUCTURE RULE

Only create infrastructure that is genuinely required.

Possible foundation components:

```text
Config
Exception Filter
Request ID
Logging
Validation
Swagger
Health
```

Do not prematurely create:

```text
AuthGuard
RolesGuard
PermissionGuard
TransactionManager
InventoryPolicy
AccountingEngine
```

Those belong to later phases unless existing code already requires them.

---

# 40. DATABASE RULE FOR THIS PHASE

Do not implement the full database architecture in Phase 01.

Phase 03 will define:

```text
MySQL
TypeORM
Entities
Migrations
Indexes
Constraints
Transactions
```

If database configuration already exists in the repository, preserve it and avoid unnecessary rewrites.

---

# 41. REDIS RULE FOR THIS PHASE

Do not implement Redis functionality in Phase 01 unless required by existing code.

Redis belongs primarily to:

```text
Phase 19 — Redis
```

Do not create fake Redis health checks.

Do not introduce caching logic.

---

# 42. BULLMQ RULE FOR THIS PHASE

Do not implement BullMQ workers in Phase 01.

BullMQ belongs primarily to:

```text
Phase 20 — BullMQ Workers
```

Do not create queues merely for demonstration.

---

# 43. AUTHENTICATION RULE FOR THIS PHASE

Do not implement full authentication in Phase 01.

Authentication belongs to:

```text
Phase 05 — Authentication
```

Swagger may be prepared for future Bearer authentication, but do not invent a fake login system.

---

# 44. RBAC RULE FOR THIS PHASE

Do not implement RBAC in Phase 01.

RBAC belongs to:

```text
Phase 06 — Dynamic RBAC + Data Visibility
```

Do not create hard-coded roles such as:

```text
ADMIN
MANAGER
SALES_STAFF
```

as part of the foundation.

---

# 45. BUSINESS MODULE RULE

Do not implement:

```text
Users
Employees
Products
Customers
Suppliers
Sales
Purchases
Inventory
Payments
Accounting
Reports
Notifications
```

in this phase unless required to preserve existing repository functionality.

---

# 46. README

Update or create a useful README section describing:

```text
Project
Technology Stack
Development Setup
Environment Variables
Run Commands
Test Commands
Swagger URL
Health Endpoint
Project Architecture
Phase Roadmap
```

Do not document features that have not been implemented.

Clearly distinguish:

```text
Implemented
Planned
```

---

# 47. DEVELOPMENT COMMANDS

Ensure the project has clear commands for:

```text
development
build
start
test
test:e2e
lint
format
```

Use the repository's existing command conventions where possible.

Do not invent commands that do not work.

Verify commands before documenting them.

---

# 48. HEALTH CHECK COMMAND

After implementation, verify the application manually or through automated tests.

Expected conceptual result:

```text
GET /api/v1/health

200 OK
```

---

# 49. SWAGGER VERIFICATION

Verify that Swagger loads successfully.

Expected conceptual URL:

```text
/api/docs
```

Verify that:

* application starts
* Swagger loads
* versioned API routes appear
* no sensitive configuration is exposed

---

# 50. BUILD VERIFICATION

Run the production build.

The project must compile successfully.

Do not ignore TypeScript errors.

Do not hide errors with:

```text
any
```

or compiler configuration changes.

---

# 51. QUALITY GATE

Before considering Phase 01 complete, run:

```text
npm run build
npm run lint
npm test
npm run test:e2e
```

Use the project's actual package manager and scripts.

If one of these scripts does not exist:

1. determine whether it should exist
2. add it if appropriate
3. document it

Do not claim success without actually running the command.

---

# 52. MANUAL VERIFICATION

Verify at minimum:

```text
Application starts
        ✓

Health endpoint
        ✓

API prefix/version
        ✓

Validation
        ✓

Exception handling
        ✓

Request ID
        ✓

Logging
        ✓

Swagger
        ✓

Build
        ✓

Unit tests
        ✓

E2E tests
        ✓
```

---

# 53. FAILURE HANDLING

If implementation fails:

Do NOT hide the failure.

Report:

```text
What failed
Why it failed
What was attempted
What remains
```

If a failure is caused by the local environment, clearly distinguish:

```text
Code failure
```

from:

```text
Environment/infrastructure failure
```

---

# 54. NO UNRELATED REFACTORING

Do not use Phase 01 as an excuse to rewrite the entire repository.

Avoid:

```text
mass refactor
renaming everything
changing architecture unnecessarily
replacing dependencies
rewriting working modules
```

Only make changes required for the foundation.

---

# 55. FINAL PHASE 01 DELIVERABLES

At the end of Phase 01, the repository should have a stable foundation containing, where applicable:

```text
✓ NestJS bootstrap
✓ Environment configuration
✓ Environment validation
✓ API prefix
✓ API versioning
✓ Global validation
✓ Global exception handling
✓ Error response convention
✓ Request correlation ID
✓ Structured logging foundation
✓ Health endpoint
✓ Swagger/OpenAPI
✓ CORS foundation
✓ Security-header foundation
✓ Graceful shutdown foundation
✓ Jest foundation
✓ E2E testing foundation
✓ ESLint/formatting foundation
✓ README updates
✓ Working development commands
```

---

# 56. DO NOT IMPLEMENT FUTURE PHASES

Do NOT implement the following in this phase:

```text
Authentication
RBAC
Users
Roles
Permissions
Company
Branch
Warehouse
Employees
Products
Customers
Suppliers
Sales
Purchases
Inventory
Inventory Ledger
Payments
Accounting
Outbox
Redis
BullMQ
Notifications
Reports
Advanced Security
Performance Optimization
Production Deployment
```

Only establish the infrastructure required for those future phases.

---

# 57. FINAL REVIEW

Before declaring Phase 01 complete, review the implementation as a Principal Engineer.

Ask:

### Architecture

Is the foundation clean and extensible?

### Security

Are secrets protected?

Is input validated?

Is sensitive information excluded from logs?

### Maintainability

Can future modules be added without restructuring everything?

### Testing

Can future modules easily add unit/integration/E2E tests?

### API

Is `/api/v1` established consistently?

### Documentation

Can a new developer understand how to run the project?

### Production

Are development-only behaviors separated from production?

### Future phases

Can Phase 02 and Phase 03 be implemented without undoing Phase 01?

If not, fix the foundation before proceeding.

---

# 58. REQUIRED FINAL RESPONSE

After implementation, return exactly this type of report:

```text
## Phase 01 — Project Foundation

### Status
[Completed / Partially Completed / Blocked]

### 1. Repository Analysis
- Current architecture
- Existing relevant code
- Important findings

### 2. Implemented
- ...

### 3. Files Created
- ...

### 4. Files Modified
- ...

### 5. Configuration
- ...

### 6. API
- Prefix:
- Version:
- Health:
- Swagger:

### 7. Error Handling
- ...

### 8. Logging / Request ID
- ...

### 9. Testing
- Unit:
- E2E:
- Validation:
- Error handling:
- Health:

### 10. Commands Executed
- ...

### 11. Test Results
- Build:
- Lint:
- Unit:
- E2E:

### 12. Known Issues
- ...

### 13. Risks
- ...

### 14. Phase 02 Readiness
- Ready / Not Ready
- Explanation
```

Do not claim any command passed unless it was actually executed.

Do not claim production readiness yet.

The objective of Phase 01 is to create a **clean, secure, testable, documented NestJS foundation** that future Fashion ERP phases can safely build upon.
