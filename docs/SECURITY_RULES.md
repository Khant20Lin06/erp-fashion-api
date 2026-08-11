# SECURITY_RULES.md

# Security Rules & Security Architecture

This document is the authoritative source for application security requirements.

AI MUST follow these rules when creating, modifying, reviewing, or refactoring code.

AI MUST NOT weaken, bypass, remove, or silently change security controls.

If a security requirement is ambiguous and the decision could affect confidentiality, integrity, authentication, authorization, tenant isolation, or financial data, STOP and ask the human engineer.

---

# 1. SECURITY PRINCIPLES

The system must follow these principles:

* deny by default
* least privilege
* server-side enforcement
* defense in depth
* explicit authorization
* secure defaults
* fail securely
* minimize sensitive data
* validate untrusted input
* protect secrets
* preserve auditability
* never trust the client

Security must not depend only on frontend behavior.

---

# 2. TRUST BOUNDARY

Treat all external input as untrusted.

Untrusted sources include:

```text
HTTP requests
Query parameters
Path parameters
Request bodies
Headers
Cookies
Uploaded files
Webhooks
External APIs
Queue payloads
Client-provided IDs
Imported files
```

Never assume that data is trustworthy merely because it came from the frontend.

---

# 3. AUTHENTICATION

Authentication determines who the user is.

All protected endpoints must require valid authentication.

The backend must validate:

* token authenticity
* token expiration
* token claims
* token issuer/audience where applicable
* session validity where applicable

Never trust a client-provided:

```text
userId
organizationId
role
permissions
```

when these values can be derived from authenticated identity.

---

# 4. PASSWORD SECURITY

Passwords must never be stored in plaintext.

Use a strong password hashing algorithm approved by the project security architecture.

Never:

```text
log passwords
return passwords
store plaintext passwords
store reversible password encryption
```

Password verification must use the secure password hashing mechanism.

---

# 5. TOKEN SECURITY

Access tokens and refresh tokens are sensitive credentials.

Never log:

```text
access_token
refresh_token
Authorization header
session secret
API key
```

Tokens must not be exposed through normal API responses unless explicitly required.

If refresh tokens are persisted, follow the project's token storage and rotation policy.

---

# 6. TOKEN VALIDATION

Do not trust token payload fields without cryptographic verification.

The server must validate the token before using claims such as:

```text
userId
role
organizationId
permissions
```

Do not decode a JWT and treat the decoded payload as authenticated.

Verification is required.

---

# 7. AUTHORIZATION

Authentication does not imply authorization.

Every protected operation must check the appropriate permission.

Example:

```text
sales:read
sales:create
sales:update
sales:delete
sales:return
sales:approve
```

Actual permissions are defined by the project's RBAC configuration.

AI must not assume:

```text
authenticated user
    =
full access
```

---

# 8. LEAST PRIVILEGE

Users, services, workers, and integrations should receive only the permissions required for their responsibilities.

Examples:

```text
Sales Staff
    → sales operations

Warehouse Worker
    → inventory operations

Accounting User
    → accounting operations
```

Do not grant administrative permissions simply because they make implementation easier.

---

# 9. RBAC SECURITY

Roles must not be treated as security merely because they have familiar names.

Authorization must be based on explicit permissions and scopes.

For example:

```text
Role
 ↓
Permissions
 ↓
Data Scope
```

AI must inspect the actual permission system before implementing authorization.

Do not hardcode:

```typescript
if (user.role === 'admin') {
  allow();
}
```

when the project uses dynamic permissions.

---

# 10. DATA VISIBILITY

Permission to read a resource does not automatically mean permission to read every record.

Example:

```text
Sales Staff
    ↓
READ sales
    ↓
Own permitted sales only
```

```text
Sales Manager
    ↓
READ sales
    ↓
Permitted team/branch scope
```

```text
Super Admin
    ↓
READ sales
    ↓
All authorized records
```

Actual visibility rules must follow `DOMAIN_RULES.md`.

---

# 11. TENANT ISOLATION

If the application is multi-tenant:

A user from Organization A must never access Organization B data.

Every tenant-sensitive query must enforce the authenticated organization scope.

Bad:

```text
GET /sales/:id
    ↓
findById(id)
```

if the query does not enforce tenant ownership.

Prefer:

```text
findOne({
  id,
  organizationId: authenticatedOrganizationId
})
```

according to the project's architecture.

Tenant isolation applies to:

```text
CRUD
Search
Reports
Exports
Bulk operations
Background jobs
Queue consumers
File access
Webhooks
```

---

# 12. CLIENT-PROVIDED TENANT IDS

Never trust:

```text
organizationId
branchId
warehouseId
userId
```

provided by the client for authorization decisions.

The server must derive the allowed scope from:

```text
authenticated identity
authorization rules
server-side relationships
```

A client may request a target resource, but the server decides whether access is allowed.

---

# 13. IDOR PROTECTION

Protect against Insecure Direct Object Reference.

Example attack:

```text
User A
GET /sales/Sale-B-ID
```

The fact that the user knows the ID does not mean the user is authorized.

Every direct resource lookup must verify authorization and visibility.

Test this behavior explicitly.

---

# 14. OBJECT-LEVEL AUTHORIZATION

Authorization must be checked at the resource level where required.

Example:

```text
Can user update Sale #123?
```

requires checking:

```text
Authenticated?
+
Has sales:update?
+
Can access Sale #123?
+
Allowed organization?
+
Allowed branch?
+
Allowed state?
```

Do not stop after checking only the global permission.

---

# 15. FUNCTION-LEVEL AUTHORIZATION

Endpoints must also verify whether the user can perform the action.

Example:

```text
sales:read
```

does not automatically grant:

```text
sales:delete
sales:return
sales:approve
sales:refund
```

Sensitive operations require explicit permissions.

---

# 16. PRIVILEGE ESCALATION

Prevent users from granting themselves additional privileges.

Users must not be able to modify:

```text
role
permissions
organization
branch scope
warehouse scope
```

unless explicitly authorized.

A user must not be able to modify their own authorization claims through ordinary profile APIs.

---

# 17. ROLE MANAGEMENT SECURITY

Role/permission management is highly sensitive.

Protect operations such as:

```text
Create Role
Update Role
Delete Role
Assign Permission
Remove Permission
Assign Role to User
Change User Scope
```

These operations require explicit administrative authorization.

Changes should be audited.

---

# 18. SELF-APPROVAL

If the business rules prohibit self-approval:

```text
Requester != Approver
```

must be enforced server-side.

Never rely on the UI to prevent self-approval.

---

# 19. STATE AUTHORIZATION

Permission alone is not enough.

Example:

```text
User has sales:update
```

does not necessarily mean:

```text
Completed Sale
    ↓
can be edited
```

Authorization must respect:

* permissions
* resource ownership
* visibility
* state
* business rules

---

# 20. INPUT VALIDATION

All external input must be validated.

Validate:

```text
body
query
params
headers
files
webhooks
external responses
queue payloads
```

Use explicit DTO/schema validation.

Never assume TypeScript types protect runtime input.

TypeScript types disappear at runtime.

---

# 21. MASS ASSIGNMENT PROTECTION

Never allow clients to update arbitrary entity fields.

Bad:

```typescript
repository.update(id, req.body);
```

This may allow users to modify:

```text
role
organizationId
permissions
isAdmin
balance
status
createdBy
```

Use explicit DTOs and allowlisted fields.

---

# 22. SQL INJECTION

Never concatenate untrusted input into SQL.

Bad:

```text
"SELECT * FROM users WHERE email = '" + email + "'"
```

Use:

* parameterized queries
* TypeORM parameters
* safe query builders
* allowlists

User-controlled sorting/filtering fields must also be validated.

---

# 23. SORTING / FILTER SECURITY

Never allow arbitrary client input to become SQL identifiers.

Bad:

```text
ORDER BY ${req.query.sortBy}
```

Prefer an allowlist:

```text
createdAt
updatedAt
name
total
```

and map allowed API values to known database fields.

---

# 24. FILE UPLOAD SECURITY

File uploads are untrusted.

Validate:

* file size
* MIME type
* file signature where appropriate
* extension
* filename
* storage location

Do not execute uploaded files.

Do not store uploads in executable server directories.

Do not trust:

```text
Content-Type
filename extension
```

alone.

---

# 25. FILE ACCESS CONTROL

Uploaded files must follow the same authorization model as the underlying business data.

Example:

```text
Organization A user
    ↓
must not download
Organization B private file
```

Do not expose internal storage paths.

Do not create public file URLs unless the file is intentionally public.

---

# 26. PATH TRAVERSAL

Never construct filesystem paths directly from untrusted input.

Protect against values such as:

```text
../
../../
absolute paths
encoded traversal
```

Use safe identifiers and controlled storage paths.

---

# 27. API SECURITY

Every API must follow `API_CONTRACTS.md`.

Security requirements include:

* authentication
* authorization
* validation
* rate limiting where required
* consistent error handling
* secure headers where applicable
* request size limits

Do not expose internal implementation details.

---

# 28. RATE LIMITING

Rate-limit security-sensitive or resource-intensive operations.

Examples:

```text
Login
Password reset
OTP
Token refresh
Search
Reports
Exports
Bulk operations
Public APIs
```

Actual limits must be defined by the project.

AI must not remove rate limiting simply to make testing easier.

---

# 29. BRUTE-FORCE PROTECTION

Authentication endpoints must protect against repeated credential attempts.

Possible controls:

```text
rate limiting
temporary lockout
progressive delay
IP/device controls
monitoring
```

Follow the project's authentication architecture.

Do not permanently lock accounts based only on untrusted IP behavior without considering operational consequences.

---

# 30. CORS

CORS must use an explicit allowlist.

Do not automatically allow:

```text
*
```

for credentialed/private APIs.

Allowed origins must be configured through environment/configuration appropriate to the deployment.

---

# 31. CSRF

If browser authentication uses cookies, protect state-changing operations against CSRF.

The exact mechanism must follow the authentication architecture.

Examples may include:

```text
CSRF token
SameSite cookies
Origin validation
```

Do not assume JWT automatically eliminates all browser security concerns.

---

# 32. SECURITY HEADERS

Production HTTP responses should use appropriate security headers.

Depending on the application:

```text
Content-Security-Policy
Strict-Transport-Security
X-Content-Type-Options
Referrer-Policy
Permissions-Policy
```

Use the project's actual security configuration.

Do not introduce headers blindly if they break required functionality.

---

# 33. HTTPS

Production authentication and sensitive business operations must use HTTPS.

Never transmit credentials or tokens over plaintext HTTP in production.

Redirect/transport security must follow deployment architecture.

---

# 34. SECRETS MANAGEMENT

Secrets must never be hardcoded in source code.

Never commit:

```text
DATABASE_PASSWORD
JWT_SECRET
API_KEY
PRIVATE_KEY
PAYMENT_SECRET
ENCRYPTION_KEY
```

to source control.

Use:

```text
environment variables
secret manager
deployment secret storage
```

according to the project architecture.

---

# 35. SECRET LOGGING

Never log secrets.

Forbidden examples:

```text
Authorization header
JWT
password
refresh token
API key
database password
private key
payment credential
```

Be careful with error objects because they may contain request headers or configuration.

---

# 36. ERROR DISCLOSURE

Production errors must not expose:

```text
stack traces
SQL statements
database credentials
filesystem paths
internal service URLs
secret values
implementation details
```

Return safe, stable error responses.

Detailed information may be recorded securely in internal logs when appropriate.

---

# 37. LOGGING SECURITY

Logs are security-sensitive.

Do not log sensitive values unnecessarily.

Protect:

```text
PII
tokens
passwords
payment data
session information
```

Use structured logging where appropriate.

Every security-relevant event should contain enough context for investigation without exposing secrets.

---

# 38. AUDIT LOGGING

Audit important security and business actions.

Examples:

```text
Login
Failed login
Logout
Password change
Role change
Permission change
User scope change
Organization change
Sensitive data access
Sale approval
Refund
Stock adjustment
Accounting correction
```

Audit records should identify:

```text
who
what
when
target
result
requestId
reason where applicable
```

Audit logs should be protected from unauthorized modification.

---

# 39. SECURITY EVENT AUDITING

Record important security events such as:

```text
Authentication failure
Authorization failure
Privilege change
Role assignment
Permission change
Suspicious repeated requests
Token/session events
Webhook verification failure
```

Do not store raw credentials in audit logs.

---

# 40. SESSION SECURITY

Sessions, if used, must have:

* expiration
* secure storage
* invalidation mechanism
* logout behavior
* rotation where required

Sensitive sessions should not remain valid indefinitely.

---

# 41. TOKEN REVOCATION

If the system supports token revocation, define how revoked tokens are handled.

Examples:

```text
logout
password change
account disable
security incident
refresh-token rotation
```

AI must follow the existing token architecture instead of inventing a second revocation mechanism.

---

# 42. ACCOUNT STATUS

Authorization must consider account status where applicable.

Examples:

```text
ACTIVE
SUSPENDED
DISABLED
LOCKED
```

A disabled user must not continue accessing protected resources merely because an old authorization record exists.

---

# 43. PASSWORD RESET

Password reset flows must be protected against:

* account enumeration
* token reuse
* token guessing
* expired reset tokens
* replay
* excessive attempts

Reset tokens must be treated as secrets.

Never log them.

---

# 44. ACCOUNT ENUMERATION

Authentication and password-reset APIs should avoid revealing unnecessary information about whether an account exists.

For example, do not expose overly specific responses such as:

```text
"This email belongs to an account."
```

unless explicitly required.

Follow the project's UX/security design.

---

# 45. SENSITIVE DATA MINIMIZATION

Only collect and store data required by the business.

Do not add sensitive fields merely because they may be useful later.

Before storing sensitive information, determine:

```text
Why is it required?
Who can access it?
How long is it retained?
How is it protected?
```

---

# 46. DATA ENCRYPTION

Sensitive data requiring encryption must follow the project's encryption architecture.

Distinguish:

```text
Encryption at rest
Encryption in transit
Password hashing
Application-level encryption
```

Do not use password hashing where reversible encryption is required.

Do not use reversible encryption for passwords.

---

# 47. PAYMENT SECURITY

Payment-related information is highly sensitive.

Never store or log payment credentials unless explicitly required and securely designed.

Prefer provider tokens/references over sensitive payment data.

Payment status must be verified through trusted provider mechanisms.

Never trust a client request such as:

```text
paymentStatus = PAID
```

without server-side verification.

---

# 48. WEBHOOK SECURITY

Webhook requests are untrusted until verified.

Verify:

```text
signature
timestamp where applicable
event ID
payload
provider identity
```

Webhook processing must be idempotent.

A duplicate webhook must not duplicate:

```text
payment
refund
order
stock operation
```

---

# 49. EXTERNAL API SECURITY

External services must be treated as untrusted boundaries.

Validate external responses before using them.

Protect:

```text
API credentials
webhook secrets
provider tokens
external URLs
```

Do not blindly trust an external response to contain valid business data.

---

# 50. SSRF PROTECTION

If the application fetches URLs supplied by users or external data:

Do not blindly request arbitrary URLs.

Protect against access to:

```text
localhost
127.0.0.1
private networks
cloud metadata endpoints
internal services
```

Use URL allowlists where appropriate.

---

# 51. OPEN REDIRECT PROTECTION

Do not redirect users to arbitrary URLs supplied by untrusted input.

Use:

```text
allowlisted domains
relative paths
validated redirect targets
```

---

# 52. COMMAND / CODE EXECUTION

Never pass untrusted user input directly into:

```text
shell commands
eval
dynamic code execution
system processes
```

Avoid dynamic execution entirely unless explicitly required and securely isolated.

---

# 53. DESERIALIZATION

Do not deserialize untrusted data into executable or unsafe object structures.

Validate structured data before processing.

Be especially careful with:

```text
webhooks
uploaded files
queue payloads
external API responses
```

---

# 54. REDIS SECURITY

Redis must not be treated as an open trusted environment.

Protect:

```text
Redis credentials
connection URLs
cache contents
queue data
locks
session data
```

Do not store sensitive data in Redis unnecessarily.

Do not expose Redis directly to the public internet.

---

# 55. BULLMQ / WORKER SECURITY

Queue payloads must be treated as untrusted input when they can originate from external requests.

Workers must re-check critical authorization/domain assumptions where necessary.

Do not assume:

```text
job.data
```

is trustworthy merely because it came from another application component.

Critical operations should remain idempotent.

---

# 56. BACKGROUND JOB AUTHORIZATION

Background jobs should operate with explicit service-level permissions.

Do not create jobs that contain unnecessary privileged credentials.

A queue worker must not automatically gain unlimited access simply because it is a backend process.

---

# 57. DATABASE SECURITY

Database credentials must be stored securely.

Application database users should have only the permissions required by the application.

Avoid using:

```text
root
```

or an unrestricted administrative database account for normal application runtime.

---

# 58. DATABASE DATA ACCESS

Database access must follow:

```text
Application
    ↓
Authorized Service
    ↓
Repository
    ↓
Database
```

Do not create hidden database access paths that bypass authorization.

---

# 59. DATABASE INJECTION

ORM usage does not automatically guarantee safety if raw SQL is used incorrectly.

When using TypeORM QueryBuilder or raw queries:

* parameterize values
* allowlist identifiers
* avoid string concatenation
* review dynamic SQL carefully

---

# 60. SECURITY MIGRATIONS

Security-sensitive schema changes require extra review.

Examples:

```text
permission changes
role changes
authentication tables
token storage
audit logs
password fields
security indexes
tenant boundaries
```

Never drop security constraints casually.

---

# 61. DEPENDENCY SECURITY

Dependencies must be monitored for known vulnerabilities.

Before adding a dependency:

Consider:

```text
maintenance status
security history
license
bundle/runtime impact
necessity
```

Do not add a dependency for functionality already provided by the project stack without justification.

---

# 62. PACKAGE / SUPPLY-CHAIN SECURITY

Do not install packages from unknown or suspicious sources.

Use trusted package registries.

Lock dependency versions according to project policy.

Review unexpected dependency changes.

---

# 63. ENVIRONMENT SEPARATION

Development, testing, staging, and production environments must remain separated.

Never use production credentials in:

```text
local development
automated tests
CI
```

unless explicitly designed and securely isolated.

---

# 64. PRODUCTION SAFETY

AI MUST treat production as a high-risk environment.

Before destructive or security-sensitive operations:

```text
verify environment
verify target
verify scope
verify backup/recovery
verify authorization
```

Never assume a command is safe because it was safe in development.

---

# 65. SECURITY TESTING

Security-sensitive behavior must have tests.

Minimum areas:

```text
Authentication
Authorization
RBAC
Tenant isolation
Object-level authorization
Input validation
Rate limiting
IDOR protection
Webhook verification
File access
Sensitive data exposure
```

Refer to:

```text
TESTING_RULES.md
```

for the testing strategy.

---

# 66. SECURITY REGRESSION TESTS

Every meaningful security bug should result in a regression test.

Process:

```text
Security bug
    ↓
Reproduce vulnerability
    ↓
Write failing security test
    ↓
Fix vulnerability
    ↓
Test passes
    ↓
Keep regression test
```

Do not remove security regression tests after the fix.

---

# 67. SECURITY REVIEW CHECKLIST

Before completing a security-sensitive feature:

```text
[ ] Authentication checked
[ ] Authorization checked
[ ] Permission checked
[ ] Data visibility checked
[ ] Tenant isolation checked
[ ] Input validation checked
[ ] Mass assignment checked
[ ] SQL injection checked
[ ] IDOR checked
[ ] Sensitive data exposure checked
[ ] Rate limiting considered
[ ] Audit logging considered
[ ] Error disclosure checked
[ ] Secrets checked
[ ] File security checked where applicable
[ ] Webhook security checked where applicable
[ ] Queue security checked where applicable
[ ] Tests added
[ ] Security regression test added where required
```

---

# 68. AI SECURITY RULES

AI MUST:

1. Treat all external input as untrusted.
2. Check authentication requirements.
3. Check authorization requirements.
4. Check object-level access.
5. Check tenant isolation.
6. Check branch/warehouse visibility.
7. Validate input.
8. Use parameterized database queries.
9. Protect secrets.
10. Avoid sensitive logging.
11. Follow secure error handling.
12. Consider rate limiting.
13. Consider audit logging.
14. Add security tests for security-sensitive behavior.
15. Review dependencies before introducing them.
16. Report security implications of architectural changes.

AI MUST NOT:

* bypass authentication
* bypass authorization
* trust client-provided roles
* trust client-provided tenant IDs
* expose secrets
* log passwords/tokens
* return sensitive database fields
* disable security middleware to make code work
* remove validation without justification
* remove rate limiting without approval
* weaken permissions to solve an authorization error
* disable TLS/HTTPS in production
* use production credentials in tests
* execute destructive production commands
* silently change security behavior

---

# 69. SECURITY CHANGE REPORT

For security-sensitive changes, AI should report:

### Security Impact

```text
[Describe affected security boundary]
```

### Authentication Impact

```text
[Describe]
```

### Authorization Impact

```text
[Describe]
```

### Data Visibility Impact

```text
[Describe]
```

### Tenant Isolation Impact

```text
[Describe]
```

### Sensitive Data Impact

```text
[Describe]
```

### Tests Added

```text
[Describe actual tests]
```

### Security Risks

```text
[Describe remaining risks]
```

### Manual Review Required

```text
[Yes/No + reason]
```

---

# 70. SECURITY INCIDENT PRINCIPLE

If AI detects a possible security vulnerability:

Do not hide it.

Do not silently work around it.

Do not weaken the security control.

Report:

```text
What is vulnerable?
Why is it vulnerable?
What data/action is affected?
How can it be exploited?
What is the safest remediation?
What tests should be added?
```

High-impact security issues require human review.

---

# 71. FINAL SECURITY PRINCIPLE

Security is not a feature added at the end.

Security is part of every feature.

Every request must answer:

```text
Who is asking?
What are they allowed to do?
Which records can they access?
Which organization/branch can they access?
What data can they see?
What happens if the request is malicious?
What happens if the request is repeated?
What happens if the request is manipulated?
```

The AI must protect:

```text
Confidentiality
Integrity
Availability
Authentication
Authorization
Tenant Isolation
Auditability
```

The AI implements security requirements.

The AI does not redefine security requirements.

When security and convenience conflict:

Security takes priority unless the human engineer explicitly approves the exception.
