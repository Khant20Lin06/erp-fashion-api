# Fashion ERP Backend — Phase 05: Authentication

## ROLE

You are implementing **Phase 05 — Authentication** of the Fashion ERP backend.

The backend stack is:

* NestJS
* TypeScript
* MySQL
* TypeORM
* Redis
* BullMQ
* Docker

The existing frontend is the primary product source of truth.

This phase must implement the authentication foundation required by the existing Fashion ERP frontend and prepare the system for:

* Phase 06 — Dynamic RBAC + Data Visibility
* Phase 07 — Organization / Company / Branch / Warehouse
* Phase 08 — User / Employee / Sales Account Management

---

# 1. ABSOLUTE RULES

Before writing code:

1. Inspect the existing repository.
2. Inspect Phase 00–04 implementation.
3. Inspect the frontend audit findings supplied with this project.
4. Do not redesign already-established architecture without a concrete reason.
5. Do not implement Phase 06 RBAC logic yet.
6. Do not implement HR logic yet.
7. Do not implement Sales Account logic yet.
8. Do not implement business-domain authorization yet.
9. Do not create fake authentication behavior just to make tests pass.
10. Do not weaken security for development convenience.

Authentication and authorization are separate concerns.

This phase is ONLY responsible for:

```text
Identity
Authentication
Session lifecycle
Password security
JWT lifecycle
Cookie lifecycle
Current-user context
Authentication guards
Authentication-related security
```

Authorization belongs primarily to Phase 06.

---

# 2. SOURCE OF TRUTH

The frontend audit has established the following facts.

## FACT FROM FRONTEND

The frontend authentication client uses:

```text
httpOnly cookie
signed JWT
withCredentials: true
```

It does NOT use:

```text
Authorization: Bearer <token>
```

as its primary authentication contract.

The backend must therefore support cookie-based JWT authentication unless a concrete incompatibility is discovered in the existing backend architecture.

Do not silently switch the authentication contract to bearer tokens.

---

# 3. FRONTEND AUTHENTICATION FINDINGS

Inspect and verify the actual frontend before implementation.

The frontend contains concepts related to:

```text
Login
Logout
Session / Current User
Protected routes
Profile
Password
Forgot Password link
```

However:

* forgot-password page is missing/dead according to the audit
* frontend authentication is currently mock-mode by default
* frontend permission checks are UI-level only
* real server-side authentication does not currently exist

The backend must implement real authentication.

---

# 4. PHASE 05 OBJECTIVES

Implement:

```text
1. User identity
2. Password hashing
3. Login
4. Logout
5. JWT access authentication
6. Secure cookie handling
7. Current authenticated user
8. Authentication guard
9. Session/token lifecycle
10. Password change
11. Password reset foundation
12. Authentication error handling
13. Authentication audit hooks
14. Authentication tests
```

Do not implement:

```text
Role management
Permission management
Data scope
Sales Account
Employee business logic
Company access policy
Branch access policy
Warehouse access policy
```

Those belong to later phases.

---

# 5. USER IDENTITY MODEL

Use a dedicated `User` entity.

The user represents the system identity.

Do NOT make Employee and User the same domain concept.

The planned architecture is:

```text
User
  ↓
Employee
  ↓
Sales Account
```

Phase 05 only implements:

```text
User
```

Phase 08 will extend the relationship to:

```text
User → Employee → Sales Account
```

---

# 6. USER ENTITY

Inspect Phase 03 database architecture before creating the entity.

The User entity should support at minimum:

```text
id
email
passwordHash
firstName
lastName
displayName
status
isEmailVerified
lastLoginAt
passwordChangedAt
createdAt
updatedAt
deletedAt
```

Do not blindly copy this list if Phase 03 already established different naming conventions.

Follow the existing project's conventions.

---

# 7. USER ID

Follow the ID strategy established in Phase 03.

If Phase 03 specifies UUID:

```text
User.id = UUID
```

Do not introduce integer IDs if UUID is already the project standard.

---

# 8. EMAIL

Email must be treated as a login identifier.

Requirements:

```text
case-insensitive comparison
normalized storage
unique constraint
validated format
```

Normalize email before authentication.

For example:

```text
User@Example.com
```

should authenticate consistently with:

```text
user@example.com
```

Do not store multiple logically identical accounts because of email casing.

---

# 9. PASSWORD SECURITY

Never store plaintext passwords.

Use a strong password hashing algorithm.

Preferred:

```text
Argon2id
```

If the existing Phase 00–04 architecture already standardized bcrypt, follow the established project decision instead.

Do not invent a second hashing strategy.

Password requirements must be centralized.

Do not duplicate password rules across controllers.

---

# 10. PASSWORD HASHING SERVICE

Create a dedicated password security abstraction.

Example responsibility:

```text
PasswordService
```

Responsibilities:

```text
hash(password)
verify(password, hash)
validatePasswordPolicy(password)
```

Do not expose:

```text
passwordHash
```

through API responses.

---

# 11. ACCOUNT STATUS

The User entity must support authentication lifecycle states.

At minimum consider:

```text
ACTIVE
INACTIVE
SUSPENDED
```

If the project's established enum naming convention differs, follow it.

Authentication behavior:

```text
ACTIVE
→ login allowed

INACTIVE
→ login denied

SUSPENDED
→ login denied
```

Do not delete users merely to disable authentication.

---

# 12. LOGIN FLOW

Implement:

```text
POST /auth/login
```

Recommended request:

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

The exact DTO naming must follow project conventions.

Flow:

```text
Request
 ↓
Validate DTO
 ↓
Normalize email
 ↓
Find user
 ↓
Check account status
 ↓
Verify password
 ↓
Create authentication token/session
 ↓
Set secure cookie
 ↓
Update lastLoginAt
 ↓
Return safe user representation
```

Never return:

```text
passwordHash
```

---

# 13. LOGIN RESPONSE

The response should contain a safe authenticated-user representation.

Example concept:

```json
{
  "user": {
    "id": "...",
    "email": "user@example.com",
    "firstName": "...",
    "lastName": "...",
    "displayName": "...",
    "status": "ACTIVE"
  }
}
```

Do not expose:

```text
passwordHash
internal secrets
JWT secret
refresh token
security metadata
```

unless explicitly required by the established architecture.

---

# 14. JWT STRATEGY

Use signed JWT.

JWT must NOT contain sensitive information.

Do not place:

```text
password
passwordHash
full permission matrix
private data
```

inside JWT.

Keep claims minimal.

Recommended claims:

```text
sub
iat
exp
jti
```

Potentially:

```text
iss
aud
```

if the project's security architecture requires them.

Do not put dynamic RBAC permissions into the token.

Reason:

Phase 06 will introduce dynamic roles and permissions.

Permissions can change while a token is still valid.

Authorization should therefore resolve permissions server-side rather than relying permanently on stale JWT claims.

---

# 15. COOKIE STRATEGY

The frontend already expects:

```text
httpOnly cookie
withCredentials: true
```

Therefore configure authentication cookie securely.

Production requirements:

```text
httpOnly = true
secure = true
sameSite = appropriate production value
```

Development values may differ through configuration.

Never hard-code environment-specific cookie behavior.

---

# 16. COOKIE CONFIGURATION

Use environment configuration.

Example concepts:

```text
AUTH_COOKIE_NAME
AUTH_COOKIE_DOMAIN
AUTH_COOKIE_SECURE
AUTH_COOKIE_SAME_SITE
AUTH_COOKIE_PATH
JWT_ACCESS_TOKEN_EXPIRES_IN
JWT_ISSUER
JWT_AUDIENCE
```

Use the project's existing configuration module.

Do not scatter `process.env.*` throughout services.

---

# 17. CORS

Because the frontend and backend may be hosted on different origins, configure CORS correctly.

The backend must support credentials.

Conceptually:

```text
credentials: true
```

Do NOT use:

```text
Access-Control-Allow-Origin: *
```

together with credentialed requests.

Allowed origins must come from configuration.

---

# 18. AUTHENTICATION GUARD

Create a reusable authentication guard.

Concept:

```text
JwtAuthGuard
```

Responsibilities:

```text
Read authentication cookie
 ↓
Verify JWT
 ↓
Resolve user identity
 ↓
Attach authenticated user to request
 ↓
Allow request
```

Unauthenticated request:

```text
401 Unauthorized
```

Do not return `403` for missing authentication.

`403 Forbidden` belongs to authorization failures in Phase 06.

---

# 19. CURRENT USER CONTEXT

Create a reusable mechanism to access the authenticated user.

Example:

```typescript
@CurrentUser()
user: AuthenticatedUser
```

or the project's preferred equivalent.

Avoid repeating:

```typescript
req.user
```

throughout every controller if a clean decorator/context abstraction is already used by the architecture.

---

# 20. AUTHENTICATED USER TYPE

Create a safe internal representation such as:

```text
AuthenticatedUser
```

It should contain only identity information required by the request pipeline.

Example:

```text
id
email
status
```

Do not expose the entire database User entity through request context.

---

# 21. CURRENT USER API

Implement:

```text
GET /auth/me
```

Purpose:

```text
frontend loads current authenticated session
```

Response:

```text
safe user profile
```

This endpoint must require authentication.

Unauthenticated:

```text
401
```

---

# 22. LOGOUT

Implement:

```text
POST /auth/logout
```

Logout must invalidate the authentication mechanism correctly.

At minimum:

```text
clear authentication cookie
```

If the chosen architecture includes server-side refresh-session state, revoke that session as well.

Do not merely return:

```json
{
  "success": true
}
```

while leaving a usable long-lived authentication token active.

---

# 23. ACCESS TOKEN LIFETIME

Do not use excessively long-lived access tokens.

Use environment configuration.

Example:

```text
JWT_ACCESS_TOKEN_EXPIRES_IN=15m
```

The exact production value should be configurable.

Do not hard-code the expiration.

---

# 24. REFRESH TOKEN / SESSION STRATEGY

Before implementation inspect the existing Phase 00–04 architecture.

Choose ONE coherent strategy.

Preferred architecture for this project:

```text
Short-lived JWT access token
+
server-side refresh session
```

If implemented:

```text
Refresh Session
├── id
├── userId
├── tokenHash
├── expiresAt
├── revokedAt
├── createdAt
├── lastUsedAt
├── ipAddress
└── userAgent
```

Do not store raw refresh tokens in the database.

Store a secure hash.

Redis may be used later for session acceleration, but do not create unnecessary Redis coupling if Phase 19 is not yet implemented.

If Phase 05 does not require refresh-token rotation based on the existing architecture, document the decision instead of inventing complexity.

---

# 25. PASSWORD CHANGE

Implement:

```text
POST /auth/change-password
```

Authentication required.

Request concept:

```json
{
  "currentPassword": "...",
  "newPassword": "..."
}
```

Flow:

```text
authenticate user
 ↓
verify current password
 ↓
validate new password
 ↓
hash new password
 ↓
update passwordHash
 ↓
update passwordChangedAt
 ↓
invalidate existing sessions if required
```

Do not allow changing another user's password through this endpoint.

Administrative password reset belongs to later Administration functionality.

---

# 26. FORGOT PASSWORD

The frontend audit identified a forgot-password link but no actual page.

Backend should still provide the authentication foundation.

Implement:

```text
POST /auth/forgot-password
POST /auth/reset-password
```

Security requirement:

Forgot-password response must not reveal whether an email exists.

Bad:

```text
Email does not exist
```

Preferred behavior:

```text
If the account exists, a reset flow is initiated.
The response remains generic.
```

---

# 27. PASSWORD RESET TOKEN

Do not store raw reset tokens.

Recommended:

```text
password_reset_tokens
```

Concept:

```text
id
userId
tokenHash
expiresAt
usedAt
createdAt
```

The raw token is sent through the reset mechanism.

Database stores only the hash.

Token must:

```text
expire
be single-use
be invalidated after successful reset
```

---

# 28. RESET PASSWORD

Implement:

```text
POST /auth/reset-password
```

Conceptual request:

```json
{
  "token": "...",
  "newPassword": "..."
}
```

Flow:

```text
validate token
 ↓
check expiration
 ↓
check usedAt
 ↓
find user
 ↓
hash new password
 ↓
update password
 ↓
mark reset token used
 ↓
invalidate sessions
```

---

# 29. LOGIN FAILURE HANDLING

Do not reveal whether the email exists.

Bad:

```text
User not found
```

or:

```text
Wrong password
```

Preferred:

```text
Invalid email or password
```

Use consistent authentication error behavior.

---

# 30. BRUTE-FORCE PROTECTION

Authentication endpoints are high-risk.

At minimum design protection for:

```text
POST /auth/login
POST /auth/forgot-password
POST /auth/reset-password
```

Possible implementation:

```text
rate limiting
IP throttling
account-based throttling
progressive delay
```

Do not over-engineer before Phase 23.

However, the architecture must allow rate limiting to be added cleanly.

---

# 31. TIMING / ENUMERATION SAFETY

Password verification must use the password hashing library's secure verification function.

Do not compare password hashes using ordinary string equality.

Do not introduce email enumeration through:

```text
login
forgot-password
reset-password
```

---

# 32. AUTHENTICATION AUDIT EVENTS

Prepare authentication services so that later Audit Log infrastructure can record events such as:

```text
LOGIN_SUCCESS
LOGIN_FAILED
LOGOUT
PASSWORD_CHANGED
PASSWORD_RESET_REQUESTED
PASSWORD_RESET_COMPLETED
ACCOUNT_SUSPENDED
```

Do not build the full Audit Log module in this phase if it belongs to a later phase.

Instead create a clean event/hook boundary.

---

# 33. AUTHENTICATION EVENT DESIGN

If the project already has a domain-event pattern from Phase 04, use it.

Example conceptual events:

```text
UserLoggedIn
UserLoginFailed
UserLoggedOut
PasswordChanged
PasswordResetRequested
PasswordResetCompleted
```

Do not introduce a second event architecture.

---

# 34. DATABASE CONSTRAINTS

Authentication-related database constraints must be enforced at database level where appropriate.

Examples:

```text
users.email UNIQUE
required fields NOT NULL
foreign keys
indexes
```

Do not rely only on DTO validation.

---

# 35. INDEXES

At minimum consider indexes for:

```text
users.email
users.status
refresh_sessions.userId
refresh_sessions.expiresAt
password_reset_tokens.userId
password_reset_tokens.expiresAt
```

Follow the actual Phase 03 indexing conventions.

Do not blindly create redundant indexes.

---

# 36. SOFT DELETE

If Phase 03 established soft delete:

```text
deletedAt
```

must be respected.

Deleted users must not authenticate.

Do not physically delete authentication identities through normal application CRUD.

---

# 37. AUTH MODULE STRUCTURE

Follow the existing project architecture.

If the project uses domain-oriented NestJS modules, structure conceptually like:

```text
src/modules/auth/
├── auth.module.ts
├── controllers/
│   └── auth.controller.ts
├── services/
│   ├── auth.service.ts
│   ├── password.service.ts
│   └── token.service.ts
├── guards/
│   └── jwt-auth.guard.ts
├── decorators/
│   └── current-user.decorator.ts
├── strategies/
│   └── jwt.strategy.ts
├── dto/
│   ├── login.dto.ts
│   ├── change-password.dto.ts
│   ├── forgot-password.dto.ts
│   └── reset-password.dto.ts
└── types/
    └── authenticated-user.ts
```

Adjust to the actual Phase 04 architecture.

Do NOT duplicate shared infrastructure.

---

# 38. USER MODULE

Authentication should not become a dumping ground for user management.

Keep responsibilities clear.

```text
Auth
→ authenticate identity

Users
→ user lifecycle / profile / administration

RBAC
→ permissions

Organization
→ company / branch / warehouse access

HR
→ employee lifecycle
```

Phase 05 may create the minimum User persistence required for authentication.

Full User Administration belongs to Phase 08/31.

---

# 39. AUTH CONTROLLER

Keep controllers thin.

Controller responsibility:

```text
HTTP
 ↓
DTO
 ↓
Service
 ↓
Response
```

Do not put:

```text
password hashing
database queries
authorization rules
JWT construction
business logic
```

directly inside controllers.

---

# 40. DTO VALIDATION

All authentication input must be validated.

At minimum:

```text
email
password
currentPassword
newPassword
resetToken
```

Use the project's established validation library and global validation pipeline.

Do not duplicate validation manually inside every controller.

---

# 41. RESPONSE SECURITY

Verify that these are NEVER returned accidentally:

```text
passwordHash
refresh token
reset token
JWT secret
database credentials
internal authentication metadata
```

Check serialization behavior.

---

# 42. ERROR CONTRACT

Follow the error architecture established in Phase 04.

Authentication errors should be consistent.

Expected concepts:

```text
400
invalid request

401
not authenticated / invalid credentials

403
authenticated but forbidden
→ primarily Phase 06

409
conflict, e.g. duplicate email

429
rate limit
```

Do not use `403` for invalid login credentials.

---

# 43. TRANSACTIONAL REQUIREMENTS

For password-changing operations, ensure related database updates are atomic.

Example:

```text
Password reset
 ↓
update password
 ↓
mark reset token used
 ↓
revoke sessions
```

If these operations are required to happen together, use a transaction.

Follow the transaction abstraction established in Phase 04.

---

# 44. SESSION INVALIDATION

Design session invalidation for:

```text
password change
password reset
account suspension
logout
```

If refresh sessions are implemented, revocation must be server-side.

---

# 45. AUTHENTICATION TESTING

Write automated tests.

At minimum test:

## Login

```text
valid credentials
invalid email
invalid password
inactive user
suspended user
deleted user
normalized email
```

## Cookie

```text
cookie is set
cookie has httpOnly
cookie security attributes are correct
```

## Current User

```text
authenticated → 200
unauthenticated → 401
```

## Logout

```text
cookie cleared
session revoked if applicable
```

## Password Change

```text
correct current password
wrong current password
weak new password
successful change
```

## Password Reset

```text
unknown email
valid reset token
expired token
used token
successful reset
```

## Security

```text
passwordHash never returned
reset token never stored raw
authentication errors do not enumerate users
```

---

# 46. TEST DATABASE

Tests must use an isolated database strategy established by Phase 04.

Do not run tests against production.

Do not require a developer's personal MySQL database.

If Docker test infrastructure already exists, use it.

---

# 47. API CONTRACT

Implement and document at minimum:

```text
POST /auth/login
POST /auth/logout
GET  /auth/me
POST /auth/change-password
POST /auth/forgot-password
POST /auth/reset-password
```

If refresh sessions are part of the selected architecture:

```text
POST /auth/refresh
```

Document the final decision.

---

# 48. AUTHENTICATION FLOW

Document the final implementation flow.

Example:

```text
Frontend
   │
   │ POST /auth/login
   ▼
NestJS AuthController
   │
   ▼
AuthService
   │
   ├── normalize email
   ├── find user
   ├── verify password
   ├── check status
   └── create JWT/session
   │
   ▼
Secure httpOnly Cookie
   │
   ▼
Frontend
```

Authenticated request:

```text
Frontend
   │
   │ Cookie
   ▼
JwtAuthGuard
   │
   ▼
JWT verification
   │
   ▼
AuthenticatedUser
   │
   ▼
Controller
```

---

# 49. PHASE 06 COMPATIBILITY

This is critical.

Phase 05 must expose enough identity context for Phase 06 to later implement:

```text
User
 ↓
User Roles
 ↓
Permissions
 ↓
Data Scope
 ↓
Organization Scope
 ↓
Sales Account
```

Do NOT put dynamic permissions into the JWT.

Do NOT hard-code roles into authentication.

Do NOT implement:

```text
if user.role === "admin"
```

inside AuthService.

Phase 06 will implement authorization.

---

# 50. FUTURE ORGANIZATION COMPATIBILITY

Phase 07 will introduce:

```text
Company
Branch
Warehouse
```

Do not hard-code company/branch access rules into Phase 05.

Authentication should establish:

```text
who is this user?
```

Phase 07/06 will determine:

```text
where can this user operate?
```

---

# 51. FUTURE SALES ACCOUNT COMPATIBILITY

Phase 08 will introduce:

```text
Employee
SalesAccount
SalesAccountAssignment
```

Do not add `salesAccountId` to JWT now unless Phase 03 explicitly requires it.

The backend should resolve current user identity first.

Later authorization/data-scope layers can resolve:

```text
User
 ↓
Employee
 ↓
Sales Account
```

---

# 52. NO FRONTEND REWRITE

Do not modify the frontend.

The backend must adapt to the existing authentication contract:

```text
httpOnly cookie
signed JWT
credentials
```

If a genuine incompatibility is discovered, stop and document it before changing the contract.

---

# 53. ENVIRONMENT VARIABLES

Add only necessary authentication configuration.

Document variables such as:

```text
JWT_SECRET
JWT_ACCESS_TOKEN_EXPIRES_IN
JWT_ISSUER
JWT_AUDIENCE

AUTH_COOKIE_NAME
AUTH_COOKIE_SECURE
AUTH_COOKIE_HTTP_ONLY
AUTH_COOKIE_SAME_SITE
AUTH_COOKIE_DOMAIN
AUTH_COOKIE_PATH

PASSWORD_RESET_TOKEN_EXPIRES_IN
```

Use secure defaults where possible.

Never commit secrets.

Update:

```text
.env.example
```

but never put real secrets into it.

---

# 54. DOCKER COMPATIBILITY

Authentication must work inside the existing Docker development environment.

Do not create a second MySQL/Redis configuration.

Use the infrastructure from Phase 02.

If Redis is not yet part of Phase 05 runtime, do not make authentication unnecessarily dependent on Redis.

---

# 55. DOCUMENTATION

After implementation, update/create the appropriate documentation according to the project's documentation structure.

Document:

```text
Authentication architecture
Login flow
Cookie strategy
JWT strategy
Password hashing
Session strategy
Environment variables
API endpoints
Error behavior
Security decisions
Phase 06 integration points
```

---

# 56. IMPLEMENTATION ORDER

Follow this order:

```text
1. Inspect Phase 00–04
2. Inspect existing User-related code
3. Inspect existing configuration
4. Inspect existing database conventions
5. Inspect frontend auth contract
6. Finalize authentication architecture
7. Create/update User entity
8. Create password service
9. Create JWT/token service
10. Create auth service
11. Implement login
12. Implement auth guard
13. Implement /auth/me
14. Implement logout
15. Implement password change
16. Implement password reset
17. Add session strategy if selected
18. Add auth events/hooks
19. Add tests
20. Update documentation
21. Run lint
22. Run typecheck
23. Run unit tests
24. Run integration/e2e tests
25. Review security
```

Do not skip directly to controller implementation.

---

# 57. ACCEPTANCE CRITERIA

Phase 05 is complete only when:

```text
[ ] User identity exists
[ ] Email normalization works
[ ] Email uniqueness enforced
[ ] Password hashing implemented
[ ] Password never stored plaintext
[ ] Login works
[ ] Invalid credentials return 401
[ ] Inactive users cannot login
[ ] Suspended users cannot login
[ ] JWT is signed
[ ] JWT contains minimal claims
[ ] JWT does not contain permissions
[ ] Authentication cookie is httpOnly
[ ] Secure cookie configuration exists
[ ] CORS credentials configured correctly
[ ] Auth guard works
[ ] /auth/me works
[ ] Logout works
[ ] Password change works
[ ] Password reset foundation works
[ ] Reset tokens are hashed
[ ] Reset tokens expire
[ ] Reset tokens are single-use
[ ] Authentication errors do not enumerate accounts
[ ] Password hashes never appear in responses
[ ] Authentication tests pass
[ ] Documentation updated
[ ] Docker environment works
[ ] Lint passes
[ ] Typecheck passes
[ ] Tests pass
```

---

# 58. FINAL VERIFICATION

Before declaring Phase 05 complete, verify:

```text
Frontend
    ↓
POST /auth/login
    ↓
httpOnly JWT cookie
    ↓
GET /auth/me
    ↓
Authenticated user returned
```

Then verify:

```text
No cookie
    ↓
GET /auth/me
    ↓
401
```

Then verify:

```text
Authenticated user
    ↓
Protected endpoint
    ↓
JwtAuthGuard
    ↓
AuthenticatedUser
```

Finally verify that Phase 06 can later consume:

```text
AuthenticatedUser.id
AuthenticatedUser.email
AuthenticatedUser.status
```

without requiring a redesign of Phase 05.

---

# 59. IMPORTANT FINAL RULE

Do not claim Phase 05 is complete merely because the application starts.

The authentication system must be:

```text
Secure
Tested
Documented
Docker-compatible
Frontend-compatible
Phase-06-compatible
```

Do not implement unrelated ERP functionality.

Do not start Sales, Inventory, Accounting, HR, Administration, or Dynamic RBAC in this phase.

Finish Authentication cleanly before moving to Phase 06.
