# RBAC_ARCHITECTURE.md

Dynamic RBAC and Data Visibility architecture implemented in Phase 06.
Business modules (Sales, Inventory, etc.) do not exist yet — this document
describes the reusable authorization foundation only.

## Core Principle

Three separate concerns, never merged:

```text
Authentication  → Who are you?               (Phase 05)
Authorization   → What are you allowed to do? (this phase, permissions)
Data Visibility → Which records can you see?  (this phase, scope — mechanism only)
```

## Entity Model

```text
User ──< UserRole >── Role ──< RolePermission >── Permission
                        │
                        └──< RoleResourceScope  (resource + scope, per role)
```

- **Role** (`roles`) — `name`, `code` (stable, unique, immutable after
  creation), `description`, `status` (`ACTIVE`/`INACTIVE`), `isSystemRole`.
  Roles are database rows, not a fixed enum — there is no hard-coded list of
  roles anywhere in the codebase (verified by grep).
- **Permission** (`permissions`) — `resource` + `action`, composed into a
  unique `code` (`resource.action`, e.g. `roles.read`). Only the RBAC
  administration permission catalog is seeded in this phase (see below) —
  business-module permissions are registered by the phases that introduce
  those modules.
- **RolePermission** (`role_permissions`) — many-to-many join,
  `unique(role_id, permission_id)`, `ON DELETE RESTRICT` on `permission_id`
  (a permission referenced by a role cannot be deleted out from under it).
- **UserRole** (`user_roles`) — many-to-many join,
  `unique(user_id, role_id)`, `ON DELETE RESTRICT` on `role_id` (a role with
  active assignments cannot be deleted by a cascading FK — deletion goes
  through `RolesService.remove()`'s explicit assignment check instead).
- **RoleResourceScope** (`role_resource_scopes`) — `unique(role_id,
  resource)`: one scope per resource per role. A single role can grant
  `ACCOUNT` scope for `sales` and `WAREHOUSE` scope for `inventory`
  simultaneously (two rows) — scope is never a single field on
  User/Role/UserRole.

## Permission Catalog (Phase 06 scope only)

```text
users.read, users.create, users.update, users.delete
roles.read, roles.create, roles.update, roles.delete
permissions.read
user_roles.read, user_roles.assign, user_roles.remove
```

Seeded idempotently via `npm run seed:rbac`
(`src/database/seeds/rbac.seed.ts`) — safe to re-run, never creates
duplicates, never deletes custom roles/permissions. Business-module
permissions (`sales.*`, `inventory.*`, ...) are explicitly **not** seeded
here per the phase's own scope boundary; they are registered by the phases
that introduce those modules.

## Multi-Role Resolution

**Effective permissions = deduplicated union across all ACTIVE roles a user
holds.** No explicit-deny model. Implemented in
`AuthorizationService.getEffectivePermissionCodes()`.

**Effective scope (when roles disagree) = broadest/most-permissive granted
scope**, per the approved architecture decision — never "deny wins," never
silently the most restrictive. Implemented in
`DataScopeService.resolveScope()` using a documented breadth ordering (`OWN
< ACCOUNT < TEAM < BRANCH < WAREHOUSE < COMPANY < ORGANIZATION < ALL`).
Scope resolution is resource-specific: the same user can have different
effective scopes for different resources.

Both resolutions re-query the database on every request — no permission
data is cached or embedded in the JWT, so a role/permission change or role
deactivation takes effect on the very next request (verified by a
dedicated e2e test, including a soft-deleted role).

## Super Admin

Implemented as a real, database-seeded system role
(`code = SUPER_ADMIN`, `isSystemRole = true`) holding explicit
`RolePermission` grants to every RBAC-administration permission — **not** a
hard-coded `if (role === 'super_admin')` bypass anywhere in the code
(verified: `grep -r "super_admin\|SUPER_ADMIN" src/` shows the string only
in the seed script and `SystemRoleCode` enum, never in a conditional
authorization check).

System-role protection (separate from the general permission system):
`isSystemRole = true` roles cannot be deleted or deactivated by anyone,
regardless of their permissions (`RolesService.deactivate()` /
`.remove()` reject with 403 before the general permission check would even
apply). This protects the role *definition*; the role can still be
assigned to/removed from individual users through the normal
`user_roles.assign` / `user_roles.remove` flow.

### Super Admin Invariant

"There must always be at least one ACTIVE Super Admin" is enforced by
`SuperAdminInvariantService`, called inside the same database transaction
as any operation that could violate it:

- `RolesService.deactivate()` — deactivating a role
- `UserRolesService.replaceForUser()` — removing a user's role assignments

The check counts active Super Admins (active role + active role status +
active, non-deleted user + active user-role assignment) **after** the
mutation, inside the same transaction, and throws (causing rollback) if the
count reaches zero. Row locks from the transaction's own writes make this
safe against concurrent invariant-violating operations — a second
transaction attempting the same kind of change blocks on the locked rows
until the first commits or rolls back.

## API Surface

| Method | Route | Permission | Purpose |
|---|---|---|---|
| GET | `/roles` | `roles.read` | List roles (paginated) |
| GET | `/roles/:id` | `roles.read` | Role detail incl. permissions + scopes |
| POST | `/roles` | `roles.create` | Create a custom role |
| PATCH | `/roles/:id` | `roles.update` | Update name/description |
| POST | `/roles/:id/activate` | `roles.update` | Activate a role |
| POST | `/roles/:id/deactivate` | `roles.update` | Deactivate (blocked for system roles, invariant-checked) |
| DELETE | `/roles/:id` | `roles.delete` | Soft-delete (blocked for system roles / active assignments) |
| PUT | `/roles/:id/permissions` | `roles.update` | Replace the role's permission set atomically |
| PUT | `/roles/:id/scopes` | `roles.update` | Replace the role's resource-scope set atomically |
| GET | `/permissions` | `permissions.read` | Full permission catalog |
| GET | `/users/:userId/roles` | `user_roles.read` | List a user's role assignments |
| PUT | `/users/:userId/roles` | `user_roles.assign` | Replace a user's role assignments atomically (invariant-checked) |
| GET | `/auth/me/permissions` | (authenticated only) | Current user's own effective roles + permissions |

All routes except `/auth/me/permissions` require `JwtAuthGuard` +
`PermissionGuard`; `/auth/me/permissions` requires only `JwtAuthGuard`
since every authenticated user may know their own access.

## Backend Enforcement Layering

```text
JwtAuthGuard        → 401 if not authenticated
PermissionGuard      → 403 if authenticated but lacking the required permission
AuthorizationService → single source of truth for permission resolution (can/canAny/canAll)
DataScopeService     → scope resolution (mechanism only — no query filtering yet;
                        future business modules call this before querying)
```

This directly defeats: **frontend bypass** (none of this logic exists
client-side), **parameter manipulation** (scope is always resolved from the
authenticated user's own role assignments, never from request
body/query), and **IDOR/BOLA** (a future business module must check both
collection-level scope and record-level access — this phase establishes the
service that makes that check possible, not yet wired into any endpoint
since no business records exist).

## Security Verification (this phase)

All verified live against the running Docker container, not just the test
suite:

- Unauthenticated request to any RBAC route → 401
- Authenticated user without the required permission → 403
- Normal user attempting to create/modify roles, assign themselves a role,
  or assign permissions to a role → 403 (privilege escalation blocked)
- Deleting or deactivating the `SUPER_ADMIN` role → 403 (system-role
  protection), independent of the caller's permissions
- Removing the last active Super Admin's role assignment → 409 (invariant
  enforced, transaction rolled back, assignment confirmed still present)
- A soft-deleted role stops granting its permissions immediately (no
  caching, verified via direct SQL soft-delete + live request)
- An inactive user cannot authenticate even while holding the Super Admin
  role (Phase 05's status check is the outer boundary)
- Unknown/extra fields in request bodies rejected by the existing global
  `ValidationPipe` (`forbidNonWhitelisted`, inherited from Phase 01)

## Future Phase Integration

- **Phase 07** (Company/Branch/Warehouse): `RoleResourceScope.scopeValue`
  is a generic nullable string, ready to hold a `companyId`/`branchId`/
  `warehouseId` once those entities exist. `COMPANY`, `BRANCH`,
  `WAREHOUSE`, `ORGANIZATION` scope values already exist in the enum.
- **Phase 08** (Employee/SalesAccount): `ACCOUNT` scope value already
  exists; no `salesAccountId` is hard-coded anywhere — Phase 08 can
  introduce the real relationship without migrating Phase 06's tables.
- **Phase 12+** (Sales, Purchase, Inventory, ...): call
  `AuthorizationService.can()` / `DataScopeService.resolveScope()` before
  business operations; register new resource/action permission codes in the
  catalog. No Sales-specific (or other business-specific) authorization
  logic exists inside the RBAC module.

## Known Limitations (by design, not oversight)

- No caching layer (Redis or otherwise) — every permission/scope check
  re-queries the database. Deliberately deferred per the phase spec's
  guidance not to make Redis mandatory before Phase 19; can be added later
  with explicit cache-invalidation hooks once real performance data
  justifies it.
- No `RequireAnyPermission`/`ANY` mode is currently used by any endpoint
  (all current endpoints use `ALL`/single-permission), though the
  decorator supports it for future use.
- No Bruno API collection exists for this phase — no prior phase (01–05)
  established Bruno tooling in this repository, so creating one now would
  be new project infrastructure beyond this phase's "reuse existing
  infrastructure" mandate. Flagged for a decision, not silently skipped.
- 404-vs-403 for hidden business records is explicitly deferred to the
  first business-module phase that needs it, per your instruction.
