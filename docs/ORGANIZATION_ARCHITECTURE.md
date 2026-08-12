# ORGANIZATION_ARCHITECTURE.md

Organizational hierarchy and administration APIs implemented in Phase 07.
Business modules (Sales, Inventory, etc.) do not exist yet, and neither does
user-organization membership (Phase 08) — this document describes the
organizational entity foundation only.

## Core Principle

```text
Company is the root organizational entity. There is no persisted
Organization table — "organization" is a conceptual label for the
Company/Branch/Warehouse hierarchy plus (future) membership, never a
fourth database table.
```

## Entity Model

```text
Company ──< Branch ──< Warehouse
```

- **Company** (`companies`) — root entity. `code` (stable, unique,
  immutable after creation), `name`, `status` (`ACTIVE`/`INACTIVE`),
  `baseCurrency` (3-letter ISO code), `timezone` (IANA identifier),
  `country`, `phone`, `email`, `address`. `legalName` was deliberately
  **not** implemented — the spec lists it as optional and no concrete
  legal-name/trade-name requirement exists yet; add it later if one
  surfaces rather than speculatively now. Fiscal-year/tax configuration is
  out of scope (belongs to Phase 17 Accounting).
- **Branch** (`branches`) — belongs to exactly one Company
  (`companyId`, immutable after creation). `code` unique **within its
  company** (`UNIQUE(company_id, code)`), not globally — the same code can
  exist under two different companies. `name`, `status`, `phone`, `email`,
  `address`, `timezone`.
- **Warehouse** (`warehouses`) — belongs to exactly one Branch
  (`branchId`, immutable after creation) and, denormalized, to exactly one
  Company (`companyId`, immutable, stored directly rather than derived via
  a join on every read). `code` unique **within its company**
  (`UNIQUE(company_id, code)` — the chosen strategy per Phase 07 §13;
  branch-local uniqueness was considered and rejected since no business
  requirement calls for reusing warehouse codes across branches of the
  same company). `name`, `type` (extensible enum: `MAIN, STORE,
  DISTRIBUTION, TRANSIT, RETURN, VIRTUAL, OTHER`), `status`, `address`.

## Critical Integrity Rule

A Warehouse's `companyId` must always equal its parent Branch's
`companyId`. Enforced in `WarehousesService.create()` before any insert —
never relied on as a database-only constraint, since the FK alone cannot
express "these two FK targets must agree with each other":

```text
Company A                    Company B
  Branch A1                    Branch B1

Warehouse.companyId = Company A
Warehouse.branchId  = Branch B1     ← REJECTED (400) — branch belongs to
                                       a different company
```

## Immutability

`companyId` (on Branch and Warehouse) and `branchId` (on Warehouse) are set
once at creation and never exposed on the `Update*Dto`s. A real "move this
branch to another company" or "transfer this warehouse to another branch"
need would be a dedicated, audited operation — not a silent `PATCH` — and
is not required by this phase.

## Uniqueness

| Field | Scope | Reason |
|---|---|---|
| `companies.code` | Global | Company is the root; nothing sits above it to scope against. |
| `branches.code` | Per company (`UNIQUE(company_id, code)`) | Spec §9 — the same branch code (e.g. `HQ`) may recur under different companies. |
| `warehouses.code` | Per company (`UNIQUE(company_id, code)`) | Spec §13's preferred default; no business requirement surfaced for branch-local codes instead. |

All three are enforced by a real database unique index, not
application-only validation — the service-layer check exists to return a
clean `409 Conflict` before the constraint would raise a raw DB error.

## Lifecycle / Status

```text
ACTIVE ⇄ INACTIVE
```

- An inactive Company/Branch/Warehouse is excluded from
  `findActiveByIdOrNull()`, so it can no longer be used as a valid parent
  for a new child (a new Branch cannot be created under an inactive
  Company; a new Warehouse cannot be created under an inactive Branch).
- Deactivating a parent does **not** cascade-deactivate its children —
  existing Branches/Warehouses remain in whatever status they already had.
  This matches Phase 07 §70–72: inactive parents block *new* operations,
  they do not silently destroy or hide historical structure.
- Deletion is soft delete only (`deletedAt`, inherited from `BaseEntity`)
  and is **blocked** while active children exist:
  - `CompaniesService.remove()` rejects with `409` if the company has any
    Branch rows.
  - `BranchesService.remove()` rejects with `409` if the branch has any
    Warehouse rows.
  - `WarehousesService.remove()` has no further children to check against
    (no business records exist yet in this phase).
  - The FK `ON DELETE RESTRICT` on every parent-child relationship is the
    hard backstop behind these explicit checks — even a direct SQL delete
    attempt would be rejected by MySQL, not just the service layer.

## RBAC Integration (Phase 06 reuse — no new authorization system)

Phase 07 adds **zero** new authorization concepts. It registers new
`resource.action` permission codes into the existing Phase 06 catalog
(`src/database/seeds/rbac.seed.ts`) and protects every endpoint with the
existing `JwtAuthGuard` + `PermissionGuard` + `@RequirePermission()`:

```text
companies.read   companies.create   companies.update   companies.delete
branches.read    branches.create    branches.update    branches.delete
warehouses.read  warehouses.create  warehouses.update   warehouses.delete
```

No new role, scope enum, guard, or decorator was created. `RbacModule` now
also exports `PermissionGuard` (previously provider-only) so
`OrganizationModule` — a separate Nest module — can use it via DI.

## Data Scope Integration — What Phase 07 Does and Does Not Do

Phase 06's `DataScope` enum already includes `COMPANY`, `BRANCH`,
`WAREHOUSE`, `ORGANIZATION`. Phase 07 gives those values real entities to
eventually resolve against, but **deliberately does not** extend
`DataScopeService` with a scope→allowed-IDs resolution method yet.

**Why**: that resolution's only meaningful input is organization
*membership* (which user belongs to which Company/Branch/Warehouse) — and
membership (`UserCompany`/`UserBranch`/`UserWarehouse`) is explicitly
Phase 08's responsibility, not Phase 07's. Building an ID-resolution method
today would mean resolving against either (a) all companies unconditionally
(meaningless — indistinguishable from no scoping at all) or (b) a
temporary, invented membership model — both rejected, the latter
explicitly by this phase's own instructions ("do not introduce a temporary
user-assignment model just to make Phase 07 appear complete").

**What exists today**: real `Company`/`Branch`/`Warehouse` rows with a
verified parent-child chain, ready for Phase 08's membership tables to
reference, and ready for `DataScopeService` to be extended once that
membership data exists. No query-level business-data filtering was
implemented in this phase — there is no business data yet to filter.

## API Surface

| Method | Route | Permission | Purpose |
|---|---|---|---|
| GET | `/companies` | `companies.read` | List companies (paginated) |
| GET | `/companies/:id` | `companies.read` | Company detail |
| POST | `/companies` | `companies.create` | Create a company |
| PATCH | `/companies/:id` | `companies.update` | Update identity/contact fields (not `code`) |
| POST | `/companies/:id/activate` | `companies.update` | Activate |
| POST | `/companies/:id/deactivate` | `companies.update` | Deactivate |
| DELETE | `/companies/:id` | `companies.delete` | Soft-delete (blocked if branches exist) |
| GET | `/branches?companyId=` | `branches.read` | List branches, optionally filtered by company |
| GET | `/branches/:id` | `branches.read` | Branch detail |
| POST | `/branches` | `branches.create` | Create a branch (validates `companyId` is an active company) |
| PATCH | `/branches/:id` | `branches.update` | Update (not `companyId`/`code`) |
| POST | `/branches/:id/activate` \| `/deactivate` | `branches.update` | Lifecycle |
| DELETE | `/branches/:id` | `branches.delete` | Soft-delete (blocked if warehouses exist) |
| GET | `/warehouses?companyId=&branchId=&status=` | `warehouses.read` | List warehouses, filterable |
| GET | `/warehouses/:id` | `warehouses.read` | Warehouse detail |
| POST | `/warehouses` | `warehouses.create` | Create (validates company+branch active and consistent) |
| PATCH | `/warehouses/:id` | `warehouses.update` | Update (not `companyId`/`branchId`/`code`) |
| POST | `/warehouses/:id/activate` \| `/deactivate` | `warehouses.update` | Lifecycle |
| DELETE | `/warehouses/:id` | `warehouses.delete` | Soft-delete |

All routes require `JwtAuthGuard` + `PermissionGuard`. None of them accept
or trust a client-supplied scope/authorization override — `companyId`/
`branchId` in a request body are used only to look up the real row
server-side, per Phase 07 §25.

## Security

- **IDOR/BOLA**: every parent reference (`companyId`, `branchId`) is
  re-validated against real, active database rows on every write — never
  trusted from the client beyond using it as a lookup key.
- **Cross-company protection**: the critical integrity rule above is
  covered by a dedicated e2e test constructing the exact Company
  A/Branch B1 mismatch scenario from Phase 07 §16/§26.
- **Orphan prevention**: hierarchy validation on create (§29) plus
  child-blocking on delete (§31) together make it impossible to end up
  with a Branch referencing a nonexistent/wrong Company, or a Warehouse
  referencing a nonexistent/wrong Branch, at any point in the entity's
  lifecycle.
- **Unknown fields**: rejected by the existing global `ValidationPipe`
  (`forbidNonWhitelisted`, inherited from Phase 01) — verified by a
  dedicated e2e test sending a `parentId` field the DTO does not declare.

## Known Limitations (by design, not oversight)

- No `DataScopeService` scope→ID resolution yet — see "Data Scope
  Integration" above. This is the primary Phase 08 integration point.
- No `Company.defaultBranchId` / `Branch.defaultWarehouseId` — the spec
  frames both as conditional ("if required"); no concrete requirement
  surfaced, and building them now would add FK complexity for a UX
  nicety nothing currently asks for. Can be added later without
  disrupting the current schema.
- No `isPrimary`/membership fields at all — membership tables
  (`UserCompany`/`UserBranch`/`UserWarehouse`) are entirely Phase 08's
  responsibility per this phase's explicit boundary.
- No `OrganizationContext`/`X-Company-Id` request-context abstraction
  (spec §35, §42–44) — these depend on membership data that does not
  exist yet; premature to build against nothing.
- No Bruno API collection — no prior phase (01–06) established Bruno
  tooling in this repository, consistent with Phase 06's own
  "reuse existing infrastructure" precedent. Flagged as deferred, not
  silently skipped.

## Future Phase Integration

- **Phase 08** (Employee/User Administration): owns
  `UserCompany`/`UserBranch`/`UserWarehouse` membership tables and the
  `GET/PUT /users/:id/companies|branches|warehouses` endpoints. Can
  reference `Company`/`Branch`/`Warehouse` by FK without any redesign of
  this phase's schema.
- **Phase 12+** (Sales, Purchase, Inventory, ...): business entities gain
  `companyId`/`branchId`/`warehouseId` foreign keys into these tables.
  Authorization combines Phase 06 permission + scope with Phase 08
  membership once both exist — `DataScopeService`'s scope→ID resolution
  extension is the natural place this composition happens.
- **Phase 17** (Accounting): Company/Branch become organizational
  dimensions for journal entries — `Company.baseCurrency`/`timezone` were
  kept identity-only specifically so Accounting's own fiscal-year/tax
  configuration can be added later without touching this schema.
