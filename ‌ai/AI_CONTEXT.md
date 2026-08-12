# AI_CONTEXT.md

# Fashion ERP Backend — Phase Tracking

This file tracks the current implementation phase of the Fashion ERP Backend.
It is the source of truth for "which phase are we on" across AI sessions.

Read this file, then `docs/AI_RULES.md`, before starting any new work.
The full phase specifications live in this same `‌ai/` folder (`PHASE 00.md`,
`Phase 01.md`, ... `Phase 31.md`).

---

## Current Phase

**Phase 09 — Master Data**

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
- Next phase: **Phase 10** (Product/ProductVariant/Pricing). Phase 09's
  `Category`, `Brand`, `Collection`, and `AttributeOption` entities/
  services/APIs are ready for Phase 10 to reference without any redesign
  — see `docs/MASTER_DATA_ARCHITECTURE.md`'s "Future Phase Integration"
  section for the exact expected FK shape
  (`Product.categoryId/brandId/collectionId`,
  `ProductVariant` ↔ `attribute_options`). `DataScopeService.
  resolveAllowedOrganizationIds()` and `SalesAccountAccessService.
  getAllowedSalesAccountIds()` remain the two reusable resolution
  contracts future business modules (Phase 12 Sales especially) should
  call rather than re-deriving visibility logic — see
  `docs/USER_EMPLOYEE_ACCOUNT_ARCHITECTURE.md`. The frontend `role`/
  `permissions` response-shape gap (flagged since Phase 05) still has a
  real backend answer via `GET /auth/me/permissions` but frontend wiring
  remains undone (backend-only phases so far). The frontend also has
  three mutually-incompatible Company/Branch/Warehouse models and,
  separately, three mutually-incompatible User/Employee/Account-adjacent
  models (`AdminUser`, `AuthUser` with its closed role enum, `Employee`)
  plus zero existing "Sales Account" concept at all — none of these were
  used as a template for Phase 08's schema; reconciling/building the
  frontend is a task for whenever frontend integration begins, not
  resolved by Phase 07, 08, or 09.
