# Purchase Architecture (Phase 13)

Current-state note as of Friday, August 14, 2026: this document preserves
the original Phase 13 boundary language. Later implemented phases already
supersede statements here that treat Inventory, Payment, Accounting,
Outbox/Kafka, Redis/BullMQ, Notifications, or Reports as future work.

This document describes the Phase 13 — Purchase module: `PurchaseOrder`
(header) and `PurchaseOrderItem` (line), the concurrency-safe purchase-order
numbering mechanism, the cost/tax snapshot principles, Supplier/
ProductVariant/PaymentTerm integration, DataScope behavior, lifecycle, and
the explicit boundaries around Goods Receipt, Purchase Request, Supplier
Invoice, Purchase Return, buyer/requester attribution, inventory, payment,
and accounting. This phase is a direct structural mirror of
`docs/SALES_ARCHITECTURE.md` (Phase 12), with differences called out
explicitly wherever Purchase's own locked decisions diverge from Sale's.

---

## 1. Purchase Domain Boundary

`src/modules/purchase/` contains exactly three entities (`PurchaseOrder`,
`PurchaseOrderItem`, `CompanyPurchaseCounter`), one service
(`PurchaseOrdersService`), one controller (`PurchaseOrdersController`), and
their DTOs. **Phase 13 owns PurchaseOrder only.** No Goods Receipt,
Purchase Request, Supplier Invoice, Purchase Return, Inventory, Stock
Movement, Payment, Accounting, Tax entity/engine, Currency entity,
ExchangeRate, Unit/UOM, Approval Workflow, RFQ, Quotation Comparison,
Budget Limit, Quality Inspection, three-way matching, Audit Log, Outbox,
BullMQ/Redis-queue usage, Promotion/Coupon, or buyer/purchaser/requester
attribution code exists anywhere in this module — see §21-25 below and the
grep evidence in the Phase 13 implementation report.

## 2. PurchaseOrder (header) architecture

`PurchaseOrder extends BaseEntity` (`id`, `createdAt`, `updatedAt`,
`deletedAt` — soft-deletable). Fields:

| Field | Type | Notes |
|---|---|---|
| `purchaseOrderNumber` | `varchar(50)` | Unique per company (`UNIQUE(company_id, purchase_order_number)`) |
| `purchaseType` | enum `STANDARD \| CREDIT` | See §2.1 |
| `supplierId` | FK → `suppliers`, RESTRICT | Required |
| `companyId` | FK → `companies`, RESTRICT | Required |
| `branchId` | FK → `branches`, RESTRICT, nullable | Optional org scope |
| `warehouseId` | FK → `warehouses`, RESTRICT, nullable | Optional org scope — see §17 (Phase 14 integration point) |
| `paymentTermId` | FK → `payment_terms`, RESTRICT, nullable | See §7 |
| `transactionDate` | `timestamp` | Defaults to now() if omitted |
| `expectedDeliveryDate` | `timestamp`, nullable | Informational only — no receiving/due-date logic consumes it in this phase |
| `status` | enum `DRAFT \| CONFIRMED \| CANCELLED` | See §11 |
| `subtotal`, `discountAmount`, `taxAmount`, `grandTotal` | `decimal(14,2)` | Server-computed only |
| `paidAmount`, `balanceAmount` | `decimal(14,2)` | Inert Phase 16 integration fields, see §19 |
| `currency` | `char(3)` | Regex-validated ISO-4217, no `Currency` entity — see §9 |
| `notes` | `varchar(1000)`, nullable | |
| `createdBy` / `updatedBy` | FK → `users`, RESTRICT, nullable | |

Every FK from `PurchaseOrder` to organizational/supplier/payment-term data
is **RESTRICT** — a PurchaseOrder is a historical financial record and
must never be silently orphaned or cascade-deleted when its Company,
Branch, Warehouse, Supplier, or PaymentTerm is removed. This mirrors
`Sale`'s own RESTRICT-everywhere convention exactly.

**No `purchaserId`/`buyerId`/`requesterId`/SalesAccount-equivalent field
exists on `PurchaseOrder`** — this is Decision #9, a locked, explicit
scope decision (not an oversight): Purchase is deliberately kept fully
independent of the SalesAccount/buyer-attribution model Phase 08/12 built
for Sales. See §24.

**No supplier name/contact snapshot** — matching Sale's own non-snapshot
treatment of Customer (`docs/SALES_ARCHITECTURE.md` §7):
`supplierId` plus the existing, permanently-preserved (soft-delete only)
`Supplier` row is sufficient to reconstruct historical supplier identity.

### 2.1. PurchaseType: a minimal, defensible enum

`STANDARD | CREDIT` — not an illustrative larger list. `STANDARD` is the
default/ordinary purchase-order channel. `CREDIT` distinguishes an order
placed against supplier-extended credit terms (`Supplier.creditDays`,
Phase 11) from a standard/immediate-settlement order — a real business
distinction already modeled elsewhere in this codebase's own `Supplier`
entity, not a speculative addition. Unlike `SaleType`'s
`POS/RETAIL/WHOLESALE` split (which distinguishes sales *channels*),
Purchase has no equivalent "channel" concept to enumerate at the header
level, so a narrower two-value enum was used rather than inventing
channel values with no real backend/frontend evidence to justify them.

### Money precision: DECIMAL(14,2), matching Sale

Following the same precedent `docs/SALES_ARCHITECTURE.md` "Money
Precision" documents: `PurchaseOrder`/`PurchaseOrderItem` money columns use
`DECIMAL(14,2)`, not `ProductVariant`/`PriceListItem`'s narrower
`DECIMAL(12,2)`. A multi-line PurchaseOrder's `grandTotal` sums several
line totals and can meaningfully exceed any single product's cost, so the
wider whole-transaction precision is the defensible, consistent choice.

## 3. PurchaseOrderItem (line) architecture

`PurchaseOrderItem` is **not** a `BaseEntity` subclass — it has its own
`id`/`createdAt`/`updatedAt` but no `deletedAt`, mirroring `SaleItem`
exactly. Fields:

| Field | Type | Notes |
|---|---|---|
| `purchaseOrderId` | FK → `purchase_orders`, **CASCADE** | Meaningless without its parent |
| `productVariantId` | FK → `product_variants`, **RESTRICT** | Never orphan historical purchase data; never a `productId`+color+size tuple |
| `quantity` | `int`, `> 0` | |
| `unitCostSnapshot` | `decimal(14,2)` | Client-supplied, server-validated `>= 0` — see §8 |
| `discountSnapshot` | `decimal(14,2)`, default 0 | Server-validated pass-through |
| `taxSnapshot` | `decimal(14,2)`, default 0 | Server-validated pass-through, see §10 |
| `lineTotal` | `decimal(14,2)` | `(unitCostSnapshot * quantity) - discountSnapshot + taxSnapshot` |
| `productNameSnapshot` | `varchar(200)` | Captured from `Product.name` at creation |
| `skuSnapshot` | `varchar(100)` | Captured from `ProductVariant.sku` at creation |

### Why no independent soft delete on `purchase_order_items`

Identical reasoning to `SaleItem` (`docs/SALES_ARCHITECTURE.md` §3):
`PurchaseOrderItem` rows are never independently created, updated, or
deleted outside of `PurchaseOrder` creation — there is no `PATCH`/`DELETE`
endpoint for a line item, and deleting a `PurchaseOrder` (which no API
endpoint in this phase does) would correctly `CASCADE`.

## 4. CompanyPurchaseCounter architecture

One row per `(company_id, year)`, holding an integer `last_sequence`
column — an exact structural mirror of `CompanySaleCounter` (Phase 12).
No `BaseEntity` — this is a pure counter row with no soft-delete/business
meaning of its own. See §12 for the full concurrency mechanism this feeds.

## 5. Supplier Integration

`PurchaseOrder.supplierId` is required. Resolution reuses
`SuppliersService.findByIdInCompany()` verbatim (Phase 11, imported via
`CustomerSupplierModule`, not reimplemented) — exists, not soft-deleted,
belongs to the resolved company. A cross-company or nonexistent
`supplierId` is **404**, matching the established IDOR-hiding convention
this codebase has used since Phase 09 for every cross-company lookup. A
`BLOCKED` supplier (Phase 11's three-value status) is rejected with 400 at
PurchaseOrder creation — the direct Purchase-side analogue of Sale's own
`BLOCKED` Customer rejection (`docs/SALES_ARCHITECTURE.md` §7).

## 6. ProductVariant Integration

Every `PurchaseOrderItem.productVariantId` is resolved and validated
(exists, active, belongs to the resolved company) via
`ProductVariantsService.findByIdInCompany()` (Phase 10), reused verbatim —
never a `productId` + color/size tuple. This is the same identity contract
`SaleItem` uses. Per
`docs/PRODUCT_VARIANT_PRICING_ARCHITECTURE.md` §20 ("Phase 13 Purchase
Integration Point"): Purchase references `ProductVariant.id` for its own
line items and captures its own transactional cost snapshot —
`ProductVariant.costPrice` is a reference/default value only, never the
authoritative purchase cost for a specific transaction (see §8).

## 7. PaymentTerm Integration

`PurchaseOrder.paymentTermId` is optional. When supplied, it is validated
via `PaymentTermsService.findByIdInCompany()` (Phase 11, reused verbatim,
not reimplemented) — must belong to the resolved company (cross-company or
nonexistent → **404**, the same IDOR-hiding convention) and must be
`ACTIVE` (inactive → 400). `PaymentTerm` is the same shared,
company-scoped entity Phase 11 built for both Customer and Supplier
(`docs/CUSTOMER_SUPPLIER_ARCHITECTURE.md` §6/§12) — Phase 13 does not
duplicate or extend it, only references it.

## 8. Cost Snapshot Strategy

Unlike Sale (which resolves `unitPriceSnapshot` server-side from an
active `PriceListItem` — `docs/SALES_ARCHITECTURE.md` §5), **Purchase has
no equivalent pricing-resolution engine.** Per
`docs/PRODUCT_VARIANT_PRICING_ARCHITECTURE.md` §20, `ProductVariant.costPrice`
is reference/default data only. The buyer supplies the actual negotiated
`unitCost` for each line of a specific order via
`CreatePurchaseOrderItemDto.unitCost` (a required, non-negative decimal
string, validated by both a `class-validator` regex pattern and a
server-side `>= 0` re-check inside the transaction). This value is stored
verbatim into `PurchaseOrderItem.unitCostSnapshot` — never resolved,
overridden, or cross-checked against `ProductVariant.costPrice`. A
`discountAmount` that exceeds the line's own resolved subtotal
(`unitCost * quantity`) is rejected (400) — the same "a line can never have
negative net value from a discount alone" rule Sale enforces.

### Server-side total computation

`PurchaseOrder.subtotal`/`discountAmount`/`taxAmount`/`grandTotal` are the
sums of every resolved line's respective components, computed entirely
inside the transaction from the server-validated per-line
`unitCost`/`discountAmount`/`taxAmount` values — **never** from anything
else in the request body. `CreatePurchaseOrderDto` has no
`subtotal`/`grandTotal` fields, and `CreatePurchaseOrderItemDto` has no
`lineTotal` field; submitting any of these is rejected outright with 400
by the existing global `ValidationPipe` (`forbidNonWhitelisted: true`) —
proven by a dedicated e2e test.

## 9. Currency Strategy

`PurchaseOrder.currency` is a `char(3)`, regex-validated ISO-4217 code
(`^[A-Z]{3}$`) — no `Currency` entity, no exchange-rate logic, matching
`Sale.currency`'s exact approach (`docs/SALES_ARCHITECTURE.md` §2). No
currency-conversion or multi-currency-total logic exists anywhere in this
phase.

## 10. Tax Snapshot Strategy — explicit, honest limitation

**Phase 13 has no tax rate engine**, identical to Phase 12's own stated
limitation (`docs/SALES_ARCHITECTURE.md` §14). There is no `Tax` entity,
no tax module, and no hardcoded rate. `PurchaseOrderItem.taxSnapshot` is a
**server-validated pass-through value only**: the client may supply an
optional, non-negative `taxAmount` per line item; the server validates it
is `>= 0` and includes it verbatim in its own
`lineTotal`/`PurchaseOrder.taxAmount` computation. There is no rate
lookup, no tax-jurisdiction logic, and no tax-exemption logic anywhere. A
future Tax phase would need to replace this with a real rate-resolution
engine.

## 11. Lifecycle

Three states only: `DRAFT`, `CONFIRMED`, `CANCELLED` — an exact mirror of
Sale's lifecycle (`docs/SALES_ARCHITECTURE.md` §10). No
`PENDING_APPROVAL`/`PARTIALLY_RECEIVED`/`RECEIVED`/`CLOSED` — no approval
workflow, no receiving-status state exists in this phase (Goods Receipt is
explicitly deferred to Phase 14, see §21).

| From \ To | DRAFT | CONFIRMED | CANCELLED |
|---|---|---|---|
| **DRAFT** | — | ✅ allowed | ✅ allowed |
| **CONFIRMED** | ❌ 409 | ❌ 409 (no-op re-confirm) | ❌ 409 |
| **CANCELLED** | ❌ 409 | ❌ 409 | ❌ 409 (no-op re-cancel) |

Every rejected transition returns **409 Conflict**. Two dedicated
endpoints only: `POST /purchase-orders/:id/confirm`,
`POST /purchase-orders/:id/cancel`. **No generic `PATCH
/purchase-orders/:id` endpoint exists at all.** Once `CONFIRMED`, a
PurchaseOrder's financial/historical fields are therefore immutable by
construction — there is no code path that can change them, proven by a
dedicated e2e test.

## 12. Numbering / Concurrency

### The mechanism used

A dedicated table, `company_purchase_counters`, holds one row per
`(company_id, year)`, with an integer `last_sequence` column — the exact
`company_sale_counters` pattern from Phase 12
(`docs/SALES_ARCHITECTURE.md` §4), reused structurally rather than
re-derived, per that document's own §23 recommendation. Inside the
**same transaction** as PurchaseOrder/PurchaseOrderItem creation
(`PurchaseOrdersService.generatePurchaseOrderNumber()`, called from
within `TransactionService.run()`):

1. `INSERT INTO company_purchase_counters (id, company_id, year, last_sequence) VALUES (UUID(), ?, ?, 0) ON DUPLICATE KEY UPDATE last_sequence = last_sequence` — a no-op upsert that guarantees the row exists without itself racing.
2. The counter row is locked with `SELECT ... FOR UPDATE` (TypeORM's `manager.createQueryBuilder(CompanyPurchaseCounter, ...).setLock('pessimistic_write')`), blocking any concurrent transaction trying to lock the same row until this one commits or rolls back.
3. `lastSequence` is incremented and saved.
4. The purchase order number is formatted as `PO-<year>-<6-digit zero-padded sequence>`, e.g. `PO-2026-000001` (`src/modules/purchase/utils/purchase-order-number.ts`).

`SELECT MAX(purchase_order_number) + 1` is never used anywhere — the same
race Phase 12 documents applies identically to Purchase Order numbers.

### Why this is safe

Because the counter-row lock is taken **inside the same transaction** as
the rest of PurchaseOrder creation, a second concurrent request for the
same company simply blocks at the `FOR UPDATE` step until the first
request's whole transaction commits or rolls back — there is no window
where two transactions can compute the same `lastSequence` value. This was
proven with a real concurrency test (10 parallel `POST /purchase-orders`
requests, `Promise.all`, asserting all resulting `purchaseOrderNumber`s
are unique and none fail — `test/purchase-orders.e2e-spec.ts`, "generates
unique purchase order numbers under real concurrent POST
/purchase-orders requests").

## 13. RBAC

Permissions (plural, `resource.action`, matching every prior phase's
convention):

- `purchase_orders.read`, `purchase_orders.create`,
  `purchase_orders.confirm`, `purchase_orders.cancel`.
- `purchase_order_items.read` (line items are only ever read as part of a
  PurchaseOrder's `items` relation — no standalone endpoint exists, but
  the permission exists for a future dedicated line-item read path,
  mirroring `sale_items.read`'s own reasoning).

**Deliberately no `.update`/`.delete`/`.approve`/`.reject` permissions** —
unlike Phase 12's `sales.update`/`sales.delete` (kept "reserved for future
use" despite no consuming endpoint), Phase 13 does not add any dead
permission with zero consuming endpoint, per this phase's explicit
instruction to close that exact gap. Every permission in the catalog has a
real, working endpoint behind it.

All five permissions are granted to `SUPER_ADMIN` via the existing
idempotent `rbac.seed.ts`, plus the mandatory `RoleResourceScope`
`ALL`-scope row for both `purchase_orders` and `purchase_order_items` —
the Phase-09-discovered gap-closing step every phase since has had to
repeat (without it, SUPER_ADMIN itself would be locked out via
`resolveRequestCompanyId()`'s `resolveScope()` call). Verified live: the
seed script output shows `Created permission: purchase_orders.read` (and
the other four), `Granted purchase_orders.read to SUPER_ADMIN` (and the
other four), `Granted ALL scope for purchase_orders to SUPER_ADMIN`,
`Granted ALL scope for purchase_order_items to SUPER_ADMIN`.

## 14. DataScope

`DataScopeService` (Phase 06/08, untouched by this phase) is reused only
for `COMPANY`/`BRANCH`/`WAREHOUSE`/`ORGANIZATION`/`ALL` scope resolution
via `resolveRequestCompanyId()` — the exact same helper every controller
since Phase 09 uses. `ACCOUNT`/`TEAM`/`OWN` scopes continue to resolve to
`[]` exactly as before. **Phase 13 does not touch `DataScopeService`'s
code at all, and does not add any ACCOUNT-scope resolution** — per
Decision #9, Purchase has no buyer/requester attribution concept for
`ACCOUNT` scope to even apply to (see §24).

## 15. Security / IDOR

- Never trust client-submitted cost/discount/tax/subtotal/grandTotal
  beyond the explicit, validated `unitCost`/`discountAmount`/`taxAmount`
  per-line fields — `CreatePurchaseOrderDto`/`CreatePurchaseOrderItemDto`
  simply have no fields for subtotal/grandTotal/lineTotal, and
  `forbidNonWhitelisted` rejects any attempt to submit them (400).
- Cross-company Supplier/ProductVariant/PaymentTerm/Branch/Warehouse →
  **404** (IDOR-safe, no existence leak) for entity lookups performed via
  `findByIdInCompany()`-style methods, or **400** (validation error) for
  the Branch/Warehouse cross-company-scope checks that mirror Sale's own
  pattern exactly — matching this codebase's established convention
  throughout.
- No generic PATCH — status can only move via dedicated,
  permission-gated endpoints, and financial fields have no update path at
  all once created.
- All new endpoints protected by `JwtAuthGuard` + `PermissionGuard` +
  `@RequirePermission()`, matching every prior phase exactly. Zero
  hardcoded role-name checks anywhere in `src/modules/purchase`.
- Verified live via e2e tests: unauthenticated → 401; authenticated
  without permission → 403; cross-company Supplier/ProductVariant/
  PaymentTerm → 404; invalid Branch/Warehouse combination → 400; BLOCKED
  Supplier → 400; invalid lifecycle transition → 409; client-submitted
  subtotal/grandTotal/lineTotal → 400 (rejected outright, never silently
  accepted-then-ignored); unknown/extra fields → 400; no PATCH route
  exists to bypass confirm/cancel-only lifecycle (404/405).

## 16. Transaction Boundaries

The only concurrency-sensitive operation in this phase is purchase-order-
number generation (§12), solved with a locked counter row inside the same
transaction as PurchaseOrder/PurchaseOrderItem creation.
`TransactionService.run()` (Phase 04, unmodified) wraps the entire
multi-step `create()` flow: company/supplier/branch/warehouse/payment-term
validation happens before the transaction opens (read-only, no lock
needed); counter locking, per-line cost/discount/tax validation, and all
`PurchaseOrder`/`PurchaseOrderItem` row creation happen inside one
`manager`-scoped transaction. Any failure at any step — an invalid
`productVariantId` mid-loop, a negative cost, a discount exceeding the
line subtotal — rolls back the entire transaction, leaving zero partial
`PurchaseOrder`/`PurchaseOrderItem` rows. Proven by a dedicated e2e test
(one valid item + one invalid `productVariantId`, asserting zero
`purchase_orders` and `purchase_order_items` rows exist afterward) and the
real 10-way parallel `POST /purchase-orders` concurrency test.

## 17. Database Schema

Three new tables, `company_purchase_counters` / `purchase_orders` /
`purchase_order_items`, InnoDB/utf8mb4/utf8mb4_unicode_ci, UUID
(`varchar(36)`) primary keys, snake_case columns. `purchase_orders` is
soft-delete only (`deleted_at`); `purchase_order_items` and
`company_purchase_counters` are not (see §3/§4 for the respective
reasoning).

Indexes: `purchase_type`, `supplier_id`, `company_id`, `branch_id`,
`warehouse_id`, `payment_term_id`, `transaction_date`, `status` on
`purchase_orders`; `purchase_order_id`, `product_variant_id` on
`purchase_order_items`. Unique constraints:
`(company_id, purchase_order_number)` on `purchase_orders`,
`(company_id, year)` on `company_purchase_counters`. No composite index in
this schema approaches MySQL's 3072-byte utf8mb4 key-length limit
(checked proactively — the widest composite unique index here is
`(company_id CHAR(36), purchase_order_number VARCHAR(50))`, well under the
limit that bit Phase 10's `product_variants.combination_key`).

### Migration

`src/database/migrations/1786560000000-CreatePurchaseTables.ts` —
verified `up()` → `down()` → `up()` against real Dockerized MySQL, with
`SHOW CREATE TABLE` output inspected directly for all three tables (see
the Phase 13 implementation report for the full command transcript).
Table creation order respects FK dependencies:
`company_purchase_counters` → `purchase_orders` → `purchase_order_items`.

## 18. API

```
GET    /api/v1/purchase-orders                 purchase_orders.read
GET    /api/v1/purchase-orders/:id             purchase_orders.read
POST   /api/v1/purchase-orders                 purchase_orders.create
POST   /api/v1/purchase-orders/:id/confirm     purchase_orders.confirm
POST   /api/v1/purchase-orders/:id/cancel      purchase_orders.cancel
```

No `PATCH`/`DELETE` on `/purchase-orders` or `/purchase-orders/:id`.
List/detail support the shared `PaginationDto`/`resolveSortField()`
(sortable: `createdAt`/`transactionDate`/`purchaseOrderNumber`/
`grandTotal`/`status`) and filters (`companyId`, `branchId`,
`warehouseId`, `supplierId`, `status`, `purchaseType`, `search` on
`purchaseOrderNumber`).

## 19. Payment Boundary (inert integration point — Phase 16)

`PurchaseOrder.paidAmount` (default `0.00`) and `PurchaseOrder.balanceAmount`
(initialized to `grandTotal` at creation) exist purely as **inert
integration-point fields** for a future Payment phase (Phase 16), an exact
mirror of `Sale.paidAmount`/`balanceAmount` (`docs/SALES_ARCHITECTURE.md`
§11). Nothing in Phase 13 ever writes to `paidAmount` again after
creation, and `balanceAmount` is never recalculated. No `Payment` entity,
ledger, or reconciliation logic exists anywhere in `src/modules/purchase`.

## 20. Accounting Boundary (inert integration point — Phase 17)

No `JournalEntry`/`Ledger`/`GLAccount`/Chart-of-Accounts table exists.
`PurchaseOrder.grandTotal` and friends are the eventual source data a
future Accounting phase would post from, but no posting/journal logic
exists in this phase. `Supplier.payableAccountId` (Phase 11's inert
FK-less placeholder) remains untouched and unreferenced by this phase.

## 21. Goods Receipt — explicitly deferred to Phase 14

**No `GoodsReceipt`/`GoodsReceiptItem` entity, receiving-quantity field,
rejected-quantity field, remaining-quantity tracking, partial-receiving
logic, over-receiving validation, receiving concurrency lock, stock
receiving, stock movement, or any inventory mutation exists anywhere in
this phase.** This is a locked, explicit scope decision (Decision #3), not
an oversight. `PurchaseOrder.status` has no `PARTIALLY_RECEIVED`/
`RECEIVED` value — receiving status is entirely Phase 14's concern to
introduce.

### Phase 14 Inventory integration contract

Phase 14 is expected to consume `PurchaseOrder`/`PurchaseOrderItem` rows —
specifically `PurchaseOrderItem.productVariantId` + `PurchaseOrderItem.quantity`
+ `PurchaseOrder.warehouseId` — as the exact fields a real Goods Receipt /
stock-increase flow would read on receiving against a `CONFIRMED`
PurchaseOrder. This is the direct inbound-stock analogue of how
`docs/SALES_ARCHITECTURE.md` §23 frames `SaleItem.productVariantId` +
`quantity` + `Sale.warehouseId` as the outbound (stock-decrease) trigger
for the same future Inventory phase. No fake stock-check or
placeholder receiving logic was added here to simulate this —
`warehouseId` on `PurchaseOrder` is captured purely as an
organizational-scope field (validated the same way `branchId` is), exactly
as Sale treats it.

## 22. Purchase Request — explicitly deferred / not built

**No `PurchaseRequest`/`RequisitionForm`/pre-approval-workflow entity of
any kind exists.** Phase 13 begins directly at the PurchaseOrder — there
is no upstream requisition, approval-routing, or budget-check step a
PurchaseOrder must originate from in this phase's data model. If a future
phase introduces Purchase Requests, `PurchaseOrder` would be the natural
entity a request converts into, but no `sourceRequestId`-style column or
any other placeholder for that relationship was added speculatively.

## 23. Supplier Invoice — explicitly deferred / not built

**No `SupplierInvoice`/`AccountsPayableInvoice`/three-way-matching entity
or logic exists.** `PurchaseOrder.grandTotal` is the eventual input a
future Supplier Invoice / three-way-match (PO vs. Receipt vs. Invoice)
phase would compare against, but no invoice-side entity, matching
tolerance logic, or invoice-status field was built here.

## 24. Buyer / Requester Attribution — explicitly omitted (Decision #9)

**No `purchaserId`/`buyerId`/`requesterId` field, no
`PurchaseAccount`/SalesAccount-equivalent relationship, no
`BuyerAssignment` table, and no `ACCOUNT` DataScope resolution for
Purchase exists anywhere in this phase.** This is a locked, explicit
architectural decision (Decision #9), not an oversight or an
inconsistency with Sale's own `SalesAccount` model
(`docs/SALES_ARCHITECTURE.md` §6). Purchase is deliberately kept fully
independent of `SalesAccountsModule` — `PurchaseModule` does not import it,
`PurchaseOrder` does not reference it, and `PurchaseOrdersService` never
calls `SalesAccountAccessService`. If a future phase decides Purchase
needs transaction-level buyer attribution analogous to Sale's
SalesAccount model, that is a new, separate architectural decision for
that phase to make explicitly — not something Phase 13 half-built or
implicitly assumed.

## 25. Purchase Return — explicitly deferred / not built

**No `PurchaseReturn`/`DebitNote`/`SupplierReturn` entity or logic
exists.** A future Purchase Return phase would need `PurchaseOrder`/
`PurchaseOrderItem` (and, once it exists, Goods Receipt) as its
originating reference data — nothing in this phase's data model
anticipates or partially builds toward that.

## 26. Definition of Done

All of the following are true as of this phase's completion (see the
Phase 13 implementation report for the exact evidence — test counts,
schema output, command output):

- PurchaseOrder/PurchaseOrderItem/CompanyPurchaseCounter entities
  implemented per the locked decisions above.
- Purchase-order-number generation is concurrency-safe, proven by a real
  parallel `POST /purchase-orders` e2e test (10 concurrent requests, 10
  unique numbers, 0 failures).
- Cost is client-supplied and server-validated (never resolved from
  `ProductVariant.costPrice`); a negative or malformed `unitCost` is
  rejected (400), proven by e2e/unit tests.
- Supplier/ProductVariant/PaymentTerm/Company/Branch/Warehouse validation
  and cross-company rejection are all enforced server-side (proven by e2e
  tests).
- Lifecycle transitions are exactly `DRAFT → CONFIRMED` /
  `DRAFT → CANCELLED`; every other transition is rejected 409 (proven by
  e2e tests covering every invalid transition).
- RBAC permissions seeded idempotently (5 permissions, no dead
  `.update`/`.delete`), SUPER_ADMIN granted all of them plus the
  `RoleResourceScope` ALL-scope rows for both `purchase_orders` and
  `purchase_order_items`.
- Migration verified UP → DOWN → UP against real Dockerized MySQL with
  `SHOW CREATE TABLE` schema inspection; all pre-existing Phase 01-12
  tables confirmed untouched throughout.
- Unit tests (20/20) and e2e tests (38/38, plus the full 11-suite e2e
  regression) pass; `npm run build`, `npx tsc --noEmit`, `npm run lint`
  all pass cleanly.
- Zero real implementation of Goods Receipt/Purchase Request/Supplier
  Invoice/Purchase Return/Inventory/Stock/Payment-entity/Accounting/
  Tax-entity/Currency-entity/Unit-entity/AuditLog/Approval/
  buyer-purchaser-requester-attribution code anywhere in
  `src/modules/purchase` (grep-verified).
