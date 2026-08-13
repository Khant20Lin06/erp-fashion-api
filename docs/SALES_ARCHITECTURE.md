# Sales Architecture (Phase 12)

This document describes the Phase 12 — Sales module: `Sale` (header) and
`SaleItem` (line), the concurrency-safe sale-numbering mechanism, the
pricing/customer snapshot principles, SalesAccount attribution, DataScope
behavior, lifecycle, and the explicit boundaries around tax, audit,
inventory, payment, and accounting. Every locked decision below overrides
`‌ai/Phase 12.md`'s illustrative prompt wherever the two conflict — that
file is a starting vocabulary, not a spec this phase followed verbatim.

---

## 1. Scope

`src/modules/sales/` contains exactly three entities (`Sale`, `SaleItem`,
`CompanySaleCounter`), one service (`SalesService`), one controller
(`SalesController`), and their DTOs. No Purchase, Inventory, Payment,
Accounting, Tax, Currency, Unit, AuditLog, Approval-workflow, or
Promotion/Coupon code exists anywhere in this module — see §14 "Phase
Boundary" below and the grep evidence in the Phase 12 implementation
report.

## 2. Sale (header) architecture

`Sale extends BaseEntity` (`id`, `createdAt`, `updatedAt`, `deletedAt` —
soft-deletable). Fields:

| Field | Type | Notes |
|---|---|---|
| `saleNumber` | `varchar(50)` | Unique per company (`UNIQUE(company_id, sale_number)`) |
| `saleType` | enum `POS \| RETAIL \| WHOLESALE` | See §3 |
| `customerId` | FK → `customers`, RESTRICT | Required |
| `salesAccountId` | FK → `sales_accounts`, RESTRICT, nullable | See §6 |
| `companyId` | FK → `companies`, RESTRICT | Required |
| `branchId` | FK → `branches`, RESTRICT, nullable | Optional org scope |
| `warehouseId` | FK → `warehouses`, RESTRICT, nullable | Optional org scope |
| `transactionDate` | `timestamp` | Defaults to now() if omitted |
| `status` | enum `DRAFT \| CONFIRMED \| CANCELLED` | See §8 |
| `subtotal`, `discountAmount`, `taxAmount`, `grandTotal` | `decimal(14,2)` | Server-computed only |
| `paidAmount`, `balanceAmount` | `decimal(14,2)` | Inert Phase 16 integration fields, see §11 |
| `currency` | `char(3)` | Regex-validated ISO-4217, no `Currency` entity |
| `notes` | `varchar(1000)`, nullable | |
| `createdBy` / `updatedBy` | FK → `users`, RESTRICT, nullable | |

Every FK from `Sale` to organizational/customer/sales-account data is
**RESTRICT** — a Sale is a historical financial record and must never be
silently orphaned or cascade-deleted when its Company, Branch, Warehouse,
Customer, or SalesAccount is removed.

### Money precision: DECIMAL(14,2), not DECIMAL(12,2) or DECIMAL(18,2)

Phase 09-11 established two precedents: `DECIMAL(12,2)` for
`ProductVariant`/`PriceListItem` (single-item prices, Phase 10) and
`DECIMAL(14,2)` for `Customer.creditLimit`/`openingBalanceAmount` (Phase
11, whole-account/whole-transaction figures). `Sale`/`SaleItem` money
columns use `DECIMAL(14,2)` to match the latter: a multi-line Sale's
`grandTotal` sums several line totals and can meaningfully exceed any
single product's price, so the wider whole-transaction precision is the
more defensible choice. `Phase 12.md`'s illustrative `DECIMAL(18,2)` was
not used — there is no evidence anywhere in this codebase's actual data
(no currency requiring 16-digit integer parts) that justifies going wider
than the existing `DECIMAL(14,2)` precedent.

### SaleType: a minimal, defensible enum

`POS | RETAIL | WHOLESALE` — not the illustrative
`POS/RETAIL/WHOLESALE/CREDIT/CASH/ONLINE` list. `POS` and `RETAIL`
distinguish the two channel concepts a fashion ERP+POS system needs at
the header level for reporting/filtering; `WHOLESALE` covers bulk/B2B
sales, referenced throughout `Phase 12.md`. `CREDIT`/`CASH` describe a
*payment* dimension, not a sale-type/channel dimension — conflating them
into this enum would mix two unrelated axes; that distinction belongs to
the future Payment phase. `ONLINE` was left out: no backend or frontend
evidence of an actual e-commerce channel integration exists in this
codebase, and inventing a channel with no consumer was avoided.

## 3. SaleItem (line) architecture

`SaleItem` is **not** a `BaseEntity` subclass — it has its own
`id`/`createdAt`/`updatedAt` but no `deletedAt`. Fields:

| Field | Type | Notes |
|---|---|---|
| `saleId` | FK → `sales`, **CASCADE** | Meaningless without its parent |
| `productVariantId` | FK → `product_variants`, **RESTRICT** | Never orphan historical sale data |
| `quantity` | `int`, `> 0` | |
| `unitPriceSnapshot` | `decimal(14,2)` | Resolved once at creation, never re-resolved |
| `discountSnapshot` | `decimal(14,2)`, default 0 | Server-validated pass-through, see §4 |
| `taxSnapshot` | `decimal(14,2)`, default 0 | Server-validated pass-through, see §9 |
| `lineTotal` | `decimal(14,2)` | `(unitPriceSnapshot * quantity) - discountSnapshot + taxSnapshot` |
| `productNameSnapshot` | `varchar(200)` | Captured from `Product.name` at creation |
| `skuSnapshot` | `varchar(100)` | Captured from `ProductVariant.sku` at creation |

### Why no independent soft delete on `sale_items`

`SaleItem` rows are never independently created, updated, or deleted
outside of `Sale` creation — there is no `PATCH`/`DELETE` endpoint for a
line item, and deleting a `Sale` (which no API endpoint in this phase
does — deletion is out of scope) would correctly `CASCADE`. A
`deletedAt` column on a table that never receives an independent delete
would be pure schema noise.

## 4. Sale Number Architecture (concurrency)

### The problem `SELECT MAX(sale_number) + 1` has

Under concurrent `POST /sales` requests, two transactions can both read
the same "current max" before either commits, producing a duplicate sale
number and a unique-constraint failure (or worse, silently accepted
duplicates without the constraint). This phase does not use that
pattern anywhere.

### The mechanism actually used

A dedicated table, `company_sale_counters`, holds one row per
`(company_id, year)`, with an integer `last_sequence` column. Inside the
**same transaction** as Sale/SaleItem creation
(`SalesService.generateSaleNumber()`, called from within
`TransactionService.run()`):

1. `INSERT INTO company_sale_counters (id, company_id, year, last_sequence) VALUES (UUID(), ?, ?, 0) ON DUPLICATE KEY UPDATE last_sequence = last_sequence` — a no-op upsert that guarantees the row exists, without itself racing: if two transactions attempt this concurrently for a brand-new `(company, year)` pair, MySQL's `ON DUPLICATE KEY UPDATE` makes exactly one insert win and the other becomes a lock-compatible update, rather than either failing on the unique constraint or silently creating two rows.
2. The counter row is then locked with `SELECT ... FOR UPDATE` (TypeORM's `manager.createQueryBuilder(CompanySaleCounter, ...).setLock('pessimistic_write')`), which blocks any concurrent transaction trying to lock the same row until this one commits or rolls back.
3. `lastSequence` is incremented and saved.
4. The sale number is formatted as `SAL-<year>-<6-digit zero-padded sequence>`, e.g. `SAL-2026-000001` (`src/modules/sales/utils/sale-number.ts`).

This sequence resets per calendar year per company (hence the composite
`(company_id, year)` key) — a deliberate default matching the illustrative
format in `Phase 12.md`, adapted since no other numbering convention
existed anywhere else in this codebase to defer to.

### Why this is safe

Because the counter-row lock is taken **inside the same transaction** as
the rest of Sale creation, a second concurrent request for the same
company simply blocks at the `FOR UPDATE` step until the first request's
whole transaction (Sale + all SaleItems) commits or rolls back — there is
no window where two transactions can compute the same `lastSequence`
value. This was proven with a real concurrency test (10 parallel
`POST /sales` requests, `Promise.all`, asserting all resulting
`saleNumber`s are unique and none fail — see §Testing in the
implementation report).

## 5. Pricing Snapshot

At Sale creation, for each item:

1. `ProductVariant` is resolved and validated (exists, active, belongs to
   the resolved company) — reuses `ProductVariantsService.findByIdInCompany()`
   from Phase 10 verbatim.
2. A `PriceList` is resolved: if the client supplied `priceListId` on
   the item, it is validated to belong to the resolved company and be
   `ACTIVE`. If omitted, and the company has **exactly one** `ACTIVE`
   `PriceList`, that one is used automatically. If the company has zero
   or multiple active price lists and no `priceListId` was supplied, the
   request is rejected with a validation error — ambiguity is never
   silently guessed.

   This rule was chosen because Phase 10's `PriceList` entity has no
   "default/current" flag — inventing one now would mean extending
   Phase 10's data model unilaterally, which this phase avoids. Requiring
   an explicit `priceListId` whenever more than one candidate exists is
   the conservative, honest choice.

3. The currently-active `PriceListItem` for that `(priceListId,
   productVariantId)` pair is resolved with the exact window Phase 10
   already established: `validFrom <= now() AND (validTo IS NULL OR
   validTo > now())`. No price-priority/tiered-pricing engine exists —
   this is a single point-in-time query.
4. The resolved `price` is stored verbatim into `unitPriceSnapshot`.

### Server-side total computation

The client may supply, per item, only `discountAmount` and `taxAmount`
(both optional, validated non-negative decimal strings) — **no**
`unitPrice`, `subtotal`, or `lineTotal` field exists anywhere in
`CreateSaleItemDto`. Submitting any of those extra fields is rejected
outright with 400 by the existing global `ValidationPipe`
(`forbidNonWhitelisted: true`) — a stronger guarantee than "the server
silently ignores it," since the request never even reaches business
logic. Likewise, `CreateSaleDto` has no `subtotal`/`grandTotal` fields.

Per line: `lineTotal = (unitPriceSnapshot * quantity) - discountSnapshot
+ taxSnapshot`. A per-line `discountAmount` that exceeds the line's own
`unitPriceSnapshot * quantity` is rejected (400) — a line can never
have negative net value from a discount alone.

`Sale.subtotal`/`discountAmount`/`taxAmount`/`grandTotal` are the sums of
every resolved line's respective components, computed entirely inside
the transaction from the server-resolved values — never from anything in
the request body.

### Verified via a real e2e test

`test/sales.e2e-spec.ts`'s "pricing snapshot correctness" test creates a
Sale, then closes and replaces the underlying `PriceListItem` with a
much higher price, then re-fetches the Sale and asserts
`unitPriceSnapshot` is unchanged — proving the snapshot, not a live
reference.

## 6. SalesAccount Integration — transaction-level attribution only

`Sale.salesAccountId` is nullable. This is a **deliberate, locked
architectural decision**, carried forward from Phase 11's own explicit
deferral (`docs/CUSTOMER_SUPPLIER_ARCHITECTURE.md` §10/§18 —
"SalesAccount/DataScope.ACCOUNT deferral"):

- **No permanent `Customer` ↔ `SalesAccount` assignment table exists.**
  Attribution is a per-transaction business fact, not master data.
- **No modification to `DataScopeService`.** `ACCOUNT`/`TEAM`/`OWN`
  scopes still resolve to `[]` (unresolvable, safe-default) exactly as
  Phase 06/08 left them — Phase 12 does not add `ACCOUNT` resolution.
- **`SalesAccountAccessService.canAccessSalesAccount(userId,
  salesAccountId)` is the ONLY authorization mechanism** used to decide
  whether a user may attribute a Sale to a given SalesAccount. There is
  no second mechanism, no permission-based bypass, and no
  DataScope-breadth-based bypass — proven by a dedicated e2e test where
  SUPER_ADMIN itself (full permissions, `ALL` data scope on every
  resource) is still rejected with 403 when it holds no active
  `SalesAccountAssignment` row for the target account.

### Validation flow when `salesAccountId` is supplied

1. Load the `SalesAccount` by id. If it does not exist, or its
   `companyId` does not match the resolved Sale company: **404** — this
   matches the established cross-company-hides-behind-404 (IDOR-safe)
   convention used by every prior phase for cross-company lookups
   (never leak whether the id exists in a different company).
2. If it exists and is company-matched but is not `ACTIVE`: **400**
   (validation error — an inactive account is a real, visible resource,
   not a hidden one).
3. Call `canAccessSalesAccount(userId, salesAccountId)`. If `false`:
   **403** (Forbidden) — the account exists, is active, and is
   company-matched, but this specific user is not authorized to operate
   it. This is a genuine permission distinction from "doesn't exist,"
   consistent with this codebase's general 404-vs-403 convention
   (cross-company/nonexistent → 404; within-company-but-unauthorized →
   403).

If `salesAccountId` is omitted entirely, the Sale is created with
`salesAccountId = null` — always allowed, no attribution required.

## 7. Customer Integration

`Sale.customerId` is required. Resolution reuses
`CustomersService.findByIdInCompany()` verbatim (Phase 11) — exists,
not soft-deleted, belongs to the resolved company. A cross-company or
nonexistent `customerId` is **404**, matching Phase 11's own established
IDOR-hiding convention for cross-company Customer lookups. A `BLOCKED`
customer (Phase 11's three-value status) is rejected with 400 at Sale
creation — the one piece of business logic this phase adds on top of
Customer's existing status, since Phase 11 explicitly left "does BLOCKED
prevent transacting" unresolved for the first business module to decide.

No customer field snapshot is stored on `Sale` beyond `customerId`
itself — unlike `SaleItem`'s product/SKU snapshot, a full Customer
name/contact snapshot was **not** added to `Sale`, because `customerId`
plus the existing, permanently-preserved (soft-delete only, never
hard-deleted) `Customer` row is sufficient to reconstruct historical
customer identity; Customer master-data fields Phase 11 itself
documents as non-live (credit limit, opening balance) are not
transaction-critical the way Product price is.

## 8. Organization Scope

`companyId` is required, resolved via the unmodified
`resolveRequestCompanyId()` helper (Phase 09) — client-supplied
`companyId` is never trusted directly, only used as a lookup key checked
against the user's own resolved allowed-company list.

`branchId`/`warehouseId` are optional. When supplied:

- `branch.companyId === companyId` is enforced (400 if not) — mirrors
  the Warehouse cross-company check Phase 07 established.
- `warehouse.companyId === companyId` is enforced (400 if not).
- When **both** are supplied, `warehouse.branchId === branchId` is also
  enforced (400 if not) — the exact "Warehouse actually belongs to a
  different branch than claimed" spoofing scenario Phase 07/08 already
  reject for Warehouse/membership creation, replicated here.

## 9. DataScope

`DataScopeService` (Phase 06/08, untouched by this phase) is reused only
for `COMPANY`/`BRANCH`/`WAREHOUSE`/`ORGANIZATION`/`ALL` scope resolution
via `resolveRequestCompanyId()`. `ACCOUNT`/`TEAM`/`OWN` scopes continue
to resolve to `[]` exactly as before — Phase 12 does not touch
`DataScopeService`'s code at all. Sales-specific ownership (who may
attribute a transaction to a given SalesAccount) is answered entirely by
`SalesAccountAccessService`, a deliberately separate mechanism (§6), not
folded into `DataScopeService`.

## 10. Lifecycle

Three states only: `DRAFT`, `CONFIRMED`, `CANCELLED`. No
`PENDING_APPROVAL`/`PARTIALLY_PAID`/`PAID`/`COMPLETED` — no approval
workflow, no payment-status state exists in this phase.

| From \ To | DRAFT | CONFIRMED | CANCELLED |
|---|---|---|---|
| **DRAFT** | — | ✅ allowed | ✅ allowed |
| **CONFIRMED** | ❌ 409 | ❌ 409 (no-op re-confirm) | ❌ 409 |
| **CANCELLED** | ❌ 409 | ❌ 409 | ❌ 409 (no-op re-cancel) |

Every rejected transition returns **409 Conflict** — the same
business-rule-violation status Phase 07 established for
"deletion blocked while active children exist."

Two dedicated endpoints only: `POST /sales/:id/confirm`,
`POST /sales/:id/cancel`. **No generic `PATCH /sales/:id` endpoint
exists at all** — not even for `notes`. Nothing concrete in this phase's
scope required a limited-field update path, and `Phase 12.md` itself
warns not to be copied blindly; omitting a generic update endpoint is
the safer, more defensible choice than building one nobody asked for
that could become an accidental backdoor into mutating financial fields.
Once `CONFIRMED`, a Sale's financial/historical fields are therefore
immutable by construction — there is no code path that can change them.

## 11. Payment Boundary (inert integration point)

`Sale.paidAmount` (default `0.00`) and `Sale.balanceAmount` (initialized
to `grandTotal` at creation) exist purely as **inert integration-point
fields** for a future Payment phase (Phase 16 in this roadmap's
numbering). Nothing in Phase 12 ever writes to `paidAmount` again after
creation, and `balanceAmount` is never recalculated by this phase. No
`Payment` entity, ledger, or reconciliation logic exists anywhere in
`src/modules/sales/`.

## 12. Inventory Boundary (integration point, no logic)

No stock/inventory check, deduction, or reservation logic exists
anywhere in this phase. `warehouseId` is captured on `Sale` purely as an
organizational-scope field (validated the same way `branchId` is) — it
is **not** used to validate stock availability, because no
Inventory/Stock/StockMovement entity exists yet in this codebase. A
future Inventory phase is expected to consume `Sale`/`SaleItem` rows
(specifically `productVariantId`, `quantity`, `warehouseId`) as its
integration point, but Phase 12 does not invent any placeholder
stock-check to simulate this.

## 13. Accounting Boundary (integration point, no logic)

No `JournalEntry`/`Ledger`/`GLAccount`/Chart-of-Accounts table exists.
`Sale.grandTotal` and friends are the eventual source data a future
Accounting phase would post from, but no posting/journal logic exists in
this phase. `Customer.receivableAccountId` (Phase 11's inert FK-less
placeholder) remains untouched and unreferenced by this phase.

## 14. Tax Boundary — explicit, honest limitation

**Phase 12 has no tax rate engine.** There is no `Tax` entity, no tax
module, and no hardcoded rate (the frontend's mock 8% constant is not a
backend requirement and was not replicated here). `SaleItem.taxSnapshot`
is a **server-validated pass-through value only**: the client may supply
an optional, non-negative `taxAmount` per line item; the server validates
it is `>= 0` and includes it verbatim in its own `lineTotal`/`Sale.taxAmount`
computation. There is no rate lookup, no tax-jurisdiction logic, and no
tax-exemption logic anywhere. A future Tax phase would need to replace
this with a real rate-resolution engine and would likely need to migrate
existing `taxSnapshot` values or treat them as a historical baseline.

## 15. Audit Log — explicit deferral

**No `AuditLog` entity, service, table, module, or event-infrastructure
of any kind exists anywhere in this codebase**, confirmed absent through
Phase 11 and still absent after Phase 12. This is consistent with every
phase since Phase 09 flagging the same pre-existing gap without
unilaterally inventing audit infrastructure. A future phase that
introduces real audit trails would need to instrument `SalesService`'s
`create()`/`confirm()`/`cancel()` methods (the natural integration
points) — Phase 12 does not build that instrumentation now.

## 16. Concurrency Strategy Summary

The only concurrency-sensitive operation in this phase is sale-number
generation (§4), solved with a locked counter row inside the same
transaction as Sale/SaleItem creation. `TransactionService.run()`
(Phase 04, unmodified) wraps the entire multi-step `create()` flow:
company/customer/org validation happens before the transaction opens
(read-only, no lock needed); SalesAccount validation, counter locking,
price resolution, and all `Sale`/`SaleItem` row creation happen inside
one `manager`-scoped transaction. Any failure at any step — an invalid
`productVariantId` mid-loop, a SalesAccount authorization failure, a
missing active price — rolls back the entire transaction, leaving zero
partial `Sale`/`SaleItem` rows. Proven by a dedicated e2e test (one
valid item + one invalid `productVariantId`, asserting zero `sales` and
`sale_items` rows exist afterward) and a real 10-way parallel
`POST /sales` concurrency test asserting unique sale numbers with no
unexpected failures.

## 17. Security Decisions Summary

- Never trust client-submitted price/discount/tax/subtotal/grandTotal —
  `CreateSaleDto`/`CreateSaleItemDto` simply have no fields for most of
  these, and `forbidNonWhitelisted` rejects any attempt to submit them
  (400), stronger than silently ignoring them.
- Cross-company Customer/SalesAccount/ProductVariant/Branch/Warehouse →
  404 (IDOR-safe, no existence leak) or 400 (validation error) per this
  codebase's established convention; within-company-but-unauthorized
  SalesAccount → 403 (a distinct, real permission failure).
- No generic PATCH — status can only move via dedicated,
  permission-gated endpoints, and financial fields have no update path
  at all once created.
- All new endpoints protected by `JwtAuthGuard` + `PermissionGuard` +
  `@RequirePermission()`, matching every prior phase exactly. Zero
  hardcoded role-name checks anywhere in `src/modules/sales`.

## 18. RBAC

Permissions (plural, `resource.action`, matching every prior phase's
convention — never singular `sale.*`):

- `sales.read`, `sales.create`, `sales.update` (reserved for future use —
  no current endpoint consumes it, since no update endpoint exists;
  kept in the catalog so a future limited-PATCH doesn't require a
  fresh migration to add the permission), `sales.delete` (reserved,
  same reasoning — soft-delete-before-confirm was not built since
  nothing concrete required it), `sales.confirm`, `sales.cancel`.
- `sale_items.read` (line items are only ever read as part of a Sale's
  `items` relation — no standalone SaleItem endpoint exists, but the
  permission exists for a future dedicated line-item read path).

All seven permissions are granted to `SUPER_ADMIN` via the existing
idempotent `rbac.seed.ts`, plus the mandatory `RoleResourceScope`
`ALL`-scope row for both `sales` and `sale_items` — the
Phase-09-discovered gap-closing step every phase since has had to
repeat (without it, SUPER_ADMIN itself would be locked out of the new
resources via `resolveRequestCompanyId()`'s `resolveScope()` call).

## 19. Database

Three new tables, `sales`/`sale_items`/`company_sale_counters`,
InnoDB/utf8mb4/utf8mb4_unicode_ci, UUID (`varchar(36)`) primary keys,
snake_case columns. `sales` is soft-delete only (`deleted_at`);
`sale_items` and `company_sale_counters` are not (see §3 for
`sale_items`'s reasoning; `company_sale_counters` is a pure counter row
with no independent business meaning to soft-delete).

Indexes: `customer_id`, `sales_account_id`, `status`, `company_id`,
`branch_id`, `warehouse_id`, `transaction_date`, `sale_type` on `sales`;
`sale_id`, `product_variant_id` on `sale_items`. Unique constraints:
`(company_id, sale_number)` on `sales`, `(company_id, year)` on
`company_sale_counters`.

## 20. Migration

`src/database/migrations/1786550000000-CreateSalesTables.ts` — verified
`up()`/`down()`/`up()` against real Dockerized MySQL, with `SHOW CREATE
TABLE` output inspected directly for all three tables (see the Phase 12
implementation report for the full command transcript). Table creation
order respects FK dependencies:
`company_sale_counters` → `sales` → `sale_items`.

## 21. API

```
GET    /api/v1/sales                 sales.read
GET    /api/v1/sales/:id             sales.read
POST   /api/v1/sales                 sales.create
POST   /api/v1/sales/:id/confirm     sales.confirm
POST   /api/v1/sales/:id/cancel      sales.cancel
```

No `PATCH`/`DELETE` on `/sales` or `/sales/:id`. List/detail support the
shared `PaginationDto`/`resolveSortField()` (sortable:
`createdAt`/`transactionDate`/`saleNumber`/`grandTotal`/`status`) and
filters (`companyId`, `branchId`, `warehouseId`, `customerId`,
`salesAccountId`, `status`, `saleType`, `search` on `saleNumber`).

## 22. Known Limitations / Deferred Items

- **No tax engine** — see §14.
- **No audit log** — see §15.
- **No approval workflow** — no `PENDING_APPROVAL` state, no approver
  role/permission, no approval history table.
- **No stock/inventory check** — `warehouseId` is scope-only; a future
  Inventory phase must add real availability validation.
- **No payment recording** — `paidAmount`/`balanceAmount` are
  initialize-only fields, never updated by this phase.
- **No accounting/journal posting.**
- **No generic update endpoint** — a DRAFT sale can only be replaced by
  creating a new one; nothing in this phase's scope required editing an
  existing DRAFT sale's items/notes.
- **No idempotency-key mechanism** on `POST /sales` — retried requests
  (e.g. a client double-submit) will create two separate DRAFT sales,
  each with its own unique sale number, rather than being deduplicated.
  This was not built because no existing infrastructure for
  idempotency keys exists anywhere in this codebase to reuse, and
  inventing one is a cross-cutting concern beyond this phase's scope —
  flagged here as a real, honest gap rather than silently ignored.
- **No dashboard/summary/aggregate endpoints** — `Phase 12.md`'s
  illustrative `/sales/summary`/`/sales/dashboard` were not built; a
  future Reports/Dashboard phase (Phase 22 per the illustrative roadmap)
  owns that.
- **PriceList resolution requires exactly one active list, or an
  explicit `priceListId` per item** — see §5. No multi-price-list
  priority/tier engine exists.

## 23. Phase 13/14/15/16/17 Integration Points

- **Phase 13 (Purchase)**: the `company_sale_counters` /
  `SELECT ... FOR UPDATE` pattern established here (§4) is the reusable
  template for Purchase-Order document numbering — the same race the
  Sale-number problem has applies identically to Purchase Order numbers.
  `Supplier` (Phase 11) is the equivalent ready-to-reference identity, the
  same way `Customer` was for this phase.
- **Phase 14/15 (Inventory / Inventory Ledger)**: `SaleItem.productVariantId`
  + `quantity` + `Sale.warehouseId` are the exact fields a real stock
  deduction would consume on `confirm()`. No fake stock logic was added
  here to simulate this — see §12.
- **Phase 16 (Payment)**: `Sale.paidAmount`/`balanceAmount` are the
  integration surface — see §11. A Payment entity would write to these
  fields (or supersede them with a real payment-ledger join) without
  needing any change to `Sale`'s own schema.
- **Phase 17 (Accounting)**: `Sale.grandTotal` and
  `Customer.receivableAccountId` (Phase 11) are the eventual posting
  inputs for a real Chart-of-Accounts/GL integration — see §13.

## 24. Definition of Done

All of the following are true as of this phase's completion (see the
Phase 12 implementation report for the exact evidence — test counts,
schema output, command output):

- Sale/SaleItem/CompanySaleCounter entities implemented per the locked
  decisions above.
- Sale-number generation is concurrency-safe, proven by a real parallel
  `POST /sales` e2e test.
- Pricing is resolved and snapshotted server-side; a price change after
  creation does not affect an existing SaleItem (proven by e2e test).
- Customer/SalesAccount/Company/Branch/Warehouse validation and
  cross-company rejection are all enforced server-side (proven by e2e
  tests).
- Lifecycle transitions are exactly `DRAFT → CONFIRMED` /
  `DRAFT → CANCELLED`; every other transition is rejected 409 (proven by
  e2e tests covering every invalid transition).
- RBAC permissions seeded idempotently, SUPER_ADMIN granted all of them
  plus the `RoleResourceScope` ALL-scope rows.
- Migration verified UP → DOWN → UP against real Dockerized MySQL with
  `SHOW CREATE TABLE` schema inspection.
- Unit tests and e2e tests pass; `npm run build`, `npx tsc --noEmit`,
  `npm run lint` all pass cleanly.
- Zero real implementation of Purchase/Inventory/Payment/
  Accounting/Tax-entity/Currency-entity/Unit-entity/AuditLog/Approval/
  Promotion code anywhere in `src/modules/sales` (grep-verified).
