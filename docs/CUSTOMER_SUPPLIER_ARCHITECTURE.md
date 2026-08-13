# CUSTOMER_SUPPLIER_ARCHITECTURE.md

Customer, Supplier, CustomerGroup, SupplierGroup, PaymentTerm,
CustomerAddress, SupplierAddress, CustomerContact, and SupplierContact
implemented in Phase 11 (`src/modules/customer-supplier/`). Sales,
Purchase, Payment, and Accounting/Double-Entry (Phases 12/13/16/17) do not
exist yet; this document describes the master-data foundation only, and
this document also serves as the Phase 11 Decision Record — no separate
decision-record artifact existed before this session (see "Locked
Decisions" below, which restates the constraints this phase was built
against as durable, citable architecture, not just a one-time instruction).

---

## 1. Customer Architecture

`Customer` (`customers`) is modeled as an independent entity — **not** a
generic `Party`/`BusinessParty` row. Company-scoped
(`companyId → companies`, `ON DELETE RESTRICT`), `UNIQUE(company_id,
customer_code)`. `branchId` is **optional** (`ON DELETE RESTRICT`,
nullable) — see "Company/Branch Scope Decision" below for why. Fields:
`customerCode`, `name`, `displayName`, `phone`, `email`, `customerGroupId`
(→ `CustomerGroup`, optional), `paymentTermId` (→ `PaymentTerm`, optional),
`creditLimit` (`DECIMAL(14,2)`, default `0.00`), `creditDays` (`INT`,
default `0`), `openingBalanceAmount` (`DECIMAL(14,2)`, default `0.00` —
see "Opening Balance Semantics"), `receivableAccountId` (nullable UUID, no
FK — see "Accounting Mapping Placeholders"), `status`
(`ACTIVE`/`INACTIVE`/`BLOCKED`), `notes`. Soft-deleted via `BaseEntity`
(`deletedAt`) — Customer rows are never hard-deleted, preserving the
identity Phase 12 (Sales) will reference.

`customerCode` uniqueness is **company-scoped**, matching every other
company-scoped code in this codebase (`Brand.code`, `Category.code`,
`Product.code`, etc.) — not globally unique, not branch-scoped. This is
the direct answer to Phase 11.md §5's open question ("Determine whether
uniqueness should be globally unique / company unique / branch unique").

## 2. Supplier Architecture

`Supplier` (`suppliers`) mirrors `Customer`'s architecture exactly but as
its own independent entity/table (Phase 11 locked decision §1 — no shared
base table, no Party abstraction). Fields: `supplierCode`, `name`,
`displayName`, `phone`, `email`, `supplierGroupId` (→ `SupplierGroup`,
optional), `paymentTermId` (→ `PaymentTerm`, optional), `creditDays` (see
"Credit Configuration" — Supplier has no `creditLimit` field), `openingBalanceAmount`,
`payableAccountId` (nullable UUID, no FK), `status`, `notes`.
`UNIQUE(company_id, supplier_code)`. Soft-deleted.

## 3. Address Architecture

Two separate tables, `CustomerAddress` (`customer_addresses`) and
`SupplierAddress` (`supplier_addresses`) — **not** a shared `PartyAddress`
table (Phase 11 locked decision §2). Each has an owner FK
(`customer_id`/`supplier_id`, `ON DELETE CASCADE` — cascading only fires
if the parent is ever hard-deleted, which normal application flows never
do since Customer/Supplier are soft-delete only; the FK is still defined
correctly for the rare case a DBA truly purges a row). Fields: `label`
(`AddressType` enum: `BILLING`/`SHIPPING`/`OFFICE`/`HOME`/`WAREHOUSE`/`OTHER`,
default `OTHER`), `recipientName`, `addressLine1` (required),
`addressLine2`, `city`, `state`, `postalCode`, `country`, `phone`,
`isPrimary` (boolean, default `false`).

Ownership is **always** re-verified server-side: every address service
method calls `CustomersService.findByIdInCompany()` /
`SuppliersService.findByIdInCompany()` with the resolved `companyId`
before touching any address row — a client-supplied `customerId`/
`supplierId` is never trusted on its own (Phase 11 locked decision §2,
§16, §27). A cross-company or nonexistent owner id surfaces as **404**,
matching the established "never leak existence" convention.

`isPrimary` is a single-primary-per-owner invariant enforced at the
**service layer**, not the database, because MySQL cannot express a
partial/filtered unique index (`UNIQUE WHERE is_primary = true`) the way
Postgres can. Creating or updating a row with `isPrimary: true`
transactionally-in-effect un-sets any previous primary for the same owner
via a single `UPDATE ... WHERE ownerId = ? AND isPrimary = true` issued
immediately before the insert/update — verified by a dedicated e2e test
asserting exactly one primary address survives after two are each created
with `isPrimary: true`.

**Soft-delete decision**: addresses/contacts ARE soft-deleted
(`deletedAt` via `BaseEntity`), not hard-deleted. Rationale: they are
owned data on a soft-delete-capable parent, and Phase 11.md §34 asks for
historical integrity broadly. A future phase snapshotting "the address
used for this shipment" would be corrupted by a hard delete. This is a
resolved ambiguity — the locked constraints left room for "no need to
over-soft-delete trivial child rows if hard delete is safe," but since
nothing today rules out a future snapshot-by-id use case and soft delete
costs nothing extra, the conservative (soft-delete) choice was made and is
documented here explicitly rather than silently decided either way.

## 4. Contact Architecture

Two separate tables, `CustomerContact` (`customer_contacts`) and
`SupplierContact` (`supplier_contacts`) — **not** a shared `PartyContact`
table (Phase 11 locked decision §3). Same ownership/company-scope
enforcement and `isPrimary` single-primary invariant as addresses (see
above). Fields: `name` (required), `jobTitle`, `email`, `phone`, `mobile`,
`isPrimary`. Soft-deleted, same rationale as addresses.

## 5. CustomerGroup / SupplierGroup Architecture

`CustomerGroup` (`customer_groups`) and `SupplierGroup` (`supplier_groups`)
are real, persisted, configurable entities — **not** hardcoded enums like
`Retail`/`Wholesale`/`VIP` (Phase 11 locked decision §4/§5). Each mirrors
the Phase 09 `Brand`/`Collection` pattern exactly: company-scoped
(`companyId → companies`, `ON DELETE RESTRICT`), `UNIQUE(company_id,
code)`, two-value `ACTIVE`/`INACTIVE` status, soft delete. Full CRUD +
activate/deactivate + duplicate-code protection (409) + pagination/search/
status-filter, identical to Brand/Collection's controller/service shape.

`remove()` on both is blocked with **409** while any active-or-inactive
Customer/Supplier still references the group (checked via
`Repository.count({ where: { customerGroupId / supplierGroupId: id } })`)
— mirrors the Phase 09 Category RESTRICT-on-children-exist precedent, so a
group can never be deleted out from under records that reference it. No
business groups (Retail/Wholesale/VIP/Local Supplier/Import Supplier/etc.)
are seeded — those are illustrative examples in Phase 11.md, not seed
data; only authorization seed data is seeded (see "RBAC" below).

## 6. Payment Terms

One shared, configurable, company-scoped `PaymentTerm` entity
(`payment_terms`) referenced by **both** Customer and Supplier via
`paymentTermId` FK (Phase 11 locked decision §6, §12). Fields: `code`,
`name`, `description`, `dueDays` (`INT`, `>= 0`, `<= 3650`), `status`.
`UNIQUE(company_id, code)`. Mirrors the Brand/CustomerGroup CRUD pattern.
No values (`Cash`/`Net 30`/`Net 60`/etc.) are hardcoded or seeded —
entirely configurable through the API.

`remove()` is blocked with 409 while any Customer or Supplier still
references the term (checked across both repositories) — same
RESTRICT-on-referenced-by-active-record precedent as groups.

**Payment Terms vs. Credit Limit — kept entirely separate, never
conflated** (Phase 11 locked decision §6, explicit non-negotiable): a
`PaymentTerm` answers "when is payment due" (`dueDays`); `creditLimit`/
`creditDays` on Customer (and `creditDays` on Supplier) answer "how much
exposure / how many days of credit are allowed." No single field or
meaning spans both concepts anywhere in this schema.

## 7. Credit Configuration

**Customer**: `creditLimit` (`DECIMAL(14,2)`, `>= 0`, default `0.00`) and
`creditDays` (`INT`, `>= 0`, `<= 3650`, default `0`) — both validated at
the DTO layer with a non-negative-decimal regex (`^\d+(\.\d{1,2})?$`) and
`@Min(0)` respectively; a negative value is rejected with 400 before it
ever reaches the service or database.

**Supplier**: `creditDays` only (`INT`, `>= 0`, `<= 3650`, default `0`) —
Phase 11.md's own Supplier field list (§6, §21) never lists a
`creditLimit` for Supplier; the domain meaning here is "days of payment
deferral this supplier extends to us," a credit **term**, not a credit
**limit** we impose on them. No Supplier-side credit ceiling concept
exists in this phase.

Neither field participates in any calculation. There is no credit-check
service, no "credit exceeded" blocking logic, no integration with any
future Sales flow yet — Phase 11 only stores and validates the configured
values, exactly as Phase 11.md §11 requires ("Do NOT implement the actual
Sales credit blocking logic in this phase").

## 8. Opening Balance Semantics — Explicit "NOT Current Balance" Statement

`opening_balance_amount` (DB column, exact snake_case name, on both
`customers` and `suppliers`, `DECIMAL(14,2)`, default `0.00`) is **initial
master-data only**:

- It is set once, at Customer/Supplier creation (or explicitly edited
  later via `PATCH`, same as any other master-data field) — never
  recalculated, never derived, never touched by any other operation.
- It is **never** treated as, exposed as, or renamed to a "current
  balance." No field named `balance`/`currentBalance`/
  `outstandingBalance`/`accountBalance` exists anywhere in this module —
  verified by grep (see "Strict Phase Boundary Verification" in the final
  report) and by a dedicated e2e test asserting the Customer response
  shape never contains any of those keys.
  status changes (activate/deactivate/block) leave it completely
  untouched.
- **No ledger, journal, or GL entry of any kind is created from this
  value.** Phase 11 does not calculate, does not read back a running
  balance, and does not write to any accounting table — there is no
  accounting table in this schema at all (see "Accounting Mapping
  Placeholders").
- **Relationship to the future accounting ledger is deferred entirely to
  Phase 17** (Accounting / Double-Entry). When Phase 17 introduces a real
  ledger, it is expected to read this field once, as the seed value for an
  initial opening-balance journal entry against the Customer's/Supplier's
  real GL account (once `receivable_account_id`/`payable_account_id` gain
  a real FK target) — but that read-and-post step, and everything after
  it, belongs entirely to Phase 17, not this phase.

## 9. Accounting Mapping Placeholders

`Customer.receivableAccountId` and `Supplier.payableAccountId`: nullable
`CHAR(36)` UUID columns with **no foreign key constraint** (Phase 11
locked decision §9). No GL Account / Chart of Accounts table exists
anywhere in this codebase yet, and creating one "just for Phase 11" is
explicitly forbidden by the locked constraints — a real FK to a
non-existent table is impossible, and a fake placeholder entity would be
worse than no entity at all (it would need to be redesigned, not just
re-pointed, once Phase 17 defines the real Chart of Accounts shape).

These columns currently accept and persist **any** syntactically valid
UUID verbatim (validated only as `@IsUUID()` at the DTO layer) — they are
inert data, not a real relationship, until Phase 17 gives them a real FK.
No code anywhere reads, joins against, or interprets these columns beyond
storing/returning them.

## 10. SalesAccount / DataScope.ACCOUNT Deferral — Explicit, Not Silent

Phase 11.md §19 ("User Account Relationship") describes an
`assignedAccount` concept and references Phase 08's Sales Account
foundation. **No `CustomerSalesAccountAssignment` table, and no permanent
SalesAccount relationship of any kind, was created on Customer or
Supplier** (Phase 11 locked decision §10). Rationale:

- Sales attribution ("which Sales Staff owns this customer for a given
  transaction") is a **Phase 12 (Sales) business rule**, not a Phase 11
  master-data concern. Phase 08's own `SalesAccountAssignmentService`
  already models Employee↔SalesAccount assignment; adding a *second*,
  Customer-side permanent assignment table now would either duplicate that
  concept or hard-wire an assumption Phase 12 hasn't specified yet
  (whether a Customer has one persistent Sales Account, or whether
  attribution happens per-transaction).
- Building it "temporarily" was explicitly disallowed — the locked
  constraints call out Phase 09's own precedent of *not* inventing a
  temporary model just to fill a gap another phase will define properly.

Correspondingly, **`DataScope.ACCOUNT` is deliberately left unresolved**
for Customer/Supplier in this phase. `DataScopeService.resolveScope()` and
`resolveAllowedOrganizationIds()` (both reused unmodified from Phase
06/08) are the only visibility mechanism wired into every Phase 11
controller via the shared `resolveRequestCompanyId()` helper — exactly the
`COMPANY`/`BRANCH`/`WAREHOUSE`/`ORGANIZATION`/`ALL` scopes Phase 07/08/09/10
already resolve, and nothing more. If a future role is granted `ACCOUNT`
scope on a Phase 11 resource, `resolveScope()` will return that scope
value, but `resolveAllowedOrganizationIds()` has no Account-aware
resolution branch (per its existing Phase 08 contract: unresolvable scope
kinds return `[]`, a safe "no access" default) — so an `ACCOUNT`-scoped
role would currently see nothing on Customer/Supplier, never everything.
This is an intentional deferral for Phase 12 to resolve when it defines
the real transaction-time Sales Account attribution contract, not a
silently-missed gap.

## 11. Company/Branch Scope

Customer and Supplier are **company-scoped** as the primary tenancy key
(Phase 11 locked decision §12, the user's explicit instruction overriding
Phase 11.md's own "company vs. company+branch" ambiguity at §16).
`companyId` is required and never mutated after creation by any service
method. `branchId` is **optional** — Phase 11.md's own Customer/Supplier
field lists (§5, §6) list only "company," never "branch," so requiring a
branch would over-constrain records the spec itself doesn't demand one
for; treating it as an optional refinement (present when a caller wants
branch-level attribution, absent otherwise) is the conservative
middle-ground consistent with "the primary scope key is companyId."

When `branchId` is supplied, it is validated exactly like Warehouse
(Phase 07) and Employee (Phase 08): `BranchesService.findActiveByIdOrNull()`
must return a row, and that row's own `companyId` must equal the resolved
`companyId` — never trusted as a bare client-supplied value, never
expressed as a database-only constraint (a composite FK cannot express
"these two FK targets must agree"). A cross-company `branchId` is rejected
with 400 before insert — verified by a dedicated unit test and e2e test
reproducing the exact Company A + Company B's Branch scenario from prior
phases.

**Resolved ambiguity, flagged explicitly**: this is the one place Phase
11.md's own spec left a genuine open question ("company scoped / branch
scoped / company + branch scoped — based on existing architecture") that
the locked constraints partially but not completely settled. The
resolution above (`companyId` required+immutable, `branchId` optional,
validated when present) is the documented, most-conservative choice
consistent with both the locked "primary scope key is companyId"
instruction and Phase 07/08's established validate-when-present pattern —
not a silent invention.

## 12. Data Visibility

Reuses Phase 06 `DataScopeService` and the Phase 09 `resolveRequestCompanyId()`
helper (`src/modules/master-data/utils/resolve-request-company-id.ts`)
**unmodified** — no `CustomerDataScopeService`, no
`SupplierVisibilityService`, no new scope enum value, no query-filtering
logic duplicated per controller (Phase 11 locked decision §13). Every
Phase 11 controller calls the same helper with its own resource string
(`customers`, `suppliers`, `customer_groups`, `supplier_groups`,
`payment_terms`, `customer_addresses`, `supplier_addresses`,
`customer_contacts`, `supplier_contacts`) exactly as Phase 09/10
controllers do. See "SalesAccount / DataScope.ACCOUNT Deferral" above for
the one explicit, documented gap in scope coverage.

## 13. RBAC

Dynamic RBAC only — `Role`, `Permission`, `RolePermission`, `UserRole`,
`RoleResourceScope`, `PermissionGuard`, `@RequirePermission()`, all reused
unmodified from Phase 06 (Phase 11 locked decision §14). No hardcoded role
name checks anywhere in `src/modules/customer-supplier` (grep-verified —
see final report). 36 new `resource.action` permissions were added to the
existing idempotent `rbac.seed.ts` catalog:

```
customers.read/create/update/delete
suppliers.read/create/update/delete
customer_groups.read/create/update/delete
supplier_groups.read/create/update/delete
payment_terms.read/create/update/delete
customer_addresses.read/create/update/delete
supplier_addresses.read/create/update/delete
customer_contacts.read/create/update/delete
supplier_contacts.read/create/update/delete
```

All 36 are granted to `SUPER_ADMIN`, and — repeating the Phase
09-discovered gap-closing step exactly, not rediscovering it — SUPER_ADMIN
also receives an `ALL`-scope `RoleResourceScope` row for each of the 9
new resources, added to `SUPER_ADMIN_ALL_SCOPE_RESOURCES`. Without this,
`DataScopeService.resolveScope()` would return `null` ("no access") for
SUPER_ADMIN itself on every Phase 11 resource, since no seed had populated
`role_resource_scopes` for these resources before Phase 11's controllers
became their first real caller. Verified idempotent: re-running
`npm run seed:rbac` after the initial seed produces zero output (no
duplicate permissions, no duplicate scope rows).

No business roles (`Customer Admin`, `Sales Manager`, etc.) were created —
consistent with every prior phase, custom roles remain entirely
API-driven.

## 14. Security Model

- **401** unauthenticated (no session cookie) on every Phase 11 route.
- **403** authenticated without the specific required permission.
- **404, never 403,** for cross-company lookups on Customer, Supplier,
  CustomerGroup, SupplierGroup, PaymentTerm, and every address/contact
  route — matches the established Phase 09/10 "never leak existence"
  convention exactly; verified live.
- **IDOR-safe address/contact ownership**: every address/contact mutation
  re-verifies the owning Customer/Supplier exists within the resolved
  company before touching any row — a spoofed cross-company
  `customerId`/`supplierId` in a nested-route URL surfaces as 404.
- **Cross-company reference rejection**: a `branchId`, `customerGroupId`,
  `supplierGroupId`, or `paymentTermId` belonging to a different company
  than the resolved `companyId` is rejected (400 for branch — an explicit
  service-level check; 404 for group/payment-term references, since those
  go through `findByIdInCompany()` which is itself company-scoped).
- **Spoofed `companyId`/`branchId` rejection**: `companyId` is never
  trusted directly from the client — it is resolved via
  `resolveRequestCompanyId()` against the user's own
  `DataScopeService`-derived allowed-company list, exactly like Phase
  09/10. A caller cannot pass an arbitrary `companyId` they have no access
  to and see/mutate that company's Customer/Supplier data.
- **Unknown/extra fields → 400** via the existing global `ValidationPipe`
  (`whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`) —
  no new pipe was introduced. Verified: submitting a `currentBalance`
  field on `POST /customers` is rejected with 400, not silently dropped or
  accepted.
- **No privilege escalation, no unauthorized modification/deletion** —
  every mutating route is gated by `@RequirePermission()`.

## 15. Full API Surface

All routes are under `/api/v1` (existing prefix/versioning, unchanged).

**Customers** (`/customers`): `GET` (list, paginated/searchable/filterable
by `companyId`/`branchId`/`customerGroupId`/`status`), `POST`, `GET /:id`,
`PATCH /:id`, `POST /:id/activate`, `POST /:id/deactivate`,
`POST /:id/block`, `DELETE /:id` (soft).

**Suppliers** (`/suppliers`): same shape as Customers (filterable by
`companyId`/`branchId`/`supplierGroupId`/`status`).

**Customer Groups** (`/customer-groups`): `GET`, `POST`, `GET /:id`,
`PATCH /:id`, `POST /:id/activate`, `POST /:id/deactivate`,
`DELETE /:id` (soft, 409 if referenced).

**Supplier Groups** (`/supplier-groups`): same shape as Customer Groups.

**Payment Terms** (`/payment-terms`): same shape as Customer Groups (409
if referenced by any Customer or Supplier).

**Customer Addresses** — dual nested + flat convention, matching Phase
10's `/products/:id/variants` + `/product-variants/:id` pattern exactly:
- `GET /customers/:customerId/addresses` (list)
- `POST /customers/:customerId/addresses` (create)
- `GET /customer-addresses/:id`
- `PATCH /customer-addresses/:id`
- `DELETE /customer-addresses/:id` (soft)

**Supplier Addresses**: identical shape under `/suppliers/:supplierId/addresses`
and `/supplier-addresses/:id`.

**Customer Contacts**: identical shape under `/customers/:customerId/contacts`
and `/customer-contacts/:id`.

**Supplier Contacts**: identical shape under `/suppliers/:supplierId/contacts`
and `/supplier-contacts/:id`.

Every list endpoint reuses the shared `PaginationDto` (`page`/`limit`/
`sort`/`order`) and `resolveSortField()` allowlist utility from Phase 04 —
no new pagination mechanism.

## 16. Database Schema / Indexes / FK Behavior

Migration `1786534701530-CreateCustomerSupplierTables.ts` creates 9
tables, InnoDB, `utf8mb4`/`utf8mb4_unicode_ci`, UUID (`CHAR(36)`) PKs,
snake_case columns, `created_at`/`updated_at`/`deleted_at` via
`BaseEntity` on every table:

| Table | Unique index | FKs (ON DELETE) |
|---|---|---|
| `customer_groups` | `(company_id, code)` | `company_id → companies` RESTRICT |
| `supplier_groups` | `(company_id, code)` | `company_id → companies` RESTRICT |
| `payment_terms` | `(company_id, code)` | `company_id → companies` RESTRICT |
| `customers` | `(company_id, customer_code)` | `company_id → companies` RESTRICT, `branch_id → branches` RESTRICT, `customer_group_id → customer_groups` RESTRICT, `payment_term_id → payment_terms` RESTRICT |
| `suppliers` | `(company_id, supplier_code)` | `company_id → companies` RESTRICT, `branch_id → branches` RESTRICT, `supplier_group_id → supplier_groups` RESTRICT, `payment_term_id → payment_terms` RESTRICT |
| `customer_addresses` | — | `customer_id → customers` **CASCADE** |
| `supplier_addresses` | — | `supplier_id → suppliers` **CASCADE** |
| `customer_contacts` | — | `customer_id → customers` **CASCADE** |
| `supplier_contacts` | — | `supplier_id → suppliers` **CASCADE** |

**CASCADE** is used only on the address/contact owner FKs — deleting a
Customer/Supplier's owned child rows is correct ownership semantics; since
Customer/Supplier themselves are soft-delete only in normal application
flow, this cascade is a rarely-fired backstop for the hard-delete case,
not something the API triggers in practice. **RESTRICT** is used
everywhere else, including Company/Branch/CustomerGroup/SupplierGroup/
PaymentTerm references — deleting a company-scope parent, a group, or a
payment term that is still referenced must never silently orphan a
Customer/Supplier row; the service-level 409 checks (see "CustomerGroup /
SupplierGroup Architecture", "Payment Terms") are the primary UX-facing
guard, and these FKs are the hard database backstop behind them, matching
the Phase 09 Category precedent exactly.

Indexes: `status`, `company_id`, `phone`, `email` on both `customers` and
`suppliers` (justified by the documented search-by-phone/email
requirement in Phase 11.md §22); `status`/`company_id` on all three
group-like tables; `customer_id`/`supplier_id` on the four address/contact
tables (the only column ever filtered on directly for those tables).
`branch_id`/`customer_group_id`/`supplier_group_id`/`payment_term_id` gain
an index automatically as MySQL indexes FK columns by default (confirmed
in the live `SHOW CREATE TABLE` output — see the final report's migration
evidence).

**Composite-unique-index byte-length check** (the Phase 10
`combination_key` bug class): the widest unique index here is
`(company_id CHAR(36), customer_code VARCHAR(50))` /
`(company_id CHAR(36), supplier_code VARCHAR(50))` — `36×4 + 50×4 = 344`
bytes for utf8mb4, far under MySQL's 3072-byte max key length. No risk of
`ER_TOO_LONG_KEY` here; checked proactively before writing the migration,
not discovered after a failure.

## 17. Transactions

`TransactionService.run()` (Phase 04) is **not** used anywhere in Phase
11. Every create/update operation in this phase is a single-table,
single-row write (Customer create, Address create, etc.) — there is no
multi-table atomic requirement, since Phase 11.md's own inline-creation
suggestion ("Create Customer + Create Address + Create Assignment") is not
actually required by any Phase 11 endpoint: addresses/contacts are always
created via their own separate endpoints, never inline with Customer/
Supplier creation. Wrapping single-row writes in a transaction for no
reason was explicitly avoided per the locked constraints ("Don't wrap
single-table single-row operations in a transaction for no reason").

## 18. Phase 12/13/16/17 Integration Points

- **`Customer.id`/`Supplier.id`** are the stable identities future phases
  reference — never re-derive a customer/supplier concept elsewhere.
- **Phase 12 (Sales)** is expected to: (a) call
  `DataScopeService.resolveAllowedOrganizationIds()` exactly as Phase
  08/09/10 do, rather than re-deriving visibility logic; (b) define its
  own transaction-time Sales Account attribution (see "SalesAccount /
  DataScope.ACCOUNT Deferral" above) — Phase 11 intentionally leaves this
  open, not half-built; (c) snapshot Customer name/contact/credit values
  at transaction time, never live-reference mutable Customer fields,
  matching the same "snapshot, don't live-reference" principle
  `docs/PRODUCT_VARIANT_PRICING_ARCHITECTURE.md` established for
  Product/Price.
- **Phase 13 (Purchase)** mirrors the above for `Supplier.id`.
- **Phase 16 (Payment)** will read `Customer.creditLimit`/`creditDays` and
  `Supplier.creditDays` as configured policy inputs, and is the first
  phase expected to actually calculate any running balance — Phase 11's
  `openingBalanceAmount` is not itself a balance-tracking mechanism Phase
  16 extends; Phase 16/17 together are expected to build a real ledger
  that is *seeded from*, not *built on top of*, this field.
  `receivableAccountId`/`payableAccountId` remain inert until Phase 16/17
  give them meaning.
- **Phase 17 (Accounting/Double-Entry)** owns: giving
  `receivableAccountId`/`payableAccountId` a real FK target once a Chart
  of Accounts table exists; consuming `openingBalanceAmount` as the seed
  value for an initial opening-balance journal entry; all double-entry
  logic. Phase 11 deliberately builds nothing toward this beyond the two
  placeholder columns.

## 19. Intentionally Deferred / Not Built in Phase 11

- No `Party`/`BusinessParty`/`PartyAddress`/`PartyContact`/
  `UniversalParty` shared abstraction.
- No `Currency` entity — no currency field exists on Customer/Supplier at
  all (Phase 11.md's own field lists never list one; the locked
  constraint says only add one "if the spec or reasonable read of it
  actually calls for it" — it does not).
- No GL Account / Chart of Accounts / ledger / journal entry table.
- No `CustomerSalesAccountAssignment` or any permanent SalesAccount
  relationship on Customer/Supplier.
- No live/current-balance calculation, no payment collection, no overdue
  calculation.
- No credit-blocking logic on any future Sales/Purchase flow (none exists
  yet to block).
- No Sales Order / Sales Invoice / Purchase Order / Purchase Invoice /
  Inventory transaction / Stock movement / Payment transaction / Journal
  Entry / General Ledger / Promotion / Coupon / Tax engine / Unit-UOM
  entity of any kind.
- No Audit Log system — none exists anywhere in this codebase as of Phase
  10 (grepped and confirmed prior to this phase); Phase 11.md §20 asks
  Phase 11 to "reuse Phase 04/Core infrastructure if already implemented,"
  and since it is not implemented, no second audit system was invented to
  fill the gap, consistent with the locked "do not silently invent
  architecture" rule. This is a pre-existing gap carried forward, not
  introduced by Phase 11.
- No Bruno API collection — consistent with every prior phase (no prior
  phase 01-10 established Bruno tooling in this repository, so one was
  not created now).

---

## Locked Decisions (Decision Record)

This section restates, as durable architecture rather than one-time
instruction, the constraints Phase 11 was built against:

1. Customer and Supplier are two independently modeled entities — no
   Party abstraction, no shared base table.
2. Addresses live in `CustomerAddress`/`SupplierAddress`, never a shared
   `PartyAddress` table; ownership is always re-verified server-side.
3. Contacts live in `CustomerContact`/`SupplierContact`, never a shared
   `PartyContact` table; same ownership rule.
4. `CustomerGroup` and `SupplierGroup` are real, persisted, configurable
   entities — never hardcoded enums.
5. One shared `PaymentTerm` entity, referenced by both Customer and
   Supplier, kept semantically separate from Credit Limit.
6. Customer gets `creditLimit` + `creditDays`; Supplier gets `creditDays`
   only — both validated `>= 0`, neither implements live balance/credit
   blocking logic.
7. `opening_balance_amount` is the exact DB column name on both tables,
   forever initial-master-data-only, never a current balance, never
   ledger-writing — Phase 17's concern entirely.
8. `receivable_account_id` (Customer) / `payable_account_id` (Supplier)
   are nullable UUID columns with no FK — no GL Account entity was
   invented to give them one prematurely.
9. No `CustomerSalesAccountAssignment` table; `DataScope.ACCOUNT` stays
   unresolved for Customer/Supplier in this phase, documented as an
   intentional deferral to Phase 12.
10. `Currency` is not modeled on Customer/Supplier at all — no basis for
    it existed in the spec's field lists.
11. Company-scoped is the primary tenancy key; `branchId` is optional and,
    when present, validated against the resolved company exactly like
    Warehouse/Employee.
12. `DataScopeService` is reused as-is — no
    `CustomerDataScopeService`/`SupplierDataScopeService`/new scope enum.
13. Dynamic RBAC only, extending the existing idempotent seed — including
    the SUPER_ADMIN ALL-scope `RoleResourceScope` grant per new resource.
14. MySQL/TypeORM/UUID PKs/snake_case/InnoDB/utf8mb4/soft-delete
    conventions inherited unmodified from Phase 03.
15. No new `ValidationPipe`, no new pipe of any kind.
16. Cross-company lookups return 404, never 403 — never leak existence.
17. REST under `/api/v1`, nested + flat address/contact routes matching
    the Phase 10 `/products/:id/variants` convention.
18. No unnecessary transactions — only single-table, single-row writes
    exist in this phase.
19. Comprehensive unit + e2e tests, migration UP/DOWN/UP verified against
    live Docker MySQL with real schema evidence.
20. Left uncommitted for review, consistent with Phase 09/10's own
    convention.
