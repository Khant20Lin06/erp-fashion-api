# PAYMENT_ARCHITECTURE.md
 
Current-state note as of Friday, August 14, 2026: this document preserves
the original Phase 16 boundary language. Later implemented phases already
supersede statements here that treat Accounting, Outbox/Kafka,
Redis/BullMQ, Notifications, or Reports as future work.
 
Payment domain implemented in Phase 16. Owns the authoritative record of
money moving between the company and its Customers/Suppliers, and the
running `paidAmount`/`balanceAmount` balance on Sale/PurchaseOrder — the
second phase (after Phase 14/Inventory) explicitly authorized to modify
previously-completed phases' service code (`SalesService`,
`PurchaseOrdersService`), and the first phase to introduce request-level
idempotency and a genuinely new "lock several unrelated documents inside
one transaction" write pattern.

## 1. Domain Ownership

Phase 16 owns exactly four entities, in a new `src/modules/payments/`
module:

```text
Payment                — dedicated, authoritative payment record (D1)
PaymentAllocation       — polymorphic allocation of a Payment against a Sale/PurchaseOrder (D3)
PaymentMethod           — company-scoped master data (D7)
CompanyPaymentCounter   — per-(company, year) payment-number sequence (D6)
```

No `CashAccount`/`BankAccount`/`FinancialAccount`/account-balance entity
(D8). No `JournalEntry`/`GLAccount`/`ChartOfAccounts` (D9). No refund/
reversal/void of any kind (D10). See §9 "Explicit Boundaries" for the full
list of what this phase deliberately does not build.

## 2. Payment — the Authoritative Record (D1, D2)

`Payment` is a dedicated table — never embedded inside `Sale` or
`PurchaseOrder`. A single `direction` enum column (`RECEIPT`|`PAYMENT`)
supports both directions in one table rather than two parallel schemas:

- `RECEIPT` — a customer pays the company. `customerId` is required,
  `supplierId` must be null.
- `PAYMENT` — the company pays a supplier. `supplierId` is required,
  `customerId` must be null.

This "exactly one of X/Y set, matching a discriminator" shape mirrors
`Sale.branchId`/`warehouseId`'s own cross-validation convention — enforced
in `PaymentsService`, never a DB `CHECK` constraint (this codebase has
never used one; every prior phase's "exactly one of" rule lives in the
service layer, and Payment does not introduce a new pattern for this).

`Payment` extends `BaseEntity` (soft-delete via `deletedAt` inherited, even
though no delete endpoint exists) — the same choice `Sale`/`PurchaseOrder`
made for the same reason: consistency of the base entity contract across
every transactional-document entity in the codebase, not an implied delete
capability.

## 3. PaymentAllocation — Polymorphic, No FK (D3)

A single `Payment` can fund one or more target documents (partial payment
against one Sale, or one payment split across several Sales/PurchaseOrders
of the same customer/supplier). `PaymentAllocation.referenceType`
(`SALE`|`PURCHASE_ORDER`) + `referenceId` (a bare `char(36)`, no foreign
key) is the polymorphic pointer — this exactly mirrors
`StockMovement.referenceType`/`referenceId`'s established precedent from
Phase 14, which already solved "one column needs to point at rows in two
different tables" for this codebase. A single FK column cannot target two
tables, and inventing two subclass tables
(`SalePaymentAllocation`/`PurchasePaymentAllocation`) would duplicate the
whole schema for no behavioral difference — the locked spec (D3) rejected
that shape explicitly.

`PaymentAllocation` does **not** extend `BaseEntity`. It has its own `id`
and `createdAt` only — no `updatedAt`, no soft-delete — mirroring
`SaleItem`/`PurchaseOrderItem`'s own shape: an allocation row is created
once, inside the same transaction as its parent `Payment`, and never
updated or deleted afterward (D5 — confirmed payments are immutable).
`paymentId` is the one deliberate `ON DELETE CASCADE` in this schema
(matching `GoodsReceiptItem`/`StockTransferItem`'s own CASCADE-to-parent
pattern) — an allocation row is meaningless without its parent payment.

## 4. PaymentMethod — Real Master Data, Not an Enum (D7)

`PaymentMethod` is a company-scoped master-data entity —
`id`/`companyId`/`code`/`name`/`status`, `UNIQUE(company_id, code)` — built
as a direct structural mirror of Phase 09's `Category`/`Brand`. `status` is
an `ACTIVE`/`INACTIVE` enum, not a boolean `isActive`: the codebase's own
master-data convention (`BrandStatus`, `CollectionStatus`, `CategoryStatus`
all use the same two-value enum) was checked and matched exactly, rather
than inventing a boolean field where the established pattern is an enum.

Its API surface is deliberately smaller than Brand/Category's full CRUD:
`GET /payment-methods` (list), `GET /payment-methods/:id` (detail),
`POST /payment-methods` (create) only — no PATCH/activate/deactivate/
DELETE. This is a direct reading of the locked spec's own API surface
(D14), which lists only `GET`/`POST` for PaymentMethod, unlike Phase 09's
own explicit call for full lifecycle management on Category/Brand/
Collection. `PaymentMethodsService` (`src/modules/payments/services/
payment-methods.service.ts`) therefore implements `findAll`/
`findByIdInCompany`/`create` and stops there — it is not an oversight, it
is the locked minimal scope.

No `CashAccount`/`BankAccount`/balance lives on `PaymentMethod` (D8) — see
§9.

## 5. CompanyPaymentCounter — Numbering (D6)

`CompanyPaymentCounter` is an exact structural mirror of
`CompanySaleCounter`/`CompanyPurchaseCounter`/
`CompanyGoodsReceiptCounter`/`CompanyStockTransferCounter`/
`CompanyStockAdjustmentCounter` (Phase 12/13/14): one row per
`(company_id, year)`, `UNIQUE(company_id, year)`, no `BaseEntity`.
`PaymentsService.generatePaymentNumber()` uses the exact same
upsert-then-lock idiom every prior document-numbering method in this
codebase uses:

```sql
INSERT INTO company_payment_counters (id, company_id, year, last_sequence)
VALUES (?, ?, ?, 0)
ON DUPLICATE KEY UPDATE last_sequence = last_sequence
```

followed by `createQueryBuilder(...).setLock('pessimistic_write').getOneOrFail()`,
an `manager.update()` (never `manager.save()` — see §7), and
`formatDocumentNumber('PMT', year, sequence)` — reusing Phase 14's shared
formatter (`src/modules/inventory/utils/document-number.ts`) rather than
writing a fifth copy of the same string-formatting function. The
`retryOnDuplicateEntry()` wrapper Phase 14 built to absorb the documented
`ER_DUP_ENTRY` race on a not-yet-existing upsert target is reused verbatim,
not re-implemented. Payment numbers look like `PMT-2026-000001`.

## 6. Lifecycle Decision (D4) — Why Every Payment Is Created Directly CONFIRMED

The locked spec explicitly delegated this call: "if your reading of the
create-flow makes a separate DRAFT stage genuinely awkward or redundant
given allocation happens inside `POST /payments` itself, you may collapse
to CONFIRMED-only creation."

**Decision: collapsed to CONFIRMED-only creation.** Reasoning:

- Every other transactional-document entity in this codebase (`Sale`,
  `PurchaseOrder`) has a real DRAFT stage because DRAFT is a genuinely
  different, useful state for those documents — a draft Sale can be edited
  (implicitly, by re-creating), reviewed, or cancelled before it ever
  touches stock or a customer balance. A DRAFT `Payment`, by contrast,
  would carry **no distinct behavior**: the entire point of the locked
  transaction flow (steps 7-15 of the spec) is that allocation, balance
  application, and payment-number generation all happen atomically inside
  the same `POST /payments` call. There is no intermediate state where a
  Payment exists but has not yet been allocated — allocations are supplied
  in the same request body that creates the Payment.
- A `POST /payments/:id/confirm` endpoint would therefore have nothing
  left to do except flip a status column — no locking, no balance
  mutation, no business logic distinct from creation. Building it anyway
  would be inventing an inert intermediate state purely to mirror
  Sale/PurchaseOrder's shape, which the locked spec's own instruction
  ("preserve the approved minimal lifecycle without inventing additional
  states") explicitly warns against.
- `PaymentStatus` still declares two values (`CONFIRMED`, `CANCELLED`),
  keeping the enum shape symmetric with `SaleStatus`/`PurchaseOrderStatus`
  and leaving room for a future phase to add real cancellation semantics
  without a schema migration. In practice, **nothing in this phase ever
  assigns `CANCELLED`** — D5/D10 forbid any reversal of a confirmed
  payment's financial effect (reversing `paidAmount`/`balanceAmount` on the
  target Sale/PurchaseOrder), and a `CANCELLED` payment would need exactly
  that reversal to be meaningful. Building a cancel endpoint that flips a
  status column without reversing the balance it caused would leave the
  system in a lying state (a "cancelled" payment that still counts toward
  `paidAmount`) — worse than not building it. So `CANCELLED` is reachable
  in the type system but not in practice; this is stated honestly here
  rather than silently omitted.
- Consequently, **no `payments.confirm` permission exists** (see §10) and
  **no `POST /payments/:id/confirm` endpoint exists** (see §11) — both
  would gate a transition nothing in this phase ever performs.

## 7. Sale/PurchaseOrder Integration — `applyPayment()` (D16)

**The single most consequential decision in this phase**: `SalesService`
and `PurchaseOrdersService` each gained exactly one new method,
`applyPayment()`, and nothing else in either file changed.

```typescript
// src/modules/sales/services/sales.service.ts
async applyPayment(
  id: string,
  companyId: string,
  allocatedAmount: number,
  userId: string,
  manager: EntityManager,
): Promise<void>

// src/modules/purchase/services/purchase-orders.service.ts
async applyPayment(
  id: string,
  companyId: string,
  allocatedAmount: number,
  userId: string,
  manager: EntityManager,
): Promise<void>
```

Why a new method on the *owning* service, rather than `PaymentsService`
reaching into `Sale`/`PurchaseOrder` rows directly: `paidAmount`/
`balanceAmount` are domain fields of Sale/PurchaseOrder, and the rule for
updating them (`newPaid = oldPaid + allocated`, `newBalance = grandTotal -
newPaid`, reject if `newPaid > grandTotal`) is domain logic those services
already own the rest of the entity's invariants for. Duplicating that rule
inside `PaymentsService` would create two places that both know how a
Sale's balance is computed — the exact kind of duplication every prior
phase's "reuse, don't reimplement" discipline (Phase 07-15) avoided.
`PaymentsService` calls `applyPayment()`; it does not recompute anything
about a Sale or PurchaseOrder itself.

Each `applyPayment()`:

1. Accepts the caller's `manager: EntityManager` — it never opens its own
   transaction (`TransactionService.run()` is called exactly once, by
   `PaymentsService.create()`, wrapping payment number generation,
   document locking, Payment/PaymentAllocation creation, and every
   `applyPayment()` call in one atomic unit).
2. Locks the target row itself, via
   `createQueryBuilder(...).where(...).andWhere('companyId = :companyId', ...).setLock('pessimistic_write').getOne()`
   — company-scoped in the same query as the lock, so a cross-company id
   fails closed as `NotFound` rather than locking a row it should never
   have been allowed to see.
3. Reads the now-locked row's *current* `paidAmount`/`grandTotal`,
   computes `newPaid`/`newBalance`, and rejects (`409 Conflict`) if
   `newPaid > grandTotal` (with a `1e-9` floating-point tolerance guard on
   the comparison, since amounts are handled as JS `number` after being
   parsed from the DB's `DECIMAL` string).
4. Writes the result via `manager.update(Entity, id, { paidAmount,
   balanceAmount, updatedBy })` — **never** `manager.save()`. This is the
   exact bug class `docs/INVENTORY_ARCHITECTURE.md` documents Phase 14
   discovering: an entity hydrated via
   `createQueryBuilder().setLock().getOneOrFail()` (or, here, `.getOne()`)
   was found, through a real e2e concurrency test in Phase 14's own
   GoodsReceipt flow, to sometimes make `manager.save()` issue a duplicate
   `INSERT` instead of an `UPDATE`. `applyPayment()` uses `manager.update()`
   from the start, deliberately avoiding reintroducing a bug class that
   was already found and fixed once in this codebase.

**Confirmed via `git diff`**: `confirm()`, `create()`, `cancel()`,
`findAll()`, `findByIdInCompany()`, and every private helper in both files
are byte-identical to their pre-Phase-16 state. The only changes are the
new `applyPayment()` method appended at the end of each class, plus the
`AppException`/`ErrorCode` imports both files already had. See the Phase
16 implementation report for the literal diff output.

## 8. Transaction Flow and Deterministic Multi-Document Locking

`PaymentsService.create()` follows the locked spec's exact 16-step flow.
The step worth architectural comment is #9 — locking every target
Sale/PurchaseOrder referenced by the payment's allocations, in
deterministic order, before mutating any of them.

This is structurally the same problem `StockTransfersService` (Phase 14)
solved for cross-warehouse locking: two concurrent operations that each
touch the same two rows, but acquire their locks in opposite orders, can
deadlock. A payment with allocations against `{Sale A, Sale B}` and a
second concurrent payment with allocations against `{Sale B, Sale A}`
(same two rows, different array order) must not be allowed to lock A-then-B
while the other locks B-then-A.

`PaymentsService` reuses `StockTransfersService`'s exact fix, generalized
from `(warehouseId, productVariantId)` tuples to `(referenceType,
referenceId)` tuples:

```typescript
const sortedTargets = [...dedupedTargets.values()].sort((a, b) => {
  const typeCompare = a.referenceType.localeCompare(b.referenceType);
  if (typeCompare !== 0) return typeCompare;
  return a.referenceId.localeCompare(b.referenceId);
});
```

Every distinct `(referenceType, referenceId)` pair referenced by the
payment's allocations is deduplicated first (a payment may allocate
multiple line amounts against the same Sale — e.g. an operator correcting
an under-allocation in the same request), summed into one total per
target, sorted, and only then locked one at a time via `applyPayment()`.
No lock is acquired until the full sorted list is known — the same
"compute the complete lock set before acquiring any lock" discipline
`StockTransfersService` established.

`PaymentsService` itself never calls `manager.createQueryBuilder(Sale,
...)` or `manager.createQueryBuilder(PurchaseOrder, ...)` directly — it
delegates the actual row lock to `applyPayment()`, keeping `SalesService`
and `PurchaseOrdersService` mutually unaware of each other and of Payment
(neither imports anything from `src/modules/payments/`).

## 9. Idempotency (D11)

An optional `Idempotency-Key` request header, mapped to
`Payment.idempotencyKey` (nullable `varchar(255)`), with a
`UNIQUE(company_id, idempotency_key)` composite index. MySQL treats
multiple `NULL` values in a unique index as non-colliding (verified live —
see the migration verification evidence in the implementation report:
several e2e tests create payments with no `Idempotency-Key` header in the
same company without any unique-constraint error), so companies that never
supply a key are entirely unaffected.

Two layers of protection, matching the locked spec's own two-part
instruction:

1. **Happy path**: before opening any transaction, `PaymentsService.create()`
   looks up an existing `Payment` by `(companyId, idempotencyKey)`. If
   found, it is returned as-is — the controller maps this to `200 OK`
   (not `201 Created`) via `response.status(wasExisting ? 200 : 201)`.
2. **Race backstop**: two genuinely concurrent requests carrying the same
   brand-new key can both pass the pre-transaction lookup (neither has
   committed yet, so neither is visible to the other). Both attempt the
   `INSERT`; the `UNIQUE(company_id, idempotency_key)` index lets exactly
   one commit and raises `ER_DUP_ENTRY`/errno `1062` for the other.
   `PaymentsService.create()` catches that specific error (narrowed to the
   idempotency index specifically, via the error message containing
   `idempotency` — the index is literally named
   `IDX_pay_company_idempotency_key` for this reason — so an unrelated
   duplicate-key failure is never silently swallowed as if it were a
   replay) and re-fetches the now-committed winning row instead of
   surfacing a `500` or creating a duplicate. This is the same category of
   fix as `retryOnDuplicateEntry()` (Phase 14) — using the database's own
   unique constraint as the concurrency backstop rather than trying to
   lock a row that does not exist yet — proven live by
   `test/payments.e2e-spec.ts`'s "does not collide across two different
   companies using the same key value" and the idempotent-replay test.

## 10. RBAC (D13)

Four new permissions, appended to the existing idempotent
`src/database/seeds/rbac.seed.ts` catalog:

| Permission | Notes |
|---|---|
| `payments.read` | `GET /payments`, `GET /payments/:id` |
| `payments.create` | `POST /payments` — creates AND confirms in one call (see §6) |
| `payment_methods.read` | `GET /payment-methods`, `GET /payment-methods/:id` |
| `payment_methods.create` | `POST /payment-methods` |

No `.update`/`.delete`/`.confirm`/`.refund`/`.reverse`/`.void`/`.export`/
`.summary`/`.reconcile` for either resource — `payments.confirm` was
deliberately not created (see §6: nothing in this phase ever performs a
separate confirm transition to gate), and PaymentMethod's own
`.update`/`.delete` were not created because no PATCH/DELETE endpoint
exists for it (§4). Both resources also received the now-standard
`RoleResourceScope` `ALL`-scope grant for `SUPER_ADMIN`, via the same
`SUPER_ADMIN_ALL_SCOPE_RESOURCES` array every phase since Phase 09 has
extended — verified live: the seed's first run printed exactly 4 new
permissions, 4 new grants, and 2 new `ALL`-scope rows; a second run printed
only the completion line (idempotent).

## 11. API Surface (D14)

```text
GET    /payments                — list, company-scoped, filterable
GET    /payments/:id            — detail, with allocations
POST   /payments                — create + allocate + confirm in one call (Idempotency-Key honored)

GET    /payment-methods         — list
GET    /payment-methods/:id     — detail
POST   /payment-methods         — create
```

No `PATCH`/`DELETE`/refund/reverse/void/summary/reconciliation/export
endpoint anywhere in this phase — proven by `test/payments.e2e-spec.ts`'s
dedicated "no PATCH/DELETE/refund endpoint of any kind" and "no PATCH/
DELETE endpoint for payment methods" test groups, which assert `404`/`405`
against every such route.

## 12. DataScope / Company Scoping

`resolveRequestCompanyId()` (Phase 09's helper, unmodified) is reused
identically by both new controllers — no new scope kind, no second
authorization mechanism. Cross-company payment/payment-method ids resolve
to `404`, never a leaked existence signal or a `403`, matching the
IDOR-hiding convention every phase since Phase 09 has followed.

## 13. Accounting Boundary — Explicit, Honest Limitation (D9)

**No `JournalEntry`/`GLAccount`/`ChartOfAccounts`/`GeneralLedger` table,
module, or "prepared" integration interface exists anywhere in this
codebase, including after this phase.** This is not an oversight — the
locked spec explicitly frames even a "prepared" event/interface for a
future accounting integration as scope creep ("an orphan API with no real
consumer"), so none was built.

What this phase *does* leave behind for a future Phase 17
(Accounting/Double-Entry) to consume, as plain data rather than any kind of
interface:

- `Payment.amount`, `Payment.direction`, `Payment.paymentMethodId`,
  `Payment.currency`
- `Sale.grandTotal`, `Sale.paidAmount`, `Sale.balanceAmount`,
  `Customer.receivableAccountId` (Phase 11's inert FK-less placeholder,
  still inert)
- `PurchaseOrder.grandTotal`, `PurchaseOrder.paidAmount`,
  `PurchaseOrder.balanceAmount`, `Supplier.payableAccountId` (same)

Phase 17 would read these through their own existing, permission-gated
REST APIs exactly as any other consumer would — no direct table access, no
new integration surface Phase 16 needs to pre-build. This mirrors exactly
how `docs/INVENTORY_ARCHITECTURE.md`/`docs/SALES_ARCHITECTURE.md` framed
their own eventual Accounting integration points.

## 14. Operational Running Balance vs. Chart-of-Accounts (Phase 16 vs. Phase 17)

`docs/CUSTOMER_SUPPLIER_ARCHITECTURE.md` §18 drew this exact line in
advance: "Phase 16 ... is the first phase expected to actually calculate
any running balance." This phase fulfills exactly that and no more:
`Sale.paidAmount`/`balanceAmount` and `PurchaseOrder.paidAmount`/
`balanceAmount` are now live, server-computed running balances, maintained
transactionally by `applyPayment()` every time a `Payment` allocates
against them.

What this phase explicitly does **not** do, per the same section's own
boundary: it does not give `Customer.receivableAccountId`/
`Supplier.payableAccountId` a real FK target (no Chart of Accounts table
exists to point at), it does not consume `Customer.openingBalanceAmount`/
`Supplier.openingBalanceAmount` as a seed value for anything (those remain
Phase 11's inert master-data fields, untouched), and it builds no
double-entry/debit-credit ledger of any kind. The `paidAmount`/
`balanceAmount` pair is a simple running total against one document, not a
general-ledger account — Phase 17 is expected to build the real ledger
*seeded from*, not *built on top of*, this phase's output, per
`CUSTOMER_SUPPLIER_ARCHITECTURE.md`'s own framing.

## 15. Refund/Reversal/Void — Explicit Deferral (D10)

**No refund, reversal, or void endpoint, permission, or field exists
anywhere in this phase, not even as a stub.** `PaymentStatus.Cancelled` is
a real enum value (kept for shape symmetry with Sale/PurchaseOrder, see
§6) but nothing in this phase ever assigns it — building a cancel
endpoint that flips the status column without reversing the
`paidAmount`/`balanceAmount` effect it caused would be worse than not
building it (a payment that claims to be cancelled but still counts toward
the target document's paid amount). A future phase that adds real
reversal semantics would need to: (a) decide what "reversing" means for an
already-applied `applyPayment()` call (a new, symmetric
`reversePayment()`-style method, presumably), and (b) decide whether a
reversal is itself a new `Payment` row (an accounting-correct approach,
preserving the immutable-history property D5 established) or a mutation of
the original (which D5 currently forbids entirely). Phase 16 takes no
position on this — it is a genuinely new decision for whichever future
phase adds refunds, not a gap silently left in this one.

## 16. AuditLog / Outbox / Event Bus — Pre-Existing Gap, Not Introduced Here

No `AuditLog`, `Outbox`, Redis-backed queue, BullMQ job, or event-bus
abstraction exists anywhere in this codebase as of Phase 15 (confirmed via
the same grep every phase since Phase 09 has run), and none was introduced
by this phase either — including no "prepared" abstraction for one, per
the same D9/D17 discipline that kept the accounting boundary clean (§13).

## 17. Concurrency / Locking Strategy Summary

Two concurrency-sensitive operations exist in this phase:

1. **Payment-number generation** — solved identically to every prior
   document-numbering phase: an idempotent upsert + `SELECT ... FOR
   UPDATE` on the per-`(company, year)` counter row, inside the same
   transaction as Payment creation.
2. **Multi-document allocation** — solved by deterministic
   `(referenceType, referenceId)`-ordered locking of every target
   Sale/PurchaseOrder before any of them is mutated (§8), with
   `applyPayment()`'s own `1e-9`-tolerant over-allocation check as the
   final correctness gate under lock.

Both are proven, not just asserted, by `test/payments.e2e-spec.ts`'s
`describe('concurrency — real Promise.all() race ...')` block: a real
`Promise.all()` of two genuinely concurrent `POST /payments` requests that
together would over-allocate a Sale (one succeeds with `201`, one is
correctly rejected `409`, the Sale's final `paidAmount` is exactly the
successful payment's amount, and exactly one `payments` row exists
afterward — not a mix of "both succeeded" or "both failed"), and a second
10-way concurrent `POST /payments` test proving payment-number uniqueness
under real parallel load, mirroring Phase 12's own 10-way `POST /sales`
concurrency test structure.

## 18. Security Decisions Summary

- Never trust client-submitted `paymentNumber`/`status`/`createdBy` —
  `CreatePaymentDto` has no fields for any of these, and the existing
  global `forbidNonWhitelisted` `ValidationPipe` rejects any attempt to
  submit them (400).
- Cross-company Customer/Supplier/PaymentMethod/Sale/PurchaseOrder id →
  404 (IDOR-safe, no existence leak), matching every phase's convention
  since Phase 09.
- `direction`/`customerId`/`supplierId` cross-validation and
  `referenceType`/`direction` cross-validation are both enforced
  server-side before the transaction opens (400), never relying on the
  client to send a self-consistent payload.
- Over-allocation (against a single document's `grandTotal`, or against
  the payment's own `amount` across all its allocations) is a `409`
  business-rule conflict, not a silently-clamped value.
- Idempotency-Key collisions across different companies are proven
  non-colliding (§9) — no cross-tenant leakage through a shared key value.

## 19. Database Schema

One migration, `1786580000000-CreatePaymentTables.ts`, in dependency
order: `payment_methods` → `company_payment_counters` → `payments` (FKs to
`companies`/`branches`/`customers`/`suppliers`/`payment_methods`/`users`)
→ `payment_allocations` (FK to `payments`, `ON DELETE CASCADE`). Verified
UP → DOWN → UP against real Dockerized MySQL with `SHOW CREATE TABLE`
inspection of all four tables and an explicit re-check that every Phase
13/14/15 table (`purchase_orders`, `goods_receipts`, `warehouse_stock`,
`stock_movements`, `stock_transfers`, `stock_adjustments`, and their
counters) remained present and untouched throughout — see the
implementation report for the literal command output.

## 20. Transactions Used

Exactly one `TransactionService.run()` call per `POST /payments` request
(inside `PaymentsService.create()`), wrapping: payment-number generation,
every target document's lock + `applyPayment()` call, `Payment` row
creation, and every `PaymentAllocation` row creation. Any failure at any
step — an over-allocated target, a mid-loop lock timeout — rolls back the
entire transaction: no partial `Payment`, no partial `PaymentAllocation`,
no partial `Sale`/`PurchaseOrder` balance change. Proven by the "no
partial Payment/PaymentAllocation rows survive the rollback" e2e assertion
(direct row-count query against `payments` after a deliberately
over-allocated request).

## 21. Deferred / Not Built (Full List)

- No `CashAccount`/`BankAccount`/`FinancialAccount`/account-balance entity
  (D8) — `PaymentMethod` + `Payment.reference` (free text) is the complete
  money-instrument model.
- No `JournalEntry`/`GLAccount`/`ChartOfAccounts`/`GeneralLedger`, not even
  a prepared interface (D9) — Phase 17's concern entirely.
- No refund/reversal/void endpoint, permission, or field beyond the inert
  `CANCELLED` enum value (D10) — see §15.
- No `Currency` entity, no exchange rate, no multi-currency conversion —
  `Payment.currency` is a plain `CHAR(3)`, matching
  `Sale.currency`/`PurchaseOrder.currency` exactly (D12).
- No `AuditLog`/`Outbox`/Redis/BullMQ/event bus, nor any prepared
  abstraction for one (D17) — pre-existing gap, not introduced here.
- No `PaymentMethod` update/deactivate/delete endpoint — the locked API
  surface (D14) stops at read+create for this resource.
- No `SalesReturn`/`PurchaseReturn` — out of scope, unrelated to Payment.
- No Bruno API collection — consistent with every prior phase (no prior
  phase established Bruno tooling in this repository).
- `@nestjs/swagger`'s transitive `js-yaml` advisory (unchanged since
  Phase 01, dev-time only).
