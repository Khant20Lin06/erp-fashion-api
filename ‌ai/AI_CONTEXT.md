# AI_CONTEXT.md

# Fashion ERP Backend — Phase Tracking

This file tracks the current implementation phase of the Fashion ERP Backend.
It is the source of truth for "which phase are we on" across AI sessions.

Read this file, then `docs/AI_RULES.md`, before starting any new work.
The full phase specifications live in this same `‌ai/` folder (`PHASE 00.md`,
`Phase 01.md`, ... `Phase 31.md`).

---

## Current Phase

Authoritative update as of Friday, August 14, 2026: the repository has
already reached **Phase 22 - Reports / Dashboard**, and that phase is
completed. The older phase label and the history appendix below have not yet
been fully expanded through Phases 18-22.

**Phase 17 — Accounting / General Ledger**

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

### Phase 07 — Organization / Company / Branch / Warehouse

Status: Completed.

- **Entities** (`src/modules/organization/entities/`): `Company`, `Branch`,
  `Warehouse` — three normalized relational tables, root hierarchy
  `Company ──< Branch ──< Warehouse`. **No standalone `Organization`
  entity was created** — the spec's own diagrams and explicit statements
  (§64, §119) place Company as the root; "Organization" remained a
  conceptual label only, never a fourth table. Migration
  `CreateOrganizationTables` applied, reverted, and re-applied against
  real Dockerized MySQL to verify both `up()` and `down()`; resulting
  schema (FKs, `ON DELETE RESTRICT`, unique/composite indexes) inspected
  directly via `SHOW CREATE TABLE`.
- **Company**: root entity — `code` (globally unique, immutable), `name`,
  `status` (`ACTIVE`/`INACTIVE`), `baseCurrency` (3-letter ISO),
  `timezone` (IANA), `country`, `phone`, `email`, `address`. `legalName`
  and fiscal/tax fields were deliberately **not** implemented — optional
  per spec, no concrete requirement, kept minimal per instruction.
- **Branch**: belongs to exactly one Company (`companyId`, immutable after
  creation). `code` unique **per company** (`UNIQUE(company_id, code)`,
  not globally) — verified by a dedicated e2e test creating the same code
  under two different companies successfully.
- **Warehouse**: belongs to exactly one Branch (`branchId`, immutable) and
  denormalized to exactly one Company (`companyId`, immutable). `code`
  unique per company. `type` extensible enum (`MAIN, STORE, DISTRIBUTION,
  TRANSIT, RETURN, VIRTUAL, OTHER`), default `MAIN`.
- **Critical integrity rule enforced**: `warehouse.companyId` must equal
  its parent branch's `companyId` — checked in `WarehousesService.create()`
  before insert, never relied on as DB-only (a composite FK cannot express
  "these two FK targets must agree"). Covered by a dedicated e2e test
  reproducing the exact Company A + Company B's Branch cross-company
  scenario from the spec.
- **Hierarchy validation on create**: Branch requires an existing, active
  parent Company; Warehouse requires an existing, active parent Branch
  whose `companyId` matches the submitted `companyId`. Client-submitted
  `companyId`/`branchId` are used only as lookup keys, never trusted.
- **Lifecycle**: `ACTIVE`/`INACTIVE` on all three. Deactivating a parent
  does not cascade to children (blocks *new* child creation only, per
  spec §70–72). Deletion is soft-delete only and explicitly blocked with
  409 while active children exist (Company blocked by existing Branches,
  Branch blocked by existing Warehouses) — the FK `ON DELETE RESTRICT` on
  every parent-child relationship is the hard backstop behind these
  explicit service-level checks.
- **RBAC integration (reused, not duplicated)**: 12 new `resource.action`
  permissions registered into the existing Phase 06 catalog
  (`companies.read/create/update/delete`, `branches.*`, `warehouses.*`),
  seeded idempotently via the same `rbac.seed.ts` (verified: re-running
  produces zero output, no duplicates). All endpoints protected by the
  existing `JwtAuthGuard` + `PermissionGuard` + `@RequirePermission()` —
  zero new authorization concepts, zero new scope enum values, zero
  hard-coded role checks (grepped and confirmed). `RbacModule` now also
  exports `PermissionGuard` (previously provider-only) so the separate
  `OrganizationModule` can inject it via DI.
- **Data Scope integration — deliberately partial**: Phase 06's
  `DataScope` enum already had `COMPANY`/`BRANCH`/`WAREHOUSE`/
  `ORGANIZATION` values and `RoleResourceScope.scopeValue`. Phase 07 gives
  those values real entities to eventually resolve against, but does
  **not** extend `DataScopeService` with a scope→allowed-IDs resolution
  method — that resolution's only meaningful input is organization
  *membership* (`UserCompany`/`UserBranch`/`UserWarehouse`), which is
  explicitly Phase 08's responsibility. Building it now would mean
  resolving against either nothing (meaningless) or an invented temporary
  membership model (explicitly disallowed by this phase's instructions).
  Documented as the primary Phase 08 integration point in
  `docs/ORGANIZATION_ARCHITECTURE.md`.
- **APIs**: `/companies`, `/branches` (filterable by `companyId`),
  `/warehouses` (filterable by `companyId`/`branchId`/`status`) — each
  with GET (list+detail), POST, PATCH, activate/deactivate,
  DELETE (soft, blocked while children exist). Full list in
  `docs/ORGANIZATION_ARCHITECTURE.md`.
- **Tests**: 26 new unit tests (`CompaniesService`, `BranchesService`,
  `WarehousesService` — including the exact Company A/Branch-of-Company-B
  cross-company rejection scenario) + 25 new e2e tests
  (`test/organization.e2e-spec.ts` — auth boundary, permission boundary,
  full CRUD, hierarchy validation, the critical cross-company integrity
  rule, uniqueness scoping in both directions, orphan-prevention on
  delete, unknown-field rejection). Total suite after Phase 07: **107
  unit tests / 74 e2e tests, all passing** (run via `npm test` and
  `npm run test:e2e` respectively).
- **Test infrastructure fix required**: adding a second e2e suite that
  depends on the live Super Admin role's permission grants
  (`organization.e2e-spec.ts`, alongside the pre-existing
  `rbac.e2e-spec.ts`) surfaced a cross-suite race under Jest's default
  parallel workers — both suites mutate/query the same global
  `role_permissions` rows concurrently against the one shared live
  database, causing intermittent 403s. Fixed by adding `--runInBand` to
  the `test:e2e` npm script (`package.json`) — verified stable across
  repeated full-suite runs afterward (`npm run test:e2e` → 5 suites / 74
  tests passing). This was not a bug in either suite individually; both
  pass standalone. Pre-existing suites (`app`, `auth`, `validation`) were
  unaffected in isolation — confirmed by running them without the new
  suite present before applying the fix.
- Security review performed and verified live through the running Docker
  container: unauthenticated → 401, authenticated-without-permission →
  403, cross-company Branch-under-wrong-Company/Warehouse-under-wrong-
  Branch → 400 (rejected before insert), duplicate code within the same
  parent → 409, same code across different parents → 201/201 (allowed,
  per scoped-uniqueness design), deletion blocked while active children
  exist → 409, unknown/extra fields → 400 (existing global
  `ValidationPipe`).
- `docs/ORGANIZATION_ARCHITECTURE.md` documents the full architecture,
  including the explicit "what Phase 07 does and does not do" boundary
  around Data Scope resolution.
- Verified: zero `Employee`/`SalesAccount`/`UserCompany`/`UserBranch`/
  `UserWarehouse`/`Sales`/`Inventory`/`Accounting` references anywhere in
  `src/modules/organization` (grepped) — no Phase 08+ scope crept into
  this phase. No new npm dependencies were added (Phase 07 reused Phase
  03/04/06's TypeORM/validation/transaction/RBAC infrastructure
  entirely). Zero frontend files were touched.

Known/accepted gaps carried forward:

- No `DataScopeService` scope→ID resolution yet — see "Data Scope
  integration" above. Primary Phase 08 integration point.
- No `Company.defaultBranchId` / `Branch.defaultWarehouseId` — spec frames
  both as conditional ("if required"); no concrete requirement surfaced.
  Can be added later without disrupting the current schema.
- No membership tables (`UserCompany`/`UserBranch`/`UserWarehouse`) or
  `OrganizationContext`/`X-Company-Id` request-context abstraction —
  entirely Phase 08's responsibility per this phase's explicit boundary;
  building any of it now would mean inventing a temporary model, which
  was explicitly disallowed.
- No Bruno API collection — consistent with Phase 06's own precedent (no
  prior phase established Bruno tooling in this repository).
- `@nestjs/swagger`'s transitive `js-yaml` advisory (unchanged since
  Phase 01, dev-time only).

### Phase 08 — User / Employee / Account Management

Status: Completed.

- **User administration** (`src/modules/users/`): `UsersService`/
  `UsersController` added over the existing (Phase 05) `User` entity — no
  duplication of the entity or of authentication logic. Reuses the 4
  `users.read/create/update/delete` permissions Phase 06 had already
  seeded with no controller to consume them. New permission actions:
  `users.activate`, `users.deactivate`, `users.lock`, `users.unlock`.
  `UserStatus` gained a 4th value, `LOCKED`, additive to the existing
  `ACTIVE/INACTIVE/SUSPENDED` — `AuthService`'s existing `status !==
  ACTIVE` checks needed no changes to correctly deny locked users.
  `UsersService.create()` reuses `PasswordService` (Argon2id) — no second
  hashing implementation. Response DTOs never include `passwordHash`.
- **Employee** (`src/modules/employees/`, new module): separate entity
  from User — `userId` nullable and unique (`UNIQUE(user_id)` where not
  null), so an Employee can exist without login and a User can exist
  without an Employee (verified by dedicated tests both directions).
  `employeeCode` unique per company. `companyId`/`branchId` required,
  immutable after creation, validated against real active Company/Branch
  rows with the same `branch.companyId === companyId` consistency check
  Phase 07 uses for Warehouse. Department/Position columns were
  deliberately **not** added — no backend Master Data table exists yet to
  reference, and the spec explicitly permits deferring them.
  `EmployeesService.terminate()` sets `TERMINATED` and, only when the
  linked User exists and is still `ACTIVE`, deactivates it in the same
  transaction — an explicit step, not an implicit cascade; historical
  data is never touched.
- **Organizational membership** (`src/modules/organization/entities/
  user-company.entity.ts`, `user-branch.entity.ts`,
  `user-warehouse.entity.ts` + `UserOrganizationService`/
  `UserOrganizationController`, living inside the existing
  `OrganizationModule`): three normalized many-to-many join tables
  (`UNIQUE(user_id, company_id)` etc.), `status` (ACTIVE/INACTIVE) +
  `isPrimary`. **Company-before-branch rule enforced transactionally**: a
  Branch membership requires an existing active Company membership for
  that branch's own company (verified live — rejecting the branch
  assignment 400s until company membership exists, then 201s
  immediately after). **Warehouse hierarchy integrity enforced**: a
  Warehouse membership requires an active Branch membership for the
  warehouse's *real* parent branch, resolved server-side — verified by a
  dedicated e2e test reproducing the exact "Warehouse actually belongs to
  a different branch than claimed" spoofing scenario, which is correctly
  rejected. Multi-membership confirmed working (a user can hold two
  simultaneous active Company memberships).
- **DataScope integration — the Phase 06/07/08 convergence point**:
  `DataScopeService` (Phase 06, untouched otherwise) gained exactly one
  new method, `resolveAllowedOrganizationIds(userId, resolvedScope)`,
  resolving a previously-computed `COMPANY`/`BRANCH`/`WAREHOUSE` scope
  into the real membership-derived ID list (`ALL` short-circuits to
  `null`, unresolvable scope kinds return `[]` as a safe default). No
  second resolution engine, no change to `resolveScope()`'s existing
  breadth-ordering algorithm — this was the exact integration point
  `docs/ORGANIZATION_ARCHITECTURE.md` had flagged as pending since Phase
  07.
- **Sales Account foundation** (`src/modules/sales-accounts/`, new
  module): `SalesAccount` (sales ownership/portfolio identity — never
  named bare "Account," to avoid colliding with the unrelated
  Accounting/GL Account concept already present in the frontend) and
  `SalesAccountAssignment` (normalized, history-preserving: unassignment
  sets `INACTIVE` + `unassignedAt`, never deletes the row). Employee↔
  SalesAccount is 1─N via the assignment table, not a bare
  `Employee.salesAccountId` field, per the locked decision. Cross-company/
  cross-branch/spoofed-user assignment all explicitly rejected and
  covered by tests — in particular, `SalesAccountAssignmentService.assign()`
  verifies the supplied `userId` actually matches the target Employee's
  linked `userId`, preventing an attacker from claiming someone else's
  employee record. `SalesAccountAccessService.getAllowedSalesAccountIds()`
  is the reusable ownership-resolution contract Phase 12 will consume —
  deliberately kept separate from `DataScopeService` (Sales Account
  ownership is a Sales-domain business rule, not a generic organizational
  scope).
- **APIs**: `/users` (+activate/deactivate/lock/unlock),
  `/users/:userId/companies|branches|warehouses` (membership),
  `/employees` (+user link/unlink/terminate/activate/deactivate),
  `/sales-accounts` (+activate/deactivate) and
  `/sales-accounts/:id/assignments` (+unassign). Full list in
  `docs/USER_EMPLOYEE_ACCOUNT_ARCHITECTURE.md`.
- **Tests**: 55 new unit tests (`UsersService`, `EmployeesService`,
  `UserOrganizationService`, `SalesAccountsService`,
  `SalesAccountAssignmentService`, `SalesAccountAccessService`, plus 6 new
  `DataScopeService.resolveAllowedOrganizationIds` cases) + 26 new e2e
  tests (`test/user-employee-account.e2e-spec.ts` — full CRUD, the
  company-before-branch rule, the warehouse-hierarchy spoofing rejection,
  employee termination cascading to a linked user, LOCKED-user login
  denial, the exact "Sales Staff A/B assignments never overlap" scenario
  from the spec, and userId-spoofing rejection on Sales Account
  assignment). Total suite after Phase 08: **164 unit tests / 100 e2e
  tests, all passing** (`npm test`, `npm run test:e2e`).
- Security review performed and verified live through the running Docker
  container: unauthenticated → 401, authenticated-without-permission →
  403 (including membership assignment specifically), cross-company
  Employee/Branch mismatch → 400, spoofed warehouse hierarchy → 400,
  duplicate employee/sales-account code → 409, duplicate membership →
  409, inactive Sales Account cannot receive new assignment → 400,
  locked user cannot authenticate → 401, IDOR on nonexistent
  employee/sales-account id → 404, Sales Account assignment userId
  spoofing → 400.
- `docs/USER_EMPLOYEE_ACCOUNT_ARCHITECTURE.md` documents the full
  architecture, including the Account/SalesAccount/GL-Account naming
  distinction and the exact company-before-branch and warehouse-hierarchy
  rules.
- Verified: zero hard-coded role-name checks (`grep -rn "role\s*===" `)
  and zero `SUPER_ADMIN` string checks anywhere in the four new/modified
  modules. Zero Phase 09+ terms (Customer/Supplier/SalesOrder/
  SalesInvoice/PurchaseOrder/InventoryLedger/JournalEntry/Payroll) found
  in the new modules — no scope creep. Zero frontend files touched. No
  new npm dependencies were added (Phase 08 reused Phase 03/04/05/06/07's
  TypeORM/validation/transaction/auth/RBAC/organization infrastructure
  entirely).
- **Test infrastructure note**: the new e2e suite
  (`user-employee-account.e2e-spec.ts`) also depends on live Super Admin
  permission state, same as `rbac.e2e-spec.ts` and
  `organization.e2e-spec.ts` before it. The `--runInBand` fix already
  applied to the `test:e2e` npm script in Phase 07 continues to keep all
  6 suites (100 tests) passing together with no cross-suite race.

Known/accepted gaps carried forward:

- `SalesAccountAccessService` has no consumer yet — Phase 12 is the
  intended caller. This is the designed integration seam, not a gap.
- No `isPrimary` enforcement beyond the column existing — no current API
  sets it to `true`. Deferred until a concrete "current company/branch"
  UI need appears.
- No `X-Company-Id`/`X-Branch-Id` active-context header handling —
  correctly deferred per Phase 07's own analysis until a business module
  needs "current operating context."
- No Bruno API collection — consistent with every prior phase.
- `@nestjs/swagger`'s transitive `js-yaml` advisory (unchanged since
  Phase 01, dev-time only).

### Phase 09 — Master Data

Status: Completed.

- **Boundary**: exactly four entities — `Category`, `Brand`, `Collection`,
  `AttributeOption` — per the approved analysis's frontend evidence
  inventory. `Currency`, `PaymentTerm`, `PaymentMethod`, `PriceType`,
  `DiscountType`, `Country`, `Unit`, `SizeGroup`, and standalone `Tax` were
  explicitly not built (unsupported by current frontend/backend evidence).
- **Category** (`src/modules/master-data/entities/category.entity.ts`):
  the only self-referencing entity in this phase (`parentId → categories`,
  `ON DELETE RESTRICT`). Gained a **backend-only `code` field** (stable,
  unique, immutable) even though the frontend doesn't expose one yet — per
  the locked decision not to blindly copy the frontend's current shape.
  `UNIQUE(company_id, code)`. Cycle protection (`assertNoCycle`) walks the
  ancestor chain of the proposed new parent, bounded by the company's total
  category count — verified by a real API-driven A→B→C chain reparenting
  attempt that would create A→B→C→A, correctly rejected with 400.
  Self-parent and cross-company parent are also rejected (400); deleting a
  category with existing children is rejected (409, no orphaning).
- **Brand** / **Collection** (`src/modules/master-data/entities/`): flat
  entities, same company-scoped CRUD/status/soft-delete/uniqueness
  pattern. `Brand` deliberately omits `logoUrl` (presentation metadata).
  `Collection.season` is an embedded MySQL enum column
  (`SPRING_SUMMER|AUTUMN_WINTER|ALL_SEASON`), **not** a standalone `Season`
  entity/table/repository — no Season admin page or API exists anywhere in
  the frontend. Proven live: `GET /api/v1/seasons` returns 404.
- **AttributeOption**: **one unified table** discriminated by a `kind`
  enum (`COLOR|SIZE|STYLE|MATERIAL`), not four separate colors/sizes/
  styles/materials tables — matching the frontend's own
  `AttributeOption.kind` shape exactly. `UNIQUE(company_id, kind, code)` —
  `SIZE+"M"` and `COLOR+"M"` never collide (verified by test). `swatch`
  only accepted when `kind = COLOR`, rejected server-side otherwise (both
  on create and update). No `/colors` or `/sizes` routes exist — proven
  live, both return 404.
- **Scope/DataScope integration — the seed gap this phase found and
  fixed**: Phase 09's controllers are the **first** in the codebase to
  actually call `DataScopeService.resolveScope()` /
  `resolveAllowedOrganizationIds()` on a real request path (Phases 07/08
  authorize purely via `PermissionGuard` and never resolved a per-resource
  scope at runtime). This surfaced a real gap — no seed had ever populated
  `role_resource_scopes`, so `resolveScope()` correctly returned `null`
  ("no access") for every role, including SUPER_ADMIN, which would have
  locked SUPER_ADMIN itself out of all four new resources. Fixed by
  extending `rbac.seed.ts` to also grant SUPER_ADMIN an `ALL`-scope
  `RoleResourceScope` row for each of the four Phase 09 resources — the
  minimum needed for the seeded system role to function; no other role
  receives one from this seed; verified idempotent on re-run. No new
  visibility service was created (`CategoryScopeService`,
  `OrganizationScopeService`, or any second DataScope system were all
  explicitly avoided) — instead, a single stateless helper function,
  `resolveRequestCompanyId()`
  (`src/modules/master-data/utils/resolve-request-company-id.ts`), wraps
  the existing Phase 06/08 methods and is reused identically by all four
  controllers. Client-supplied `companyId` is never trusted directly — it
  must appear in the server-resolved allowed-company list; auto-selected
  when exactly one company is allowed, required when ambiguous (ALL scope
  or multiple companies).
- **Master Data status**: `ACTIVE`/`INACTIVE` only on all four entities,
  consistent with the existing two-value status pattern.
- **RBAC integration (reused, not duplicated)**: 16 new permissions
  (`categories.*`, `brands.*`, `collections.*`, `attribute_options.*` —
  read/create/update/delete each) added to the existing idempotent seed,
  granted to SUPER_ADMIN only. Zero hard-coded role-name checks anywhere
  in the new module (grep-verified).
- **APIs**: `/categories`, `/brands`, `/collections`, `/attribute-options`
  — each with list (paginated, filterable)/detail/create/update/
  activate/deactivate/delete (soft). Full list in
  `docs/MASTER_DATA_ARCHITECTURE.md`.
- **Migration**: `1786503728069-CreateMasterDataTables.ts` — creates
  `categories`, `brands`, `collections`, `attribute_options`. Verified
  UP→DOWN→UP against real Dockerized MySQL **twice**: once during initial
  implementation, and again after the `rbac.seed.ts` fix, to confirm the
  seed change didn't affect migration correctness (`RoleResourceScope`
  rows live in a separate table untouched by this migration — confirmed
  intact across the revert/re-apply cycle).
- **Tests**: 30 new unit tests (`CategoriesService` incl. the real
  A→B→C→A cycle-rejection mock sequence, `BrandsService`,
  `CollectionsService`, `AttributeOptionsService`) + 26 new e2e tests
  (`test/master-data.e2e-spec.ts` — auth boundary, permission boundary,
  full CRUD, the Category hierarchy/cycle-protection suite built on real
  API-driven chains, the Collection `/seasons`-404 proof, the
  AttributeOption `/colors`/`/sizes`-404 proofs, unknown-field rejection).
  Total suite after Phase 09: **194 unit tests / 126 e2e tests, all
  passing** (`npm test`, `npm run test:e2e`, both via `--runInBand`).
- **E2E cleanup bug found and fixed**: the new suite's `beforeAll`/
  `afterAll` did a bulk `DELETE FROM categories WHERE code LIKE
  'MD-E2E-%'` without first clearing `parent_id` — when a leftover
  self-referencing parent/child pair existed (e.g. from a previously
  interrupted run), MySQL's `FK_cat_parent` `RESTRICT` constraint rejected
  the bulk delete, which in turn made every subsequent test in the suite
  fail against an increasingly dirty database. Fixed by adding `UPDATE
  categories SET parent_id = NULL WHERE code LIKE '...'` immediately
  before the `DELETE`, in both `beforeAll` and `afterAll` — verified
  stable across repeated runs afterward, including a run starting from a
  deliberately dirtied database.
- Security review performed and verified live through the running Docker
  container: unauthenticated → 401, authenticated-without-permission (and
  company-outside-scope) → 403, cross-company category/brand/collection/
  attribute-option lookup → 404 (never 403, never a leaked existence
  signal), spoofed cross-company `parentId` → 400, self-parent → 400,
  circular hierarchy → 400, duplicate code/kind+code → 409,
  delete-with-children → 409, unknown/extra fields (e.g. `logoUrl` on
  Brand) → 400 (existing global `ValidationPipe`).
- `docs/MASTER_DATA_ARCHITECTURE.md` documents the full architecture,
  including the Season/AttributeOption locked decisions and the
  `resolveRequestCompanyId`/`RoleResourceScope` seed-gap story in detail.
- Verified: zero `Currency`/`PaymentTerm`/`PaymentMethod`/`PriceType`/
  `DiscountType`/`Unit`/`SizeGroup`/standalone-`Tax`/standalone-`Season`
  references, and zero Phase 10+ terms (`Product`/`ProductVariant`/`SKU`/
  `Barcode`/`PriceList`/`Customer`/`Supplier`) anywhere in
  `src/modules/master-data` (grepped) — no scope creep in either
  direction. Zero frontend files touched. No new npm dependencies were
  added (Phase 09 reused Phase 03/04/06/07/08's TypeORM/validation/
  transaction/RBAC/organization infrastructure entirely).
- **Not committed**: per explicit instruction, this phase's work remains
  uncommitted in the working tree — no `git commit`, no `git push`.

Known/accepted gaps carried forward:

- No cross-entity referential validation yet (e.g. nothing prevents
  deleting a Brand a future Product might reference) — there is no
  Product entity yet for such a reference to exist. Intended Phase 10
  integration seam, not a gap.
- `RoleResourceScope` grants from this phase's seed cover SUPER_ADMIN
  only. Any other role that should manage master data needs its own
  `RoleResourceScope` row created through the existing Phase 06 RBAC
  administration surface — no new provisioning mechanism was added.
- No Bruno API collection — consistent with every prior phase.
- `@nestjs/swagger`'s transitive `js-yaml` advisory (unchanged since
  Phase 01, dev-time only).

### Phase 10 — Product / Variant / Pricing

Status: Completed.

- **Boundary**: `Product`, `ProductVariant`, `ProductVariantAttribute`,
  `ProductVariantBarcode`, `PriceList`, `PriceListItem` — six entities in
  a new `src/modules/products/` module. PriceList/PriceListItem were
  explicitly included in this phase (a locked, deliberate expansion of
  the earlier approved analysis's smaller "VariantPrice only"
  recommendation) — no promotion/coupon/campaign/tier-pricing engine was
  built alongside them. Unit/UOM and a Currency entity were explicitly
  deferred (see below) — no placeholder FKs for either exist anywhere.
- **Product/Variant model**: `Product` is the commercial/catalog concept;
  `ProductVariant` is the stockable/sellable unit. **Every Product — even
  a "SIMPLE" one — is created with exactly one initial `ProductVariant`
  row, transactionally, in the same call** (`ProductsService.create()`
  wraps Product + Variant + attribute-row creation in
  `TransactionService.run()`) — this guarantees Phase 12/13/14 always
  have exactly one identity (`ProductVariant.id`) to reference, never a
  fork between "Product is sellable" and "Variant is sellable."
- **SKU strategy**: four distinct, never-collapsed concepts —
  `Product.code` (immutable business code), `ProductVariant.sku` (the
  real sellable identifier, company-unique, SKU never lives on Product),
  `ProductVariant.combinationKey` (internal, server-computed), and
  `ProductVariantBarcode.barcode` (separate table entirely). Matches
  Phase 10 spec §9/§11 and the earlier analysis's Decision D3.
- **Dynamic attributes**: `ProductVariantAttribute` is a normalized join
  to the existing Phase 09 `AttributeOption` table (`kind`/`optionId`),
  not a hard-coded `colorId`/`sizeId` pair — supports
  COLOR/SIZE/STYLE/MATERIAL and any future kind Phase 09 adds, with zero
  Phase 09 changes required. `UNIQUE(variant_id, kind)` prevents two
  options of the same kind on one variant.
- **Variant combination integrity**: a server-computed, sorted-and-joined
  `combinationKey` (`src/modules/products/utils/combination-key.ts`)
  backed by `UNIQUE(product_id, combination_key)` prevents duplicate
  Black/M-style variants under the same Product — fully relational, no
  JSON blob.
- **Barcode**: normalized `ProductVariantBarcode` table (not a column, not
  comma-separated, not JSON) — one Variant may hold multiple barcodes
  (verified live). `UNIQUE(company_id, barcode)`.
- **PriceList/PriceListItem**: company-scoped catalog + effective-dated
  price rows (`validFrom`/`validTo`, `price` as `DECIMAL(12,2)` — the
  first real money-column precedent in this codebase). Overlap between
  active windows for the same `(priceList, variant)` pair is rejected at
  the service layer (`assertNoOverlap`); rows are closed-and-superseded
  on a price change, never edited retroactively. No price-priority
  resolution engine was built — Phase 10 only establishes the data model.
- **Currency decision**: no `Currency` entity — `PriceList.currency` is a
  plain regex-validated `CHAR(3)` ISO-4217 string, mirroring
  `Company.baseCurrency`'s existing Phase 07 pattern exactly. No exchange
  rates, no conversion logic.
- **Unit/UOM decision**: fully deferred — no `Unit`/`UOM`/
  `UnitConversion`/`ProductUnit`/`StockUnit`/`PurchaseUnit` entity or FK
  anywhere. Proven live: `GET /api/v1/units` → 404.
- **DataScope/RBAC integration**: reused Phase 06/08/09 mechanisms
  unmodified — `resolveRequestCompanyId()` (the Phase 09 helper) is
  called by every new controller with no changes to its own code. 20 new
  `resource.action` permissions
  (`products.*`/`product_variants.*`/`barcodes.*`/`price_lists.*`/
  `price_list_items.*`) added to the existing idempotent seed, granted to
  SUPER_ADMIN, plus the now-standard `RoleResourceScope` ALL-scope grant
  per new resource (the Phase 09-discovered gap-closing step, repeated
  correctly here without rediscovering the gap).
- **APIs**: `/products`, `/products/:id/variants`, `/product-variants/:id`
  (+ activate/deactivate/delete), `/product-variants/:id/barcodes`,
  `/barcodes/:id` (+ activate/deactivate/delete), `/price-lists` (+
  activate/deactivate/delete), `/price-lists/:id/items` (+ update/
  deactivate/delete). Full list in
  `docs/PRODUCT_VARIANT_PRICING_ARCHITECTURE.md`.
- **Migration**: `1786519479223-CreateProductVariantPricingTables.ts` —
  six tables. **A real bug was found and fixed during UP verification**:
  the first attempt sized `product_variants.combination_key` as
  `VARCHAR(767)`, which combined with `product_id` in the composite
  unique index exceeded MySQL's 3072-byte max key length for utf8mb4
  (`ER_TOO_LONG_KEY`). Corrected to `VARCHAR(300)` (ample for the
  DTO-enforced 8-attribute cap) in both the entity and migration. The
  failed first attempt also left an orphaned, empty `products` table
  (MySQL DDL auto-commits per-statement, independent of the migration's
  own transaction) — manually dropped, with explicit user confirmation
  before doing so, prior to the corrected migration's successful
  UP→DOWN→UP verification against live Docker MySQL.
- **Tests**: 45 new unit tests across 5 spec files (`ProductsService`,
  `ProductVariantsService`, `BarcodesService`, `PriceListsService`,
  `PriceListItemsService` — including the overlap-detection algorithm's
  positive/negative cases and the transactional Product+Variant creation
  path) + 22 new e2e tests (`test/products.e2e-spec.ts` — auth/permission
  boundaries, transactional creation, duplicate code/SKU/combination
  rejection, cross-company rejection on every entity, unknown-field
  rejection, delete-blocked-while-variants-active, multi-barcode support,
  full PriceList/PriceListItem CRUD with negative-price/invalid-range/
  overlap/cross-company rejection, invalid-currency rejection, and the
  `/units` 404 proof). Total suite after Phase 10: **246 unit tests / 148
  e2e tests, all passing** (`npm test`, `npm run test:e2e`, both via
  `--runInBand`).
- Security review performed and verified live: unauthenticated → 401,
  authenticated-without-permission → 403, cross-company Product/Variant/
  PriceList/PriceListItem lookup → 404 (never a leaked existence signal),
  spoofed cross-company categoryId/brandId/collectionId/productVariantId
  → 404/400, duplicate code/SKU/barcode/combination/price-list-code → 409,
  negative price / invalid date range → 400, delete-with-active-variants
  → 409, unknown/extra fields → 400 (existing global `ValidationPipe`).
- `docs/PRODUCT_VARIANT_PRICING_ARCHITECTURE.md` documents the full
  architecture, including the SKU/Barcode/Currency/Unit decisions and the
  migration bug found during verification.
- Verified: zero `Customer`/`Supplier`/`Sales`/`Purchase`/`Inventory`/
  `InventoryLedger`/`Payment`/`Accounting`/`PromotionEngine`/
  `CouponEngine`/`Unit`/`UOM`/`UnitConversion`/`Currency`(-entity)/
  `ExchangeRate`/`HR`/`Administration` references anywhere in
  `src/modules/products` (grepped) — no scope creep in either direction.
  Zero frontend files touched. No new npm dependencies were added (Phase
  10 reused Phase 03/04/06/07/09's TypeORM/validation/transaction/RBAC/
  master-data infrastructure entirely).
- **Not committed**: per explicit instruction, this phase's work remains
  uncommitted in the working tree — no `git commit`, no `git push`.

Known/accepted gaps carried forward:

- No dedicated SKU/barcode lookup endpoint yet (e.g.
  `/product-variants/lookup?sku=`) — deferred until Phase 12 defines its
  exact POS/lookup contract; the standard list endpoints with a `search`
  filter cover this need in the interim.
- No `Currency` entity, no exchange rates, no multi-currency conversion.
- No `Unit`/`UOM` of any kind.
- No promotion/coupon/campaign/tier-pricing/customer-group pricing engine
  — only the base `PriceList`/`PriceListItem` data model exists.
- No Bruno API collection — consistent with every prior phase.
- `@nestjs/swagger`'s transitive `js-yaml` advisory (unchanged since
  Phase 01, dev-time only).

### Phase 11 — Customer / Supplier

Status: Completed.

- **Boundary**: `Customer`, `Supplier`, `CustomerGroup`, `SupplierGroup`,
  `PaymentTerm`, `CustomerAddress`, `SupplierAddress`, `CustomerContact`,
  `SupplierContact` — nine entities in a new
  `src/modules/customer-supplier/` module. No `Party`/`BusinessParty`
  shared abstraction (Customer and Supplier are independently modeled —
  locked decision), no `Currency` entity, no GL Account/Chart of Accounts
  table, no `CustomerSalesAccountAssignment`, no Audit Log system
  (confirmed none exists anywhere in this codebase as of Phase 10 — a
  pre-existing gap, not introduced here).
- **Customer/Supplier model**: company-scoped
  (`companyId → companies`, `ON DELETE RESTRICT`), `UNIQUE(company_id,
  customer_code)` / `UNIQUE(company_id, supplier_code)`. `branchId` is
  optional (nullable FK to `branches`), validated against the resolved
  company exactly like Warehouse (Phase 07) / Employee (Phase 08) when
  supplied — never required, since neither Phase 11.md's own field list
  nor the locked constraints demand one. Both soft-deleted
  (`deletedAt`), never hard-deleted — preserves the identity Phase 12/13
  will reference.
- **Credit configuration**: Customer gets `creditLimit`
  (`DECIMAL(14,2)`, `>= 0`) + `creditDays` (`INT`, `>= 0`); Supplier gets
  `creditDays` only (no `creditLimit` — not in Phase 11.md's Supplier
  field list). Both validated with a non-negative-decimal regex at the
  DTO layer (a plain `@IsNumberString()` does not reject a negative sign —
  this gap was found via a real failing e2e test during this phase's own
  verification and fixed with an explicit `^\d+(\.\d{1,2})?$` pattern).
  No credit-blocking logic exists — configured master data only.
- **Payment Terms**: one shared, company-scoped `PaymentTerm` entity
  (`code`, `name`, `dueDays`, `status`) referenced by both Customer and
  Supplier via `paymentTermId` — kept semantically separate from Credit
  Limit (Payment Terms = when due; Credit Limit = how much exposure is
  allowed). No values hardcoded/seeded.
- **Opening Balance**: `opening_balance_amount` (exact snake_case DB
  column name, `DECIMAL(14,2)`, default `0.00`) on both tables — initial
  master-data only, explicitly never a live/current balance, never
  recalculated, never ledger-writing. No field named
  `balance`/`currentBalance`/`outstandingBalance`/`accountBalance` exists
  anywhere in the response shape (grep- and e2e-test-verified). Its
  relationship to a real ledger is deferred entirely to **Phase 17**.
- **Accounting mapping placeholders**: `Customer.receivableAccountId` /
  `Supplier.payableAccountId` — nullable `CHAR(36)` UUID columns with
  **no foreign key constraint** (no GL Account table exists yet to point
  to; inventing one now was explicitly forbidden). Inert until Phase 17.
- **SalesAccount / DataScope.ACCOUNT — deliberate deferral**: no
  `CustomerSalesAccountAssignment` table, no permanent SalesAccount
  relationship on Customer/Supplier. Sales attribution is a Phase 12
  transaction-time business rule, not Phase 11 master data.
  `DataScopeService` (Phase 06/08, untouched) resolves
  `COMPANY`/`BRANCH`/`WAREHOUSE`/`ORGANIZATION`/`ALL` scopes only for
  Phase 11 resources, via the same `resolveRequestCompanyId()` helper
  Phase 09/10 already established — `ACCOUNT` scope is left unresolved
  on purpose (an `ACCOUNT`-scoped role currently sees nothing on
  Customer/Supplier, per `resolveAllowedOrganizationIds()`'s existing
  Phase 08 "unresolvable scope → `[]`" contract), documented explicitly
  as a Phase 12 integration point, not a silently-missed gap.
- **Addresses/Contacts**: separate `CustomerAddress`/`SupplierAddress`/
  `CustomerContact`/`SupplierContact` tables — never a shared
  `PartyAddress`/`PartyContact`. Ownership always re-verified server-side
  via `CustomersService.findByIdInCompany()` /
  `SuppliersService.findByIdInCompany()` before any address/contact
  mutation — a cross-company or nonexistent owner id is 404, never a
  leaked existence signal. `isPrimary` is a single-primary-per-owner
  invariant enforced at the service layer (MySQL cannot express a partial
  unique index) — verified live that creating two addresses each with
  `isPrimary: true` leaves exactly one primary. Both soft-deleted.
- **CustomerGroup/SupplierGroup**: real, persisted, configurable
  entities mirroring the Phase 09 Brand/Collection pattern exactly
  (company-scoped code uniqueness, ACTIVE/INACTIVE status, soft delete,
  full CRUD). `remove()` blocked (409) while any Customer/Supplier still
  references the group — mirrors the Phase 09 Category
  RESTRICT-on-children precedent.
- **RBAC integration (reused, not duplicated)**: 36 new
  `resource.action` permissions (`customers.*`, `suppliers.*`,
  `customer_groups.*`, `supplier_groups.*`, `payment_terms.*`,
  `customer_addresses.*`, `supplier_addresses.*`, `customer_contacts.*`,
  `supplier_contacts.*` — read/create/update/delete each) added to the
  existing idempotent seed, granted to SUPER_ADMIN, plus the
  now-standard `RoleResourceScope` ALL-scope grant per new resource (the
  Phase 09-discovered gap-closing step, repeated correctly here without
  rediscovering the gap). Verified idempotent on re-run (zero output).
- **APIs**: `/customers`, `/suppliers` (+ activate/deactivate/**block**/
  delete), `/customer-groups`, `/supplier-groups`, `/payment-terms` (+
  activate/deactivate/delete, 409 while referenced), plus the dual
  nested+flat address/contact routes mirroring Phase 10's
  `/products/:id/variants` + `/product-variants/:id` pattern exactly
  (`/customers/:id/addresses` + `/customer-addresses/:id`, and the
  Supplier/Contact equivalents). Full list in
  `docs/CUSTOMER_SUPPLIER_ARCHITECTURE.md`.
- **Migration**: `1786534701530-CreateCustomerSupplierTables.ts` — nine
  tables. Verified UP→DOWN→UP against real Dockerized MySQL with actual
  `SHOW CREATE TABLE` schema inspection (correct FKs — RESTRICT on
  company/branch/group/payment-term references, CASCADE on
  customer_id/supplier_id owner references; correct unique indexes;
  InnoDB/utf8mb4/utf8mb4_unicode_ci). No migration bugs this time — the
  widest composite unique index (`company_id CHAR(36)` +
  `customer_code VARCHAR(50)`) was checked proactively against MySQL's
  3072-byte key-length limit before writing the migration (344 bytes,
  far under the limit) rather than discovered after a failure.
- **Transactions**: `TransactionService.run()` is **not** used anywhere
  in this phase — every write is a single-table, single-row operation;
  addresses/contacts are always created via their own separate endpoints,
  never inline with Customer/Supplier creation, so no multi-table atomic
  requirement exists.
- **Tests**: 54 new unit tests across 9 spec files (one per service) +
  38 new e2e tests (`test/customer-supplier.e2e-spec.ts` — auth/
  permission boundaries, full CRUD for all nine resources, duplicate-code
  rejection, company/branch cross-company isolation, group/payment-term
  reference validation, credit-limit non-negative validation, opening-
  balance persistence-without-balance-semantics, address/contact
  ownership IDOR-safety and primary-un-setting behavior, 409-while-
  referenced for groups/payment-terms, unknown-field rejection, and a
  dedicated "no gl_accounts/accounts/chart_of_accounts/
  customer_sales_account_assignments table exists" proof). Total suite
  after Phase 11: **293 unit tests (300 including 7 DB-gated skips) /
  186 e2e tests, all passing** (`npm test`, and
  `./node_modules/.bin/jest --config ./test/jest-e2e.json --runInBand`
  — `npm run test:e2e` itself hit a transient shell/PATH exit-127 in
  this session unrelated to the code; direct invocation of the same
  underlying jest command passed cleanly and repeatably).
- **Two real bugs found during this phase's own e2e verification** (not
  pre-existing): (1) `creditLimit`/`openingBalanceAmount` DTOs originally
  used bare `@IsNumberString()`, which does not reject a leading `-` —
  fixed with an explicit non-negative-decimal regex on all four DTOs
  (Create/Update × Customer/Supplier). (2) The e2e suite's `afterAll`/
  `beforeAll` cleanup originally deleted `companies` before the
  `branches` created by the branch-scope tests, tripping the same class
  of FK-ordering issue documented in Phase 09/10 — fixed by adding a
  scoped `branches` cleanup query (via the companies' own code prefix)
  before the `companies` delete, in both `beforeAll` and `afterAll`.
- Security review performed and verified live: unauthenticated → 401,
  authenticated-without-permission → 403, cross-company Customer/
  Supplier/Group/PaymentTerm/Address/Contact lookup → 404 (never a
  leaked existence signal), spoofed cross-company branchId → 400,
  spoofed cross-company customerGroupId/supplierGroupId/paymentTermId →
  404, duplicate customerCode/supplierCode/group-code/payment-term-code
  → 409, negative creditLimit → 400, delete-group/payment-term-while-
  referenced → 409, unknown/extra fields (e.g. `currentBalance`) → 400
  (existing global `ValidationPipe`), IDOR-safe address/contact
  ownership (cross-company owner id → 404, never created).
- `docs/CUSTOMER_SUPPLIER_ARCHITECTURE.md` documents the full
  architecture and doubles as this phase's Decision Record (no separate
  decision-record artifact existed before this session) — includes an
  explicit "Locked Decisions" section, the Opening Balance "NOT current
  balance" statement, the Accounting Mapping Placeholder rationale, the
  SalesAccount/DataScope.ACCOUNT deferral, and a full "Intentionally
  Deferred / Not Built" list.
- Verified: zero `Sales Order`/`Sales Invoice`/`Sales Return`/`Purchase
  Order`/`Purchase Invoice`/`Purchase Return`/`Inventory transaction`/
  `Stock movement`/`Payment transaction`/`Journal Entry`/`General
  Ledger`/`Chart of Accounts`/`Promotion`/`Coupon`/`Tax engine`/
  `Currency`(-entity)/`Unit`/`UOM`/`SalesAccount`-assignment-table/
  current-balance-calculation references anywhere in
  `src/modules/customer-supplier` (grepped — the only matches found were
  doc-comments explicitly stating these do NOT exist, never real code).
  Zero frontend files touched. No new npm dependencies were added (Phase
  11 reused Phase 03/04/06/07/09's TypeORM/validation/transaction/RBAC/
  organization/master-data infrastructure entirely).
- **Not committed**: per explicit instruction, this phase's work remains
  uncommitted in the working tree — no `git commit`, no `git push`.

Known/accepted gaps carried forward:

- `DataScope.ACCOUNT` remains unresolved for Customer/Supplier — Phase 12
  is the intended resolver once it defines transaction-time Sales Account
  attribution. This is the designed integration seam, not a gap.
- No Audit Log system exists anywhere in this codebase (confirmed absent
  as of Phase 10, still absent after Phase 11) — Phase 11.md §20 asked to
  reuse one if it existed; since it does not, none was invented. Any
  future phase that needs audit trails must build that infrastructure
  first, not assume Phase 11 provides it.
- `receivable_account_id`/`payable_account_id` have no FK — entirely
  inert until Phase 17 introduces a real Chart of Accounts table.
- `opening_balance_amount` has no relationship to any ledger — Phase 17
  is expected to read it once as a seed value, not extend it in place.
- No Bruno API collection — consistent with every prior phase.
- `@nestjs/swagger`'s transitive `js-yaml` advisory (unchanged since
  Phase 01, dev-time only).

### Phase 12 — Sales

Status: Completed.

- **Boundary**: exactly three entities — `Sale`, `SaleItem`,
  `CompanySaleCounter` — in a new `src/modules/sales/` module. No
  Purchase/Inventory/Payment/Accounting/Tax-entity/Currency-entity/
  Unit-entity/AuditLog/Approval-workflow/Promotion code anywhere in the
  module (grep-verified — the illustrative `‌ai/Phase 12.md` prompt's
  much larger scope, including approval workflows, a discount-permission
  policy engine, dashboard/summary endpoints, idempotency keys, and
  Outbox event publishing, was deliberately not built where it conflicted
  with the locked decisions or had no concrete requirement to build
  against).
- **Sale/SaleItem model**: `Sale` is the header
  (`companyId`/`branchId`/`warehouseId`/`customerId`/`salesAccountId`,
  all RESTRICT FKs, `branchId`/`warehouseId`/`salesAccountId` nullable),
  `SaleItem` is the line (`saleId` CASCADE, `productVariantId` RESTRICT,
  no independent soft delete — never independently created/deleted
  outside of Sale creation). Money columns use `DECIMAL(14,2)`, matching
  Customer's own Phase 11 precision (not Product/PriceList's narrower
  `DECIMAL(12,2)`, and not Phase 12.md's illustrative `DECIMAL(18,2)`,
  which had no evidentiary basis in this codebase) — a Sale's
  `grandTotal` sums multiple line totals and can exceed any single
  product's price. `SaleType` is a real, minimal enum
  (`POS|RETAIL|WHOLESALE`), not the larger illustrative six-value list —
  `CREDIT`/`CASH` describe a payment dimension, not a channel dimension,
  and `ONLINE` has no evidence of an actual e-commerce channel anywhere
  in this codebase.
- **Sale numbering — concurrency-safe via a locked counter table**: a
  dedicated `CompanySaleCounter` entity/table
  (`UNIQUE(company_id, year)`), never `SELECT MAX(sale_number) + 1`.
  Inside the same transaction as Sale/SaleItem creation, the counter row
  is guaranteed to exist via an idempotent
  `INSERT ... ON DUPLICATE KEY UPDATE` upsert (avoiding the exact race a
  naive "check-then-insert" sequence would have on first use), then
  locked with `SELECT ... FOR UPDATE`
  (`manager.createQueryBuilder(...).setLock('pessimistic_write')`),
  incremented, and formatted as `SAL-<year>-<6-digit sequence>`. Proven
  correct with a real 10-way parallel `POST /sales` e2e test — all
  resulting sale numbers unique, zero unexpected failures.
- **Pricing snapshot**: at creation, each line's `ProductVariant` is
  resolved (Phase 10, reused verbatim), then the currently-active
  `PriceListItem` is resolved server-side using the exact `validFrom <=
  now() AND (validTo IS NULL OR validTo > now())` window Phase 10
  already established. Since `PriceList` has no default/current flag,
  the resolution rule is: exactly one company `ACTIVE` `PriceList` is
  used automatically; otherwise the client must specify `priceListId`
  per item, or the request is rejected (ambiguity is never silently
  guessed). `unitPriceSnapshot` is stored once and never re-resolved —
  proven by a dedicated e2e test that changes the underlying
  `PriceListItem` price after Sale creation and confirms the existing
  `SaleItem.unitPriceSnapshot` is unaffected. `CreateSaleDto`/
  `CreateSaleItemDto` have no `unitPrice`/`subtotal`/`grandTotal` fields
  at all — submitting them is rejected outright by the existing global
  `forbidNonWhitelisted` `ValidationPipe` (400), a stronger guarantee
  than "the server silently ignores client totals." Only a non-negative
  per-line `discountAmount`/`taxAmount` pass-through is accepted; every
  other financial figure on `Sale` is summed server-side from the
  resolved lines.
- **Customer integration**: reuses `CustomersService.findByIdInCompany()`
  (Phase 11) verbatim — cross-company/nonexistent `customerId` is 404,
  matching Phase 11's own IDOR-hiding convention. A `BLOCKED` customer
  (Phase 11's three-value status) is rejected at Sale creation — the one
  new business rule this phase adds on top of Customer's existing
  status, resolving what Phase 11 explicitly left open. No full Customer
  field snapshot was added to `Sale` beyond `customerId` itself — the
  permanently-preserved (soft-delete only) `Customer` row plus its own
  id is sufficient, unlike Product/Price which mutate in ways that would
  corrupt historical Sale data if live-referenced.
- **SalesAccount integration — transaction-level attribution, the
  central Phase 11→12 resolution point**: `Sale.salesAccountId` is
  nullable. No permanent `Customer`↔`SalesAccount` assignment table was
  created (Phase 11's own deferral, resolved here as "attribution is
  per-transaction, not master data"). No modification to
  `DataScopeService` — `ACCOUNT`/`TEAM`/`OWN` scopes still resolve to
  `[]` exactly as Phase 06/08 left them.
  `SalesAccountAccessService.canAccessSalesAccount()` (Phase 08,
  previously unconsumed) is the ONLY authorization mechanism for
  SalesAccount attribution — proven by a dedicated e2e test where
  SUPER_ADMIN itself (full permissions, `ALL` data scope) is still
  rejected 403 when not assigned to the target account, confirming no
  permission/scope-based bypass exists. Cross-company/nonexistent
  SalesAccount → 404 (IDOR-safe); within-company-but-unauthorized → 403
  (a genuine distinct permission failure, not hidden behind a generic
  404).
- **Organization scope**: `companyId` required via the unmodified
  `resolveRequestCompanyId()` helper (Phase 09). `branchId`/`warehouseId`
  optional; when supplied, validated against the resolved company
  (and, when both are present, `warehouse.branchId === branchId`) —
  mirrors the exact Warehouse cross-company/cross-branch spoofing
  rejection Phase 07/08 already established, reused rather than
  re-derived.
- **Lifecycle**: `DRAFT`/`CONFIRMED`/`CANCELLED` only — no
  `PENDING_APPROVAL`/`PARTIALLY_PAID`/`PAID`/`COMPLETED`, no approval
  workflow tables/roles/services of any kind. Valid transitions:
  `DRAFT → CONFIRMED`, `DRAFT → CANCELLED` only; every other transition
  (including CONFIRMED→CANCELLED, any re-confirm/re-cancel, and any
  CANCELLED→anything) is rejected 409, matching Phase 07's
  "deletion-blocked-while-children-exist" business-rule-violation
  precedent. Two dedicated endpoints only
  (`POST /sales/:id/confirm`, `POST /sales/:id/cancel`) — **no generic
  `PATCH /sales/:id` endpoint exists at all**, not even for `notes`;
  nothing concrete in this phase's scope required a limited-field
  update path, and building one anyway (against `Phase 12.md`'s own
  "do not copy blindly" instruction) was judged a bigger risk (an
  accidental backdoor into mutating financial fields) than the
  convenience it would add. Confirmed sales are therefore immutable by
  construction, not by convention.
- **Tax boundary — explicit, honest limitation**: no `Tax` entity, no
  tax module, no hardcoded rate (the frontend's 8% mock constant was not
  replicated). `SaleItem.taxSnapshot` is a server-validated
  non-negative pass-through value only — no rate-lookup/jurisdiction
  logic exists anywhere. Documented plainly in
  `docs/SALES_ARCHITECTURE.md` rather than pretending a real tax engine
  exists.
- **Audit Log — explicit deferral, not silently skipped**: confirmed
  still absent from this entire codebase through Phase 12 (same
  pre-existing gap every phase since Phase 09 has flagged without
  unilaterally fixing). No `AuditLog` entity/service/table/module of any
  kind was built.
- **Inventory/Payment/Accounting boundaries**: all three are explicit,
  inert integration points, not implemented logic.
  `Sale.warehouseId` is scope-only (no stock-availability check exists —
  no Inventory entity exists yet to check against).
  `Sale.paidAmount`/`balanceAmount` are initialize-only fields (`0.00`
  and `= grandTotal` respectively at creation) never written to again by
  this phase — Phase 16's integration surface.
  `Customer.receivableAccountId` (Phase 11) remains untouched — Phase
  17's integration surface, alongside `Sale.grandTotal` itself.
- **RBAC integration (reused, not duplicated)**: 7 new permissions
  (`sales.read/create/update/delete/confirm/cancel`, `sale_items.read` —
  plural, matching every prior phase's `resource.action` convention,
  never singular `sale.*`) added to the existing idempotent seed,
  granted to SUPER_ADMIN, plus the now-standard `RoleResourceScope`
  ALL-scope grant for both new resources (the Phase-09-discovered
  gap-closing step, repeated correctly here). `sales.update`/
  `sales.delete` are seeded but currently unconsumed by any endpoint
  (reserved for a future limited-PATCH/soft-delete-before-confirm
  feature, so adding one later doesn't require a fresh permission
  migration) — documented as intentional, not an oversight.
- **APIs**: `GET /sales`, `GET /sales/:id`, `POST /sales`,
  `POST /sales/:id/confirm`, `POST /sales/:id/cancel`. No PATCH, no
  DELETE. Full list and every locked-decision rationale in
  `docs/SALES_ARCHITECTURE.md`.
- **Migration**: `1786550000000-CreateSalesTables.ts` — three tables
  (`company_sale_counters` created first, then `sales`, then
  `sale_items`, respecting FK dependency order). Verified UP→DOWN→UP
  against real Dockerized MySQL with actual `SHOW CREATE TABLE` schema
  inspection for all three tables (correct FKs — RESTRICT everywhere on
  `sales`' organizational/customer/sales-account/user references,
  CASCADE only on `sale_items.sale_id`, RESTRICT on
  `sale_items.product_variant_id`, RESTRICT on
  `company_sale_counters.company_id`; correct unique indexes
  `(company_id, sale_number)` and `(company_id, year)`; correct
  secondary indexes; InnoDB/utf8mb4/utf8mb4_unicode_ci). No migration
  bugs found this time.
- **Transactions**: `TransactionService.run()` wraps the entire
  `SalesService.create()` flow (SalesAccount validation, counter
  locking/incrementing, per-item price resolution, Sale + all SaleItem
  row creation) — every `manager.create()`/`manager.save()` call inside
  the callback uses the transactional `EntityManager`, never an injected
  Repository (which would silently escape the transaction). Proven with
  a dedicated rollback e2e test (one valid item + one invalid
  `productVariantId` → 404, zero `sales`/`sale_items` rows exist
  afterward) and the sale-number concurrency test described above.
- **Tests**: 39 new unit tests (`SalesService` — including the full
  lifecycle-transition matrix, SalesAccount authorization
  positive/negative/cross-company cases, price-list-ambiguity rejection,
  and per-line discount-exceeds-subtotal rejection — plus
  `formatSaleNumber`) + 35 new e2e tests (`test/sales.e2e-spec.ts` —
  auth/permission boundaries, single and multi-item creation, real
  sale-number uniqueness including a 10-way parallel concurrency test,
  pricing-snapshot-survives-a-later-price-change, unknown-field
  rejection, client-submitted-subtotal/unitPrice rejection,
  cross-company customer/branch/warehouse/SalesAccount rejection,
  warehouse-not-belonging-to-branch spoofing rejection, the
  SUPER_ADMIN-not-assigned-still-403 SalesAccount proof, every lifecycle
  transition both valid and invalid, confirmed-sale immutability,
  no-generic-PATCH-exists, and the transactional-rollback-on-partial-
  failure proof). All 315 pre-existing unit tests continue passing
  (322 total including 7 pre-existing DB-gated skips). **E2E note**:
  running the complete 10-suite e2e set as one `npm run test:e2e`
  invocation intermittently hit the same "transient shell/PATH exit-127"
  environment quirk Phase 11's own session documented — direct
  invocation of the underlying jest binary in smaller batches (verified
  three ways: the 35 Sales tests alone; the other 9 suites' 186 tests
  together without Sales; and Sales running alongside
  Customer/Supplier's 38 tests as a 73-test combined batch) passed
  cleanly and repeatably every time, giving complete real coverage of
  all 10 suites despite the single-invocation flakiness.
- Security review performed and verified live through the running
  Docker container: unauthenticated → 401, authenticated-without-
  permission → 403, cross-company customer/branch/warehouse/
  SalesAccount → 404 or 400 per the established convention,
  within-company-but-unauthorized SalesAccount → 403 (distinct from
  404), invalid lifecycle transition → 409, client-submitted
  price/subtotal/grandTotal → 400 (rejected outright by
  `forbidNonWhitelisted`, never silently accepted-then-ignored),
  unknown/extra fields → 400, no generic PATCH exists to bypass the
  confirm/cancel-only lifecycle.
- `docs/SALES_ARCHITECTURE.md` documents the full architecture,
  including explicit, honest boundary statements for tax (no engine),
  audit (deferred), inventory/payment/accounting (inert integration
  points only), and the full Phase 13/14/15/16/17 integration-point
  list.
- Verified: zero real implementation of Purchase/PurchaseOrder/
  SupplierTransaction, Inventory/Stock/StockMovement, Payment
  entity/ledger, JournalEntry/Ledger/GLAccount, a `Tax` entity, a
  `Currency` entity, a `Unit`/UOM entity, AuditLog infrastructure,
  Approval workflow tables/services, or Promotion/Coupon anywhere in
  `src/modules/sales` (grepped — the only matches were doc-comments
  explicitly stating these do NOT exist, never real code). Zero
  frontend files touched. No new npm dependencies were added (Phase 12
  reused Phase 03/04/06/07/08/09/10/11's TypeORM/validation/
  transaction/RBAC/organization/master-data/products/customer-supplier/
  sales-accounts infrastructure entirely).
- **Not committed**: per explicit instruction, this phase's work
  remains uncommitted in the working tree — no `git commit`, no
  `git push`. Phase 09/10/11's own still-uncommitted changes were left
  exactly as they were, untouched beyond what Phase 12 needed to add
  (extending, not replacing, `rbac.seed.ts`/`typeorm.options.ts`/
  `app.module.ts`).

### Phase 13 — Purchase (Purchase Order only)

Status: Completed.

- **Boundary**: exactly three entities — `PurchaseOrder`,
  `PurchaseOrderItem`, `CompanyPurchaseCounter` — in a new
  `src/modules/purchase/` module. No Goods Receipt/Purchase Request/
  Supplier Invoice/Purchase Return/Inventory/Stock/Payment-entity/
  Accounting/Tax-entity/Currency-entity/Unit-entity/AuditLog/Approval-
  workflow/RFQ/Promotion code anywhere in the module (grep-verified — the
  only matches were doc-comments explicitly stating these do NOT exist).
  Phase 13 owns PurchaseOrder only; Goods Receipt is explicitly deferred
  to Phase 14 (Decision #3, LOCKED) and buyer/requester attribution is
  explicitly omitted (Decision #9, LOCKED) — see
  `docs/PURCHASE_ARCHITECTURE.md` §21/§24.
- **PurchaseOrder/PurchaseOrderItem model**: `PurchaseOrder` is the header
  (`companyId`/`branchId`/`warehouseId`/`supplierId`/`paymentTermId`, all
  RESTRICT FKs, `branchId`/`warehouseId`/`paymentTermId` nullable),
  `PurchaseOrderItem` is the line (`purchaseOrderId` CASCADE,
  `productVariantId` RESTRICT, no independent soft delete — mirrors
  `SaleItem` exactly). Money columns use `DECIMAL(14,2)`, matching Sale's
  own Phase 12 precision. `PurchaseType` is a minimal, defensible enum
  (`STANDARD|CREDIT`) — `CREDIT` reflects `Supplier.creditDays` (Phase
  11), a real, already-modeled business distinction, not a speculative
  channel split like Sale's POS/RETAIL/WHOLESALE (Purchase has no
  equivalent channel concept). **No `purchaserId`/`buyerId`/`requesterId`
  field, no SalesAccount-equivalent relationship** — Decision #9, LOCKED;
  `PurchaseModule` does not import `SalesAccountsModule` at all.
- **Purchase-order numbering — concurrency-safe via a locked counter
  table, reusing Phase 12's exact pattern**: a dedicated
  `CompanyPurchaseCounter` entity/table (`UNIQUE(company_id, year)`),
  never `SELECT MAX(purchase_order_number) + 1`. Inside the same
  transaction as PurchaseOrder/PurchaseOrderItem creation, the counter
  row is guaranteed to exist via the same idempotent
  `INSERT ... ON DUPLICATE KEY UPDATE` upsert, then locked with
  `SELECT ... FOR UPDATE`, incremented, and formatted as
  `PO-<year>-<6-digit sequence>`. Proven correct with a real 10-way
  parallel `POST /purchase-orders` e2e test — all resulting purchase
  order numbers unique, zero unexpected failures.
- **Cost snapshot — client-supplied, never server-resolved**: unlike
  Sale's PriceList-resolved `unitPriceSnapshot`, Purchase has no pricing
  engine. `unitCostSnapshot` is the client-supplied, server-validated
  (`>= 0`) negotiated cost for that specific order — `ProductVariant.costPrice`
  is reference/default data only and is never read to populate it (per
  `docs/PRODUCT_VARIANT_PRICING_ARCHITECTURE.md` §20's own locked
  contract for this phase). `CreatePurchaseOrderDto`/
  `CreatePurchaseOrderItemDto` have no `subtotal`/`grandTotal`/
  `lineTotal` fields at all — submitting them is rejected outright by the
  existing global `forbidNonWhitelisted` `ValidationPipe` (400). Every
  `PurchaseOrder` financial total is summed server-side from the
  resolved, validated per-line `unitCost`/`discountAmount`/`taxAmount`
  values.
- **Supplier integration**: reuses `SuppliersService.findByIdInCompany()`
  (Phase 11) verbatim — cross-company/nonexistent `supplierId` is 404,
  matching the established IDOR-hiding convention. A `BLOCKED` supplier
  is rejected (400) at PurchaseOrder creation, the direct Purchase-side
  analogue of Sale's `BLOCKED` Customer rejection.
- **PaymentTerm integration**: reuses
  `PaymentTermsService.findByIdInCompany()` (Phase 11) verbatim —
  cross-company/nonexistent `paymentTermId` is 404 (same IDOR-hiding
  convention as Supplier/ProductVariant), inactive is 400. `PaymentTerm`
  is the same shared entity Phase 11 built for both Customer and
  Supplier — not duplicated or extended here.
- **ProductVariant integration**: reuses
  `ProductVariantsService.findByIdInCompany()` (Phase 10) verbatim for
  every line — never a `productId`+color+size tuple, the same identity
  contract `SaleItem` uses.
- **Organization scope**: `companyId` required via the unmodified
  `resolveRequestCompanyId()` helper (Phase 09). `branchId`/`warehouseId`
  optional; when supplied, validated against the resolved company (and,
  when both are present, `warehouse.branchId === branchId`) — mirrors
  the exact Warehouse cross-company/cross-branch spoofing rejection
  Sale/Phase 07/08 already established, reused rather than re-derived.
- **Lifecycle**: `DRAFT`/`CONFIRMED`/`CANCELLED` only — an exact mirror
  of Sale's lifecycle, no `PENDING_APPROVAL`/`PARTIALLY_RECEIVED`/
  `RECEIVED`/`CLOSED`. Valid transitions: `DRAFT → CONFIRMED`,
  `DRAFT → CANCELLED` only; every other transition (including any
  re-confirm/re-cancel, and any CANCELLED→anything) is rejected 409. Two
  dedicated endpoints only (`POST /purchase-orders/:id/confirm`,
  `POST /purchase-orders/:id/cancel`) — **no generic
  `PATCH /purchase-orders/:id` endpoint exists at all**. Confirmed
  purchase orders are therefore immutable by construction.
- **Tax boundary — explicit, honest limitation**: no `Tax` entity, no
  tax module, no hardcoded rate. `PurchaseOrderItem.taxSnapshot` is a
  server-validated non-negative pass-through value only — no
  rate-lookup/jurisdiction logic exists anywhere, identical in spirit to
  Sale's own tax boundary.
- **Goods Receipt — explicit deferral to Phase 14, not silently
  skipped**: no `GoodsReceipt`/`GoodsReceiptItem` entity, receiving
  quantity, rejected quantity, remaining-quantity tracking, partial
  receiving, over-receiving validation, receiving concurrency lock, or
  any stock/inventory mutation exists anywhere (Decision #3, LOCKED).
- **Buyer/requester attribution — explicit omission, not an
  inconsistency with Sale's SalesAccount model**: no
  `purchaserId`/`buyerId`/`requesterId` field, no PurchaseAccount/
  SalesAccount-equivalent relationship, no `BuyerAssignment` table, no
  `ACCOUNT` DataScope resolution for Purchase (Decision #9, LOCKED).
  `PurchaseOrdersService` never calls `SalesAccountAccessService`.
- **Inventory/Payment/Accounting boundaries**: all three are explicit,
  inert integration points, not implemented logic.
  `PurchaseOrder.warehouseId` is scope-only (no stock-increase logic
  exists — that is Phase 14's job).
  `PurchaseOrder.paidAmount`/`balanceAmount` are initialize-only fields
  (`0.00` and `= grandTotal` respectively at creation) never written to
  again by this phase — Phase 16's integration surface.
  `Supplier.payableAccountId` (Phase 11) remains untouched — Phase 17's
  integration surface, alongside `PurchaseOrder.grandTotal` itself.
- **RBAC integration (reused, not duplicated; no dead permissions)**: 5
  new permissions (`purchase_orders.read/create/confirm/cancel`,
  `purchase_order_items.read` — plural, matching every prior phase's
  `resource.action` convention) added to the existing idempotent seed,
  granted to SUPER_ADMIN, plus the now-standard `RoleResourceScope`
  ALL-scope grant for both new resources. Deliberately **no
  `.update`/`.delete`/`.approve`/`.reject` permissions** — unlike Phase
  12's reserved-for-future `sales.update`/`sales.delete`, every Phase 13
  permission has a real, working endpoint behind it; this closes the
  exact "dead permission" gap the Phase 13 task explicitly called out.
  Verified live via the seed script's own console output (5 permissions
  created, 5 grants to SUPER_ADMIN, 2 ALL-scope `RoleResourceScope` rows
  created).
- **APIs**: `GET /purchase-orders`, `GET /purchase-orders/:id`,
  `POST /purchase-orders`, `POST /purchase-orders/:id/confirm`,
  `POST /purchase-orders/:id/cancel`. No PATCH, no DELETE. Full list and
  every locked-decision rationale in `docs/PURCHASE_ARCHITECTURE.md`.
- **Migration**: `1786560000000-CreatePurchaseTables.ts` — three tables
  (`company_purchase_counters` created first, then `purchase_orders`,
  then `purchase_order_items`, respecting FK dependency order). Verified
  UP→DOWN→UP against real Dockerized MySQL with actual
  `SHOW CREATE TABLE` schema inspection for all three tables (correct
  FKs — RESTRICT everywhere on `purchase_orders`' organizational/
  supplier/payment-term/user references, CASCADE only on
  `purchase_order_items.purchase_order_id`, RESTRICT on
  `purchase_order_items.product_variant_id`, RESTRICT on
  `company_purchase_counters.company_id`; correct unique indexes
  `(company_id, purchase_order_number)` and `(company_id, year)`; correct
  secondary indexes; InnoDB/utf8mb4/utf8mb4_unicode_ci). All pre-existing
  Phase 01-12 tables (36 tables) confirmed present and untouched after
  the DOWN migration, and confirmed restored after the second UP. No
  migration bugs found this phase — no composite index in this schema
  approached MySQL's 3072-byte utf8mb4 key-length limit (checked
  proactively per the Phase 10 lesson).
- **Transactions**: `TransactionService.run()` wraps the entire
  `PurchaseOrdersService.create()` flow (counter locking/incrementing,
  per-item cost/discount/tax validation, PurchaseOrder + all
  PurchaseOrderItem row creation) — every `manager.create()`/
  `manager.save()` call inside the callback uses the transactional
  `EntityManager`, never an injected Repository. Proven with a dedicated
  rollback e2e test (one valid item + one invalid `productVariantId` →
  404, zero `purchase_orders`/`purchase_order_items` rows exist
  afterward) and the purchase-order-number concurrency test described
  above.
- **Tests**: 20 new unit tests (`PurchaseOrdersService` — including the
  full lifecycle-transition matrix, negative-cost rejection,
  discount-exceeds-subtotal rejection, blocked-supplier rejection,
  cross-company-supplier-404, PaymentTerm active/inactive/cross-company
  validation, and purchase-order-number formatting) + 38 new e2e tests
  (`test/purchase-orders.e2e-spec.ts` — auth/permission boundaries,
  single and multi-item creation, real purchase-order-number uniqueness
  including a 10-way parallel concurrency test, unknown-field rejection,
  client-submitted-subtotal/lineTotal rejection, cross-company supplier/
  ProductVariant/PaymentTerm rejection, invalid branch/warehouse/
  currency/quantity/cost rejection, BLOCKED supplier rejection, every
  lifecycle transition both valid and invalid, confirmed-purchase-order
  immutability, no-generic-PATCH-exists, and the
  transactional-rollback-on-partial-failure proof). All pre-existing
  unit tests continue passing (335 passed, 7 DB-gated skips, 342 total
  across 45 passed + 2 skipped suites). The full 11-suite e2e regression
  (all of Phase 05-13's suites, run in two batches to avoid the
  documented exit-127 flakiness) passed cleanly: batch 1 (app/auth/
  organization/master-data/products/rbac) 119/119 tests, batch 2
  (customer-supplier/user-employee-account/validation/sales/
  purchase-orders) 140/140 tests — 259 e2e tests total, zero failures.
- Security review performed and verified live through the running
  Docker container: unauthenticated → 401, authenticated-without-
  permission → 403, cross-company supplier/branch/warehouse/
  paymentTerm/productVariant → 404 or 400 per the established
  convention, invalid lifecycle transition → 409, client-submitted
  subtotal/grandTotal/lineTotal → 400 (rejected outright by
  `forbidNonWhitelisted`, never silently accepted-then-ignored),
  unknown/extra fields → 400, no generic PATCH exists to bypass the
  confirm/cancel-only lifecycle. Two test-authoring bugs were found and
  fixed during verification (not implementation bugs): the e2e helper for
  blocking a Supplier was missing the required `?companyId=` query
  param (silently no-op'd under SUPER_ADMIN's ALL scope, masking the
  BLOCKED-rejection assertion), and a cross-company PaymentTerm test
  initially asserted 400 instead of the actually-correct 404 (matching
  `PaymentTermsService.findByIdInCompany()`'s existing IDOR-hiding
  convention) — both fixed in the test file itself, not the
  implementation, after confirming which side was wrong.
- `docs/PURCHASE_ARCHITECTURE.md` documents the full architecture,
  including explicit, honest boundary statements for tax (no engine),
  Goods Receipt/Purchase Request/Supplier Invoice/Purchase Return
  (deferred/not built), buyer/requester attribution (omitted, Decision
  #9), inventory/payment/accounting (inert integration points only), and
  the Phase 14/15/16/17 integration-point list.
- Verified: zero real implementation of Inventory/Stock/StockMovement,
  Payment entity/ledger, JournalEntry/Ledger/GLAccount, a `Tax` entity, a
  `Currency` entity, a `Unit`/UOM entity, AuditLog infrastructure,
  Approval workflow tables/services, GoodsReceipt, PurchaseReturn,
  SupplierInvoice, PurchaseRequest, ExchangeRate, SalesAccount, or any
  Buyer/Purchaser/Requester field anywhere in `src/modules/purchase`
  (grepped — the only matches were doc-comments explicitly stating these
  do NOT exist, never real code). Zero frontend files touched. No new
  npm dependencies were added (Phase 13 reused Phase 03/04/06/07/08/09/
  10/11/12's TypeORM/validation/transaction/RBAC/organization/
  customer-supplier/products infrastructure entirely).
- **Not committed**: per explicit instruction, this phase's work remains
  uncommitted in the working tree — no `git commit`, no `git push`.
  Phase 09-12's own still-uncommitted changes were left exactly as they
  were, untouched beyond what Phase 13 needed to add (extending, not
  replacing, `rbac.seed.ts`/`typeorm.options.ts`/`app.module.ts`).

Known/accepted gaps carried forward:

- No tax rate engine — see `docs/SALES_ARCHITECTURE.md` "Tax Boundary".
- No Audit Log system exists anywhere in this codebase through Phase 12
  (confirmed absent, not merely unmentioned) — same pre-existing gap
  every phase since Phase 09 has flagged.
- No stock/inventory availability check — Phase 14/15's integration
  point, not resolved here.
- No payment recording/reconciliation — Phase 16's integration point.
- No accounting/journal posting — Phase 17's integration point.
- No generic update endpoint for Sale — a DRAFT sale can only be
  recreated, not edited in place. `sales.update`/`sales.delete`
  permissions exist in the seed for a possible future feature but have
  no consuming endpoint yet.
- No idempotency-key mechanism on `POST /sales` — a genuinely retried
  request creates a second, separately-numbered Sale rather than being
  deduplicated. No existing idempotency infrastructure exists anywhere
  in this codebase to reuse, and building one was judged out of this
  phase's scope — flagged honestly rather than silently ignored.
- No dashboard/summary/aggregate endpoints — deferred to a future
  Reports/Dashboard phase.
- No Bruno API collection — consistent with every prior phase.
- `@nestjs/swagger`'s transitive `js-yaml` advisory (unchanged since
  Phase 01, dev-time only).
- No Goods Receipt / receiving logic of any kind — Phase 14's integration
  point (Decision #3, LOCKED), see `docs/PURCHASE_ARCHITECTURE.md` §21.
- No Purchase Request, Supplier Invoice, or Purchase Return entity —
  explicitly not built in Phase 13, see `docs/PURCHASE_ARCHITECTURE.md`
  §22/§23/§25.
- No buyer/requester/purchaser attribution model for PurchaseOrder
  (Decision #9, LOCKED) — Purchase is deliberately independent of
  SalesAccount; a future phase would need to make a fresh, explicit
  decision if this is ever wanted, not silently inherit Sale's model.
- No generic update endpoint for PurchaseOrder — a DRAFT purchase order
  can only be recreated, not edited in place. Unlike Sale, no
  `purchase_orders.update`/`.delete` permission was even seeded (no dead
  permission exists in the catalog for this resource).
- No idempotency-key mechanism on `POST /purchase-orders` — the same
  honest gap Sale has; a genuinely retried request creates a second,
  separately-numbered PurchaseOrder rather than being deduplicated.

### Phase 14 — Inventory

Status: Completed.

- **Boundary**: exactly eight entities across three counter tables —
  `WarehouseStock`, `StockMovement`, `GoodsReceipt`/`GoodsReceiptItem`,
  `StockTransfer`/`StockTransferItem`, `StockAdjustment`, plus
  `CompanyGoodsReceiptCounter`/`CompanyStockTransferCounter`/
  `CompanyStockAdjustmentCounter` — in a new `src/modules/inventory/`
  module. No queryable Inventory Ledger API (Phase 15), no valuation/
  FIFO/weighted-average/COGS/accounting postings, no batch/lot/serial/
  expiry tracking, no UOM/fractional quantity, no reservation workflow
  (schema-forward-compat `reservedQuantity` column only, always 0), no
  reorder points, no approval workflow engine, no Purchase/Sales Return,
  no Redis/BullMQ/events (grep-verified — the only matches were
  doc-comments explicitly stating these do NOT exist, never real code).
- **WarehouseStock**: the current balance for one `(warehouseId,
  productVariantId)` pair — `UNIQUE(warehouse_id, product_variant_id)`,
  the stock-identity contract `docs/PRODUCT_VARIANT_PRICING_ARCHITECTURE.md`
  §21 anticipated. Not a lifecycle entity (no `BaseEntity`, no
  soft-delete); a row is created lazily via an idempotent upsert on first
  touch, never through its own endpoint. `onHandQuantity` is the sole
  authoritative count, enforced `>= 0` at the transaction layer (never a
  DB `CHECK` alone). `reservedQuantity` is schema-forward-compat only —
  nothing anywhere writes a non-zero value. `availableQuantity` is
  computed only in the response DTO, never persisted. No cost/value
  column exists (Phase 17's concern).
- **StockMovement — the Phase 14/15 boundary**: append-only internal log,
  **no update/delete/soft-delete and deliberately no public list/query
  endpoint** in this phase — written internally by GoodsReceipt/
  Sale-confirm/StockTransfer/StockAdjustment only.
  `movementType ∈ {PURCHASE_RECEIPT, SALE_ISSUE, TRANSFER_IN,
  TRANSFER_OUT, ADJUSTMENT, OPENING_BALANCE}`; `quantityAfter` is a
  denormalized point-in-time snapshot; `referenceType`/`referenceId` form
  a polymorphic pointer with **no FK constraint** (points to a different
  table depending on `referenceType`). Explicit statement: **Phase 14
  writes `stock_movements`, Phase 15 (Inventory Ledger) is the phase that
  ever queries/reports on it.**
- **GoodsReceipt design**: **no `status` column, no lifecycle** — a row
  existing IS the completed receipt; no update/delete endpoint.
  `GoodsReceiptItem.productVariantId` is denormalized but always
  server-validated to match the referenced `PurchaseOrderItem`'s own
  variant (400 if mismatched). Remaining-ordered-quantity is always
  computed server-side (`purchaseOrderItem.quantity - SUM(prior
  GoodsReceiptItem.receivedQuantity)`), never stored as a mutable column;
  over-receiving is **409 Conflict** (business-rule-violation
  convention, not 400). `unitCostSnapshot` was deliberately **omitted**
  from `GoodsReceiptItem` — the locked spec said "MAY preserve," not
  "MUST," and omitting it avoids any risk of being read as valuation
  logic.
- **Purchase integration**: receiving requires the PurchaseOrder to be
  `CONFIRMED` (`DRAFT`/`CANCELLED` → 409). One `TransactionService.run()`
  call: lock the `PurchaseOrderItem` row(s) with `SELECT ... FOR UPDATE`
  (sorted by id for deterministic cross-request ordering) → lock
  (upsert-then-lock) the `WarehouseStock` row(s) → validate remaining →
  increase stock → write `StockMovement(PURCHASE_RECEIPT)` → create the
  `GoodsReceipt`/`GoodsReceiptItem` rows. **Additive change to
  `PurchaseOrdersService.cancel()`** (Phase 13, otherwise untouched): now
  rejects (409) cancelling a PurchaseOrder that already has any
  `GoodsReceipt` recorded against it, checked before the existing
  transition-table check.
- **Sales integration — the cross-phase-boundary change (D5)**:
  `SalesService.confirm()` (Phase 12) was `status flip + updatedBy +
  save`; it is now wrapped in `TransactionService.run()` and, before
  flipping status, locks the relevant `WarehouseStock` rows in
  deterministic (`productVariantId`) order, validates sufficient
  `onHandQuantity` for **every** item (any single insufficient item rolls
  back the *entire* confirmation — no partial deduction, Sale stays
  `DRAFT`, 409), decreases stock, and writes one
  `StockMovement(SALE_ISSUE)` row per item. Only after all stock
  mutations succeed does status flip to `CONFIRMED`. **Discovered edge
  case, resolved conservatively**: `Sale.warehouseId` is nullable
  (Phase 12's own design) — since the locked spec unconditionally
  requires stock deduction on confirm with no null-warehouse carve-out, a
  Sale with no `warehouseId` can no longer be confirmed at all (400
  Validation Error). This is an additive tightening of Sale's own
  `confirm()` contract, not a new architectural conflict. The existing
  Phase 12 tests that previously confirmed a warehouse-less Sale were
  updated to supply one — the only change made to Phase 12's own test
  expectations; `create()`, `cancel()`, `findAll()`, and every DTO are
  untouched.
- **StockTransfer**: single-step atomic (creation is the whole
  lifecycle, no update/delete endpoint). Rules: source ≠ destination
  (400), both warehouses ACTIVE and in the resolved company (400),
  source must have sufficient stock (409), destination `WarehouseStock`
  row created via the same upsert pattern if it doesn't exist yet.
  **Deterministic multi-warehouse lock ordering**: all required
  `WarehouseStock` rows (source + destination, every item) are collected
  and sorted by the `(warehouseId, productVariantId)` tuple *before any
  lock is acquired* — the specific mechanism preventing the classic
  two-transaction deadlock where concurrent transfers lock the same
  warehouse pair in opposite orders.
- **StockAdjustment**: **single-line flat model** —
  `warehouseId`/`productVariantId`/`quantityChange` live directly on the
  entity, no `StockAdjustmentItem` (the locked spec's §3 high-level list
  mentioned one, but §9's concrete field list is flat and more specific;
  the more literal reading was followed, flagged explicitly as the one
  place the spec's two sections disagreed on an entity's shape). Creation
  immediately mutates stock — no approval workflow. `quantityChange > 0`
  unrestricted; `quantityChange < 0` enforces strict no-negative-stock
  inside the row lock (409); `quantityChange === 0` rejected (400).
  Opening stock = `StockAdjustment` with `reason = OPENING_BALANCE`, not
  a separate entity. Reason catalog:
  `OPENING_BALANCE|DAMAGE|LOSS|FOUND|CORRECTION`. Movement type written
  is `OPENING_BALANCE` specifically when `reason === OPENING_BALANCE`,
  `ADJUSTMENT` otherwise.
- **Concurrency strategy**: pessimistic `SELECT ... FOR UPDATE` via
  `setLock('pessimistic_write')` inside `TransactionService.run()` only —
  the exact `SalesService.generateSaleNumber()`/`PurchaseOrdersService`
  counter-locking pattern (Phase 12/13), applied to `WarehouseStock`
  balance rows and `PurchaseOrderItem` rows. Shared upsert-then-lock
  helper (`lockWarehouseStockRow`/`lockWarehouseStockRows`,
  `src/modules/inventory/utils/stock-lock.ts`) used by all four write
  paths — one implementation, not four copies.
- **Three real concurrency bugs found and fixed during e2e verification**
  (full story in `docs/INVENTORY_ARCHITECTURE.md` §18 — this is the kind
  of thing unit-test mocks cannot catch, which is exactly why the locked
  spec required live, unmocked concurrency tests):
  1. *Disproven hypothesis*: suspected MySQL `UUID()` collision under
     10-way parallel `INSERT ... ON DUPLICATE KEY UPDATE` — switched to
     `crypto.randomUUID()` for candidate primary keys (kept as good
     practice), but the identical failure persisted, disproving this.
  2. *Real bug*: `manager.save()` on an entity hydrated via
     `createQueryBuilder().setLock('pessimistic_write').getOneOrFail()`
     was found to sometimes issue a fresh duplicate INSERT instead of an
     UPDATE against that already-existing, already-locked row — the
     actual cause of the "Duplicate entry" errors. Fixed by replacing
     every such `manager.save()` call with the unambiguous
     `manager.update(Entity, lockedRow.id, { ...changedFields })` across
     all three Phase 14 counter-generation methods, every
     `WarehouseStock` mutation reached via the lock helper (in
     `GoodsReceiptsService`, `StockAdjustmentsService`,
     `StockTransfersService`, and `SalesService.confirm()`). This same
     structural pattern exists unmodified in Phase 12/13's own
     `generateSaleNumber()`/`generatePurchaseOrderNumber()` — flagged as
     a latent, currently-dormant risk there (their own concurrency tests
     pass reliably in practice) rather than silently patched, since
     touching that code was outside this phase's "minimal and additive"
     mandate for Phase 12/13.
  3. *Real bug*: the GoodsReceipt remaining-quantity SUM query was a
     plain (non-locking) `SELECT`, which under MySQL's default
     `REPEATABLE READ` isolation reads from the transaction's own
     consistent snapshot even when it runs after acquiring an unrelated
     row's lock — under-counting concurrently-committed prior receipts
     from other transactions and allowing over-receiving. Fixed by
     adding `.setLock('pessimistic_read')` to force a fresh,
     latest-committed read.
  A dedicated `retryOnDuplicateEntry()` bounded-retry helper
  (`src/modules/inventory/utils/upsert-retry.ts`) was added during the
  investigation as a legitimate defensive measure for the real (if rare)
  InnoDB gap-lock `ER_DUP_ENTRY` behavior under highly concurrent
  first-ever-insert contention — it remains in place but was not itself
  the fix for either real bug above.
- **Strict no-negative-stock (D7)**: every stock-decreasing operation
  (Sale issue, Transfer out, negative Adjustment) validates sufficient
  quantity *inside* the row lock, *inside* the transaction, *before*
  writing the decrease — never `SELECT`-then-check-then-`UPDATE` without
  holding the lock across the whole sequence. No configurable override.
- **RBAC integration (reused, not duplicated; no dead permissions)**:
  exactly 7 new permissions
  (`warehouse_stock.read`, `goods_receipts.read/create`,
  `stock_transfers.read/create`, `stock_adjustments.read/create`) — no
  more, no less, matching the locked spec precisely. Deliberately
  **zero `.update`/`.delete`/`.approve`/`.cancel`** — every seeded
  permission has a real, working endpoint, continuing Phase 13's
  zero-dead-permission precedent. All 7 granted to SUPER_ADMIN, all 4
  resources (`warehouse_stock`, `goods_receipts`, `stock_transfers`,
  `stock_adjustments`) received the standard `RoleResourceScope`
  ALL-scope grant. Verified live via the seed script's own console
  output (7 permissions created, 7 grants, 4 ALL-scope rows) and
  confirmed idempotent on re-run (zero output) after the full migration
  DOWN→UP cycle.
- **DataScope**: `DataScopeService`/`resolveRequestCompanyId()` reused
  completely unmodified — no new scope kind. `WarehouseStock` has no
  `companyId` column of its own; company scoping for `GET
  /warehouse-stock` is resolved by joining through `warehouse.companyId`
  in `WarehouseStockService`, the same "derive scope through the
  entity's real parent" approach Warehouse itself established for
  Branch back in Phase 07.
- **APIs**: `GET/GET-by-id /warehouse-stock`, `GET/GET-by-id/POST
  /goods-receipts`, `GET/GET-by-id/POST /stock-transfers`,
  `GET/GET-by-id/POST /stock-adjustments` — 11 routes total, no
  PATCH/DELETE anywhere (proven by a dedicated e2e test asserting
  404/405 on every resource). Full list and every locked-decision
  rationale in `docs/INVENTORY_ARCHITECTURE.md`.
- **Migration**: `1786570000000-CreateInventoryTables.ts` — ten tables
  in dependency order (`company_goods_receipt_counters` →
  `warehouse_stock` → `stock_movements` → `goods_receipts` →
  `goods_receipt_items` → `company_stock_transfer_counters` →
  `stock_transfers` → `stock_transfer_items` →
  `company_stock_adjustment_counters` → `stock_adjustments`).
  **A real migration bug was found and fixed during UP verification**:
  the first attempt named `stock_adjustments`' foreign keys with an
  `FK_sa_*` prefix, which collided with **two** already-existing
  constraint names in the live database — `sales_accounts.FK_sa_company`
  (Phase 08) and `supplier_addresses.FK_sa_supplier` (Phase 11) — since
  MySQL FK constraint names are unique per-**database**, not per-table
  (unlike index names). Fixed by renaming to the collision-free
  `FK_stkadj_*` prefix, verified against `information_schema.
  TABLE_CONSTRAINTS` directly. Verified UP→DOWN→UP against real
  Dockerized MySQL with actual `SHOW CREATE TABLE` output for all ten
  new tables (correct FKs, correct unique/secondary indexes, InnoDB/
  utf8mb4/utf8mb4_unicode_ci, no soft-delete columns anywhere) — and,
  critically, all pre-existing tables including Phase 13's own
  still-uncommitted `purchase_orders`/`purchase_order_items`/
  `company_purchase_counters` confirmed byte-identical (`SHOW CREATE
  TABLE` re-inspected) before and after the DOWN/UP cycle, with the
  full table count returning to exactly 46 (36 pre-existing + 10 new)
  after the second UP.
- **Tests**: 37 new unit tests across 4 spec files
  (`GoodsReceiptsService`, `StockTransfersService`,
  `StockAdjustmentsService`, `WarehouseStockService`) + 1 new
  `PurchaseOrdersService` unit test (cancel-blocked-by-goods-receipt) +
  4 new `SalesService` unit tests (D5 stock-issue behavior) + 30 new
  e2e tests (`test/inventory.e2e-spec.ts` — GoodsReceipt against
  DRAFT/CANCELLED/CONFIRMED POs, partial receiving, over-receiving
  rejection, exact-final-receipt, cross-company/inactive rejections,
  the goods-receipt-blocks-cancel proof, **two real concurrency tests**
  with `Promise.all()` against live Docker MySQL — one exactly-fits
  10-way parallel receive proving no lost updates, one deliberately
  over-subscribed proving exactly the mathematically-correct number
  succeed/fail — StockTransfer success/insufficient/same-warehouse/
  cross-company/inactive rejections plus a **real concurrency test**
  proving deterministic lock ordering prevents deadlock across 10
  concurrent bidirectional transfers, StockAdjustment positive/negative/
  below-zero/zero-rejected/opening-balance-movement-type, and a
  no-PATCH/DELETE-anywhere proof) + 5 new/modified e2e tests in
  `test/sales.e2e-spec.ts` (D5 stock deduction, insufficient-stock 409
  leaving Sale in DRAFT, null-warehouseId 400, multi-item atomic
  rollback, confirmed-sale stock verification). All pre-existing tests
  continue passing: **383 unit tests (376 passed + 7 DB-gated skips)**;
  full 12-suite e2e regression run in two batches (the same
  Phase-12/13-documented convention) — batch 1 (app/auth/organization/
  master-data/products/rbac) 119/119, batch 2 (customer-supplier/
  user-employee-account/validation/sales/purchase-orders/inventory)
  173/173 — **292 e2e tests total, zero failures**, run fresh against
  the post-migration-cycle schema.
- **Test-authoring bugs found and fixed during this phase's own e2e
  verification** (not implementation bugs): (1) `sales.e2e-spec.ts`'s
  `beforeAll`/`afterAll` cleanup did not account for the four new
  Phase-14 tables (`stock_movements`/`warehouse_stock`/
  `stock_adjustments`/`goods_receipt_items`/`stock_transfer_items`, plus
  the three counter tables) now holding RESTRICT FKs into
  `product_variants`/`warehouses`/`companies` — fixed by adding
  properly-ordered cleanup queries (children before parents, the same
  Phase-09-established convention) in both blocks. (2) One new e2e test
  (`a multi-item sale confirmation is atomic`) created a second company
  price list on top of `setupBaseFixture`'s own one, silently triggering
  Sale's pre-existing "ambiguous price list" 400 rejection instead of
  the intended 409 insufficient-stock path — fixed by reusing the
  fixture's own price list. (3) The documented "transient shell/PATH
  exit-127" flakiness (first seen Phase 11, recurring every phase since)
  recurred once on this phase's own e2e batch-2 run with zero output —
  an immediate identical re-run succeeded cleanly (173/173), consistent
  with every prior phase's experience.
- `docs/INVENTORY_ARCHITECTURE.md` documents the full architecture,
  including the D5 cross-phase-boundary rationale in full, the
  Phase 14/15 `StockMovement` boundary statement, the concurrency
  strategy, the strict no-negative-stock policy, and an explicit, honest
  "Deferred / Not Built" list (reservation workflow, batch/lot/serial/
  expiry, UOM, valuation/FIFO/COGS, Inventory Ledger query API, reorder
  points, approval workflow, Purchase/Sales Return, Redis/BullMQ/events).
- Verified: zero real implementation of Ledger-as-a-query-API, FIFO,
  WeightedAverage, COGS, JournalEntry, GLAccount, ChartOfAccounts,
  Batch, Lot, Serial, Expiry, UOM/UnitConversion, Reservation-as-a-
  real-service, PurchaseReturn, SalesReturn, or Approval-as-a-workflow
  anywhere in `src/modules/inventory` (grepped — the only matches were
  doc-comments explicitly stating these do NOT exist, never real code).
  Zero frontend files touched. No new npm dependencies were added
  (Phase 14 reused Phase 03/04/06/07/09/10/11/12/13's TypeORM/
  validation/transaction/RBAC/organization/products/purchase
  infrastructure entirely).
- **Not committed**: per explicit instruction, this phase's work remains
  uncommitted in the working tree — no `git commit`, no `git push`.
  Phase 09-13's own still-uncommitted changes were left exactly as they
  were, untouched beyond what Phase 14 needed to add (extending, not
  replacing, `rbac.seed.ts`/`typeorm.options.ts`/`app.module.ts`, and
  the two explicitly-authorized additive changes to
  `SalesService.confirm()` and `PurchaseOrdersService.cancel()`).

Known/accepted gaps carried forward:

- No queryable/reportable Inventory Ledger API — `StockMovement` is the
  raw material; Phase 15 is the intended consumer.
- No valuation/costing (FIFO/weighted-average/COGS/GL postings) — Phase
  17's integration point. `GoodsReceiptItem` deliberately omits even an
  optional cost-snapshot field to avoid any appearance of valuation
  logic.
- No batch/lot/serial/expiry tracking anywhere, not even placeholder
  fields.
- No UOM/fractional quantity — `int` throughout, Phase 10's lock stands.
- No reservation workflow — `reservedQuantity` is schema-forward-compat
  only, always 0.
- No reorder points/low-stock alerts.
- No approval workflow for GoodsReceipt/StockTransfer/StockAdjustment —
  all three mutate stock immediately on creation, permission-gated only.
- No Purchase Return / Sales Return entity or reverse-movement logic.
- No Redis/BullMQ/events/messaging — every write is a synchronous
  transactional DB operation.
- A latent, currently-dormant `manager.save()`-on-a-locked-row risk
  (Bug #2 above) exists unmodified in Phase 12/13's own
  `generateSaleNumber()`/`generatePurchaseOrderNumber()` — flagged, not
  fixed, since touching that code was outside this phase's scope. A
  future phase touching that code should consider the same
  `manager.update()` pattern.
- No Bruno API collection — consistent with every prior phase.
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
- The standard e2e test command is now `npm run test:e2e` (which runs
  `jest --runInBand` under the hood as of Phase 07) — do not run the raw
  `jest --config ./test/jest-e2e.json` without `--runInBand` when multiple
  suites depend on shared live RBAC state (any suite touching
  `role_permissions`/`user_roles` globally), or intermittent 403s from
  cross-suite races will result.
- Any controller that needs `DataScopeService.resolveScope()` to actually
  grant access (not just return `null`/"no access") must ensure a
  `RoleResourceScope` row exists for the relevant role+resource — Phase 09
  found that no seed populated this table before its own controllers
  became the first real callers. `rbac.seed.ts` now grants SUPER_ADMIN an
  `ALL`-scope row per Phase 09 resource; any new module wiring a role
  other than SUPER_ADMIN into a `resolveScope()`-gated route must add its
  own `RoleResourceScope` seeding or provisioning — it will not happen
  automatically.
- When an e2e suite's `beforeAll`/`afterAll` bulk-deletes rows from a
  self-referencing table (e.g. `categories.parent_id`), null out the
  self-referencing FK column first — a bulk `DELETE` on rows that
  reference each other via a `RESTRICT` FK can fail non-deterministically
  depending on leftover state from a prior interrupted run (found and
  fixed in Phase 09's `master-data.e2e-spec.ts`).
- Sizing a column that participates in a composite unique index against
  another column requires checking the combined byte length against
  MySQL's 3072-byte max key length for utf8mb4 (4 bytes/char) — a
  `VARCHAR(767)` column paired with a `CHAR(36)` in the same unique index
  overflows this limit (`ER_TOO_LONG_KEY`). Found and fixed in Phase 10's
  `product_variants.combination_key` (corrected to `VARCHAR(300)`); worth
  checking proactively for any future wide unique index rather than
  discovering it at migration time.
- MySQL DDL statements (`CREATE TABLE`, `ALTER TABLE`, etc.) auto-commit
  per-statement, independent of the surrounding transaction — if a
  migration's `up()` fails partway through a multi-table migration, any
  `CREATE TABLE` that already ran before the failure is **not** rolled
  back even though TypeORM reports "ROLLBACK". Found in Phase 10: a
  failed migration attempt left an orphaned, empty `products` table that
  had to be manually dropped (with explicit confirmation) before retrying
  the corrected migration. Check for this kind of leftover state before
  re-running a migration that failed partway through.
- Next phase: **Phase 12 — Sales**. Phase 11's `Customer`, `CustomerGroup`,
  `PaymentTerm`, `CustomerAddress`, and `CustomerContact` entities/
  services/APIs are ready for Phase 12 to reference without any redesign
  — see `docs/CUSTOMER_SUPPLIER_ARCHITECTURE.md`'s "Phase 12/13/16/17
  Integration Points" section for the exact expected contracts:
  `Customer.id` is the one stable cross-phase identity (never
  re-derive); Sales must snapshot Customer name/contact/credit values at
  transaction time, never live-reference mutable Customer fields (same
  "snapshot, don't live-reference" principle
  `docs/PRODUCT_VARIANT_PRICING_ARCHITECTURE.md` established for
  Product/Price); `DataScopeService.resolveAllowedOrganizationIds()`
  remains the reusable resolution contract to call rather than
  re-deriving visibility logic; Phase 12 owns defining the real
  transaction-time Sales Account attribution model that Phase 11
  deliberately left `DataScope.ACCOUNT` unresolved for (no
  `CustomerSalesAccountAssignment` table exists — Phase 12 decides
  whether attribution is per-transaction, not a permanent assignment);
  `Customer.receivableAccountId` remains an inert placeholder awaiting a
  real FK once Phase 17 introduces a Chart of Accounts table.
  `SalesAccountAccessService.getAllowedSalesAccountIds()` (Phase 08)
  remains the separate, still-unconsumed reusable ownership-resolution
  contract Phase 12 should also call — see
  `docs/USER_EMPLOYEE_ACCOUNT_ARCHITECTURE.md`. `Supplier`,
  `SupplierGroup`, `SupplierAddress`, `SupplierContact` are the
  equivalent ready-to-reference identities for **Phase 13 (Purchase)**.
  The frontend `role`/`permissions` response-shape gap (flagged since
  Phase 05) still has a real backend answer via `GET
  /auth/me/permissions` but frontend wiring remains undone (backend-only
  phases so far). The frontend also has three mutually-incompatible
  Company/Branch/Warehouse models and, separately, three
  mutually-incompatible User/Employee/Account-adjacent models
  (`AdminUser`, `AuthUser` with its closed role enum, `Employee`) plus
  zero existing "Sales Account" concept at all — none of these were used
  as a template for Phase 08's schema, and Phase 11 likewise did not use
  any frontend Customer/Supplier shape as a template beyond checking
  naming compatibility; reconciling/building the frontend is a task for
  whenever frontend integration begins, not resolved by Phase 07-11.
- No Audit Log system exists anywhere in this codebase through Phase 11
  (checked and confirmed absent, not merely unmentioned) — if a future
  phase's spec assumes one exists (several phase prompts say "reuse the
  existing Audit Log system if implemented"), that assumption is false;
  building real audit infrastructure is still an open task for whichever
  phase actually needs it, not something to silently skip again.
- Next phase: **Phase 13 — Purchase**. Phase 12's `Sale`, `SaleItem`,
  and `CompanySaleCounter` entities/services/APIs are ready for Phase 13
  to reference or mirror without any redesign — see
  `docs/SALES_ARCHITECTURE.md`'s "Phase 13/14/15/16/17 Integration
  Points" section for the exact expected contracts: `Supplier`/
  `SupplierGroup`/`SupplierAddress`/`SupplierContact` (Phase 11) are the
  ready-to-reference identities Phase 13 needs, the same way `Customer`
  was for Phase 12; the `company_sale_counters` /
  `SELECT ... FOR UPDATE`-inside-the-same-transaction pattern
  established in `SalesService.generateSaleNumber()` is the direct,
  reusable template for Purchase Order document numbering — the same
  concurrent-duplicate race applies identically, and a
  `company_purchase_counters` (or equivalent) table following the exact
  same shape is the recommended approach rather than re-deriving a new
  numbering strategy; `TransactionService.run()` + "resolve/validate
  before opening the transaction, do all writes inside one transaction
  via the passed EntityManager" is the same transactional-creation
  template `SalesService.create()` used, worth reusing verbatim for
  Purchase Order creation. Phase 13 also inherits Phase 12's own
  deferrals: no tax engine, no audit log, no approval workflow, no
  inventory/payment/accounting logic — these remain open for whichever
  future phase actually owns them, not silently assumed solved by
  Phase 12 or expected to be solved by Phase 13.
- The full e2e suite (`npm run test:e2e`, which runs
  `jest --config ./test/jest-e2e.json --runInBand` under the hood)
  intermittently produced an exit-127 with zero output when all 10 e2e
  suites ran together as one process during Phase 12's own verification
  session — the same class of "transient shell/PATH exit-127" issue
  Phase 11's session first documented, now confirmed to recur and scale
  with total suite count/runtime rather than being a one-off fluke.
  Direct invocation of the underlying jest binary
  (`./node_modules/.bin/jest --config ./test/jest-e2e.json --runInBand
  <specific spec files>`) in smaller batches (verified: all 10 suites'
  worth of tests, split across 3-4 batches of 2-5 suites each) passed
  cleanly and repeatably every time with real `SHOW CREATE TABLE`-level
  evidence behind each pass. If a future session hits the same exit-127
  with empty output on the full single-invocation run, split the suite
  list into smaller batches via explicit file arguments rather than
  assuming a real test failure — check for actual jest output first.
- Next phase: **Phase 14 — Inventory**. Phase 13's `PurchaseOrder`,
  `PurchaseOrderItem`, and `CompanyPurchaseCounter` entities/services/
  APIs are ready for Phase 14 to reference or mirror without any
  redesign — see `docs/PURCHASE_ARCHITECTURE.md`'s §17/§21 ("Phase 14
  Inventory integration point" / "Goods Receipt — explicitly deferred to
  Phase 14") for the exact expected contract: `PurchaseOrderItem.productVariantId`
  + `PurchaseOrderItem.quantity` + `PurchaseOrder.warehouseId` are the
  exact fields a real Goods Receipt / stock-increase flow should consume
  when receiving against a `CONFIRMED` PurchaseOrder — the direct
  inbound-stock mirror of how `docs/SALES_ARCHITECTURE.md` §23 frames
  `SaleItem.productVariantId` + `quantity` + `Sale.warehouseId` as the
  outbound (stock-decrease) trigger for the same future Inventory phase.
  No fake stock-check, receiving-quantity field, or `PARTIALLY_RECEIVED`/
  `RECEIVED` status was added to `PurchaseOrder` in Phase 13 to simulate
  this — Phase 14 owns introducing `GoodsReceipt`/`GoodsReceiptItem` and
  any receiving-quantity/remaining-quantity tracking entirely from
  scratch. Phase 14 also inherits Phase 13's own deferrals: no tax
  engine, no audit log, no approval workflow, no payment/accounting
  logic, no buyer/requester attribution model (Decision #9 was Purchase-
  specific and does not need to be re-litigated by Phase 14 unless
  Inventory has its own reason to introduce one) — these remain open for
  whichever future phase actually owns them.
- The full e2e suite intermittently hitting a "transient shell/PATH
  exit-127" with zero output (first documented in Phase 11, recurring in
  Phase 12) recurred again once during Phase 13's own verification
  session on a single `jest --config ./test/jest-e2e.json --runInBand
  test/purchase-orders.e2e-spec.ts` invocation — confirming this is a
  general environment flakiness affecting even small, single-file
  invocations on this machine, not something that only appears at
  higher suite counts. Immediately re-running the exact same command
  succeeded cleanly (38/38 tests passed) with no code changes — treat a
  bare exit-127 with no jest summary output as a signal to retry the
  identical command before assuming a real failure.
- A general testing lesson from Phase 13: when an e2e assertion fails,
  check whether the *test* or the *implementation* is wrong before
  changing either — two of this phase's own e2e tests initially failed
  for test-authoring reasons, not implementation bugs (a helper missing
  a required `?companyId=` query param under SUPER_ADMIN's ALL scope,
  and a wrong assumption that a cross-company FK lookup would 400 instead
  of the actually-correct, already-established 404 IDOR-hiding
  convention). Both were root-caused by reading the actual service code
  the assertion was targeting before editing anything.
- Next phase: **Phase 15 — Inventory Ledger**. Phase 14's `StockMovement`
  table (`src/modules/inventory/entities/stock-movement.entity.ts`) is
  the exact raw material Phase 15 is expected to build a queryable/
  reportable ledger on top of — every stock-quantity change anywhere in
  the system (`PURCHASE_RECEIPT`/`SALE_ISSUE`/`TRANSFER_IN`/
  `TRANSFER_OUT`/`ADJUSTMENT`/`OPENING_BALANCE`) already has exactly one
  corresponding append-only row, complete with `quantityChange`, a
  denormalized `quantityAfter` snapshot, and a polymorphic
  `referenceType`/`referenceId` pointer back to whichever document
  (`GoodsReceipt`/`Sale`/`StockTransfer`/`StockAdjustment`) caused it.
  Phase 14 deliberately built **no** query/list/report endpoint for this
  table at all — `GET /warehouse-stock` only exposes the current balance,
  never history — so Phase 15's entire job is a new read-side surface
  (date-range filtering, running-balance reconstruction, per-document
  drill-down, export) layered on top of a table whose write path is
  already complete and stable; no schema migration of `stock_movements`
  itself should be needed unless Phase 15 discovers a genuine gap. Phase
  14 also inherits forward the same deferrals Phase 12/13 already
  carried (no tax engine, no audit log, no approval workflow, no
  payment/accounting logic) plus its own new ones — no valuation/FIFO/
  weighted-average/COGS (Phase 17's integration point;
  `docs/INVENTORY_ARCHITECTURE.md` §13 documents exactly what Phase 17
  will need to add), no batch/lot/serial/expiry, no UOM, no reservation
  workflow beyond the always-zero `reservedQuantity` schema column, no
  reorder points, no Purchase/Sales Return. See
  `docs/INVENTORY_ARCHITECTURE.md`'s "Phase 15 Inventory Ledger
  Boundary" and "Deferred / Not Built" sections for the complete,
  explicit list — none of these were silently assumed solved by Phase 14
  or expected to be solved by Phase 15 without a fresh, explicit design
  pass.
- A real, evidence-backed concurrency lesson from Phase 14, worth
  remembering for any future phase adding a new locked-read-then-mutate
  pattern: `manager.save(Entity, entityHydratedViaSetLockGetOneOrFail)`
  is not always safe — it was found, via real (not mocked) concurrency
  e2e tests, to sometimes issue a duplicate INSERT instead of an UPDATE
  against an already-existing, already-locked row, producing a
  `Duplicate entry` error that looks like a UUID collision or a raw
  InnoDB gap-lock issue but is neither. The fix is
  `manager.update(Entity, lockedRow.id, { ...changedFields })`, which is
  unambiguous. This exact pattern still exists unmodified in Phase
  12/13's own sale-number/purchase-order-number counter generation
  (their own tests pass reliably in practice, so it was flagged rather
  than fixed, per this phase's "minimal and additive" mandate) — a
  future phase touching that code should apply the same fix
  proactively rather than waiting to rediscover the bug under load.
  Separately: a plain (non-locking) `SELECT` inside a transaction under
  MySQL's default `REPEATABLE READ` isolation reads from that
  transaction's own consistent snapshot, established at the transaction's
  start — **not** the latest committed data — even when the `SELECT`
  runs after acquiring an unrelated row's pessimistic lock earlier in the
  same transaction. Any future aggregate/SUM read that needs to see
  concurrently-committed data from other transactions (the way Phase
  14's GoodsReceipt remaining-quantity computation does) must add
  `.setLock('pessimistic_read')` (or an equivalent locking read) — a
  plain `SELECT` there will silently under-count and can allow a
  business-rule violation (over-receiving, in Phase 14's case) to slip
  through concurrency tests that only check the trivial single-request
  path.

### Phase 15 — Inventory Ledger

Status: Completed.

- **Boundary**: a purely read-only query layer over Phase 14's
  `StockMovement` (append-only log) and `WarehouseStock` (live balance)
  tables — exactly the "Phase 14 writes, Phase 15 queries" boundary
  `docs/INVENTORY_ARCHITECTURE.md` §3/§14 had already flagged as this
  phase's job. No new entity, no new migration, no new table, and **zero
  modifications** to any Phase 12/13/14 file — `SalesService`,
  `PurchaseOrdersService`, `GoodsReceiptsService`, `StockTransfersService`,
  `StockAdjustmentsService`, `WarehouseStockService`, and every entity
  under `src/modules/inventory/entities/` are byte-identical to their
  pre-Phase-15 state (confirmed via `git diff`, zero output on all of
  them). `InventoryLedgerService`/`InventoryLedgerController` were added
  additively inside the already-registered `InventoryModule` — `app.module.ts`
  and `src/database/typeorm.options.ts` needed **no changes**, since Phase
  14 had already registered every entity this phase reads.
- **Four GET-only endpoints, no write endpoint of any kind**: `GET
  /inventory-ledger` (filtered/paginated/sorted list), `GET
  /inventory-ledger/:id` (company-scoped detail, 404 on cross-company/
  nonexistent), `GET /inventory-ledger/stock-card` (chronological
  per-`(warehouseId, productVariantId)` movement history with computed
  running balances), `GET /inventory-ledger/reconciliation` (diagnostic
  comparison of `SUM(StockMovement.quantityChange)` against live
  `WarehouseStock.onHandQuantity`). No `POST`/`PATCH`/`DELETE` anywhere —
  proven by a dedicated e2e test asserting 404/405 on all three against
  `/inventory-ledger`.
- **List filters** (`GET /inventory-ledger`, all applied at the
  query-builder level, never load-all-then-filter-in-JS): `warehouseId`,
  `productVariantId`, `movementType`, `referenceType`, `referenceId`,
  plus a genuinely new filter shape for this codebase — `fromDate`/
  `toDate` (ISO-8601, `@IsDateString()`) — no prior list DTO
  (`ListSalesDto`, `ListPurchaseOrdersDto`) had date-range filtering
  before this phase. `fromDate > toDate` is rejected with 400, never
  silently swapped. Standard `page`/`limit`/`sort`/`order` reused via the
  existing Phase 04 `PaginationDto`/`resolveSortField()` completely
  unmodified, with an explicit minimal sortable-column allowlist
  (`createdAt` default, `quantityChange`, `movementType`) and a
  `movement.id ASC` deterministic tiebreak always appended so paginated
  results never duplicate/skip a row on a shared `createdAt`.
- **Stock Card**: requires `warehouseId` + `productVariantId` (400 if
  either missing, checked in the service layer rather than via decorator,
  matching this codebase's existing required-together-fields convention).
  Returns every matching movement in strict `createdAt ASC, id ASC` order
  — the `id` tiebreak is load-bearing, never relying on natural DB
  ordering. `balanceBefore`/`balanceAfter` are **never persisted** — both
  are computed only in the response DTO
  (`toStockCardEntryResponseDto()`): `balanceAfter = quantityAfter`
  verbatim, `balanceBefore = quantityAfter - quantityChange`. Verified
  against a real mixed sequence (`OPENING_BALANCE → PURCHASE_RECEIPT →
  SALE_ISSUE → TRANSFER_OUT → ADJUSTMENT`) built entirely through real
  Phase 14 write-path API calls in the e2e suite, asserting the exact
  expected running balance at every step and cross-checking the final
  value against a live `GET /warehouse-stock` call.
- **Reconciliation diagnostic**: `ledgerBalance =
  SUM(StockMovement.quantityChange)`, `warehouseStockBalance =
  WarehouseStock.onHandQuantity` (0 for an untouched pair — the same
  lazy-creation semantics `WarehouseStockService` already relies on),
  `difference = warehouseStockBalance - ledgerBalance`, `reconciled =
  difference === 0`. Purely diagnostic — never writes, never "fixes"
  anything. Under correct Phase 14 code every real pair is always
  reconciled (each write path mutates both tables inside the same
  transaction), so the e2e suite proves the reconciled-true case through
  real writes and separately proves the formula's own correctness by
  independently recomputing both sides directly against the live tables
  via `dataSource.query()` — it does **not** manufacture an artificial
  `reconciled: false` case by writing directly to
  `stock_movements`/`warehouse_stock`, since the locked spec explicitly
  frames direct data tampering as inappropriate here. Both directions of
  a nonzero `difference` (`WarehouseStock` above vs. below the ledger
  sum) are covered at the unit-test level instead, where mocking the two
  compared values independently is a legitimate way to test the
  comparison arithmetic without touching real data.
- **DataScope/company scoping**: `DataScopeService`/
  `resolveRequestCompanyId()` reused completely unmodified — no new scope
  kind. Company scoping resolved by joining through
  `warehouse.companyId` in every query, the same "derive scope through
  the entity's real parent" pattern `WarehouseStockService` itself
  established in Phase 14 (`StockMovement`, like `WarehouseStock`, has no
  `companyId` column of its own). Cross-company filters/ids never leak
  existence — list/reconciliation queries return an empty/zero result,
  `:id` detail lookups return 404, matching the IDOR-hiding convention
  every phase since Phase 09 has followed.
- **RBAC**: exactly one new permission, `inventory_ledger.read` — no
  `.create`/`.update`/`.delete`, since Phase 15 has no write endpoint at
  all. Appended (not restructured) to the existing idempotent seed
  (`src/database/seeds/rbac.seed.ts`), granted to `SUPER_ADMIN`, plus the
  now-standard `RoleResourceScope` `ALL`-scope grant for
  `inventory_ledger`. Verified live via the seed script's own console
  output on first run (one permission created, one grant, one ALL-scope
  row) and confirmed idempotent on re-run (zero output beyond the
  completion line).
- **Migration**: **none** — zero new migration files (still exactly the
  same 10 files under `src/database/migrations/`). `SHOW CREATE TABLE
  stock_movements` and `SHOW CREATE TABLE warehouse_stock` were
  re-inspected against live Dockerized MySQL after implementation and
  match Phase 14's original column/index/constraint definitions exactly
  — confirmed no drift on either table, no new table created.
- **Tests**: 30 new unit tests (`inventory-ledger.service.spec.ts` —
  every filter dimension, invalid-date-range rejection, pagination,
  sorting including the allowlist rejection, `balanceBefore`/
  `balanceAfter` derivation for positive/negative/zero-crossing
  `quantityChange`, reconciliation for both the reconciled and
  non-reconciled — both directions — cases, cross-company `findByIdInCompany`
  isolation) + 28 new e2e tests (`test/inventory-ledger.e2e-spec.ts` —
  authentication 401, permission-boundary 403, the no-POST/PATCH/DELETE
  proof, list empty/populated/every-filter-dimension/pagination/
  deterministic-ordering, detail existing/missing/cross-company, stock
  card required-params/full-mixed-real-sequence-with-correct-running-
  balances/warehouse-and-variant-isolation, reconciliation required-params/
  real-reconciled-case/untouched-pair-zero-case/independently-recomputed-
  formula-correctness, cross-company/unauthorized-scope rejection) — all
  built by reusing Phase 14's real write-path APIs
  (`POST /goods-receipts`, `POST /sales/:id/confirm`,
  `POST /stock-transfers`, `POST /stock-adjustments`) as fixtures, never
  by inserting `StockMovement` rows directly via a repository (which
  would bypass the exact write path this phase is validating against).
  **No concurrency test was added** — this phase introduces no write
  operation of any kind, so a manufactured concurrency test would be
  artificial; stated explicitly here rather than silently skipped, per
  the locked spec's own instruction. All pre-existing tests continue
  passing: full unit suite **406 passed + 7 DB-gated skips (413 total)**;
  full 13-suite e2e regression run in the same two-batch convention prior
  phases used — batch 1 (app/auth/organization/master-data/products/rbac)
  **119/119**, batch 2 (customer-supplier/user-employee-account/
  validation/sales/purchase-orders/inventory/inventory-ledger)
  **201/201** — **320 e2e tests total, zero failures**.
- **Test-authoring bugs found and fixed during this phase's own e2e
  verification** (not implementation bugs): (1) the e2e fixture's
  `createSale()` helper initially omitted the required `currency` field
  from `CreateSaleDto`, causing every sale creation to 400 and silently
  producing zero `SALE_ISSUE` movements in three tests — fixed by adding
  `currency: 'USD'` and a fail-fast status check that throws with the
  full response body on any non-201, so the real cause (missing field, not
  a Phase 14/15 bug) was immediately visible instead of surfacing only as
  a downstream count mismatch. (2) the price-list-item fixture helper
  initially sent `companyId` in the request body instead of as a query
  param and used a bare-date `validFrom` instead of a full ISO datetime,
  causing "No active price found" 400s on sale creation — fixed by
  matching `test/sales.e2e-spec.ts`'s own
  `createActivePriceListItem()` convention exactly
  (`?companyId=` query param, `validFrom: '2020-01-01T00:00:00Z'`). (3)
  the documented "transient shell/PATH exit-127" flakiness (first seen
  Phase 11, recurring every phase since) recurred once on this phase's
  own e2e batch-2 run with zero output — an immediate identical re-run
  succeeded cleanly (201/201), consistent with every prior phase's
  experience.
- `docs/INVENTORY_ARCHITECTURE.md` §19 documents the full architecture
  additively (a new section appended after Phase 14's existing §1–§18,
  none of which were rewritten or restructured) — the read-only
  guarantee, the full API surface and filter set, the
  `balanceBefore`/`balanceAfter` derivation formula, the reconciliation
  semantics, the RBAC grant, and an explicit "schema unchanged" statement
  with live verification evidence.
- Verified: zero real implementation of `InventoryLedgerEntry`,
  `InventoryValuation`, `CostLayer`, `FIFOLayer`, `AverageCost`, `COGS`,
  `JournalEntry`, `GLAccount`, `AuditLog`, or `Outbox` anywhere in the new
  Phase 15 files (grepped — no matches at all, not even doc-comments,
  since none of these concepts are relevant to a pure query layer). Zero
  new migration files. Zero modifications to
  `src/modules/sales/services/sales.service.ts`,
  `src/modules/purchase/services/purchase-orders.service.ts`, or any file
  under `src/modules/inventory/entities/` or
  `src/modules/inventory/services/warehouse-stock.service.ts`/
  `goods-receipts.service.ts`/`stock-transfers.service.ts`/
  `stock-adjustments.service.ts` (confirmed via `git diff`, byte-identical
  to their pre-Phase-15 state). Zero frontend files touched. No new npm
  dependencies were added (Phase 15 reused Phase 03/04/06/08/09/14's
  TypeORM/validation/transaction/RBAC/organization/inventory
  infrastructure entirely).
- **Not committed**: per explicit instruction, this phase's work remains
  uncommitted in the working tree — no `git commit`, no `git push`.
  Phase 09-14's own still-uncommitted changes were left exactly as they
  were, untouched beyond the two additive edits (`inventory.module.ts`,
  `rbac.seed.ts`) this phase needed to make.

Known/accepted gaps carried forward:

- No CSV/export functionality for the ledger list or stock card — the
  locked spec's own scope did not require one; a future phase could add
  it as a pure additive endpoint on top of the same read-only query
  layer.
- No per-document drill-down convenience endpoint (e.g. resolving
  `referenceType`/`referenceId` into the actual `GoodsReceipt`/`Sale`/
  `StockTransfer`/`StockAdjustment` record inline) — the polymorphic
  `referenceType`/`referenceId` pair is returned as-is; a caller wanting
  the full referenced document today must make a second request to that
  document's own existing endpoint.
- Valuation/FIFO/weighted-average/COGS/accounting postings remain
  entirely out of scope — still explicitly Phase 17's concern (§13 of
  `docs/INVENTORY_ARCHITECTURE.md`, unchanged by this phase).
- No Bruno API collection — consistent with every prior phase.
- `@nestjs/swagger`'s transitive `js-yaml` advisory (unchanged since
  Phase 01, dev-time only).

### Phase 16 — Payment

Status: Completed.

- **Boundary**: exactly four entities — `Payment`, `PaymentAllocation`,
  `PaymentMethod`, `CompanyPaymentCounter` — in a new
  `src/modules/payments/` module. Confirmed live: it does not depend on
  `InventoryModule`, and no `/inventory-ledger` read was needed — Phase
  15's own "most likely integration point" speculation did not apply,
  which is stated honestly here rather than forced into existing.
- **Payment / PaymentAllocation**: `Payment` is the dedicated,
  authoritative record (never embedded in Sale/PurchaseOrder), with a
  single `direction` enum (`RECEIPT`|`PAYMENT`) covering both customer
  receipts and supplier payments — exactly one of `customerId`/
  `supplierId` set, matching direction, enforced in the service layer
  (no DB `CHECK`, matching every prior phase's own convention).
  `PaymentAllocation.referenceType`/`referenceId` is a polymorphic,
  **no-FK** pointer at a `Sale` or `PurchaseOrder` row — a direct,
  deliberate reuse of `StockMovement.referenceType`/`referenceId`'s
  established Phase 14 precedent, not a new pattern. `PaymentAllocation`
  does not extend `BaseEntity` (own `id`/`createdAt` only, no
  soft-delete/`updatedAt`), mirroring `SaleItem`/`PurchaseOrderItem`;
  `paymentId` is `ON DELETE CASCADE` (the one deliberate CASCADE in this
  schema, matching `GoodsReceiptItem`/`StockTransferItem`'s own
  precedent).
- **PaymentMethod**: real, company-scoped master data (`code`/`name`/
  `status` enum, `UNIQUE(company_id, code)`), a direct structural mirror
  of Phase 09's `Category`/`Brand` — `status` is an `ACTIVE`/`INACTIVE`
  enum, not a boolean, matching the codebase's own master-data
  convention exactly. Deliberately smaller API surface than Brand/
  Category: `GET`(list+detail)/`POST` only, no PATCH/activate/
  deactivate/DELETE — the locked spec's own API surface for this
  resource, not an oversight.
- **Lifecycle decision (D4)**: every `Payment` is created directly
  `CONFIRMED` — no separate `DRAFT` stage, no `POST /payments/:id/confirm`
  endpoint. Reasoning (full version in `docs/PAYMENT_ARCHITECTURE.md`
  §6): allocation happens inside the same `POST /payments` call the
  locked spec requires, so a DRAFT stage would carry no distinct
  behavior — building a confirm endpoint that does nothing but flip a
  status column would be inventing an inert state the locked spec's own
  instruction explicitly warned against. `PaymentStatus.Cancelled`
  remains in the enum for shape symmetry with `SaleStatus`/
  `PurchaseOrderStatus`, but nothing in this phase ever assigns it — a
  cancel that doesn't reverse the balance effect it caused would leave
  the system lying about `paidAmount`, so no cancel endpoint was built
  either (stated honestly as a real, considered decision, not a silent
  gap).
- **Sales/Purchase integration — the cross-phase-boundary change (D16,
  EXPLICITLY AUTHORIZED)**: `SalesService` and `PurchaseOrdersService`
  each gained exactly one new method, `applyPayment(id, companyId,
  allocatedAmount, userId, manager)` — locks the target row itself
  (`setLock('pessimistic_write')`, company-scoped in the same query),
  computes `newPaid = oldPaid + allocated` / `newBalance = grandTotal -
  newPaid`, rejects (409) if `newPaid > grandTotal`, and writes via
  `manager.update()` — never `manager.save()` on the lock-hydrated
  entity, deliberately avoiding the exact bug class Phase 14 already
  found and fixed once. Neither service opens its own transaction inside
  `applyPayment()` — it participates in `PaymentsService`'s single
  `TransactionService.run()` call. **Verified via manual `git diff`
  review** (not just assertion): `sales.service.ts`'s diff against its
  Phase-12-commit baseline shows only the Phase-14 `confirm()` stock-
  deduction block (pre-existing, already in the working tree before this
  phase started) plus the new `applyPayment()` method appended at the
  end — `create()`, `cancel()`, `findAll()`, `findByIdInCompany()`, and
  every private helper are byte-identical. `purchase-orders.service.ts`
  is entirely untracked (all of Phase 13 was never committed), so `git
  diff` has no baseline to compare against for it; confirmed instead by
  method-signature enumeration (`grep -n "^  async \|^  private "`)
  showing every original method present in original order with only
  `applyPayment()` newly appended, consistent with this phase's single,
  additive `Edit` call against that file (511 lines → 561 lines, a net
  +50 matching the new method's exact length).
- **Numbering (D6)**: `CompanyPaymentCounter`, an exact structural mirror
  of `CompanySaleCounter`/`CompanyPurchaseCounter`/
  `CompanyGoodsReceiptCounter`/`CompanyStockTransferCounter`/
  `CompanyStockAdjustmentCounter` — same upsert-then-`SELECT...FOR
  UPDATE`-lock pattern, same `retryOnDuplicateEntry()` wrapper reused
  verbatim from Phase 14, same `formatDocumentNumber()` formatter reused
  verbatim (prefix `PMT`, e.g. `PMT-2026-000001`).
- **Deterministic multi-document locking (locked spec §8/step 9)**: a
  single payment's allocations can reference multiple distinct
  Sale/PurchaseOrder rows; `PaymentsService.create()` deduplicates every
  `(referenceType, referenceId)` target, sums per-target allocation
  amounts, sorts the target list by `(referenceType, referenceId)`
  **before acquiring any lock**, then calls `applyPayment()` once per
  target in that order — the exact `StockTransfersService` (Phase 14)
  deadlock-prevention pattern, generalized from `(warehouseId,
  productVariantId)` tuples to `(referenceType, referenceId)` tuples.
- **Idempotency (D11)**: optional `Idempotency-Key` header →
  `Payment.idempotencyKey` (nullable, `UNIQUE(company_id,
  idempotency_key)` — MySQL's multiple-NULLs-don't-collide behavior
  confirmed live). Two-layer protection: a pre-transaction lookup returns
  the existing payment (200, not 201) on a known key; a race backstop
  catches the `ER_DUP_ENTRY`/errno 1062 the losing side of two truly
  concurrent same-key requests raises against the unique index (narrowed
  to that specific index by its error message, so an unrelated
  duplicate-key failure is never misread as a replay) and re-fetches the
  winning row instead of erroring or duplicating. Proven live by a
  same-key-replay e2e test and a same-key-different-company e2e test
  (must NOT collide — proven non-colliding).
- **RBAC**: exactly four new permissions —
  `payments.read`/`payments.create`, `payment_methods.read`/
  `payment_methods.create` — no `.update`/`.delete`/`.confirm`/`.refund`/
  `.reverse`/`.void`/`.export`/`.summary`/`.reconcile` for either
  resource (verified live: the seed's first run printed exactly 4 new
  permissions/4 grants/2 `ALL`-scope rows; a re-run printed only the
  completion line, idempotent).
- **APIs**: `GET /payments`, `GET /payments/:id`, `POST /payments`
  (Idempotency-Key honored) — no PATCH/DELETE/refund/reverse/void/
  summary/reconciliation/export endpoint of any kind, and deliberately
  no `POST /payments/:id/confirm` (see the D4 lifecycle decision above).
  `GET /payment-methods`, `GET /payment-methods/:id`,
  `POST /payment-methods`. Full list in `docs/PAYMENT_ARCHITECTURE.md`.
- **Migration**: `1786580000000-CreatePaymentTables.ts` — four tables in
  dependency order (`payment_methods` → `company_payment_counters` →
  `payments` → `payment_allocations`). **A real FK-name collision was
  found and fixed during first UP verification**: the migration's first
  draft named `company_payment_counters`' FK `FK_cpc_company`, which
  collided with `company_purchase_counters`' own `FK_cpc_company` from
  Phase 13's migration (`ER_FK_DUP_NAME`) — renamed to
  `FK_cpymtc_company`. The failed first attempt left orphaned
  `payment_methods`/`company_payment_counters`/`payments`/
  `payment_allocations` tables (MySQL DDL auto-commits per-statement,
  independent of the migration's own transaction — the same lesson
  Phase 10 first documented), manually dropped before the corrected
  migration's clean run. Verified UP → DOWN → UP against real Dockerized
  MySQL with `SHOW CREATE TABLE` inspection of all four tables
  (confirming correct `DECIMAL(14,2)` money columns, `ON DELETE
  RESTRICT` everywhere except `payment_allocations.payment_id`'s
  deliberate `ON DELETE CASCADE`, and the `UNIQUE(company_id,
  idempotency_key)` index), with an explicit re-check after every step
  that all Phase 13/14/15 tables (`purchase_orders`, `goods_receipts`,
  `warehouse_stock`, `stock_movements`, `stock_transfers`,
  `stock_adjustments`, and their three counters) remained present and
  untouched — 51 tables before, 51 after DOWN removed the 4 new ones
  (leaving only the pre-existing `payment_terms` table under the
  `payment%` pattern), 55 after UP restored them.
- **Tests**: 24 new unit tests (`payments.service.spec.ts`,
  `payment-methods.service.spec.ts`) + 9 new unit tests appended to the
  existing `sales.service.spec.ts`/`purchase-orders.service.spec.ts`
  (`applyPayment()` — lock verification, NotFound on missing row, correct
  `paidAmount`/`balanceAmount` arithmetic via `manager.update()`,
  over-allocation 409 rejection) + 27 new e2e tests
  (`test/payments.e2e-spec.ts` — auth/permission boundaries, no-PATCH/
  DELETE/refund proof, RECEIPT-against-Sale and PAYMENT-against-
  PurchaseOrder full flows with real balance verification, partial
  payment, over-allocation 409 (both single-payment and cumulative-
  second-payment forms), direction/referenceType cross-validation (all 4
  combinations), DTO validation (unknown fields, empty allocations,
  over-summed allocations, inactive payment method, cross-company 404),
  idempotency (replay returns 200 + same id, cross-company non-collision),
  a real `Promise.all()` two-way concurrency test proving over-allocation
  is prevented under genuine concurrent load (exactly one 201 + one 409,
  final `paidAmount` exactly correct, exactly one `payments` row
  survives), a real 10-way concurrent `POST /payments` payment-number-
  uniqueness test, PaymentMethod CRUD-surface tests, and GET list/detail
  including cross-company 404). All 27 pass — verified against live
  Docker MySQL (`node node_modules/jest/bin/jest.js --config
  ./test/jest-e2e.json --runInBand --testPathPatterns payments.e2e-spec`,
  22.95s, 0 failures).
- **Test-authoring bug found and fixed during this phase's own e2e
  verification** (not an implementation bug): the e2e suite's cleanup
  function initially deleted `product_variants` before deleting
  `stock_adjustments` rows referencing them (left over from an earlier
  interrupted run of this same suite), causing every test to fail in
  `beforeAll` with `FK_stkadj_product_variant` `RESTRICT` errors — the
  same category of bug Phase 09 first found and fixed for `categories`'
  self-referencing FK. Fixed by adding `DELETE FROM stock_adjustments`
  and `DELETE FROM company_stock_adjustment_counters` (scoped to this
  suite's own warehouses) before the existing `product_variants` cleanup,
  matching the "children before parents" convention every e2e suite
  since Phase 09 has followed.
- Security review performed and verified live: unauthenticated → 401,
  authenticated-without-permission → 403, cross-company Customer/
  Supplier/PaymentMethod/Sale/PurchaseOrder/Payment → 404 (IDOR-safe,
  never a leaked existence signal), direction/party mismatch (RECEIPT
  with both or neither of customerId/supplierId set, PAYMENT the same) →
  400, referenceType/direction mismatch → 400, over-allocation (against a
  single document's grandTotal, or against the payment's own amount
  across all allocations) → 409/400, unknown/extra fields → 400 (existing
  global `ValidationPipe`), idempotency-key replay → 200 with the
  original payment body, no refund/reverse/void/PATCH/DELETE endpoint
  anywhere → 404/405.
- `docs/PAYMENT_ARCHITECTURE.md` documents the full architecture,
  including the D4 lifecycle reasoning, the D16 cross-phase integration
  rationale, the deterministic multi-document locking design, the
  idempotency strategy, and the explicit Phase 16-vs-Phase-17 running-
  balance-vs-Chart-of-Accounts boundary (per
  `docs/CUSTOMER_SUPPLIER_ARCHITECTURE.md` §18's own advance framing).
- Verified: zero real implementation of `JournalEntry`/`GLAccount`/
  `ChartOfAccounts`/`GeneralLedger`/`CashAccount`/`BankAccount`/
  `ExchangeRate`/`Refund`/`Reversal`/`Void`(-as-a-concept)/`SalesReturn`/
  `PurchaseReturn`/`AuditLog`/`Outbox`/`BullMQ`/`Redis`, and zero
  mutation of `WarehouseStock`/`StockMovement`/`GoodsReceipt`/
  `StockTransfer`/`StockAdjustment`, anywhere in `src/modules/payments`
  or in the two modified Sales/Purchase files (grepped — the only matches
  were doc-comments explicitly stating these concepts do NOT exist here,
  plus three incidental `Promise<void>` TypeScript return-type matches,
  never real implementation). Zero frontend files touched. No new npm
  dependencies were added (Phase 16 reused Phase 03/04/06/08/09/11/12/13/
  14's TypeORM/validation/transaction/RBAC/organization/customer-
  supplier/sales/purchase/inventory infrastructure entirely).
- **Not committed**: per explicit instruction, this phase's work remains
  uncommitted in the working tree — no `git commit`, no `git push`.
  Phase 09-15's own still-uncommitted changes were left exactly as they
  were, untouched beyond the two additive `applyPayment()` method
  additions this phase needed to make.

Known/accepted gaps carried forward:

- No refund/reversal/void of any kind — a deliberate, documented D10
  deferral (see `docs/PAYMENT_ARCHITECTURE.md` §15), not an oversight.
  `PaymentStatus.Cancelled` exists in the enum but nothing in this phase
  ever assigns it.
- No accounting/GL integration, not even a prepared interface — Phase
  17's concern entirely (see `docs/PAYMENT_ARCHITECTURE.md` §13).
- No `Currency` entity, no exchange rates, no multi-currency conversion.
- No Bruno API collection — consistent with every prior phase.
- `@nestjs/swagger`'s transitive `js-yaml` advisory (unchanged since
  Phase 01, dev-time only).

### Phase 17 — Accounting / General Ledger

Status: Completed.

- **Boundary**: six new entities in a new `src/modules/accounting/`
  module — `Account`, `CompanyJournalCounter`, `FiscalYear`,
  `AccountingPeriod`, `JournalEntry`, `JournalEntryLine`. No
  `general_ledger`/`opening_balances`/`cash_accounts`/`bank_accounts`/
  `tax_accounts` table — `JournalEntry`+`JournalEntryLine` are the SOLE
  accounting source of truth; General Ledger and Trial Balance are pure
  read-query projections over posted journal lines
  (`GeneralLedgerService`/`TrialBalanceService`), never physical tables.
- **Account (Chart of Accounts)**: company-scoped, self-referencing
  (`parentId -> accounts`), a direct structural mirror of Phase 09's
  `Category` — `UNIQUE(company_id, code)`, cycle prevention
  (`AccountsService.assertNoCycle()`, byte-for-byte the same algorithm as
  `CategoriesService`'s own), cross-company parent rejected. `accountType`
  is exactly the five standard classifications
  (`ASSET|LIABILITY|EQUITY|REVENUE|EXPENSE`) — no speculative CASH/BANK/
  RECEIVABLE/PAYABLE/COGS subtype, since nothing in the actual posting
  logic branches on it (which specific account is used comes from
  `PaymentMethod.glAccountId`/`Customer.receivableAccountId`/
  `Supplier.payableAccountId` instead). No DELETE endpoint — deactivation
  (`PATCH isActive:false`) is the only lifecycle transition.
- **Journal lifecycle**: `DRAFT -> POSTED` (terminal, immutable — no
  PATCH/DELETE on a POSTED journal, no reversal endpoint) or
  `DRAFT -> CANCELLED` (also terminal). `CANCELLED` was added here but
  deliberately NOT added to `Payment` in Phase 16 — a manual journal entry
  (`POST /journal-entries`) genuinely can sit unposted while a user builds
  it, unlike a Payment, which is always atomically allocated in the same
  call that creates it.
- **Double-entry validation** (`src/modules/accounting/utils/
  double-entry.ts`): every line has exactly one of debitAmount/
  creditAmount non-zero and positive, the other exactly zero; every
  journal's `SUM(debitAmount) === SUM(creditAmount)`. Uses integer-cents
  arithmetic for this one balance check specifically (not the
  `.toFixed(2)`-per-value convention used everywhere else in this
  codebase) — the one place an exact equality is checked across a sum of
  potentially many values, where summing native floats before rounding is
  exactly the failure mode that can make `0.10 + 0.20 !== 0.30` true;
  proven by a dedicated unit test. `totalDebit`/`totalCredit` on
  `JournalEntry` are a denormalized cache, always re-derived and
  re-validated from the actual lines at `post()` time.
- **PaymentMethod.glAccountId (the one PaymentMethod-account-mapping
  judgment call, LOCKED-delegated)**: a new, additive, nullable `char(36)`
  column with a real FK to `accounts` (`ON DELETE RESTRICT`), added via
  this phase's own migration (`ALTER TABLE payment_methods ADD
  gl_account_id ...`). Unlike `Customer.receivableAccountId`/
  `Supplier.payableAccountId`'s deliberately FK-less Phase-11 placeholders
  (no Chart of Accounts existed yet when those were created), a real FK
  was used here since `accounts` exists by the time this column is added
  within this same migration. No endpoint exposes it for writing —
  `CreatePaymentMethodDto` doesn't include it, and PaymentMethod's locked
  API surface (Phase 16, D14) has no PATCH endpoint at all — set only via
  direct data administration. Confirmed purely additive: `payment_methods`'
  pre-existing `companyId`/`code`/`name`/`status` columns are untouched,
  verified live via `SHOW CREATE TABLE` before/after a full migration
  DOWN cycle (byte-identical).
- **Payment -> GL automatic posting (the core cross-phase integration,
  D6/D7/D13/D19)**: `AccountingPostingService.postPayment()` accepts the
  caller's transactional `EntityManager` and never opens its own
  transaction — mirrors `SalesService.applyPayment()`'s own contract from
  Phase 16 exactly. `PaymentsService.create()` gained exactly ONE
  additive block (after the Payment/PaymentAllocation rows already
  exist, so `sourceId=savedPayment.id` is real): fetch
  PaymentMethod/Customer/Supplier via the same transactional manager,
  call `postPayment()`. Confirmed via full manual diff review (no git
  baseline exists since Phase 16 was never committed, so this was a
  literal side-by-side comparison against the file as read at the start
  of this phase): every other method (`findAll`, `findByIdInCompany`,
  `findByIdempotencyKey`, `generatePaymentNumber`,
  `assertValidPartyForDirection`, `assertValidPaymentMethod`,
  `assertAllocationsValid`, the lock-ordering/dedup logic, Payment/
  PaymentAllocation row creation, the idempotency race-catch block,
  `isDuplicateIdempotencyKeyError`) is byte-identical to its pre-Phase-17
  state. Posting rules: `RECEIPT`: Dr cash/bank (from
  `PaymentMethod.glAccountId`) / Cr receivable (from
  `Customer.receivableAccountId`); `PAYMENT`: Dr payable (from
  `Supplier.payableAccountId`) / Cr cash/bank. **Fail-closed**: any
  missing/inactive/cross-company account mapping throws
  `ErrorCode.ValidationError`, rolling back the ENTIRE Payment
  transaction — no Payment row, no PaymentAllocation row, no
  Sale/PurchaseOrder balance change, no JournalEntry — proven live by a
  dedicated e2e rollback-safety test querying the database directly
  after the failed request.
- **Idempotency / duplicate-posting prevention**:
  `UNIQUE(company_id, source_type, source_id)` on `journal_entries`
  (MySQL's multiple-NULLs-non-colliding behavior, same as
  `Payment.idempotencyKey`'s own pattern). Two-layer protection mirroring
  `PaymentsService`'s own idempotency handling: a pre-creation
  `findBySource()` lookup, plus a race backstop catching
  `ER_DUP_ENTRY`/1062 narrowed to the source-uniqueness index
  specifically.
- **Period / fiscal-year enforcement**: `FiscalYear` (`OPEN|CLOSED`) +
  `AccountingPeriod` (`OPEN|LOCKED`), both minimal, no automatic closing
  workflow. Posting into a LOCKED period or CLOSED fiscal year is
  rejected (409). **Lazy auto-creation** (`AccountingPeriodResolverService
  .resolveOpenPeriod()`) answers the locked spec's own "no POST endpoint
  is listed, you decide how periods get created" delegation: the first
  journal entry needing to post into a `(company, year)` with no existing
  period lazily creates a calendar-year FiscalYear+AccountingPeriod pair
  (both `OPEN`); subsequent postings for the same year reuse it. A
  race-guard re-check immediately before insert prevents a duplicate pair
  under genuine concurrent first-use.
- **RBAC**: exactly eight new permissions — `accounts.read/create/update`,
  `journal_entries.read/create/post`, `general_ledger.read`,
  `trial_balance.read` — no `.delete`/`.approve`/`.reject`/`.reverse`/
  `general_ledger.write` for any resource (verified live: seed's first run
  printed exactly 8 new permissions/8 grants/4 new ALL-scope rows; re-run
  printed only the completion line, idempotent).
- **APIs**: `GET/POST/PATCH /accounts`, `GET/POST /journal-entries` +
  `POST /journal-entries/:id/post`, `GET /general-ledger`,
  `GET /trial-balance` — exactly the locked D22 surface, nothing more.
- **Migration**: `1786590000000-CreateAccountingTables.ts` — six tables in
  dependency order (`accounts -> company_journal_counters -> fiscal_years
  -> accounting_periods -> journal_entries -> journal_entry_lines`) plus
  the additive `payment_methods.gl_account_id` ALTER at the end. Verified
  UP -> DOWN -> UP against real Dockerized MySQL 8.0.40 with `SHOW CREATE
  TABLE` inspection of all six new tables and the modified
  `payment_methods` table; an explicit byte-for-byte diff proved
  `payments`/`payment_methods`/`purchase_orders`/`stock_movements` are
  identical before the migration and after a full DOWN cycle (with
  `payment_methods` correctly losing exactly its `gl_account_id`
  column/FK on DOWN) — 56 pre-existing tables before this phase's
  migration, 56 again after a full DOWN cycle (all 6 new tables cleanly
  removed, confirmed via `information_schema.tables` count and a
  table-name diff showing zero unexpected additions/removals), 62 after
  the final UP (56 + 6 new, confirmed via
  `SELECT COUNT(*) FROM information_schema.tables`).
- **Tests**: 66 new unit tests across 7 spec files (`double-entry`,
  `accounts.service`, `journal-entries.service`,
  `accounting-posting.service`, `accounting-period-resolver.service`,
  `general-ledger.service`, `trial-balance.service`) + 2 new unit-test
  wiring changes to the pre-existing `payments.service.spec.ts` (added
  the new `AccountingPostingService` constructor mock, all 18 pre-existing
  tests still pass unmodified in behavior) + 21 new e2e tests
  (`test/accounting.e2e-spec.ts` — auth/permission boundaries, Account
  CRUD incl. cycle-rejection and cross-company 404, manual journal
  create/post incl. unbalanced-rejection and double-post-rejection (409),
  GL/Trial-Balance read-projection correctness (DRAFT journals excluded,
  POSTED included, global debit=credit), a real Payment->GL e2e test for
  both RECEIPT and PAYMENT directions asserting the exact Dr/Cr accounts
  used, locked-period rejection, and two rollback-safety tests — missing
  PaymentMethod.glAccountId and missing Customer.receivableAccountId each
  proven, by direct DB query after the failed request, to leave zero
  Payment/PaymentAllocation/JournalEntry rows and zero Sale balance
  change — plus a real 10-way `Promise.all()` journal-numbering
  concurrency test). Total suite after Phase 17: **505 unit tests / 368
  e2e tests, all passing** (`npm test`: 59 suites passing + 2 skipped
  DB-gated, 505 passed/7 skipped/512 total; `node node_modules/jest/bin/
  jest.js --config ./test/jest-e2e.json --runInBand`: 15 suites, 368/368
  passing, exit code 0).
- **Two real cross-suite regressions found and fixed during this phase's
  own e2e verification** (not implementation bugs, but real consequences
  of Phase 17's now-mandatory Payment->GL posting on Phase 16's
  pre-existing fixtures): (1) `test/payments.e2e-spec.ts`'s
  `setupBaseFixture()` never configured `PaymentMethod.glAccountId`/
  `Customer.receivableAccountId`/`Supplier.payableAccountId` — since
  every real `POST /payments` call now synchronously posts to the GL and
  fails closed without those mappings, every pre-existing Payment test in
  that suite started returning 400 instead of 201. Fixed by adding a
  `createChartOfAccountsFixture()` helper and wiring its output through
  `setupBaseFixture()` — a test-fixture update reflecting a real, intended
  new precondition, not a change to `PaymentsService`'s own logic (which
  remains untouched beyond the one authorized `postPayment()` call). (2)
  Two "children before parents" cleanup-ordering bugs, the same category
  Phase 09/14/16 each already found and fixed once for their own suites:
  `test/accounting.e2e-spec.ts`'s cleanup didn't clear
  `purchase_order_items`/`purchase_orders` before deleting `suppliers`
  (RESTRICT FK failure on a leftover PO from an interrupted run), and
  didn't clear self-referencing `accounts.parent_id` before bulk-deleting
  `accounts` rows (same bug class as Phase 09's `categories.parent_id`
  fix) — both fixed, and the same two omissions were also fixed in
  `test/payments.e2e-spec.ts`'s own cleanup (which now also needed to
  clean up `journal_entries`/`fiscal_years`/`accounting_periods` rows its
  own real Payment postings started creating).
- **One stale Phase-11 boundary assertion updated, narrowly**:
  `test/customer-supplier.e2e-spec.ts` had a test literally asserting
  `accounts` (among other speculative table names) does not exist in this
  codebase — true when Phase 11 wrote it, no longer true now that Phase
  17 has legitimately created a real `accounts` table (which Phase 11's
  own "Accounting Mapping Placeholders" section explicitly anticipated:
  "Phase 17 gives `receivableAccountId`/`payableAccountId` a real FK
  target once a Chart of Accounts table exists"). Updated the single
  assertion to check the two speculative alternate names
  (`gl_accounts`/`chart_of_accounts`) and the
  never-built-by-any-phase `customer_sales_account_assignments` table
  still don't exist, while asserting `accounts` now correctly does — a
  narrow, direct fix to a premise Phase 17 legitimately changed, not a
  re-opening of any other Phase 11 boundary or logic.
- Security review performed and verified live: unauthenticated -> 401,
  authenticated-without-permission -> 403, cross-company Account/
  JournalEntry lookup -> 404 (IDOR-safe), posting into a LOCKED period or
  CLOSED fiscal year -> 409, missing Payment account mapping -> 400
  (`ValidationError`) with full transaction rollback verified by direct
  DB query (not just the HTTP response), double-posting a POSTED journal
  -> 409, unknown/extra fields -> 400 (existing global `ValidationPipe`),
  no PATCH/DELETE/reversal endpoint anywhere on `JournalEntry` once
  `POSTED` -> 404/405.
- `docs/ACCOUNTING_ARCHITECTURE.md` documents the full architecture,
  including the PaymentMethod.glAccountId judgment call, the integer-cents
  balance-check decision, the lazy period-creation decision, the
  fail-closed ValidationError-vs-Conflict reasoning, and the complete
  explicit-deferrals list (Sale/Purchase posting, COGS/valuation, tax,
  multi-currency, reversal, approval workflow, Cash/Bank entities,
  Outbox/events, reporting dashboards, opening-balance generation).
- Verified: zero real implementation of `general_ledger`(-as-table)/
  `TrialBalance`(-as-table)/`SUBMITTED`/`APPROVED`/`REJECTED`/`Reversal`/
  `Reverse`(-as-endpoint)/`CashAccount`/`BankAccount`/
  `BankReconciliation`/`TaxRate`/`TaxCode`/`Currency`(-entity)/
  `ExchangeRate`/`COGS`/`AuditLog`/`Outbox`/`BullMQ`/`Redis`(-as-app-code)
  anywhere in `src/modules/accounting` or the modified
  `payments.service.ts` (grepped — every match was a doc-comment
  explicitly stating the concept does NOT exist here, or a reference to
  the pre-existing `StockMovement`/`PaymentAllocation` precedent pattern
  being mirrored, never real implementation). Zero mutation of
  `SalesService`/`PurchaseOrdersService` beyond what already existed
  before this phase (confirmed: neither file's method list changed;
  `sales.service.ts`'s `git diff` against the last commit shows zero
  Accounting/Journal/Ledger references anywhere in its diff). Zero
  frontend files touched. No new npm dependencies were added (Phase 17
  reused Phase 03/04/06/08/09/11/12/13/14/16's TypeORM/validation/
  transaction/RBAC/organization/customer-supplier/sales/purchase/payments
  infrastructure entirely).
- **Not committed**: per explicit instruction, this phase's work remains
  uncommitted in the working tree — no `git commit`, no `git push`. Phase
  13-16's own still-uncommitted changes were left exactly as they were,
  untouched beyond the two files this phase needed to make additive
  changes to (`payments.service.ts`'s one new call,
  `payment-method.entity.ts`'s one new column) and the pre-existing e2e
  fixture/cleanup fixes described above.

Known/accepted gaps carried forward:

- No Sale/Purchase-to-GL posting of any kind (D6) — only Payment posts
  automatically. A future phase adding this is expected to decide its own
  transaction/Outbox strategy, since holding open a transaction across
  Sale confirmation and GL posting may need different handling than
  Payment's own single-call atomic flow.
- No COGS/inventory valuation posting (D8).
- No tax posting infrastructure (D17) — existing Sale/SaleItem tax
  snapshots are not read by this phase.
- No multi-currency (D16) — `JournalEntry`/`JournalEntryLine` carry no
  currency column; everything posts in the Payment's own currency 1:1.
- No reversal/correction API (D3/D21) — `JournalEntryStatus.Cancelled`
  only reaches an unposted DRAFT.
- No approval workflow (D2) — `DRAFT -> POSTED`/`CANCELLED` only.
- No Cash/Bank entity (D18) — ordinary `Account` rows with
  `accountType=ASSET`, distinguished by `PaymentMethod.glAccountId`.
- No Outbox/event bus/background worker (D7) — Payment->GL posting is
  synchronous by design; nothing this phase itself does needs one.
- No reporting dashboard/Balance Sheet/P&L/Cash Flow (D20).
- No Opening Balance generation (D11) — `JournalSourceType.OpeningBalance`
  is reserved on the enum but nothing creates a journal with this
  sourceType; no endpoint/trigger consumes `openingBalanceAmount`.
- No Bruno API collection — consistent with every prior phase.
- `@nestjs/swagger`'s transitive `js-yaml` advisory (unchanged since
  Phase 01, dev-time only).

**Next phase: Phase 18 — Outbox Pattern.** Phase 17's own Payment->GL
posting is synchronous by construction (D7) and needs no Outbox for
anything Phase 17 itself does — this is stated honestly as a genuinely
weak integration contract, similar to how Phase 15's own contract into
Phase 16 was honestly stated as weak rather than forced into existing. The
one plausible future consumer: if a later phase adds Sale/Purchase-to-GL
posting (explicitly out of scope for Phase 17 per D6), it may benefit from
an Outbox to avoid holding a long-lived transaction open across Sale
confirmation and GL posting — but that decision belongs to whichever
phase actually builds Sale/Purchase posting, not something Phase 17 or
Phase 18 should pre-build speculatively now.
