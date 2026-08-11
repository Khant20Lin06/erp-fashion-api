# AUTHENTICATION.md

Authentication architecture implemented in Phase 05. Authorization (roles,
permissions, data scope) is explicitly out of scope — see Phase 06.

## Identity Model

A dedicated `User` entity (`src/modules/users/entities/user.entity.ts`)
represents system identity, deliberately separate from the future `Employee`/
`SalesAccount` concepts Phase 08 will introduce (`User → Employee → Sales
Account`).

Fields: `email` (unique, case-insensitive via normalization at the
application layer), `passwordHash`, `firstName`, `lastName`, `displayName`,
`status` (`ACTIVE` / `INACTIVE` / `SUSPENDED`), `isEmailVerified`,
`lastLoginAt`, `passwordChangedAt`, plus `BaseEntity`'s `id`/`createdAt`/
`updatedAt`/`deletedAt`.

## Password Security

Argon2id (`@node-rs/argon2`, `src/modules/auth/services/password.service.ts`)
— the algorithm Phase 05's spec prefers. No prior bcrypt standardization
existed to defer to. Never logged, never returned in any API response.
Minimum length policy: 8 characters (`PasswordService.validatePolicy`).

## JWT Strategy

Signed HS256 JWT via `@nestjs/jwt`. Claims are deliberately minimal: `sub`
(user id), `jti` (unique per token), `iat`, `exp`, plus `iss`/`aud` set by
`@nestjs/jwt` from configuration. **No roles or permissions are embedded** —
Phase 06 must resolve authorization server-side against live data, not
against token claims that could go stale while a token is still valid.

Configuration (`JWT_SECRET`, `JWT_ACCESS_TOKEN_EXPIRES_IN`, `JWT_ISSUER`,
`JWT_AUDIENCE`) lives in `src/config/auth.config.ts`, validated at startup
(`JWT_SECRET` must be at least 32 characters).

## Cookie Strategy

The access token is delivered as an httpOnly cookie
(`AUTH_COOKIE_NAME`, default `fashion_erp_access_token`), never as a
response body field or `Authorization` header. This matches the real
frontend's `apiClient` (`withCredentials: true`, no `Authorization` header
sent on login).

`AUTH_COOKIE_SECURE`, `AUTH_COOKIE_SAME_SITE`, `AUTH_COOKIE_DOMAIN`, and
`AUTH_COOKIE_PATH` are all environment-configured — never hard-coded.

**Operational note:** if the frontend and backend are ever deployed on
different top-level origins (true cross-site), `AUTH_COOKIE_SAME_SITE=none`
requires `AUTH_COOKIE_SECURE=true` (browsers reject `SameSite=None` without
`Secure`). Local development uses `AUTH_COOKIE_SECURE=false` because it runs
over plain HTTP.

## Refresh Token Decision

**No server-side refresh session was implemented.** The real frontend defines
an `/auth/refresh` endpoint path but never calls it anywhere in its code
(verified directly against the frontend repository) — building refresh-session
infrastructure now would be speculative complexity with no current consumer,
which `‌ai/Phase 05.md` explicitly permits deferring. The access token is
short-lived (`JWT_ACCESS_TOKEN_EXPIRES_IN=15m` by default) with no automatic
renewal; re-authentication via `/auth/login` is required after expiry. This
decision should be revisited if/when the frontend actually needs
long-lived sessions.

## Authentication Flow

```text
POST /api/v1/auth/login
  → normalize email
  → find user
  → verify password (Argon2)
  → check status == ACTIVE
  → sign JWT
  → Set-Cookie: fashion_erp_access_token (httpOnly)
  → return safe user profile (no passwordHash)

Authenticated request
  → JwtAuthGuard reads the cookie
  → verifies JWT (signature, expiry, issuer, audience)
  → attaches { id } to request.user
  → @CurrentUser() reads it in the controller

GET /api/v1/auth/me            → safe profile, requires auth
POST /api/v1/auth/logout       → clears cookie, requires auth
POST /api/v1/auth/change-password → requires auth, requires current password
POST /api/v1/auth/forgot-password → always generic response (no enumeration)
POST /api/v1/auth/reset-password  → single-use, hashed, expiring token
```

No `POST /auth/register` endpoint exists — user creation is explicitly
Phase 08's responsibility, not Phase 05's, per the approved analysis. Test
users are seeded directly (migration/manual insert), not through a public API.

## Security Measures

- **No account enumeration**: login and forgot-password always return the
  same generic response regardless of whether the email exists. Login
  additionally runs a dummy Argon2 verification when the user isn't found,
  so response timing doesn't leak existence either (verified: ~24-28ms for
  both the real and dummy path).
- **IDOR-safe**: `change-password` and `me` always operate on
  `request.user.id` from the validated JWT — never a client-supplied user
  id. Verified directly: a `userId` field in the request body is silently
  ignored (401 is returned first if unauthenticated; the field would be
  rejected by `forbidNonWhitelisted` if it were authenticated).
- **Auth bypass**: `forbidNonWhitelisted` on the global `ValidationPipe`
  (Phase 01) rejects any unexpected field (e.g. a smuggled `role` or
  `isAdmin`) before it reaches business logic. Verified directly.
- **Reset tokens**: generated with `crypto.randomBytes(32)`, stored only as
  a SHA-256 hash, checked for expiry and single-use inside a
  `TransactionService`-wrapped transaction (mark-used and password-update
  happen atomically).
- **No sensitive data exposure**: `passwordHash` never appears in any
  response (`SafeUserDto` / `toSafeUserDto()` is the only user shape ever
  returned). Verified directly against real HTTP responses.
- **401 vs 403**: authentication failures return 401, never 403 (403 is
  reserved for Phase 06 authorization failures).

## Environment Variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `JWT_SECRET` | **Yes** (min 32 chars) | — | JWT signing secret |
| `JWT_ACCESS_TOKEN_EXPIRES_IN` | No | `15m` | Access token lifetime |
| `JWT_ISSUER` | No | `fashion-erp-backend` | JWT `iss` claim |
| `JWT_AUDIENCE` | No | `fashion-erp-frontend` | JWT `aud` claim |
| `AUTH_COOKIE_NAME` | No | `fashion_erp_access_token` | Cookie name |
| `AUTH_COOKIE_SECURE` | No | `true` | `Secure` cookie flag |
| `AUTH_COOKIE_SAME_SITE` | No | `lax` | `SameSite` cookie attribute |
| `AUTH_COOKIE_DOMAIN` | No | unset | Cookie domain scope |
| `AUTH_COOKIE_PATH` | No | `/` | Cookie path scope |
| `PASSWORD_RESET_TOKEN_EXPIRES_IN_MINUTES` | No | `30` | Reset token TTL |

## API Endpoints

| Method | Route | Auth required | Purpose |
|---|---|---|---|
| POST | `/api/v1/auth/login` | No | Authenticate, set cookie |
| GET | `/api/v1/auth/me` | Yes | Current user profile |
| POST | `/api/v1/auth/logout` | Yes | Clear cookie |
| POST | `/api/v1/auth/change-password` | Yes | Change own password |
| POST | `/api/v1/auth/forgot-password` | No | Initiate reset (generic response) |
| POST | `/api/v1/auth/reset-password` | No | Complete reset via token |

## Phase 06 Integration Points

- `AuthenticatedUser` (`src/modules/auth/types/authenticated-user.ts`) —
  currently `{ id: string }` only. Phase 06 may extend request context (via
  `RequestContextService`, Phase 04) with roles/permissions/scope without
  modifying this type's meaning — it should stay "identity from a validated
  token," with authorization data resolved separately.
- `JwtAuthGuard` is a standalone, composable guard — Phase 06 can add a
  `PermissionGuard`/`RolesGuard` alongside it rather than replacing it.
- `@CurrentUser()` decorator is generic (reads `request.user`) and does not
  need to change shape when Phase 06 adds authorization concepts, as long as
  those concepts are resolved server-side rather than stuffed into
  `request.user` itself.

## Known Limitations (by design, not oversight)

- No refresh-token rotation (see "Refresh Token Decision" above).
- No rate limiting on `/auth/login`, `/auth/forgot-password`, or
  `/auth/reset-password` yet — `‌ai/Phase 05.md` explicitly defers this to
  Phase 23 while requiring the architecture allow it to be added cleanly
  later (no design decision here blocks adding a rate-limit guard/middleware
  in front of these routes).
- Password reset tokens are generated but not delivered anywhere (no email
  integration exists yet) — logged at debug level only, for local
  development/testing purposes, and explicitly documented as such in
  `AuthService.forgotPassword`.
- The frontend's `AuthUser` type (role/permissions/branchId) is not
  satisfied by this phase's response shape — this is a known, previously
  flagged gap for whoever wires up real frontend integration; see the
  Phase 05 analysis for the underlying tension between Phase 05's scope and
  the frontend's current type requirements.
