# INVENTORY_ARCHITECTURE.md

Inventory domain implemented in Phase 14. Owns real stock quantity — the
first phase in this codebase where a mutation in one module (Sales)
transactionally mutates state owned by another module (Inventory), and the
first phase explicitly authorized to modify a previously-completed phase's
service code (`SalesService.confirm()`, Phase 12).

## 1. Domain Ownership

Phase 14 owns exactly six entities, three of them company-scoped document
counters, in a new `src/modules/inventory/` module:

```text
WarehouseStock          — current stock balance per (warehouse, variant)
StockMovement           — append-only internal movement log
GoodsReceipt / GoodsReceiptItem       — inbound stock (Purchase Order receiving)
StockTransfer / StockTransferItem     — warehouse-to-warehouse movement
StockAdjustment                        — manual correction / opening balance
CompanyGoodsReceiptCounter
CompanyStockTransferCounter
CompanyStockAdjustmentCounter
```

No Inventory Ledger query/report API, no valuation/costing, no batch/lot/
serial/expiry tracking, no UOM, no reservation workflow, no reorder points,
no approval workflow, no Purchase Return, no Sales Return — see §14
"Deferred / Not Built" for the full, explicit list.

## 2. WarehouseStock Architecture

`WarehouseStock` is the current, live balance for exactly one
`(warehouseId, productVariantId)` pair — `UNIQUE(warehouse_id,
product_variant_id)`, the stock-identity contract
`docs/PRODUCT_VARIANT_PRICING_ARCHITECTURE.md` §21 anticipated. It is not a
lifecycle entity: no `BaseEntity`, no soft-delete, no `deletedAt`. A row is
created lazily, on first touch, via an idempotent upsert
(`INSERT ... ON DUPLICATE KEY UPDATE on_hand_quantity = on_hand_quantity`)
— never pre-provisioned, never created through its own endpoint (there is
no `POST /warehouse-stock` at all).

`onHandQuantity` is the single authoritative real stock count, enforced
`>= 0` at the transaction layer (D7), never by a DB `CHECK` constraint
alone. `reservedQuantity` exists purely for schema-forward compatibility
with a future reservation phase — see §8. `availableQuantity`
(`onHandQuantity - reservedQuantity`) is **never persisted**; it is
computed only inside the response DTO (`toWarehouseStockResponseDto`).

No cost/value column exists anywhere on `WarehouseStock` — see §13.

## 3. StockMovement — the Append-Only Boundary (Phase 14 writes, Phase 15 queries)

`StockMovement` is an append-only internal log. **No update, no delete, no
soft-delete, and — deliberately — no public list/query endpoint of any
kind exists for it in this phase.** It is written internally by
`GoodsReceiptsService`, `SalesService.confirm()`, `StockTransfersService`,
and `StockAdjustmentsService` only.

**Explicit boundary statement**: Phase 14 writes `stock_movements`. Phase
15 (Inventory Ledger) is the phase that ever exposes it through a
queryable/reportable API. This is not an oversight — a full ledger query
surface (date-range filtering, running balances, per-document drill-down,
export) is a real feature with its own design surface that this phase
does not attempt to pre-empt. `StockMovement` is deliberately kept
structurally simple — a flat append-only fact table — specifically so
Phase 15 can build a ledger view on top of it without needing any schema
migration of this table itself.

Every movement row carries:

- `movementType` — one of `PURCHASE_RECEIPT | SALE_ISSUE | TRANSFER_IN |
  TRANSFER_OUT | ADJUSTMENT | OPENING_BALANCE`.
- `quantityChange` — signed (positive for increases, negative for
  decreases).
- `quantityAfter` — a denormalized snapshot of the resulting
  `WarehouseStock.onHandQuantity` at the moment the movement was written,
  so a later ledger view does not need to replay the whole history to
  reconstruct a point-in-time balance.
- `referenceType` + `referenceId` — a polymorphic pointer into whichever
  table actually owns the originating transaction
  (`GOODS_RECEIPT|SALE|STOCK_TRANSFER|STOCK_ADJUSTMENT`). `referenceId`
  deliberately carries **no FK constraint**, since it points to a
  different table depending on `referenceType` — an FK cannot express
  that, and inventing four nullable FK columns instead would be worse.

## 4. GoodsReceipt Design

`GoodsReceipt` has **no `status` column and no lifecycle** — a row
existing IS the completed receipt. No `DRAFT`/`APPROVED`/`CONFIRMED`/
`CANCELLED` state was built (Phase 14 locked decision), matching the
single-terminal-state design already established by Sale/PurchaseOrder's
`confirm`/`cancel` endpoints, taken one step further since receiving here
has no draft phase at all. No update/delete endpoint exists.

`GoodsReceiptItem.productVariantId` is denormalized from the referenced
`PurchaseOrderItem` for query convenience, but is always
server-validated against `purchaseOrderItem.productVariantId` — a client
cannot receive against the wrong variant by supplying a mismatched pair
(400 if it does not match).

**Remaining-quantity computation** is always computed server-side as
`purchaseOrderItem.quantity - SUM(all prior GoodsReceiptItem.receivedQuantity
for that PurchaseOrderItem)`, inside the same row lock — never stored as a
mutable column on `PurchaseOrderItem`. Over-receiving beyond that computed
remaining quantity is rejected with **409 Conflict** (this codebase's
existing convention for a business-rule violation, matching
`PurchaseOrdersService`'s own lifecycle-transition 409s — a validation
failure like a missing/malformed field is 400, a legitimate-shaped request
that violates a business invariant is 409).

`unitCostSnapshot` was deliberately **omitted** from `GoodsReceiptItem`.
The locked spec framed it as something the entity "MAY preserve," not
"MUST" — omitting it entirely avoids any risk of the field being read as
valuation logic (no cost/value aggregation exists anywhere in this
module). `PurchaseOrderItem.unitCostSnapshot` remains queryable via the
`purchaseOrderItemId` FK for any future phase that needs it.

## 5. Purchase Integration

Receiving requires the referenced `PurchaseOrder` to be `CONFIRMED` —
`DRAFT` and `CANCELLED` are both rejected with **409 Conflict**. The
entire receive operation is one `TransactionService.run()` call:

1. Lock the relevant `PurchaseOrderItem` row(s) with `SELECT ... FOR
   UPDATE` (sorted by `purchaseOrderItemId` for deterministic ordering
   across concurrent receipts) — locked *before* the remaining-quantity
   sum is computed, so no other transaction can compute a stale remaining
   value in between.
2. Lock (upsert-then-lock) the relevant `WarehouseStock` row(s).
3. Validate `receivedQuantity <= remaining` for every item.
4. Increase `WarehouseStock.onHandQuantity`.
5. Write a `StockMovement(PURCHASE_RECEIPT)` row.
6. Create the `GoodsReceipt`/`GoodsReceiptItem` rows.

All inside the same transaction — any failure at any step rolls back
everything (no partial receiving, no stock mutation without a matching
`GoodsReceipt` row). Proven with a real 10-way parallel concurrency test
(`test/inventory.e2e-spec.ts`) that over-subscribes the remaining
quantity on purpose and asserts the exact number of requests that can
mathematically succeed do succeed, the rest are cleanly rejected with 409,
final `WarehouseStock.onHandQuantity` and cumulative received quantity are
both exactly correct, and the movement count matches the successful
request count precisely — no lost updates, no over-receiving.

**Purchase-side additive change**: `PurchaseOrdersService.cancel()` now
rejects (409) cancelling a PurchaseOrder that already has any `GoodsReceipt`
recorded against it — receiving has already increased real warehouse stock,
so cancelling the order afterward would leave that increase attached to a
cancelled purchase. This check runs before the existing DRAFT→CANCELLED
transition check. Nothing else about PurchaseOrder's Phase 13 lifecycle was
touched — `confirm()`, `create()`, and every other method are unmodified.

## 6. Sales Integration — the Cross-Phase-Boundary Change (D5)

**What changed and why**: `SalesService.confirm()` (Phase 12) was
originally a trivial `status flip + updatedBy + save`. The Phase 14 locked
specification unconditionally requires that confirming a Sale deducts real
stock — this is the one place in Phase 14 where a mutation crosses back
into a previously-completed phase's service code, explicitly authorized by
the approved architecture rather than invented unilaterally.

`confirm()` is now wrapped in `TransactionService.run()`:

1. Load the Sale with its items (already available via
   `findByIdInCompany()`'s `relations: { items: true }` — verified, no
   change needed there).
2. Validate the `DRAFT → CONFIRMED` transition is allowed (existing check,
   unchanged).
3. Lock the relevant `WarehouseStock` rows in deterministic
   (`productVariantId`) order — the same upsert-then-lock pattern
   GoodsReceipt/StockTransfer use.
4. Validate sufficient `onHandQuantity` for **every** item under the
   strict no-negative-stock policy (§7) — if any single item is
   insufficient, the whole transaction rolls back, the Sale stays `DRAFT`,
   and the response is **409 Conflict**. No partial deduction is ever
   possible.
5. Decrease `WarehouseStock.onHandQuantity` for every item and write one
   `StockMovement(SALE_ISSUE)` row per item.
6. Only after all stock mutations succeed: flip `Sale.status =
   CONFIRMED`, set `updatedBy`, save.

**Discovered edge case, resolved conservatively and documented, not a stop
condition**: `Sale.warehouseId` is nullable at the document level (a
deliberate Phase 12 design choice — `branchId`/`warehouseId` were
originally scope-only fields with no stock-availability check behind
them). Since Phase 14's locked spec states unconditionally that
confirmation deducts stock, with no carve-out for a warehouse-less Sale, a
Sale with `warehouseId = null` **can no longer be confirmed at all** —
confirmation now returns `400 Validation Error` ("Sale.warehouseId is
required to confirm a sale"). This is an additive tightening of Sale's
existing `confirm()` contract, not a new architectural conflict: the
locked spec's overall intent (Sale confirmation always deducts stock) is
unambiguous even though this specific null-warehouse edge case was not
spelled out. The existing Phase 12 e2e/unit tests that previously
confirmed a Sale with no `warehouseId` were updated to supply one
(`test/sales.e2e-spec.ts`, `sales.service.spec.ts`) — this is the only
change made to Phase 12's own test expectations; `create()`, `cancel()`,
`findAll()`, and every DTO are untouched.

## 7. Transfer

`StockTransfer` is single-step atomic — creation is the entire lifecycle,
no state machine, no update/delete endpoint. Rules: `sourceWarehouseId !==
destinationWarehouseId` (400 if equal); both warehouses must exist, be
`ACTIVE`, and belong to the resolved company (400 if not); every item
quantity must be `> 0`; the source warehouse must have sufficient stock
under the strict no-negative policy (409 if not); the destination
`WarehouseStock` row may not exist yet and is created via the same upsert
pattern GoodsReceipt uses.

**Deterministic multi-warehouse lock ordering (deadlock prevention)**: all
required `WarehouseStock` rows — source rows for every item AND
destination rows for every item — are collected into one list and sorted
by the `(warehouseId, productVariantId)` tuple **before any lock is
acquired**. This is the specific mechanism that prevents the classic
two-transaction deadlock where concurrent Transfer A locks
warehouse-1-then-2 while concurrent Transfer B locks
warehouse-2-then-1 — with global tuple ordering, every transaction that
touches both warehouses acquires their locks in the same relative order,
so a cycle can never form. Proven with a real concurrency test
(`test/inventory.e2e-spec.ts`) running 10 concurrent transfers in both
directions between the same warehouse pair simultaneously — all 10
succeed with zero deadlocks, and total stock across both warehouses is
conserved exactly (no lost updates).

## 8. Adjustment

`StockAdjustment` is a **single-line flat model** — `warehouseId`/
`productVariantId`/`quantityChange` live directly on the entity, no
`StockAdjustmentItem` header+line split. The locked specification's own
§3 (high-level entity list) mentioned `StockAdjustmentItem`, but §9 (the
concrete field list) is flat and more specific — the more literal,
detailed reading was followed, per the locked spec's own instruction to
prefer the more specific section when the two disagree. If a genuinely
different reading is ever needed, this is the one place in the spec where
two sections gave different levels of an entity's shape; flagged here
explicitly rather than silently resolved.

Creation immediately mutates stock — no approval workflow, no update/
delete endpoint, permission-gated by RBAC only (`stock_adjustments.create`).
`quantityChange > 0` increases stock with no restriction.
`quantityChange < 0` enforces the strict no-negative-stock policy inside
the same row lock (409 if it would drive `onHandQuantity` below zero).
`quantityChange === 0` is rejected as invalid input (400) — a no-op
adjustment carries no meaning.

**Opening stock** is a `StockAdjustment` with `reason = OPENING_BALANCE` —
not a separate entity. The reason catalog is a small, justified set:
`OPENING_BALANCE | DAMAGE | LOSS | FOUND | CORRECTION`. The movement type
written is `OPENING_BALANCE` specifically when `reason === OPENING_BALANCE`,
`ADJUSTMENT` for every other reason — this is the one place `StockMovement`
carries a value (`OPENING_BALANCE`) that also happens to be an
`StockAdjustmentReason` value; they are separate enums with separate
purposes (one classifies a stock-quantity event, the other classifies the
business reason a human gave for a manual correction) that happen to share
a name for the one case both need to express the same real-world event.

## 9. Concurrency Strategy

Every stock-mutating operation in this phase uses **pessimistic locking
only** — `SELECT ... FOR UPDATE` via TypeORM's `setLock('pessimistic_write')`,
inside a single `TransactionService.run()` call — exactly mirroring the
proven `SalesService.generateSaleNumber()` / `PurchaseOrdersService`
counter-locking pattern from Phase 12/13, now applied to `WarehouseStock`
balance rows (and `PurchaseOrderItem` rows, for GoodsReceipt's
remaining-quantity computation) instead of counter rows. No
optimistic/version-based locking exists anywhere in this module.

The upsert-then-lock helper (`lockWarehouseStockRow` /
`lockWarehouseStockRows`, `src/modules/inventory/utils/stock-lock.ts`) is
shared by all four write paths (GoodsReceipt, Sale confirm, Transfer,
Adjustment) — one implementation, not four copies. The same no-op
`INSERT ... ON DUPLICATE KEY UPDATE on_hand_quantity = on_hand_quantity`
technique Sale/Purchase numbering uses to make first-ever-row creation
itself lock-compatible is reused verbatim, applied to a stock balance row
instead of a counter.

Two real, evidence-backed concurrency tests exist (no mocks used to claim
concurrency correctness anywhere): a GoodsReceipt parallel-receiving test
and a StockTransfer concurrent-both-directions test — both described in
§5/§7 above and both implemented in `test/inventory.e2e-spec.ts` using
real `Promise.all()` against the live running application and database.

## 10. Strict No-Negative-Stock Policy (D7)

Every stock-decreasing operation — Sale issue, Transfer out, negative
Adjustment — validates sufficient quantity **inside** the row lock,
**inside** the transaction, **before** writing the decrease. The service
code never does `SELECT`, then checks in application code, then `UPDATE`s
later without holding the lock across that whole sequence — the lock is
acquired first via `lockWarehouseStockRow`/`lockWarehouseStockRows`, and
only after the lock is held is `onHandQuantity` read, validated, and
(conditionally) written. On insufficient stock the transaction rolls back
and the caller receives **409 Conflict**. There is no configurable
override and no company-level exception to this policy anywhere in the
codebase.

## 11. RBAC

Exactly seven permissions were added to the existing idempotent seed
(`src/database/seeds/rbac.seed.ts`), matching the locked spec precisely —
no more, no less:

```text
warehouse_stock.read
goods_receipts.read
goods_receipts.create
stock_transfers.read
stock_transfers.create
stock_adjustments.read
stock_adjustments.create
```

**Deliberately zero `.update`/`.delete`/`.approve`/`.cancel` permissions**
for any of these four resources — every seeded permission has a real,
working endpoint behind it, matching Phase 13's own "zero dead
permission" precedent (in contrast to Phase 12's `sales.update`/
`sales.delete`, seeded for a still-hypothetical future feature). All
seven were granted to `SUPER_ADMIN`, and all four resources
(`warehouse_stock`, `goods_receipts`, `stock_transfers`,
`stock_adjustments`) received the now-standard `RoleResourceScope`
ALL-scope grant, the same Phase-09-discovered gap-closing step every
phase since has repeated. Verified live via the seed script's own console
output: 7 permissions created, 7 grants to SUPER_ADMIN, 4 ALL-scope
`RoleResourceScope` rows created, confirmed idempotent (a second run
produces zero output).

## 12. DataScope

`DataScopeService`/`resolveRequestCompanyId()` are reused completely
unmodified — no new scope kind, no second visibility mechanism.
`WarehouseStock` has no `companyId` column of its own (its identity is
purely `(warehouseId, productVariantId)`); company scoping for
`GET /warehouse-stock` is resolved by joining through
`warehouse.companyId` in `WarehouseStockService.findAll()`/
`findByIdInCompany()` — the same "derive scope through the entity's real
parent" approach `warehouses.companyId` itself established for
`branch.companyId` back in Phase 07. `WAREHOUSE` is the natural primary
scoping boundary conceptually for this domain, but `COMPANY`/`BRANCH`
continue to resolve correctly through the existing, unmodified
`DataScopeService.resolveAllowedOrganizationIds()` mechanism — no new
scope kind was introduced.

## 13. Phase 17 Valuation Boundary — explicit, honest limitation

`WarehouseStock` has no cost/value column. No average cost, no FIFO, no
weighted-average, no COGS calculation, no journal posting, and no GL
Account/Chart-of-Accounts reference exists anywhere in this module.
`PurchaseOrderItem.unitCostSnapshot` (Phase 13) remains the only cost data
adjacent to this module, and it is never read, aggregated, or averaged by
anything in Phase 14. A future valuation phase (Phase 17, per the
existing phase-numbering convention this codebase's docs consistently
use) would need to introduce its own costing model layered on top of
`StockMovement`'s raw quantity history — nothing here precludes that, and
nothing here attempts to simulate it.

## 14. Phase 15 Inventory Ledger Boundary — explicit, honest limitation

No queryable/reportable Inventory Ledger API exists in this phase — see
§3. `StockMovement` is the raw material; Phase 15 is expected to build
the actual ledger query surface (date-range filtering, running-balance
reconstruction, per-document drill-down, CSV/report export) on top of it.

## 15. Deferred / Not Built (by design, not oversight)

- **Reservation workflow**: `WarehouseStock.reservedQuantity` exists as a
  schema-forward-compatible column, always `0` — nothing anywhere in this
  phase ever writes a non-zero value to it. No reservation service, API,
  or lifecycle of any kind exists.
- **Batch/Lot/Serial/Expiry tracking**: no fields anywhere, not even
  placeholders. Quantities are aggregate integers only.
- **UOM / fractional quantity**: `int` throughout, no decimals. Phase
  10's lock on Unit/UOM still stands — Inventory does not introduce one
  either.
- **Valuation / FIFO / weighted-average / COGS / accounting postings**:
  see §13. Explicitly Phase 17's concern.
- **Inventory Ledger query/report API**: see §3/§14. Explicitly Phase
  15's concern.
- **Reorder points, low-stock alerts**: no fields, no logic.
- **Approval workflow engine**: `StockAdjustment`/`GoodsReceipt`/
  `StockTransfer` all mutate stock immediately on creation — permission
  gating is the only authorization layer, matching Sale/PurchaseOrder's
  own "no approval workflow" precedent from Phase 12/13.
- **Purchase Return / Sales Return**: no entity, no reverse-movement
  logic. A future return phase would need its own explicit design,
  layered on top of `StockMovement`'s existing append-only shape.
- **Redis / BullMQ / events / messaging**: every write in this phase is a
  synchronous transactional database operation. No async job, no event
  bus, no message queue.
- **No Bruno API collection** — consistent with every prior phase.
- **No Audit Log system** — still absent from this entire codebase
  through Phase 14, the same pre-existing gap every phase since Phase 09
  has flagged without unilaterally fixing.
- `@nestjs/swagger`'s transitive `js-yaml` advisory (unchanged since
  Phase 01, dev-time only).

## 16. API Surface

```text
GET  /warehouse-stock                  warehouse_stock.read
GET  /warehouse-stock/:id              warehouse_stock.read
GET  /goods-receipts                   goods_receipts.read
GET  /goods-receipts/:id               goods_receipts.read
POST /goods-receipts                   goods_receipts.create
GET  /stock-transfers                  stock_transfers.read
GET  /stock-transfers/:id              stock_transfers.read
POST /stock-transfers                  stock_transfers.create
GET  /stock-adjustments                stock_adjustments.read
GET  /stock-adjustments/:id            stock_adjustments.read
POST /stock-adjustments                stock_adjustments.create
```

No `PATCH`/`DELETE` anywhere, proven by a dedicated e2e test asserting
404/405 on every resource. Every route uses `JwtAuthGuard` +
`PermissionGuard` + `@RequirePermission()` and the
`resolveRequestCompanyId()` pattern, exactly matching Sale/PurchaseOrder's
own controllers.

## 17. Database Schema / Migration

One migration, `1786570000000-CreateInventoryTables.ts`, ten tables in
dependency order: `company_goods_receipt_counters` → `warehouse_stock` →
`stock_movements` → `goods_receipts` → `goods_receipt_items` →
`company_stock_transfer_counters` → `stock_transfers` →
`stock_transfer_items` → `company_stock_adjustment_counters` →
`stock_adjustments`. Raw SQL via `queryRunner.query()`, inline
`CREATE TABLE` + separate `ALTER TABLE ADD CONSTRAINT` blocks, symmetric
reverse-order `down()` — the exact structural template
`1786560000000-CreatePurchaseTables.ts` established.

**A real migration bug was found and fixed during UP verification**: the
first attempt named `stock_adjustments`' foreign keys with an `FK_sa_*`
prefix (intended as a `StockAdjustment` abbreviation), which collided
with **two** already-existing constraint names in the live database —
`sales_accounts.FK_sa_company` (Phase 08) and `supplier_addresses.FK_sa_supplier`
(Phase 11) — since MySQL foreign-key constraint names are unique
per-**database**, not per-table (unlike index names, which are
per-table). The migration failed partway through with
`ER_FK_DUP_NAME`("Duplicate foreign key constraint name 'FK_sa_company'"),
leaving the nine tables created before the failure orphaned in the
database (the same "MySQL DDL auto-commits per-statement independent of
the migration's own transaction" behavior Phase 10 first documented) —
those orphaned tables were manually dropped before re-running the
corrected migration. Fixed by renaming `stock_adjustments`' FK prefix to
the collision-free `FK_stkadj_*`. Verified against the full live schema
with a direct `information_schema.TABLE_CONSTRAINTS` query confirming
zero remaining name collisions across all 25 new foreign keys before
re-running. This is the same class of "silent global-namespace collision"
lesson Phase 10 (`combination_key` byte-length) and Phase 09 (self-referencing
FK bulk-delete ordering) each independently surfaced — worth checking
proactively for future phases: any new migration's constraint-name
prefixes should be checked for collision against `information_schema`
before running, not discovered at migration time.

## 18. Three Real Concurrency Bugs Found and Fixed During e2e Verification

The two required GoodsReceipt concurrency tests (§5) did not pass on the
first real run — investigating them surfaced three distinct, genuine
bugs, none of them present in the unit-test-mocked code paths (mocks
cannot exercise real MySQL locking/isolation behavior, which is exactly
why the locked spec requires live concurrency tests with no mocks). Each
is documented here in the order actually found, including one disproven
hypothesis, because the debugging path is itself useful evidence that the
final fix is the real one and not a guess.

### 18.1 Disproven hypothesis: MySQL `UUID()` collision

The first symptom was `QueryFailedError: Duplicate entry '<uuid>' for key
'company_goods_receipt_counters.PRIMARY'` on 9 of 10 parallel
`POST /goods-receipts` requests. The initial theory was that MySQL 8.0's
`UUID()` function (a time-ordered, v1-style value) could produce
colliding values across near-simultaneous parallel connections.
`lockWarehouseStockRow()` and all three Phase 14 counter-generation
methods were changed to generate the candidate primary key in application
code (`crypto.randomUUID()`, a real random v4 UUID) instead of relying on
MySQL's `UUID()`. Re-running the identical test still failed identically
— same error class, now against a `randomUUID()` value — which
disproved UUID collision as the cause. The switch to `crypto.randomUUID()`
was kept anyway as strictly better practice (never let a DB function
decide a client-visible id), even though it did not fix the real bug.

### 18.2 Bug #1 (real): `manager.save()` re-INSERTs a `SELECT ... FOR UPDATE`-hydrated entity

Deeper instrumentation (temporary `console.error` tracing, since removed)
showed the counter's lock-and-increment step (`createQueryBuilder(...)
.setLock('pessimistic_write').getOneOrFail()`, mutate `lastSequence`,
`manager.save(...)`) was reporting `LOCK ACQUIRED seq=1` on every one of
9 "failing" requests — the sequence value was never advancing past 1,
meaning the increment was never actually persisting, yet no error
surfaced until later. The real failing SQL, captured directly from the
thrown `QueryFailedError`, was:
`INSERT INTO company_goods_receipt_counters(id, company_id, year,
last_sequence) VALUES (?, ?, ?, ?)` — a **plain 4-column INSERT**, not
the `ON DUPLICATE KEY UPDATE` upsert. TypeORM's `manager.save()`, given
an entity object that was hydrated via
`createQueryBuilder().setLock().getOneOrFail()` rather than a plain
`repository.findOne()`/`manager.findOne()` call, was issuing a fresh
INSERT instead of an UPDATE for that already-existing row — colliding
with the row that (correctly) already existed from an earlier request in
the same batch.

**Fix**: replaced every `manager.save(Entity, lockedRow)` call across the
lock-then-mutate pattern with `manager.update(Entity, lockedRow.id, {
...changedFields })`, which is unambiguous — it always issues an UPDATE
against the given id, never an INSERT. Applied to all three Phase 14
counter-generation methods (GoodsReceipt/Transfer/Adjustment numbering)
and every `WarehouseStock` mutation reached via `lockWarehouseStockRow`/
`lockWarehouseStockRows` — in `GoodsReceiptsService`,
`StockAdjustmentsService`, `StockTransfersService` (both source and
destination rows), and `SalesService.confirm()` (D5). Entities created
fresh via `manager.create()` with no pre-existing id (`GoodsReceipt`,
`GoodsReceiptItem`, `StockTransfer`, `StockTransferItem`,
`StockAdjustment`, `Sale` on the final status-flip save) were left using
`manager.save()`, since that call correctly targets a genuinely new
(or, for `Sale`, `repository`-tracked) row and is not part of the
locked-read-then-mutate pattern that triggered the bug.

The `retryOnDuplicateEntry()` bounded-retry helper
(`src/modules/inventory/utils/upsert-retry.ts`) was added during this
investigation as a defensive measure around the `INSERT ... ON DUPLICATE
KEY UPDATE` upsert calls themselves (a real, independently-documented
InnoDB gap-lock behavior under high concurrent first-ever-insert
contention against a table with a secondary unique index). It remains in
place as a legitimate defensive improvement, but it was **not** the fix
for Bug #1 — the `manager.update()` change was.

### 18.3 Bug #2 (real): a plain SELECT's REPEATABLE READ snapshot masked concurrently-committed prior receipts

After fixing Bug #1, the first (exactly-fits) GoodsReceipt concurrency
test passed cleanly, but the second (deliberately over-subscribed) test —
designed so that only 6 of 10 requests should be able to succeed — let
all 10 succeed, silently over-receiving past the ordered quantity.

**Root cause**: `GoodsReceiptsService.create()` locks the relevant
`PurchaseOrderItem` row with `SELECT ... FOR UPDATE` before computing the
remaining-quantity SUM, but the SUM query itself
(`SUM(gri.receivedQuantity) ... WHERE purchaseOrderItemId = ...`) was a
**plain, non-locking `SELECT`**. Under MySQL's default `REPEATABLE READ`
isolation, a plain `SELECT` inside a transaction reads from a consistent
snapshot established at the start of that transaction (or its first
read) — it does **not** see rows committed by other transactions after
that point, even when the plain `SELECT` runs after acquiring an
unrelated row's lock. Only locking reads (`FOR UPDATE`/`FOR SHARE`) see
the latest committed data. So each waiting transaction, once it acquired
the `PurchaseOrderItem` lock, still summed prior `GoodsReceiptItem` rows
against its own stale snapshot from transaction start — under-counting
concurrently-committed receipts from other transactions that had already
finished, and allowing every request to compute a remaining quantity as
if it were first.

**Fix**: added `.setLock('pessimistic_read')` to the SUM query, forcing
it to be a locking read that always sees the latest committed data rather
than the transaction's snapshot. After this fix, the full 10-way
GoodsReceipt concurrency test (exactly-fits) and the second
(over-subscribed, exactly 6 of 10 expected to succeed) concurrency test
both pass repeatably.

### 18.4 Why Sale/Purchase's own equivalent counter-upsert/save code (Phase 12/13, unmodified) was left as-is

Bug #1's `manager.save()`-on-a-locked-row pattern is structurally
identical in `SalesService.generateSaleNumber()` and
`PurchaseOrdersService.generatePurchaseOrderNumber()` (Phase 12/13,
neither modified by this phase beyond the two explicitly authorized
changes — D5's `SalesService.confirm()` stock-issue logic, and the
`PurchaseOrdersService.cancel()` goods-receipt guard). Their own existing
concurrency tests (`test/sales.e2e-spec.ts`, `test/purchase-orders.e2e-spec.ts`)
pass reliably in practice — confirmed by re-running
`purchase-orders.e2e-spec.ts` clean (38/38) during this investigation.
The most likely reason Phase 12/13 never observed Bug #1 in practice: a
`Sale`/`PurchaseOrder` document create only ever needs to increment the
counter **once**, and TypeORM's save()-versus-insert heuristic misfire
appears to depend on a specific combination of `setLock()`-hydrated
entities plus this codebase's specific TypeORM version — since the same
existing code passes its own tests repeatedly, the exposure there is
either narrower in practice or has not yet been hit by an unlucky timing
window. This was judged a latent, currently-dormant risk in Phase 12/13's
own code, not silently left undiscovered — flagged explicitly here rather
than modified, since changing already-completed, already-tested Phase
12/13 code beyond the two explicitly authorized touch points was outside
this phase's "keep the modification minimal and additive" mandate. A
future phase touching that code should consider applying the same
`manager.update()` pattern as a preventive measure.

## 19. Phase 15 — Inventory Ledger: Read-Only Query Layer

Phase 15 fulfills the boundary statement §3/§14 above set up: it is the
phase that ever exposes `StockMovement` through a queryable API. It adds
exactly one new service (`InventoryLedgerService`) and one new controller
(`InventoryLedgerController`) inside the **same, already-registered**
`InventoryModule` — no new entity, no new `TypeOrmModule.forFeature()`
registration, no new migration, and **zero modifications** to any Phase
12/13/14 file (`SalesService`, `PurchaseOrdersService`,
`GoodsReceiptsService`, `StockTransfersService`,
`StockAdjustmentsService`, `WarehouseStockService`, or any entity under
`src/modules/inventory/entities/`). This section documents the read-only
query layer built on top of the append-only `stock_movements` table and
the live `warehouse_stock` balance table Phase 14 already wrote.

### 19.1 Read-Only Guarantee

`InventoryLedgerController` exposes exactly four `GET` routes and no
`POST`/`PATCH`/`DELETE` of any kind. `InventoryLedgerService` never calls
`.save()`, `.insert()`, `.update()`, or `.delete()` against any repository
— every method is a `SELECT`-only query-builder read. Proven by a
dedicated e2e test (`test/inventory-ledger.e2e-spec.ts`) asserting
`POST`/`PATCH`/`DELETE` against `/inventory-ledger` all 404/405.

### 19.2 API Surface

```text
GET  /inventory-ledger                 inventory_ledger.read
GET  /inventory-ledger/stock-card      inventory_ledger.read
GET  /inventory-ledger/reconciliation  inventory_ledger.read
GET  /inventory-ledger/:id             inventory_ledger.read
```

`/stock-card` and `/reconciliation` are registered before `/:id` in the
controller so NestJS's route matcher does not swallow either literal path
segment as a UUID path param.

**List filters** (`GET /inventory-ledger`, all applied at the database
query-builder level — never load-all-then-filter-in-JS): `warehouseId`,
`productVariantId`, `movementType` (enum-validated against
`StockMovementType`), `referenceType` (enum-validated against
`StockMovementReferenceType`), `referenceId`, `fromDate`/`toDate`
(ISO-8601 date/datetime strings, `@IsDateString()`), plus the standard
`page`/`limit`/`sort`/`order` via the existing Phase 04 `PaginationDto`
(reused unmodified). `sort` is validated through the existing Phase 04
`resolveSortField()` against an explicit, minimal allowlist —
`createdAt` (default), `quantityChange`, `movementType` — with
`movement.id ASC` always appended as a deterministic tiebreak so paginated
results never duplicate or skip a row when several movements share the
same `createdAt`.

**Date-range validation**: `fromDate > toDate` is rejected with a 400
`VALIDATION_ERROR` in `InventoryLedgerService.assertValidDateRange()` —
never silently swapped. `fromDate === toDate` is accepted (not a
violation). This is a genuinely new filter shape for this codebase — no
prior list DTO (`ListSalesDto`, `ListPurchaseOrdersDto`) has date-range
filtering — designed consistently with their existing
`@IsOptional()`/`@IsUUID()`/`@IsEnum()` DTO style, just with
`@IsDateString()` for the two new fields.

**Stock Card** (`GET /inventory-ledger/stock-card`) requires
`warehouseId` + `productVariantId` as query params — enforced explicitly
in the service (400 `VALIDATION_ERROR` if either is missing), not via
`@IsNotEmpty()` decorators, matching this codebase's existing preference
for service-level required-together validation. Returns every matching
`StockMovement` row in strict chronological order
(`createdAt ASC, id ASC` — the `id ASC` tiebreak is load-bearing, not
decorative: relying on natural DB ordering alone is explicitly
disallowed by the locked spec).

**Reconciliation** (`GET /inventory-ledger/reconciliation`) also requires
`warehouseId` + `productVariantId`. Purely diagnostic — it never writes
anything and never "fixes" a discrepancy, regardless of the result.

Every route reuses `JwtAuthGuard` + `PermissionGuard` +
`@RequirePermission('inventory_ledger.read')` +
`resolveRequestCompanyId()`, exactly matching every controller since
Phase 09. Company scoping is resolved by joining through
`warehouse.companyId` in every query — the same "derive scope through the
entity's real parent" pattern `WarehouseStockService` itself established
in Phase 14 (`StockMovement`, like `WarehouseStock`, has no `companyId`
column of its own). Cross-company `warehouseId`/`productVariantId`/`:id`
values never leak existence: list/reconciliation queries simply return an
empty/zero result (the company join excludes the row entirely), and
`:id` detail lookups return 404, matching the IDOR-hiding convention
every phase since Phase 09 has followed.

### 19.3 `balanceBefore` / `balanceAfter` Derivation

Neither field is a database column — both are computed only inside
`toStockCardEntryResponseDto()`:

```text
balanceAfter  = StockMovement.quantityAfter               (verbatim)
balanceBefore = StockMovement.quantityAfter - StockMovement.quantityChange
```

This is a pure derivation of a single already-persisted row; no other
row, and no `WarehouseStock` read, is consulted to compute either value.
Verified for both positive (`PURCHASE_RECEIPT`/`OPENING_BALANCE`/
`TRANSFER_IN`) and negative (`SALE_ISSUE`/`TRANSFER_OUT`/negative
`ADJUSTMENT`) `quantityChange` values, including a zero-crossing decrease
down to exactly zero, in both `inventory-ledger.service.spec.ts` (unit,
mocked) and `inventory-ledger.e2e-spec.ts` (e2e, a real mixed sequence of
`OPENING_BALANCE → PURCHASE_RECEIPT → SALE_ISSUE → TRANSFER_OUT →
ADJUSTMENT` built entirely through real Phase 14 write-path API calls,
asserting the exact expected running balance at every step and that the
final `balanceAfter` matches the live `GET /warehouse-stock` value).

### 19.4 Reconciliation Semantics

```text
ledgerBalance         = SUM(StockMovement.quantityChange)
                         WHERE warehouseId = X AND productVariantId = Y
warehouseStockBalance = WarehouseStock.onHandQuantity
                         WHERE warehouseId = X AND productVariantId = Y
                         (0 if no WarehouseStock row exists yet — the
                         same "row created lazily on first touch"
                         semantics WarehouseStockService already relies
                         on for an untouched pair)
difference             = warehouseStockBalance - ledgerBalance
reconciled             = difference === 0
```

Under correct Phase 14 write-path code, every real `(warehouseId,
productVariantId)` pair is always reconciled — each write path
(`GoodsReceiptsService`, `SalesService.confirm()`, `StockTransfersService`,
`StockAdjustmentsService`) mutates `WarehouseStock.onHandQuantity` and
writes the corresponding `StockMovement.quantityChange` inside the exact
same transaction, so the two numbers can never legitimately diverge. The
e2e suite proves the reconciled-true case through a real mixed sequence
of writes, and separately proves the formula's own arithmetic correctness
by independently recomputing `SUM(quantity_change)` and
`on_hand_quantity` directly against the live tables via `dataSource.query()`
and asserting the API's response matches that independent computation
exactly. **No test manufactures an artificial discrepancy by writing
directly to `stock_movements`/`warehouse_stock`** — the locked spec
explicitly frames that as inappropriate (it would prove nothing about the
read-only diagnostic's correctness, only about a deliberately corrupted
fixture), so a genuine `reconciled: false` case is not exercised end-to-end
in this test suite; the unit tests (`inventory-ledger.service.spec.ts`)
do cover both directions of a nonzero `difference` directly at the
service layer, where feeding in a mocked ledger sum and a mocked
`WarehouseStock.onHandQuantity` that disagree is a legitimate way to test
the comparison logic itself without touching real data.

### 19.5 RBAC

Exactly one permission was added to the existing idempotent seed
(`src/database/seeds/rbac.seed.ts`), matching the locked spec precisely:

```text
inventory_ledger.read
```

No `.create`/`.update`/`.delete` — Phase 15 has no write endpoint of any
kind. Granted to `SUPER_ADMIN`, and `inventory_ledger` received the
now-standard `RoleResourceScope` `ALL`-scope grant, the same
Phase-09-discovered gap-closing step every phase since has repeated.
Verified live via the seed script's own console output on first run
(`Created permission: inventory_ledger.read`,
`Granted inventory_ledger.read to SUPER_ADMIN`,
`Granted ALL scope for inventory_ledger to SUPER_ADMIN`) and confirmed
idempotent on re-run (zero output besides the completion line).

### 19.6 Schema — Explicitly Unchanged

No new migration file exists (still exactly the same 10 files under
`src/database/migrations/` as before this phase). `SHOW CREATE TABLE
stock_movements` and `SHOW CREATE TABLE warehouse_stock` were both
re-inspected against live Dockerized MySQL after this phase's
implementation and match §3/§2's original column/index/constraint
definitions exactly — no column added, removed, or retyped on either
table, no new table created. `InventoryModule`'s
`TypeOrmModule.forFeature([...])` array is unchanged from Phase 14 — Phase
15 only reads the `StockMovement`/`WarehouseStock` entities already
registered there.

### 19.7 Explicitly Out of Scope (by design, not oversight)

Continuing §15's "Deferred / Not Built" list, Phase 15 additionally does
**not** build: a second ledger table/entity (no `InventoryLedgerEntry`),
any write/reversal/correction endpoint, human-readable ledger numbering
(no counter table, no `ledgerNumber` field — `StockMovement.id` is
sufficient), a `balanceBefore` database column (compute-only, §19.3),
valuation/FIFO/weighted-average/COGS/accounting/GL (still Phase 17's
concern, §13), a reporting dashboard/KPI/analytics engine, Audit Log
integration (still absent from this entire codebase), Outbox/events/
Redis/BullMQ, batch/lot/serial tracking, or any frontend change.
