# USER_EMPLOYEE_ACCOUNT_ARCHITECTURE.md

User administration, Employee, organizational membership, and Sales Account
foundation implemented in Phase 08. Business modules (Sales, HR, Accounting,
etc.) do not exist yet — this document describes the identity/membership/
ownership foundation only.

## Core Principle

Five separate concerns, never merged:

```text
Authentication  → WHO ARE YOU?                    (Phase 05, unchanged)
Role/Permission → WHAT CAN YOU DO?                 (Phase 06, unchanged)
Organization    → WHERE CAN YOU OPERATE?           (Phase 07 entities + Phase 08 membership)
Employee        → WHICH BUSINESS PERSON ARE YOU?   (Phase 08)
Sales Account   → WHICH SALES PORTFOLIO DO YOU OWN? (Phase 08)
Data Scope      → WHICH RECORDS CAN YOU SEE?        (Phase 06 mechanism + Phase 08 resolution)
```

```text
Authenticated User
    AND
Required Permission
    AND
Allowed Data Scope
    AND
Organization Membership
    AND
Business Ownership Rule (e.g. Sales Account assignment)
```

## Entity Model

```text
User ──0..1── Employee ──0..N── SalesAccountAssignment ──N..1── SalesAccount
 │                                                                   │
 ├──N..N── UserCompany ────N..1── Company ─────────────────────────1..N (SalesAccount.companyId)
 ├──N..N── UserBranch ─────N..1── Branch ──────────────────────────1..N (SalesAccount.branchId)
 └──N..N── UserWarehouse ──N..1── Warehouse
```

- **User** (`users`, Phase 05, unchanged shape) — login identity. Gains
  administration CRUD in this phase (`UsersService`/`UsersController`) but
  no new columns except `status` gaining a `LOCKED` value.
- **Employee** (`employees`) — business/personnel identity, entirely
  separate from User. `userId` nullable and unique (`UNIQUE(user_id)` where
  not null) — an Employee can exist without a login, and a User can exist
  without an Employee (e.g. a system administrator). `employeeCode` unique
  per company. `companyId`/`branchId` required, immutable after creation,
  validated against real active Company/Branch rows with the
  `branch.companyId === companyId` consistency check (same pattern as
  Phase 07's Warehouse validation).
- **UserCompany / UserBranch / UserWarehouse** (`user_companies`,
  `user_branches`, `user_warehouses`) — organizational membership, answering
  "where can this user operate." Many-to-many, `status`
  (`ACTIVE`/`INACTIVE`), `isPrimary`. **Never grants permission by itself**
  — combines with Role/Permission and Data Scope at query time.
- **SalesAccount** (`sales_accounts`) — sales ownership/portfolio identity.
  **Not** the Accounting GL Account (see "Naming" below). `code` unique per
  company. `companyId`/`branchId` required and validated consistent.
  `employeeId` nullable — an account can exist before being staffed.
- **SalesAccountAssignment** (`sales_account_assignments`) — normalized,
  history-preserving ownership relationship. Enables one SalesAccount to be
  worked by multiple users and one employee to hold multiple accounts.
  `assignedAt`/`unassignedAt` timestamps; unassignment sets `INACTIVE` and
  `unassignedAt` rather than deleting the row, so "who owned this account
  at the time of sale" remains answerable later (Phase 12's concern, not
  built here).

## Naming — avoiding the Account/SalesAccount/GL-Account collision

The frontend already has an unrelated `Account` type for chart-of-accounts
(asset/liability/equity/income/expense). To avoid ambiguity, this phase
never uses the bare word "Account" for sales ownership:

```text
SalesAccount            (never "Account")
sales_accounts          (never "accounts")
sales_accounts.*        (permission resource — never "account.*")
SalesAccountAssignment  (never "AccountAssignment")
salesAccountId          (never "accountId", except where it unambiguously
                          means the sales account within this module's own
                          files)
```

## Company-Before-Branch Rule (LOCKED)

A user cannot be granted Branch membership unless they already hold an
**active** Company membership for that branch's own parent company:

```text
User -> Company A (active membership)
User -> Branch A1 (Branch A1.companyId === Company A.id)   VALID

User -> Branch A1
     (no active Company A membership)                       REJECTED
```

Enforced transactionally in `UserOrganizationService.assignBranch()` —
reads the company membership and writes the branch membership inside one
transaction so the two are seen consistently under concurrent requests.

## Warehouse Membership Integrity (LOCKED)

Symmetrically, Warehouse membership requires an active Branch membership
for the warehouse's **real** parent branch — resolved server-side from the
database, never trusted from the client:

```text
User -> Company A, Branch A1 (active memberships)
Warehouse X.branchId = Branch A1                  -> assignment VALID
Warehouse Y.branchId = Branch A2 (different branch) -> assignment REJECTED,
    even if the client claims Warehouse Y belongs to Branch A1
```

Covered by a dedicated e2e test reproducing exactly this spoofing attempt.

## Employee Termination Lifecycle

```text
Employee.status = TERMINATED
  ↓
Employee.terminatedAt = now()
  ↓
IF Employee.userId is set AND that User.status === ACTIVE:
  User.status = INACTIVE     (explicit transactional step, not a blind cascade)
ELSE:
  User untouched
```

Both writes happen inside one transaction (`EmployeesService.terminate()`).
Historical Sales/Accounting/Inventory/audit data is never touched — nothing
in this phase deletes or rewrites history. Membership rows and
`SalesAccountAssignment` rows are also left untouched by termination itself
— only the two transitions above were explicitly required; no further
cascade was invented.

## Data Scope Integration — the Phase 06/07/08 convergence point

`DataScopeService` (Phase 06) gained exactly one new method,
`resolveAllowedOrganizationIds(userId, resolvedScope)`:

```text
resolveScope(userId, resource)          → {scope: COMPANY|BRANCH|..., scopeValue}   (Phase 06, unchanged)
resolveAllowedOrganizationIds(userId, resolved) → string[] | null                     (Phase 08, new)
```

Behavior:

| `resolved.scope` | Result |
|---|---|
| `ALL` | `null` — caller treats this as "no ID filtering needed," matching the Super Admin/`ALL`-scope short-circuit already recommended in the Phase 07 analysis |
| `COMPANY` | Active `UserCompany.companyId` values for the user |
| `BRANCH` | Active `UserBranch.branchId` values for the user |
| `WAREHOUSE` | Active `UserWarehouse.warehouseId` values for the user |
| anything else (`OWN`/`ACCOUNT`/`TEAM`) | `[]` — safe default, this method only resolves organizational membership |

No second resolution engine was created — this is the single integration
point the Phase 07 documentation flagged as "the primary Phase 08
integration point," implemented as an additive method with the existing
breadth-ordering/union logic in `resolveScope()` left completely unchanged.

## Sales Account Ownership — deliberately separate from DataScope

`SalesAccountAccessService.getAllowedSalesAccountIds(userId)` resolves
active `SalesAccountAssignment` rows directly. It is **not** part of
`DataScopeService` and does not touch `DataScope` at all — Sales Account
ownership is a Sales-domain business rule, not a generic organizational
scope, per the explicit architectural boundary in the Phase 08
specification ("do not make generic DataScope responsible for every
business-specific rule").

```text
Future Sales visibility (Phase 12, NOT built here):
CanReadSales =
    hasPermission("sales.read")
    AND organizationScopeAllows(record)   -- DataScopeService
    AND salesAccountPolicyAllows(record)  -- SalesAccountAccessService
```

## RBAC Integration (reused, not duplicated)

`users.read/create/update/delete` were already seeded in Phase 06 with no
controller to use them until now — reused as-is. New permissions added to
the same idempotent seed:

```text
users.activate   users.deactivate   users.lock   users.unlock
employees.read   employees.create   employees.update   employees.delete
user_organizations.read   user_organizations.assign   user_organizations.remove
sales_accounts.read    sales_accounts.create   sales_accounts.update
sales_accounts.delete  sales_accounts.assign   sales_accounts.unassign
```

No new authorization system, no new scope enum, no hard-coded role checks
anywhere in the new modules (grep-verified). `DataScope.ACCOUNT` (already
present since Phase 06) remains reserved for a future SalesAccount-scoped
`RoleResourceScope` row if a role ever needs "only records for my assigned
sales account" as a resource-scope value — not consumed by this phase,
which resolves Sales Account ownership through `SalesAccountAccessService`
instead.

## API Surface

| Method | Route | Permission |
|---|---|---|
| GET/POST | `/users` | `users.read` / `users.create` |
| GET/PATCH | `/users/:id` | `users.read` / `users.update` |
| POST | `/users/:id/activate` \| `/deactivate` \| `/lock` \| `/unlock` | `users.activate`/`deactivate`/`lock`/`unlock` |
| DELETE | `/users/:id` | `users.delete` (soft delete) |
| GET/POST/DELETE | `/users/:userId/companies[/:companyId]` | `user_organizations.read`/`assign`/`remove` |
| GET/POST/DELETE | `/users/:userId/branches[/:branchId]` | same |
| GET/POST/DELETE | `/users/:userId/warehouses[/:warehouseId]` | same |
| GET/POST | `/employees` | `employees.read` / `employees.create` |
| GET/PATCH | `/employees/:id` | `employees.read` / `employees.update` |
| POST/DELETE | `/employees/:id/user` | `employees.update` (link/unlink) |
| POST | `/employees/:id/terminate` \| `/activate` \| `/deactivate` | `employees.update` |
| GET/POST | `/sales-accounts` | `sales_accounts.read` / `create` |
| GET/PATCH | `/sales-accounts/:id` | `sales_accounts.read` / `update` |
| POST | `/sales-accounts/:id/activate` \| `/deactivate` | `sales_accounts.update` |
| GET/POST | `/sales-accounts/:id/assignments` | `sales_accounts.read` / `assign` |
| DELETE | `/sales-accounts/:id/assignments/:assignmentId` | `sales_accounts.unassign` |

All routes require `JwtAuthGuard` + `PermissionGuard`. Client-supplied
`companyId`/`branchId`/`warehouseId`/`employeeId`/`salesAccountId`/`userId`
are never trusted beyond using them as lookup keys re-validated against
real, active database rows server-side.

## Security

- **IDOR/BOLA**: every entity lookup by ID goes through a permission-gated
  endpoint; nonexistent IDs return 404, verified by dedicated tests.
- **Cross-company/branch/warehouse membership**: company-before-branch and
  warehouse-hierarchy rules (above) prevent a user from ever holding
  membership inconsistent with the real Company→Branch→Warehouse chain.
- **Sales Account assignment spoofing**: `SalesAccountAssignmentService.assign()`
  validates that the target Employee's `companyId`/`branchId` match the
  Sales Account's, and — critically — that the supplied `userId` matches
  the Employee's actual linked `userId`, preventing an attacker from
  assigning a Sales Account to themselves via a mismatched employeeId.
  Covered by a dedicated e2e test.
- **Self-escalation**: membership assignment and Sales Account assignment
  both require `user_organizations.assign` / `sales_accounts.assign`
  respectively — a user without the permission cannot grant themselves
  broader access via a crafted request.
- **Locked/inactive users**: `LOCKED` and `INACTIVE` both fail Phase 05's
  existing `status !== ACTIVE` authentication check — no new bypass
  surface, verified by a dedicated e2e login test.
- **Password handling**: `UsersService.create()` reuses `PasswordService`
  (Argon2id, Phase 05) — no second hashing implementation. Response DTOs
  never include `passwordHash`.

## Database

New tables (all UUID CHAR(36) PKs, snake_case, InnoDB, utf8mb4/
utf8mb4_unicode_ci, soft-delete `deleted_at`, inherited from `BaseEntity`):

| Table | Unique constraint | Key FKs (ON DELETE) |
|---|---|---|
| `employees` | `(company_id, employee_code)`; `(user_id)` where not null | `user_id → users` (RESTRICT), `company_id → companies` (RESTRICT), `branch_id → branches` (RESTRICT) |
| `user_companies` | `(user_id, company_id)` | `user_id → users` (CASCADE), `company_id → companies` (RESTRICT) |
| `user_branches` | `(user_id, branch_id)` | `user_id → users` (CASCADE), `branch_id → branches` (RESTRICT) |
| `user_warehouses` | `(user_id, warehouse_id)` | `user_id → users` (CASCADE), `warehouse_id → warehouses` (RESTRICT) |
| `sales_accounts` | `(company_id, code)` | `company_id → companies` (RESTRICT), `branch_id → branches` (RESTRICT), `employee_id → employees` (RESTRICT) |
| `sales_account_assignments` | none at DB level (active-uniqueness enforced at service level — MySQL lacks native partial unique indexes) | `user_id → users` (CASCADE), `employee_id → employees` (RESTRICT), `sales_account_id → sales_accounts` (RESTRICT) |

`users.status` enum extended from `('ACTIVE','INACTIVE','SUSPENDED')` to
`('ACTIVE','INACTIVE','SUSPENDED','LOCKED')` — additive, existing rows
unaffected, `ALTER TABLE ... MODIFY` reversible in the migration's `down()`.

Membership FKs to `users` use `CASCADE` (deleting a user's row — which
never actually happens, only soft-delete is used — would also remove their
membership rows) while FKs to Company/Branch/Warehouse/Employee/SalesAccount
use `RESTRICT`, consistent with every prior phase's "never silently destroy
organizational/historical structure" convention.

## Known Limitations (by design, not oversight)

- `SalesAccountAccessService` is a read/query capability only — no Sales
  module exists yet to call it. This is the intended Phase 12 integration
  seam, not a gap.
- No `isPrimary` enforcement beyond the column existing — "only one primary
  company per user" is not yet enforced at the service level, since no
  current API sets `isPrimary` to `true` (assignment endpoints always
  create with `isPrimary: false`). Deferred until a concrete UI need sets
  a primary membership.
- No `X-Company-Id`/`X-Branch-Id` active-context header handling — still
  correctly deferred, per Phase 07's own analysis, until a business module
  exists to consume "current operating context."
- No Bruno API collection — consistent with every prior phase's precedent.

## Future Phase Integration

- **Phase 09** (Master Data) can reference Company/Branch/Warehouse/
  Employee/User/SalesAccount without any redesign.
- **Phase 12** (Sales) is the primary consumer: `Sale.salesAccountId`,
  authorization combining `sales.read` permission + `DataScopeService`
  organization scope + `SalesAccountAccessService.getAllowedSalesAccountIds()`
  ownership — exactly the formula documented above, with zero role-name
  string comparisons.
- **Phase 14** (Inventory) can assign operational users to Warehouse via
  the existing `UserWarehouse` membership — no Warehouse redesign needed.
- **Phase 17** (Accounting) remains fully independent — `SalesAccount` is
  never confused with the GL Chart of Accounts; Phase 17 introduces its own
  `Account`/`JournalEntry`/`Ledger` concepts with no interaction with this
  phase's tables.
- **Phase 30** (HR) can extend `Employee` with Department/Position/
  Attendance/Leave/Payroll additively — this phase deliberately omitted
  those columns/tables rather than building placeholders for them.
