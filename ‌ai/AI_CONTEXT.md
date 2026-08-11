# AI_CONTEXT.md

# Fashion ERP Backend — Phase Tracking

This file tracks the current implementation phase of the Fashion ERP Backend.
It is the source of truth for "which phase are we on" across AI sessions.

Read this file, then `docs/AI_RULES.md`, before starting any new work.
The full phase specifications live in this same `‌ai/` folder (`PHASE 00.md`,
`Phase 01.md`, ... `Phase 31.md`).

---

## Current Phase

**Phase 06 — Dynamic RBAC + Data Visibility**

Status: **Completed**

---

## Phase History

### Phase 00 — AI Rules / Source of Truth

Not a code phase. Equivalent content lives in `docs/AI_RULES.md`.

### Phase 01 — Project Foundation

Status: Completed.

NestJS bootstrap, centralized config with Joi validation, global validation
pipe, global exception filter with a safe error shape, request correlation
ID, structured logging (pino, redacted), `/api/v1` prefix+versioning,
Swagger at `/api/docs`, liveness health check, CORS allowlist, security
headers, graceful shutdown, Jest unit+e2e foundation.

### Phase 02 — Docker / Infrastructure

Status: Completed.

- `docker-compose.yml`: `api` (NestJS, multi-stage `Dockerfile` with
  `development`/`builder`/`production` targets), `mysql` (8.0.40, utf8mb4),
  `redis` (7.4.1-alpine) — all on an internal `fashion-erp-network` bridge
  network, all with real healthchecks (`mysqladmin ping`, `redis-cli ping`,
  and the API's Phase 01 health endpoint via `depends_on: condition:
  service_healthy`).
- Named volumes (`mysql_data`, `redis_data`, `api_node_modules`) — data
  persists across `docker compose down` (not `down -v`, which is
  documented as destructive).
- Host ports configurable via `.env` (`API_HOST_PORT`, `DB_HOST_PORT`,
  `REDIS_HOST_PORT`) — required in practice, since this development
  machine already had other projects' containers bound to the default
  3306/6379/3000.
- Verified live: full stack up, health endpoint reachable through the
  mapped host port, MySQL/Redis both respond to real pings, data survives
  a MySQL container restart, API correctly stays "healthy" (liveness-only)
  when MySQL is stopped rather than falsely reporting DB health it doesn't
  check.
- README updated with Docker architecture, commands, and troubleshooting.

### Phase 03 — Database Architecture

Status: Completed.

- TypeORM + `mysql2`, `synchronize: false` always, migration-first.
- `src/database/`: `typeorm.options.ts` (shared factory used by both the
  app's `DatabaseModule` and the CLI `data-source.ts`), `base.entity.ts`
  (`id` UUID PK, `createdAt`/`updatedAt`/`deletedAt` only — no business
  fields), `migrations/`.
- Conventions: UUID (`CHAR(36)`) primary keys, snake_case DB columns,
  InnoDB, utf8mb4/utf8mb4_unicode_ci (verified against the live database).
- `docs/DATABASE_ARCHITECTURE.md` documents the decisions.
- No business entities were created in this phase per its own scope rule
  (§100/§101) — the first real entities (`User`, `PasswordResetToken`) were
  created in Phase 05, which owns them.

### Phase 04 — Core / Shared Infrastructure

Status: Completed.

- `src/core/context/`: `RequestContextService` (`AsyncLocalStorage`),
  `RequestContextMiddleware` (seeded from the Phase 01 `x-request-id`
  header, runs after `RequestIdMiddleware`). Concurrency-safety (no
  cross-request leakage) verified in `request-context.service.spec.ts`.
- `src/core/transaction/`: `TransactionService.run()` wraps
  `DataSource.transaction()`. Commit/rollback verified against real
  Dockerized MySQL in `transaction.service.integration.spec.ts` (skips
  automatically without DB env vars).
- `src/core/errors/`: `ErrorCode` enum (single source of truth — the Phase
  01 `GlobalExceptionFilter` now derives its `code` field from this enum
  instead of duplicated string literals) and `AppException`.
- `src/shared/decorators/current-user.decorator.ts`: `@CurrentUser()`,
  generic against `request.user` — populated for real by Phase 05's guard.
- `src/shared/dto/`: `PaginationDto` (page/limit capped at 100/sort/order)
  and `resolveSortField()` (explicit allowlist, prevents arbitrary
  client-supplied sort columns reaching a query).
- `docs/CORE_INFRASTRUCTURE.md` documents the layer.
- Explicitly NOT implemented: authentication, RBAC, response envelope,
  anything business-specific — per the phase's own scope boundary.

### Phase 05 — Authentication

Status: Completed.

- `User` entity (`src/modules/users/entities/user.entity.ts`) + migration
  `CreateUsersAndPasswordResetTokens` — applied, reverted, and re-applied
  against real Dockerized MySQL to verify both `up()` and `down()`; actual
  resulting schema inspected directly (single unique index on `email`, one
  index on `status`, correct FK with `ON DELETE CASCADE` on
  `password_reset_tokens.user_id`).
- `PasswordService` (Argon2id via `@node-rs/argon2` — the spec's preferred
  algorithm; no prior standardization existed to defer to instead).
- `TokenService` (JWT via `@nestjs/jwt`; minimal claims only — `sub`,
  `jti`, `iat`, `exp`, `iss`, `aud` — no roles/permissions embedded,
  verified by a dedicated test).
- `AuthService`: login (with a decoy Argon2 verification on unknown-email
  paths so response timing doesn't leak account existence — measured
  ~24-28ms on both paths), `getCurrentUser`, `changePassword`,
  `forgotPassword` (always generic response), `resetPassword` (hashed
  single-use token, atomic via `TransactionService`).
- `JwtAuthGuard` reads the httpOnly cookie (not `Authorization: Bearer` —
  matches the real frontend's verified contract), attaches only `{ id }`
  to `request.user`.
- `AuthController`: `POST /auth/login`, `GET /auth/me`,
  `POST /auth/logout`, `POST /auth/change-password`,
  `POST /auth/forgot-password`, `POST /auth/reset-password`. **No
  `POST /auth/register`** — user creation is Phase 08's responsibility per
  the approved Phase 05 analysis; confirmed with the requester before
  implementation.
- **Refresh-token decision**: short-lived JWT only, no server-side refresh
  session table. The frontend defines an `/auth/refresh` path but never
  calls it anywhere (verified against the frontend repo) — confirmed with
  the requester before implementation as the simpler, currently-sufficient
  choice. Revisit if the frontend starts requiring long-lived sessions.
- Tests: 61 unit tests + 27 e2e tests, all passing, including the new auth
  suite run directly against the live Docker MySQL (login variations,
  cookie attributes, `/me` auth/unauth, logout invalidation,
  change-password, forgot/reset-password including single-use and
  expiry, and a dedicated "never leaks passwordHash" check).
- Security review performed and verified live through the running Docker
  container (not just the test harness): unknown-field injection
  (`role`/`isAdmin` on login) rejected by `forbidNonWhitelisted`;
  `change-password`/`me` always act on the authenticated session's own
  user id, never a client-supplied id (IDOR-safe); enumeration-safe login
  and forgot-password confirmed with matching generic responses.
- `docs/AUTHENTICATION.md` documents the architecture, including the
  known SameSite=None+Secure operational requirement for true cross-origin
  deployments, and the still-open frontend `role`/`permissions` field gap
  (flagged, not silently resolved).
- Verified: zero role/permission/company/branch/warehouse references
  anywhere in `src/modules/auth` or `src/modules/users` (grepped) — no
  Phase 06+ scope crept into this phase.

Known/accepted risks carried forward:

- `@nestjs/swagger`'s transitive `js-yaml` advisory (same as Phase 01,
  unchanged — dev-time only, not in the runtime request path).
- No rate limiting yet on `/auth/login`, `/auth/forgot-password`,
  `/auth/reset-password` — explicitly deferred to Phase 23 per
  `‌ai/Phase 05.md`; the architecture does not block adding it later.
- Password reset tokens are generated but have no delivery mechanism (no
  email integration) — logged at debug level for local
  development/testing only, clearly documented as such.
- The frontend's `AuthUser` type requires `role`/`permissions`/`branchId`
  that this phase's response does not provide (those are Phase 06/07
  concepts) — an explicit, previously-flagged open decision, not resolved
  by this phase and not silently patched around.

### Phase 06 — Dynamic RBAC + Data Visibility

Status: Completed.

- **Entities** (`src/modules/rbac/entities/`): `Role`, `Permission`,
  `RolePermission`, `UserRole`, `RoleResourceScope` — five normalized
  relational tables, no JSON blobs, no hard-coded role/permission arrays.
  Migration `CreateRbacTables` applied, reverted, and re-applied against
  real Dockerized MySQL to verify both `up()` and `down()`; resulting
  schema (unique constraints, FKs, `ON DELETE CASCADE`/`RESTRICT`)
  inspected directly.
- **Permission model**: `resource.action` code (e.g. `roles.read`),
  matching the approved architecture. Only the RBAC-administration
  catalog is seeded (`users.*`, `roles.*`, `permissions.read`,
  `user_roles.*` — 12 permissions) — business-module permissions
  (`sales.*`, etc.) are explicitly not invented here, per scope.
  Idempotent seed: `npm run seed:rbac`
  (`src/database/seeds/rbac.seed.ts`), verified safe to re-run without
  creating duplicates.
- **Role model**: `name`, `code` (unique, immutable), `description`,
  `status` (`ACTIVE`/`INACTIVE`), `isSystemRole`. One system role seeded:
  `SUPER_ADMIN`. No fixed list of business roles — custom roles are
  created entirely through the API.
- **User-role model**: many-to-many via `UserRole`
  (`unique(user_id, role_id)`). Effective permissions = deduplicated
  union across all ACTIVE roles a user holds (`AuthorizationService`) —
  verified by test with two roles granting overlapping and
  non-overlapping permissions.
- **Data visibility model**: `RoleResourceScope`
  (`unique(role_id, resource)`) — scope is resource-specific per role, not
  a single field on User/Role. `DataScope` enum: `OWN, ACCOUNT, TEAM,
  BRANCH, WAREHOUSE, COMPANY, ORGANIZATION, ALL`. When a user's multiple
  roles grant different scopes for the same resource, `DataScopeService`
  returns the broadest (union/most-permissive), per the approved
  decision — verified by a dedicated test with three conflicting-scope
  roles. Query-level filtering is explicitly **not** implemented — only
  the resolution mechanism, since no business module exists yet to
  consume it.
- **Super Admin**: real system role holding explicit `RolePermission`
  grants — **no hard-coded bypass** anywhere (grepped and confirmed: the
  only `SUPER_ADMIN`/`super_admin` references in `src/` are the seed
  script, the `SystemRoleCode` enum, and `SuperAdminInvariantService`'s
  invariant check, never a permission-bypass conditional).
  System-role protection (delete/deactivate blocked, 403) enforced
  independently of the general permission system.
- **Super Admin invariant**: "at least one active Super Admin must always
  remain" enforced transactionally by `SuperAdminInvariantService`,
  invoked inside the same transaction as role deactivation and
  user-role-set replacement. Verified live: attempting to remove the
  last Super Admin's role assignment returns 409 and the assignment is
  confirmed still present afterward (rollback verified, not just
  assumed).
- **Guards/decorators**: `PermissionGuard` (composes after Phase 05's
  `JwtAuthGuard`, never replaces it) + `@RequirePermission()` /
  `@RequireAnyPermission()` decorators (metadata-only; the guard performs
  the actual check).
- **APIs**: `/roles` (CRUD + activate/deactivate + permissions/scopes
  replace), `/permissions` (catalog read), `/users/:userId/roles`
  (list/replace), `/auth/me/permissions` (own effective roles +
  permissions — resolves the Phase 05-flagged frontend `role`/
  `permissions` response-shape gap). Full list in
  `docs/RBAC_ARCHITECTURE.md`.
- **Tests**: 27 new unit/integration tests (`AuthorizationService`,
  `DataScopeService`, `PermissionGuard`, `SuperAdminInvariantService`
  against real MySQL) + 22 new e2e tests (`test/rbac.e2e-spec.ts` —
  CRUD, permission boundary 401-vs-403, privilege-escalation attempts,
  system-role protection, Super Admin invariant, soft-deleted-role
  revocation, malformed scope input). Total suite after Phase 06:
  **88 unit tests / 49 e2e tests, all passing**.
- **Test-isolation bug found and fixed**: `auth.e2e-spec.ts` (Phase 05)
  did an unscoped `DELETE FROM users` in its `beforeAll`/`afterAll`,
  which deleted `rbac.e2e-spec.ts`'s test users when both suites ran in
  the same `npm run test:e2e` invocation, causing 5 intermittent
  RBAC-suite failures. Fixed by scoping both queries to
  `auth.e2e-spec.ts`'s own test emails — verified stable across repeated
  full-suite runs afterward.
- **Typecheck gap found and fixed**: `nest build` succeeding is not
  sufficient evidence of a clean typecheck — it excludes `*.spec.ts` from
  compilation. `npx tsc --noEmit -p tsconfig.json` (which includes test
  files) is now the standard verification command; used throughout this
  phase's implementation.
- Security review performed and verified live through the running Docker
  container: unauthenticated → 401, authenticated-without-permission →
  403, privilege escalation (self-role-assignment, unauthorized role
  creation/modification) → 403, system-role deletion/deactivation → 403,
  Super Admin invariant violation → 409 with confirmed rollback,
  soft-deleted role → immediate revocation (no caching), inactive user
  with Super Admin role → cannot even authenticate (Phase 05 boundary).
- `docs/RBAC_ARCHITECTURE.md` documents the full architecture.
- Verified: zero `companyId`/`branchId`/`warehouseId`/`Employee`/
  `SalesAccount` references anywhere in `src/modules/rbac`,
  `src/modules/auth`, or `src/modules/users` (grepped) — no Phase 07/08
  scope crept into this phase. No new npm dependencies were added
  (Phase 06 reused Phase 03/05's TypeORM/validation/transaction
  infrastructure entirely).

Known/accepted risks and gaps carried forward:

- No caching layer for permission/scope resolution — every check
  re-queries the database. Deliberately deferred (spec explicitly warns
  against making Redis mandatory before Phase 19); can be added later
  with explicit invalidation hooks.
- No Bruno API collection exists for Phase 06 — no prior phase (01–05)
  established Bruno tooling in this repository, so one was not created
  now (would be new project infrastructure beyond this phase's "reuse
  existing infrastructure" mandate). Flagged as an open item, not
  silently skipped.
- Query-level data-visibility enforcement (turning a resolved scope into
  an actual `WHERE` clause) does not exist yet — correctly deferred,
  since no business module exists to need it. The first business-module
  phase (Phase 12+) must call `DataScopeService` before querying; this is
  a code-review discipline item for that phase, not something Phase 06
  can enforce at compile time.
- 404-vs-403 for hidden business records is explicitly deferred, per
  instruction, to the first business-module phase that needs it.
- `@nestjs/swagger`'s transitive `js-yaml` advisory (unchanged since
  Phase 01, dev-time only).

---

## Notes for Future Sessions

- The NestJS project root is `erp-pos fashion api/` itself (no separate
  `backend/` subfolder).
- `docs/API_CONTRACTS.md` still does not exist — should be created once
  more real business endpoints exist beyond `/auth/*`.
- The `‌ai/` folder name begins with an invisible zero-width non-joiner
  character (U+200C). Do not rename it; tools must reference it by copying
  the exact folder name rather than retyping "ai".
- Git repository was initialized as part of Phase 01 with an initial
  commit; Phases 02–06 have not yet been committed as of this writing —
  the working tree contains all Phase 02–06 changes uncommitted.
- Local Docker stack: `docker compose up -d` (from the api project root).
  `.env` uses non-default host ports (`DB_HOST_PORT=3307`,
  `REDIS_HOST_PORT=6380`) because this development machine already had
  other unrelated projects' containers bound to the defaults — this is a
  per-machine accommodation, not a project requirement; a clean machine
  can use the `.env.example` defaults.
- Running tests that hit the real database requires `DB_USERNAME`,
  `DB_PASSWORD`, `DB_DATABASE`, `DB_HOST`, `DB_PORT` to be set in the
  shell environment (or rely on `.env` being picked up by `ConfigModule`
  for e2e tests) — the transaction integration test and the auth e2e
  suite both skip automatically (not fail) when these aren't present, so
  CI without Docker won't break, but also won't get real coverage of
  those paths.
- All e2e test suites now scope their database cleanup queries to their
  own test data (e.g. `WHERE email LIKE '<suite-prefix>-%'`) rather than
  unscoped `DELETE FROM <table>` — this convention must be followed by
  any new e2e suite to avoid the cross-suite deletion bug found and fixed
  in Phase 06.
- The standard typecheck command is `npx tsc --noEmit -p tsconfig.json`,
  not just `npm run build` — `nest build` excludes `*.spec.ts` files from
  compilation and will not catch type errors in test files.
- Next phase: **Phase 07 — Organization / Company / Branch / Warehouse**.
  Phase 06's `RoleResourceScope.scopeValue` and the `COMPANY`/`BRANCH`/
  `WAREHOUSE`/`ORGANIZATION` scope enum values are ready for Phase 07 to
  connect to real entities. The frontend `role`/`permissions`
  response-shape gap (flagged since Phase 05) now has a real backend
  answer via `GET /auth/me/permissions`, though wiring the frontend to
  consume it was not done in Phase 06 (backend-only phase; frontend
  integration was not required by the approved architecture decisions).
