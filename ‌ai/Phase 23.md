# Phase 23 — API Security

## Fashion ERP Backend

## Production-Ready Implementation Prompt

You are implementing **Phase 23 — API Security** of the Fashion ERP Backend.

The goal is to harden the entire ERP backend API for production use.

This phase must NOT replace or duplicate:

```text
Phase 05 — Authentication
Phase 06 — Dynamic RBAC + Data Visibility
Phase 18 — Outbox Pattern
Phase 19 — Redis
Phase 20 — BullMQ Workers
Phase 21 — Notifications
Phase 22 — Reports / Dashboard
```

Instead, Phase 23 must provide a centralized security layer around the existing application.

---

# 1. PROJECT STACK

Existing stack:

```text
NestJS
TypeScript
MySQL
TypeORM
Redis
BullMQ
Docker
REST API
JWT
Dynamic RBAC
Data Visibility
Audit Log
Outbox Pattern
Bruno
```

Do not introduce another backend framework, ORM, database, or authentication system.

The existing repository is the primary source of truth.

---

# 2. FIRST STEP — INSPECT THE EXISTING CODEBASE

Before writing code, inspect the complete security-related architecture.

Search:

```text
src/
common/
auth/
users/
roles/
permissions/
guards/
decorators/
middleware/
interceptors/
filters/
pipes/
redis/
queues/
audit/
notifications/
reports/
controllers/
main.ts
app.module.ts
```

Search for:

```text
JWT
accessToken
refreshToken
guard
AuthGuard
RolesGuard
PermissionGuard
permission
role
visibility
audit
rateLimit
throttle
helmet
cors
csrf
cookie
session
password
bcrypt
argon
hash
encryption
secret
API key
idempotency
requestId
traceId
validation
exception
```

Do not create duplicate security infrastructure if it already exists.

---

# 3. SECURITY OBJECTIVES

Phase 23 must protect against:

```text
Authentication attacks
Authorization bypass
Privilege escalation
IDOR
Mass assignment
Injection
SQL injection
XSS
CSRF
CORS abuse
Brute force
Credential stuffing
Token abuse
Replay attacks
Rate abuse
Request flooding
Sensitive data leakage
Improper error disclosure
Unsafe file access
Unsafe report downloads
API enumeration
Webhook abuse
Queue abuse
Cache poisoning
Security misconfiguration
```

Implement only controls relevant to this backend.

---

# 4. SECURITY ARCHITECTURE

Target architecture:

```text
Client
  │
  ▼
Reverse Proxy / Load Balancer
  │
  ▼
Security Headers
  │
  ▼
CORS
  │
  ▼
Request ID / Trace ID
  │
  ▼
Rate Limiting
  │
  ▼
Body / Request Limits
  │
  ▼
Validation Pipe
  │
  ▼
Authentication
  │
  ▼
RBAC
  │
  ▼
Data Visibility
  │
  ▼
Resource Authorization
  │
  ▼
Controller
  │
  ▼
Service
  │
  ▼
Database / Redis / Queue
```

Do not depend on only one security layer.

---

# 5. SECURITY PRINCIPLE

Never trust:

```text
Frontend
HTTP body
query parameters
route parameters
headers
cookies
client-side role
client-side permission
client-provided companyId
client-provided branchId
client-provided warehouseId
client-provided userId
client-provided salesAccountId
```

Everything must be validated server-side.

---

# 6. GLOBAL VALIDATION

Use NestJS validation consistently.

Configure:

```text
ValidationPipe
```

with appropriate secure options.

Consider:

```text
whitelist
forbidNonWhitelisted
transform
```

based on the existing DTO architecture.

---

# 7. MASS ASSIGNMENT PROTECTION

Prevent clients from injecting protected fields.

Example malicious request:

```json
{
  "name": "John",
  "roleId": "SUPER_ADMIN",
  "isSuperAdmin": true,
  "companyId": "another-company",
  "createdBy": "another-user"
}
```

The API must ignore/reject unauthorized fields.

Never allow entities to be populated directly from arbitrary request bodies.

Use:

```text
Request DTO
    ↓
Validated DTO
    ↓
Service mapping
    ↓
Entity
```

not:

```text
request.body
    ↓
repository.save()
```

---

# 8. IDOR PROTECTION

Protect every resource endpoint from:

```text
Insecure Direct Object Reference
```

Example:

```text
GET /sales/:id
```

must not mean:

```text
if JWT valid
→ return sale
```

It must mean:

```text
JWT valid
+
permission valid
+
resource exists
+
user can access resource
+
company/branch/warehouse/sales-account visibility valid
```

---

# 9. RESOURCE AUTHORIZATION

For protected resources:

```text
User
 ↓
Permission
 ↓
Resource
 ↓
Visibility
```

Example:

```text
GET /customers/:id
```

must verify that the customer belongs to an authorized scope.

Do not rely only on:

```text
customerId
```

being valid.

---

# 10. COMPANY ISOLATION

Every company-scoped API must prevent:

```text
Company A user
→ Company B data
```

Test:

```text
GET
POST
PUT
PATCH
DELETE
```

for cross-company access.

Do not trust:

```text
companyId
```

from the request.

Derive or validate company scope from authenticated context and visibility rules.

---

# 11. BRANCH ISOLATION

Prevent:

```text
Branch A user
→ Branch B data
```

even if the attacker manually changes:

```text
branchId
```

in:

```text
body
query
params
```

---

# 12. WAREHOUSE ISOLATION

Prevent unauthorized warehouse access.

Examples:

```text
inventory
stock
stock movement
inventory ledger
transfer
warehouse report
```

must enforce warehouse visibility.

---

# 13. SALES ACCOUNT ISOLATION

Critical ERP requirement.

Sales Staff must not access another Sales Account's records.

Test:

```text
sales
orders
customers
sales reports
payments
commissions
dashboard
```

where Sales Account visibility applies.

---

# 14. DYNAMIC RBAC

Use Phase 06 Dynamic RBAC.

Do NOT hard-code:

```text
if role === "SUPER_ADMIN"
```

throughout the application.

Use the existing:

```text
Role
Permission
UserRole
RolePermission
```

architecture.

---

# 15. PERMISSION CHECKING

Use permission-based authorization.

Examples:

```text
sales.read
sales.create
sales.update
sales.delete

purchase.read
purchase.create
purchase.update
purchase.delete

inventory.read
inventory.create
inventory.update
inventory.delete

accounting.read
accounting.create
accounting.update

report.sales.read
report.accounting.read
report.export
```

Use the actual permission naming convention already present in the repository.

---

# 16. ACTION-LEVEL AUTHORIZATION

Do not assume:

```text
resource.read
```

means:

```text
resource.update
resource.delete
resource.approve
resource.export
```

Treat sensitive actions separately.

Potential actions:

```text
read
create
update
delete
approve
cancel
post
reverse
export
download
manage
```

Only implement actions supported by the existing domain.

---

# 17. APPROVAL SECURITY

For workflows such as:

```text
purchase approval
sales approval
payment approval
journal posting
inventory adjustment
```

verify:

```text
permission
scope
workflow state
```

before allowing the action.

Never allow:

```text
draft → posted
```

simply because the user has update permission.

---

# 18. DELETE SECURITY

Do not allow arbitrary deletion of financial records.

For:

```text
sales
purchase
payment
inventory ledger
accounting journal
```

inspect existing business rules.

Prefer:

```text
cancel
void
reverse
soft delete
```

where required.

Do not destroy accounting history.

---

# 19. JWT SECURITY

Inspect Phase 05 implementation.

Verify:

```text
algorithm
secret/key management
issuer
audience
expiration
token type
```

Do not hard-code secrets.

Use environment variables or secret management.

---

# 20. JWT ALGORITHM

Do not accept arbitrary JWT algorithms from clients.

Configure an explicit allowed algorithm.

Prevent algorithm confusion attacks.

---

# 21. ACCESS TOKEN

Access tokens should have appropriate short-lived expiration.

Do not use unnecessarily long access token lifetimes.

Follow the existing frontend/backend architecture.

---

# 22. REFRESH TOKEN

If refresh tokens exist:

```text
rotate refresh tokens
detect reuse
revoke compromised token/session
```

where appropriate.

Never store raw long-lived refresh tokens in plaintext if the architecture supports secure hashing/storage.

---

# 23. TOKEN REVOCATION

Support revocation for:

```text
logout
password change
account disable
security incident
session revoke
```

Use Redis or the existing session/token infrastructure if appropriate.

Do not build another token store unnecessarily.

---

# 24. PASSWORD SECURITY

Inspect existing password hashing.

Use a modern password hashing algorithm already supported by the project.

Never store plaintext passwords.

Never log:

```text
password
password confirmation
refresh token
access token
```

---

# 25. PASSWORD POLICY

Implement only business-required policy.

Potential:

```text
minimum length
complexity
password history
common-password protection
```

Do not make arbitrary requirements that conflict with existing frontend behavior.

---

# 26. LOGIN BRUTE FORCE PROTECTION

Protect:

```text
POST /auth/login
```

against repeated failures.

Use:

```text
Redis
rate limiting
temporary lockout
progressive delay
```

where appropriate.

Do not permanently lock accounts from simple attack traffic.

---

# 27. ACCOUNT ENUMERATION

Avoid revealing whether an account exists.

For password reset:

Do not return different responses such as:

```text
Email does not exist
```

vs:

```text
Reset email sent
```

Prefer a generic response where appropriate.

---

# 28. RATE LIMITING

Implement global and endpoint-specific rate limits.

Categories:

```text
Global API
Authentication
Password reset
OTP
Search
Reports
Exports
File downloads
Webhook
```

Use Redis-backed throttling if multiple API instances exist.

---

# 29. RATE LIMIT KEY

Do not rate-limit only by IP.

Where appropriate combine:

```text
IP
User ID
Endpoint
Authentication state
```

Be careful with shared/NAT IP addresses.

---

# 30. DISTRIBUTED RATE LIMITING

If the application runs multiple replicas:

```text
API instance A
API instance B
API instance C
```

rate limiting must remain consistent.

Use Redis-backed state.

Do not rely only on in-memory counters.

---

# 31. SEARCH ENDPOINT PROTECTION

Search APIs can become expensive.

Protect:

```text
?page=
?limit=
?q=
```

with:

```text
pagination limits
query length limits
rate limits
allowed filters
```

---

# 32. PAGINATION LIMIT

Never allow:

```text
limit=1000000
```

Use a safe maximum.

Example:

```text
default = 20
maximum = 100
```

Adjust according to the existing frontend requirements.

---

# 33. SORTING SECURITY

Never accept arbitrary SQL:

```text
?sort=DROP TABLE
```

or:

```text
?orderBy=(SELECT ...)
```

Use a whitelist:

```text
allowedSortFields = [...]
```

Map API fields to actual database fields.

---

# 34. FILTER SECURITY

Never convert arbitrary filter strings into SQL.

Use validated DTOs and whitelisted fields.

---

# 35. SQL INJECTION

All SQL must be parameterized.

For TypeORM:

```text
QueryBuilder parameters
repository methods
```

Use raw SQL only when necessary and parameterize every variable.

Never:

```text
"... WHERE id = " + userInput
```

---

# 36. ORM SECURITY

Inspect all:

```text
queryBuilder
raw()
query()
find()
findOne()
```

usage.

Search for unsafe string interpolation.

Fix any injection risk found.

---

# 37. NOSQL / REDIS INJECTION

Redis keys and commands must not allow attacker-controlled command injection.

Do not dynamically execute arbitrary Redis commands.

Normalize cache keys.

---

# 38. CORS

Configure CORS explicitly.

Do not use:

```text
origin: "*"
```

for authenticated production APIs unless the architecture genuinely requires it.

Use environment-based allowed origins.

Example concept:

```text
development
staging
production
```

with separate allowed frontend domains.

---

# 39. CREDENTIALS

If cookies are used:

```text
credentials: true
```

must only be enabled with controlled origins.

Never combine:

```text
Access-Control-Allow-Origin: *
```

with credentialed requests.

---

# 40. CSRF

Determine whether authentication uses:

```text
Authorization: Bearer
```

or:

```text
cookie
```

If authentication is cookie-based, implement appropriate CSRF protection.

If the API is strictly bearer-token based and not cookie-authenticated, document the CSRF threat model rather than blindly adding unnecessary middleware.

---

# 41. SECURITY HEADERS

Use appropriate security headers.

Inspect whether the project already uses Helmet or equivalent.

Consider:

```text
Content-Security-Policy
X-Content-Type-Options
Referrer-Policy
X-Frame-Options
Strict-Transport-Security
```

according to deployment architecture.

Do not blindly enable policies that break required API behavior.

---

# 42. HSTS

Enable HSTS only when production is guaranteed to be HTTPS.

Do not enable aggressive HSTS settings in local development.

Use environment configuration.

---

# 43. CONTENT TYPE

Validate expected content types.

Reject unexpected body formats where appropriate.

---

# 44. REQUEST BODY SIZE

Configure limits for:

```text
JSON
URL encoded
multipart
file uploads
```

based on actual application requirements.

Prevent oversized request attacks.

---

# 45. FILE UPLOAD SECURITY

If file uploads exist:

validate:

```text
MIME type
extension
size
filename
content
```

Do not trust:

```text
Content-Type
```

alone.

---

# 46. FILE PATH TRAVERSAL

Never allow user input to directly become a filesystem path.

Prevent:

```text
../
..\ 
absolute paths
```

and equivalent traversal techniques.

---

# 47. FILE DOWNLOAD SECURITY

Every download endpoint must verify:

```text
authentication
permission
resource ownership/scope
file existence
file status
```

Never expose raw filesystem paths.

---

# 48. REPORT DOWNLOAD SECURITY

Phase 22 report files are sensitive.

Verify:

```text
job ownership
permission
visibility
expiration
status
```

before download.

---

# 49. ERROR HANDLING

Use a global exception filter if the project already follows that architecture.

Production responses must not expose:

```text
stack trace
SQL query
database host
filesystem path
environment variables
internal service details
Redis credentials
JWT secrets
```

---

# 50. ERROR RESPONSE

Use a stable error structure.

Example:

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action",
    "requestId": "..."
  }
}
```

Follow the existing API response convention.

---

# 51. INTERNAL VS EXTERNAL ERROR

Client receives:

```text
safe business error
```

Logs receive:

```text
detailed technical context
```

Never expose internal exceptions directly.

---

# 52. REQUEST ID

Every request should have a unique:

```text
requestId
```

or reuse an incoming trusted correlation ID after validation.

Use it in:

```text
logs
errors
audit
tracing
```

---

# 53. TRUSTED PROXY

If behind:

```text
Nginx
Traefik
Cloudflare
Load Balancer
Kubernetes Ingress
```

configure trusted proxy behavior correctly.

Do not blindly trust:

```text
X-Forwarded-For
```

from arbitrary clients.

---

# 54. IP EXTRACTION

When using client IP for:

```text
rate limiting
audit
security monitoring
```

ensure the proxy configuration is correct.

Do not allow attackers to spoof their IP through arbitrary headers.

---

# 55. API VERSIONING

Follow the existing API versioning strategy.

Security middleware must apply consistently across versions.

Do not leave:

```text
/v1
```

protected while:

```text
/v2
```

is accidentally unprotected.

---

# 56. PUBLIC ENDPOINTS

Explicitly identify public endpoints.

Examples:

```text
health
login
refresh
password reset
public webhook
```

Everything else should require authentication unless explicitly designed as public.

Do not accidentally expose controllers by forgetting guards.

---

# 57. HEALTH CHECK SECURITY

Health endpoints should not expose:

```text
database credentials
Redis status internals
environment variables
queue details
```

Public health endpoint should provide minimal information.

Detailed health diagnostics should require internal/admin access.

---

# 58. API DISCOVERY

Do not expose unnecessary:

```text
debug endpoints
test endpoints
internal endpoints
admin endpoints
```

in production.

Search repository for:

```text
/debug
/test
/dev
/internal
/admin
```

and verify authorization.

---

# 59. SWAGGER / API DOCUMENTATION

If Swagger exists:

Production policy should determine whether:

```text
/swagger
```

is public, protected, or disabled.

Do not expose sensitive internal API details publicly without reason.

---

# 60. API KEY / SERVICE AUTHENTICATION

If internal services or integrations require API keys:

Use:

```text
hashed storage
rotation
expiration
scopes
revocation
audit
```

Do not store plaintext long-lived API keys unnecessarily.

Do not implement API keys if the project does not require them.

---

# 61. WEBHOOK SECURITY

If the ERP exposes webhooks:

verify:

```text
signature
timestamp
replay protection
source
```

where the provider supports signed webhooks.

Never trust:

```text
X-Webhook-Source
```

alone.

---

# 62. WEBHOOK REPLAY PROTECTION

Use:

```text
eventId
timestamp
signature
```

and Redis/database deduplication where appropriate.

Reuse Phase 18 Outbox infrastructure when applicable.

---

# 63. IDEMPOTENCY

Financial APIs may require idempotency.

Potential:

```text
POST /sales
POST /payments
POST /inventory/transfer
POST /journal-entries
```

Inspect existing implementation.

Where needed support:

```text
Idempotency-Key
```

with Redis/database-backed storage.

---

# 64. IDEMPOTENCY SECURITY

Idempotency keys must be scoped to:

```text
user
company
endpoint
```

Do not let User A reuse User B's idempotency record.

---

# 65. REPLAY ATTACKS

For sensitive operations:

```text
payment
inventory transfer
journal posting
approval
```

prevent accidental duplicate execution.

Use:

```text
idempotency
transaction
locking
state validation
```

according to existing architecture.

---

# 66. CONCURRENCY

Security and business correctness must work together.

Protect against:

```text
double payment
double stock deduction
double approval
double posting
double cancellation
```

using existing transaction/locking mechanisms.

Do not solve concurrency with frontend validation.

---

# 67. TRANSACTION SECURITY

For sensitive multi-step operations:

```text
validate permission
validate visibility
validate state
perform transaction
commit
emit event
```

Do not emit successful business events before the database transaction is safely committed unless the Outbox Pattern guarantees consistency.

---

# 68. OUTBOX SECURITY

Inspect Phase 18.

Outbox records must not expose sensitive payloads unnecessarily.

Protect:

```text
event payload
customer information
payment information
user information
```

from unauthorized API access.

---

# 69. AUDIT LOG

Security-sensitive actions should integrate with Phase 04/06/18 existing Audit Log architecture.

Potential:

```text
login success
login failure
logout
password change
role change
permission change
user disable
token revoke
sensitive report export
financial approval
security setting change
```

Do not log secrets.

---

# 70. AUDIT LOG DATA

Useful metadata:

```text
userId
action
resource
resourceId
companyId
branchId
requestId
IP
userAgent
timestamp
result
```

Only store what is actually required.

---

# 71. DO NOT LOG SECRETS

Never log:

```text
password
access token
refresh token
API key
JWT secret
database password
Redis password
encryption key
OTP
```

Even in debug logs.

---

# 72. LOG REDACTION

Inspect:

```text
Logger
Interceptor
HTTP logging
Exception filter
Audit service
```

Ensure sensitive headers/body fields are redacted.

Potential:

```text
authorization
cookie
password
token
secret
apiKey
```

---

# 73. SECURITY LOGGING

Security events should be distinguishable from normal application logs.

Potential events:

```text
AUTH_LOGIN_FAILED
AUTH_LOGIN_SUCCESS
AUTH_TOKEN_REVOKED
AUTH_PERMISSION_DENIED
SECURITY_RATE_LIMIT
SECURITY_IDOR_BLOCKED
SECURITY_INVALID_TOKEN
SECURITY_SUSPICIOUS_REQUEST
```

Use existing logging conventions.

---

# 74. SENSITIVE RESPONSE DATA

Never return:

```text
passwordHash
refreshTokenHash
securityAnswer
internalSecret
privateKey
```

from entities.

Use response DTOs.

---

# 75. ENTITY SERIALIZATION

Do not rely on:

```text
JSON.stringify(entity)
```

for API responses.

Explicitly control returned fields.

---

# 76. USER API SECURITY

User endpoints must prevent privilege escalation.

For example:

```text
PATCH /users/:id
```

must not allow a normal user to modify:

```text
role
permissions
company scope
branch scope
warehouse scope
status
isSuperAdmin
```

unless authorized.

---

# 77. ROLE API SECURITY

Role management is highly privileged.

Protect:

```text
create role
update role
delete role
assign permissions
```

with appropriate permissions.

Do not allow a user to grant themselves a permission they do not possess.

---

# 78. PERMISSION ESCALATION

Critical rule:

A user with:

```text
role.manage
```

must not automatically be able to grant:

```text
super-admin-only permission
```

unless the permission model explicitly allows it.

Implement permission-grant boundaries if required by the system.

---

# 79. SUPER ADMIN

If the system has a true Super Admin capability:

do not rely solely on:

```text
role name
```

Use the existing system-level authorization model.

Super Admin actions should still be auditable.

---

# 80. SELF-MODIFICATION

Prevent users from modifying their own security privileges through generic endpoints.

Examples:

```text
PATCH /users/me
```

must not allow:

```text
roleId
permissionIds
isActive
companyAccess
branchAccess
warehouseAccess
```

unless explicitly authorized.

---

# 81. ACCOUNT DISABLE

Disabled users must not be able to continue using valid sessions indefinitely.

Invalidate/revoke appropriate sessions/tokens.

---

# 82. PASSWORD CHANGE

When password changes:

consider revoking existing refresh sessions/tokens.

Do not automatically destroy every access token mechanism unless required by the architecture.

---

# 83. SESSION MANAGEMENT

If sessions are implemented, support:

```text
list sessions
revoke session
revoke all sessions
```

only where required.

Do not expose session secrets.

---

# 84. SECURITY CONFIGURATION

Create a centralized configuration for:

```text
JWT
CORS
rate limits
body limits
upload limits
security headers
token expiration
cookie options
```

Do not scatter security constants across modules.

---

# 85. ENVIRONMENT SECURITY

Never commit:

```text
.env
secrets
private keys
production passwords
JWT secrets
API keys
```

Inspect:

```text
.gitignore
.env.example
Docker
CI/CD
```

for accidental secret exposure.

---

# 86. SECRET VALIDATION

Application startup should fail safely if critical production secrets are missing.

Do not silently use:

```text
secret
password
123456
development-secret
```

as production defaults.

---

# 87. ENVIRONMENT SEPARATION

Ensure:

```text
development
test
staging
production
```

do not accidentally share production secrets.

---

# 88. DATABASE SECURITY

Inspect database configuration.

Verify:

```text
least privilege DB user
no root usage
TLS where required
connection credentials from secrets
```

Do not expose MySQL externally unless required.

---

# 89. MYSQL USER PRIVILEGE

Application DB user should not normally have unnecessary administrative privileges.

Avoid using:

```text
root
```

for the production application.

---

# 90. REDIS SECURITY

Inspect Redis configuration.

Production should use:

```text
authentication
network isolation
TLS where required
```

according to deployment environment.

Do not expose Redis publicly.

---

# 91. BULLMQ SECURITY

Workers must not trust arbitrary job payloads.

Validate:

```text
job type
input
user/scope
```

before processing.

Do not allow clients to submit arbitrary BullMQ job names.

---

# 92. REPORT JOB SECURITY

Phase 22 report jobs must enforce:

```text
permission
scope
ownership
filters
```

at creation and retrieval.

Do not allow:

```text
GET /reports/jobs/:id
```

to expose another user's report.

---

# 93. NOTIFICATION SECURITY

Notifications must not leak:

```text
financial data
other users' report links
sensitive customer information
```

to unauthorized recipients.

---

# 94. API RESPONSE TIMING

Do not attempt to build custom timing defenses everywhere.

Focus timing protection on sensitive authentication/identity endpoints where enumeration is possible.

---

# 95. SECURITY TEST MATRIX

Create a security matrix covering:

```text
Authentication
Authorization
RBAC
Visibility
IDOR
Injection
Validation
Rate limiting
CORS
CSRF
Headers
File upload
File download
Report export
Webhook
Idempotency
Audit
Secrets
Error handling
```

---

# 96. IDOR TEST MATRIX

Test every major resource:

```text
User
Employee
Role
Permission
Company
Branch
Warehouse
Customer
Supplier
Product
Sale
Purchase
Inventory
Payment
Journal Entry
Report Job
Notification
```

for unauthorized access.

---

# 97. CROSS-TENANT TEST

For every company-scoped resource:

```text
Company A
Company B
```

create test users.

Verify:

```text
A cannot access B
B cannot access A
```

---

# 98. ROLE ESCALATION TEST

Test:

```text
Sales Staff
Sales Manager
Accountant
Warehouse Staff
Admin
Super Admin
```

or the actual dynamic permissions created in the system.

Verify that users can only perform authorized actions.

Do not hard-code these as permanent roles if the application uses custom roles.

---

# 99. NEGATIVE TESTING

Security tests must focus heavily on:

```text
401
403
404
422
429
```

and ensure the API does not leak information.

---

# 100. 401 VS 403

Use consistently:

```text
401 Unauthorized
=
authentication missing/invalid
```

```text
403 Forbidden
=
authenticated but not authorized
```

Do not return 403 for invalid/missing authentication unless the existing security architecture intentionally requires it.

---

# 101. RESOURCE ENUMERATION

For sensitive resources, consider whether returning:

```text
404
```

instead of:

```text
403
```

is appropriate to avoid revealing resource existence.

Follow the project's security policy consistently.

---

# 102. SECURITY TEST TOOLS

Use:

```text
Jest
Supertest
Bruno
```

and existing project testing infrastructure.

If appropriate, use external security tools during local testing.

Do not add unnecessary dependencies.

---

# 103. BRUNO SECURITY COLLECTION

Create a dedicated collection/folder:

```text
Phase 23 — API Security
```

with requests for:

```text
401 tests
403 tests
IDOR tests
RBAC tests
rate-limit tests
validation tests
pagination abuse
sorting abuse
cross-company tests
cross-branch tests
cross-warehouse tests
sales-account tests
```

---

# 104. SECURITY HEADERS TEST

Verify production responses contain expected headers.

Test:

```text
curl
Bruno
integration tests
```

where appropriate.

---

# 105. CORS TEST

Verify:

```text
allowed frontend
```

works.

Verify:

```text
unauthorized origin
```

is rejected.

Do not test only browser UI behavior.

---

# 106. RATE LIMIT TEST

Verify:

```text
normal requests
```

work.

Then exceed configured limits and verify:

```text
429 Too Many Requests
```

with safe response information.

---

# 107. LOGIN SECURITY TEST

Test:

```text
wrong password
nonexistent email
repeated failures
disabled account
expired token
invalid token
revoked token
```

---

# 108. TOKEN SECURITY TEST

Test:

```text
expired access token
wrong signature
wrong algorithm
missing token
malformed token
revoked refresh token
refresh token reuse
```

according to the actual implementation.

---

# 109. INPUT SECURITY TEST

Test payloads containing:

```text
SQL injection strings
HTML
script tags
oversized strings
unexpected fields
invalid UUID
invalid numeric values
invalid dates
invalid enum values
nested unexpected objects
```

The API must safely reject or normalize them.

---

# 110. SECURITY REGRESSION

Do not break:

```text
Authentication
RBAC
Data Visibility
Sales
Purchase
Inventory
Payment
Accounting
Reports
Notifications
BullMQ
```

while implementing security.

Run the full test suite after changes.

---

# 111. PERFORMANCE

Security middleware must not create unnecessary database queries for every request.

Avoid:

```text
JWT request
→ 10 database queries
```

when existing cached authorization context can safely be reused.

Use Redis only where justified.

---

# 112. AUTHORIZATION PERFORMANCE

For permission checking:

prefer existing optimized/cached permission loading if available.

Do not query:

```text
Role
Permission
UserRole
RolePermission
```

repeatedly in every layer.

---

# 113. SECURITY CACHE

If permissions are cached:

invalidate cache when:

```text
role changed
permission changed
user role changed
user disabled
visibility changed
```

Otherwise stale permissions may remain active.

---

# 114. FAIL-SAFE AUTHORIZATION

If authorization infrastructure fails:

do NOT default to:

```text
allow
```

Fail closed.

Example:

```text
permission service unavailable
→ deny sensitive operation
```

---

# 115. FAIL-SAFE SECURITY

Security failures should generally be:

```text
deny
```

not:

```text
allow
```

unless the endpoint is explicitly public.

---

# 116. SECURITY MIDDLEWARE ORDER

Verify middleware/guard order.

Recommended conceptual order:

```text
Request ID
↓
Security headers
↓
CORS
↓
Body limits
↓
Rate limit
↓
Validation
↓
Authentication
↓
Authorization
↓
Controller
```

Adapt to NestJS implementation details.

---

# 117. PUBLIC VS PRIVATE ROUTES

Create a documented list:

```text
Public
Authenticated
Permission-protected
Admin-only
System-only
Internal-worker-only
```

This becomes part of the security architecture documentation.

---

# 118. INTERNAL WORKER ENDPOINTS

If workers communicate through queues, do not expose internal worker operations as public REST endpoints unnecessarily.

---

# 119. ADMIN ENDPOINTS

Administrative APIs must have explicit permissions.

Examples:

```text
user management
role management
permission management
security settings
audit access
system configuration
```

---

# 120. SECURITY DOCUMENTATION

Create/update:

```text
docs/security/api-security.md
docs/security/authentication.md
docs/security/authorization.md
docs/security/threat-model.md
```

Document:

```text
Authentication
Authorization
RBAC
Data Visibility
JWT
Rate limiting
CORS
CSRF
Headers
Validation
IDOR
Injection
File security
Webhook security
Idempotency
Audit
Secrets
Error handling
```

---

# 121. THREAT MODEL

Document major threats:

```text
Threat
Attack vector
Affected endpoint
Mitigation
Test
Status
```

Example:

```text
IDOR
→ GET /sales/:id
→ Resource visibility policy
→ integration test
→ PASS
```

---

# 122. SECURITY CHECKLIST

Before completion verify:

```text
[ ] Authentication cannot be bypassed
[ ] Authorization cannot be bypassed
[ ] Dynamic RBAC enforced
[ ] Data Visibility enforced
[ ] Company isolation enforced
[ ] Branch isolation enforced
[ ] Warehouse isolation enforced
[ ] Sales Account isolation enforced
[ ] IDOR protected
[ ] Mass assignment protected
[ ] SQL injection checked
[ ] Redis injection checked
[ ] Input validation enforced
[ ] Pagination limits enforced
[ ] Sorting whitelist enforced
[ ] Search protected
[ ] Rate limiting implemented
[ ] Distributed rate limiting verified
[ ] CORS configured
[ ] CSRF threat model verified
[ ] Security headers configured
[ ] Request body limits configured
[ ] File upload protected
[ ] File download protected
[ ] Report download protected
[ ] JWT configuration hardened
[ ] Refresh token security verified
[ ] Password security verified
[ ] Account enumeration reduced
[ ] Login brute-force protection implemented
[ ] Error responses sanitized
[ ] Request ID implemented
[ ] Sensitive logs redacted
[ ] Secrets not logged
[ ] Secrets not committed
[ ] Production secret validation implemented
[ ] Redis security verified
[ ] MySQL least privilege verified
[ ] BullMQ job authorization verified
[ ] Webhook security verified where applicable
[ ] Idempotency verified where applicable
[ ] Audit integration verified
[ ] Security cache invalidation verified
[ ] Fail-closed behavior verified
[ ] Public/private routes documented
[ ] Swagger security reviewed
[ ] Security tests implemented
[ ] Bruno security collection implemented
[ ] Full test suite passes
[ ] TypeScript passes
[ ] ESLint passes
[ ] Build passes
[ ] Docker build passes
```

---

# 123. DEFINITION OF DONE

Phase 23 is complete only when:

```text
Repository inspected
+
Existing security architecture understood
+
Security gaps identified
+
Security layer implemented
+
Authentication hardened
+
Authorization hardened
+
Dynamic RBAC protected
+
Data Visibility protected
+
IDOR protected
+
Input validation hardened
+
Rate limiting implemented
+
CORS configured
+
Security headers configured
+
Error handling sanitized
+
Sensitive logging protected
+
File security verified
+
Report/export security verified
+
Webhook security verified where required
+
Idempotency verified where required
+
Audit integration verified
+
Redis security verified
+
Database security verified
+
BullMQ security verified
+
Security tests pass
+
Bruno security tests pass
+
Full regression suite passes
+
Documentation complete
```

---

# 124. FINAL SECURITY RULES

Never trust the client.

Never trust:

```text
role
permission
companyId
branchId
warehouseId
salesAccountId
userId
```

from the client without server-side validation.

Never rely on frontend authorization.

Never protect only the UI.

Never aggregate unauthorized data and hide it afterward.

Never expose secrets.

Never log tokens/passwords.

Never use arbitrary SQL.

Never accept arbitrary sort/filter SQL.

Never allow mass assignment.

Never allow IDOR.

Never allow privilege escalation.

Never let security infrastructure fail open.

Never let a normal user grant themselves permissions.

Never let Company A access Company B data.

Never let Branch A access Branch B data.

Never let Warehouse A access Warehouse B inventory.

Never let Sales Staff access another Sales Account's restricted data.

Never allow heavy reports to block normal API requests.

Never trust asynchronous job payloads.

Never expose report files without authorization.

Never expose internal exception details.

Never assume:

```text
401 = 403
```

Use:

```text
401 = unauthenticated
403 = authenticated but forbidden
```

The final security architecture should follow:

```text
                    CLIENT
                       │
                       ▼
                ┌─────────────┐
                │ API Gateway │
                └──────┬──────┘
                       │
             ┌─────────▼─────────┐
             │ Security Layer    │
             │                   │
             │ CORS              │
             │ Rate Limit        │
             │ Validation        │
             │ Request ID        │
             │ Headers           │
             └─────────┬─────────┘
                       │
                       ▼
                Authentication
                       │
                       ▼
                Dynamic RBAC
                       │
                       ▼
                Data Visibility
                       │
                       ▼
             Resource Authorization
                       │
                       ▼
                 Controller
                       │
                       ▼
                  Service
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
        MySQL        Redis        BullMQ
          │            │            │
          └────────────┼────────────┘
                       ▼
                  Audit / Outbox
```

The most important principle of Phase 23:

```text
SECURITY
=
Authentication
+
Authorization
+
Data Visibility
+
Resource Ownership
+
Input Validation
+
Rate Limiting
+
Isolation
+
Auditability
+
Secure Infrastructure
```

Do not consider the phase complete merely because JWT and RBAC work.

The objective is to make the entire Fashion ERP API resistant to common production security failures while preserving the existing business logic and architecture.
