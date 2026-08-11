# Phase 15 — Inventory Ledger

## NestJS + TypeScript + MySQL + TypeORM + Redis + BullMQ + Docker

## Production-Ready Implementation Prompt

You are implementing **Phase 15 — Inventory Ledger** of the Fashion ERP Backend.

The backend stack is:

* NestJS
* TypeScript
* MySQL
* TypeORM
* Redis
* BullMQ
* Docker
* REST API
* Bruno API Testing

Frontend:

* GitHub: https://github.com/Khant20Lin06/Fashion-ERP
* Frontend: https://fashion-erp.vercel.app/

---

# 1. COMPLETED PHASES

The following phases are already implemented:

```text
Phase 00 — AI Rules / Source of Truth
Phase 01 — Project Foundation
Phase 02 — Docker / Infrastructure
Phase 03 — Database Architecture
Phase 04 — Core / Shared Infrastructure
Phase 05 — Authentication
Phase 06 — Dynamic RBAC + Data Visibility
Phase 07 — Organization / Company / Branch / Warehouse
Phase 08 — User / Employee / Account Management
Phase 09 — Master Data
Phase 10 — Product / Variant / Pricing
Phase 11 — Customer / Supplier
Phase 12 — Sales
Phase 13 — Purchase
Phase 14 — Inventory
```

Do NOT rewrite completed phases unnecessarily.

Reuse the existing architecture.

The existing codebase is the source of truth.

---

# 2. PHASE 15 OBJECTIVE

Implement a production-ready **Inventory Ledger** responsible for recording the complete historical movement of inventory.

The key distinction is:

```text
Phase 14 — Inventory
    =
Current Stock State

Phase 15 — Inventory Ledger
    =
Historical Stock Movement
```

Inventory Ledger must answer:

```text
What happened?
When did it happen?
Which product?
Which variant?
Which warehouse?
How much changed?
Why did it change?
Which business document caused it?
Who caused it?
What was the quantity before?
What was the quantity after?
What was the unit cost?
What was the total cost?
```

---

# 3. CORE PRINCIPLE

The Inventory Ledger is a **historical record**.

Once a finalized ledger entry has been created:

```text
DO NOT UPDATE IT
DO NOT DELETE IT
DO NOT RECALCULATE HISTORY
DO NOT OVERWRITE OLD VALUES
```

If something must be corrected:

```text
Original Movement
        ↓
Reversal / Correction Movement
        ↓
Corrected Movement
```

Never modify history to hide an error.

---

# 4. SOURCE OF TRUTH BOUNDARY

Use this architecture:

```text
                    PURCHASE
                       │
                    RECEIVE
                       │
                       ▼
                 ┌─────────────┐
                 │  INVENTORY  │
                 │ Phase 14    │
                 │             │
                 │ Current     │
                 │ Stock State │
                 └──────┬──────┘
                        │
                  Stock Movement
                        │
                        ▼
                 ┌─────────────┐
                 │  INVENTORY  │
                 │   LEDGER    │
                 │  Phase 15   │
                 │             │
                 │ Historical  │
                 │ Movement    │
                 └──────┬──────┘
                        │
                        ▼
                 ACCOUNTING
                 Phase 17
```

Inventory Ledger must NOT become a second current-stock system.

Phase 14 remains responsible for current stock.

Phase 15 remains responsible for historical stock movements.

---

# 5. FIRST STEP — INSPECT BEFORE CODING

Before writing code, inspect the existing backend.

Inspect:

```text
Phase 03 — Database Architecture
Phase 06 — Dynamic RBAC + Data Visibility
Phase 07 — Company / Branch / Warehouse
Phase 08 — User / Employee / Account
Phase 10 — Product / Variant
Phase 12 — Sales
Phase 13 — Purchase
Phase 14 — Inventory
```

Inspect:

```text
entities
repositories
services
controllers
DTOs
guards
permissions
data scopes
transactions
migrations
audit log
outbox
events
error handling
pagination
response format
tests
```

Do not create duplicate infrastructure.

---

# 6. FRONTEND INSPECTION

Inspect the actual frontend repository.

Search for:

```text
Inventory Ledger
Stock Ledger
Stock History
Inventory History
Stock Movement
Stock Movement History
Stock Card
Stock Card Report
Stock Transaction
Stock In
Stock Out
Transfer
Adjustment
Opening Stock
Running Balance
```

Also inspect:

```text
routes
pages
components
tables
filters
date filters
warehouse filters
product filters
variant filters
transaction types
document references
running balance
export
reports
dashboard
```

Create an internal mapping:

```text
Frontend Ledger Feature
        ↓
Backend API
        ↓
Service
        ↓
Ledger Entity
        ↓
Permission
        ↓
Data Visibility
```

Do not implement UI features that do not exist unless required for backend integrity.

---

# 7. LEDGER ENTRY

A ledger entry represents one inventory movement.

Conceptually:

```text
InventoryLedgerEntry
├── id
├── companyId
├── branchId
├── warehouseId
├── productId
├── variantId
├── movementType
├── quantityIn
├── quantityOut
├── quantity
├── balanceBefore
├── balanceAfter
├── unitCost
├── totalCost
├── referenceType
├── referenceId
├── referenceNumber
├── movementDate
├── reason
├── metadata
├── createdBy
├── createdAt
└── reversalOfId
```

Adapt this structure to the existing architecture.

Do not blindly create every field.

---

# 8. MOVEMENT TYPES

Use explicit movement types.

Potential:

```text
OPENING_BALANCE

PURCHASE_RECEIPT

SALES_ISSUE

SALES_RETURN

PURCHASE_RETURN

TRANSFER_IN

TRANSFER_OUT

ADJUSTMENT_IN

ADJUSTMENT_OUT

STOCK_RESERVATION

STOCK_RESERVATION_RELEASE

REVERSAL

CORRECTION
```

Only implement movement types supported by the actual business flow.

Do not create unnecessary types.

---

# 9. DIRECTION

Every physical stock movement must clearly identify direction.

For example:

```text
PURCHASE_RECEIPT
    quantityIn = 100
    quantityOut = 0
```

Sales:

```text
SALES_ISSUE
    quantityIn = 0
    quantityOut = 20
```

Transfer Out:

```text
TRANSFER_OUT
    quantityIn = 0
    quantityOut = 10
```

Transfer In:

```text
TRANSFER_IN
    quantityIn = 10
    quantityOut = 0
```

Do not allow:

```text
quantityIn > 0
AND
quantityOut > 0
```

for a normal physical movement unless the architecture explicitly supports a special movement type.

---

# 10. QUANTITY

Use a precise numeric type appropriate for inventory quantities.

Do NOT use floating-point arithmetic for quantities where precision matters.

Respect existing database conventions.

Examples:

```text
1
10
10.5
0.250
```

depending on the product/unit system.

Never silently round quantities.

---

# 11. BALANCE BEFORE / AFTER

Every finalized ledger movement should preserve:

```text
balanceBefore
balanceAfter
```

Example:

```text
Opening Stock
    Before = 0
    In = 100
    After = 100

Sale
    Before = 100
    Out = 20
    After = 80

Purchase
    Before = 80
    In = 50
    After = 130
```

This allows the ledger to explain the exact stock evolution.

---

# 12. RUNNING BALANCE

The ledger should support:

```text
Running Balance
```

For a stock card:

```text
Date        In     Out    Balance

Jan 01      100      0       100
Jan 03        0     20        80
Jan 05       50      0       130
Jan 08        0     10       120
```

Do not calculate this only in the frontend.

The backend must provide reliable balance information.

---

# 13. BALANCE INTEGRITY

For physical inventory:

```text
balanceAfter =
    balanceBefore
    + quantityIn
    - quantityOut
```

This rule must be enforced by application logic.

Where possible, use database constraints.

Do not allow inconsistent records.

Example invalid:

```text
balanceBefore = 100
quantityIn = 20
quantityOut = 0
balanceAfter = 500
```

This must never happen.

---

# 14. LEDGER ORDERING

Ledger entries must have deterministic ordering.

Do NOT rely only on:

```text
createdAt
```

because multiple transactions can occur within the same timestamp.

Use an ordering strategy such as:

```text
movementDate
+
createdAt
+
id
```

or an appropriate sequential number.

The ordering must be deterministic.

---

# 15. LEDGER NUMBER

If the system requires a ledger transaction number:

```text
STK-LED-2026-000001
STK-LED-2026-000002
```

Generate it server-side.

Protect against concurrent generation.

Reuse existing document-number infrastructure if available.

Do not create duplicate sequence infrastructure.

---

# 16. REFERENCE DOCUMENT

Every ledger movement should be traceable to a business operation.

Examples:

```text
PURCHASE_RECEIPT
    → Purchase Receiving ID

SALES_ISSUE
    → Sales ID

TRANSFER_OUT
    → Stock Transfer ID

TRANSFER_IN
    → Stock Transfer ID

ADJUSTMENT_IN
    → Stock Adjustment ID
```

Conceptually:

```text
referenceType
referenceId
referenceNumber
```

The exact implementation should follow existing project conventions.

---

# 17. TRACEABILITY

A user should be able to go:

```text
Ledger Entry
    ↓
Reference
    ↓
Business Transaction
    ↓
User / Account
```

Example:

```text
Stock Out
    ↓
Sales Invoice INV-2026-00125
    ↓
Customer ABC
    ↓
Sales Staff Account
```

Do not duplicate entire Sales/Purchase records inside the ledger.

Store references.

---

# 18. PURCHASE → LEDGER

When Phase 13 Purchase Receiving increases inventory:

```text
Purchase Receiving
        ↓
Phase 14 Inventory
        ↓
Stock + quantity
        ↓
Phase 15 Ledger
        ↓
PURCHASE_RECEIPT
```

Example:

```text
Received = 100

Inventory:
On Hand +100

Ledger:
IN = 100
OUT = 0
```

Do not create ledger entries when a Purchase Order is merely created.

Ledger should represent actual stock movement.

---

# 19. SALES → LEDGER

When Phase 12 Sales causes actual stock deduction:

```text
Sales
    ↓
Fulfillment / Stock Issue
    ↓
Phase 14 Inventory
    ↓
Phase 15 Ledger
```

Example:

```text
Sold = 20

Ledger:
IN = 0
OUT = 20
```

Do not create physical stock-out ledger entries for draft sales.

Follow the actual Phase 12 state machine.

---

# 20. SALES RETURN

If Sales Return puts stock back:

```text
SALES_RETURN

quantityIn = returnedQuantity
quantityOut = 0
```

The return must be linked to the original Sales transaction.

Do not treat the return as an unrelated adjustment.

---

# 21. PURCHASE RETURN

If goods are returned to supplier:

```text
PURCHASE_RETURN

quantityIn = 0
quantityOut = returnedQuantity
```

Link it to:

```text
Purchase
Purchase Receipt
Return transaction
```

according to existing architecture.

---

# 22. TRANSFER

A warehouse transfer normally creates two ledger entries.

Example:

```text
Warehouse A
    ↓
TRANSFER_OUT
    OUT = 20

Warehouse B
    ↓
TRANSFER_IN
    IN = 20
```

Both entries must reference the same:

```text
StockTransfer
```

This makes the transfer traceable.

---

# 23. TRANSFER ATOMICITY

If the business flow performs a single atomic transfer:

```text
Warehouse A -20
Warehouse B +20
```

both ledger entries must be created in the same database transaction.

If the existing workflow supports:

```text
IN_TRANSIT
```

then follow that architecture.

Do not create a ledger entry that claims goods arrived before the receiving step actually happened.

---

# 24. STOCK ADJUSTMENT

Adjustment creates a ledger movement.

Positive:

```text
ADJUSTMENT_IN
quantityIn = difference
```

Negative:

```text
ADJUSTMENT_OUT
quantityOut = difference
```

Example:

```text
Expected = 100
Actual = 97

Adjustment:
OUT = 3
```

Do not overwrite the historical stock count.

---

# 25. OPENING BALANCE

Opening stock may create:

```text
OPENING_BALANCE
```

Example:

```text
Before = 0
In = 500
After = 500
```

Opening balance should be distinguishable from normal purchase receiving.

---

# 26. RESERVATION

Important:

Reservation is not necessarily physical stock movement.

If Phase 14 uses:

```text
onHandQuantity
reservedQuantity
availableQuantity
```

then:

```text
Reservation
```

should generally NOT create a physical stock IN/OUT ledger movement.

Instead, support a separate reservation history if required.

Do not incorrectly show:

```text
Reserved 20
```

as:

```text
Stock Out 20
```

until actual stock issue occurs.

---

# 27. RESERVATION RELEASE

Likewise:

```text
Reservation Release
```

normally does not mean:

```text
Stock In
```

because the physical stock never left the warehouse.

Keep:

```text
physical movement
```

and:

```text
reservation state
```

separate.

---

# 28. COST INFORMATION

Ledger should be designed to support inventory valuation.

Potential fields:

```text
unitCost
totalCost
currency
costMethod
```

Do not implement a full valuation engine unless required.

Phase 17 Accounting owns accounting integration.

Potential future cost methods:

```text
FIFO
WEIGHTED_AVERAGE
SPECIFIC_IDENTIFICATION
```

Do not hard-code an accounting method without inspecting the existing architecture.

---

# 29. COST RULE

For a movement:

```text
totalCost =
quantity × unitCost
```

Use precise decimal arithmetic.

Never use JavaScript floating-point arithmetic for financial calculations.

Reuse existing Money/Decimal utilities if the project already has them.

---

# 30. CURRENCY

If costs are stored:

Use the existing project currency architecture.

Do not create a second currency model.

If multi-currency is supported:

```text
currencyId
exchangeRate
baseUnitCost
baseTotalCost
```

may be required.

Only implement what the existing architecture supports.

---

# 31. LOT / BATCH

Inspect Phase 10 and Phase 14.

If batch/lot tracking exists, ledger should support:

```text
batchId
batchNumber
```

where appropriate.

Example:

```text
Batch A
    IN 100

Batch B
    IN 50
```

Do not combine them if the business requires lot-level traceability.

---

# 32. SERIAL NUMBER

If serial tracking exists:

```text
serialNumberId
```

or equivalent reference should be supported.

Each serial movement must remain traceable.

Do not create serial-number architecture if it does not exist yet.

---

# 33. UNIT OF MEASURE

If Phase 09/10 supports units:

```text
piece
box
carton
kg
liter
```

the ledger must respect the existing unit model.

Do not silently convert units.

If conversion exists:

```text
Purchase Unit
    ↓
Base Inventory Unit
```

the ledger should use the correct base quantity.

---

# 34. DATA VISIBILITY

Every ledger API MUST use Phase 06 Data Visibility.

Visibility dimensions:

```text
Company
Branch
Warehouse
User
Account
```

Example:

```text
Warehouse Staff
    ↓
Own Warehouse Ledger

Branch Manager
    ↓
Branch Ledger

Super Admin
    ↓
Authorized Global Scope
```

Do NOT hard-code role names.

Use:

```text
Permission
+
Data Scope
+
Company Scope
+
Branch Scope
+
Warehouse Scope
```

---

# 35. LEDGER DATA SECURITY

A user must NOT be able to infer unauthorized stock through:

```text
ledger list
ledger detail
running balance
aggregates
totals
reports
```

For example:

If User A cannot see Warehouse B:

```text
GET /inventory-ledger
```

must not expose:

```text
Warehouse B entries
```

and:

```text
GET /inventory-ledger/summary
```

must not include Warehouse B totals.

---

# 36. RBAC PERMISSIONS

Integrate with Dynamic RBAC.

Possible permissions:

```text
inventory_ledger.read
inventory_ledger.detail
inventory_ledger.export
inventory_ledger.summary
inventory_ledger.reverse
inventory_ledger.correct
```

Adapt to existing permission naming conventions.

Do NOT create fixed roles.

---

# 37. READ-ONLY DEFAULT

Normal ledger entries should be read-only.

Users should NOT have:

```text
ledger.update
ledger.delete
```

unless there is an extremely specific controlled workflow.

Prefer:

```text
reverse
correct
```

instead of:

```text
update
delete
```

---

# 38. REVERSAL

Implement reversal carefully.

Example:

Original:

```text
PURCHASE_RECEIPT

IN = 100
```

If the transaction must be reversed:

```text
REVERSAL

OUT = 100
```

with:

```text
reversalOfId = originalLedgerId
```

The original remains unchanged.

---

# 39. REVERSAL RULES

A finalized ledger entry:

```text
CAN be reversed
CANNOT be edited
CANNOT be deleted
```

A reversal must:

```text
reference original entry
have a reason
record user
record timestamp
create opposite movement
```

Do not allow multiple accidental reversals.

Example:

```text
Original
    ↓
Reversal
    ↓
Already reversed
```

Second reversal should be rejected unless explicitly supported.

---

# 40. CORRECTION

If a transaction has incorrect information:

Do not modify the old entry.

Use:

```text
Original Entry
      ↓
Correction / Reversal
      ↓
Correct Entry
```

The correction should preserve the full audit trail.

---

# 41. IMMUTABILITY

Enforce ledger immutability at multiple levels.

Application:

```text
No update
No delete
```

Database:

Use appropriate constraints / permissions / architecture where practical.

Tests:

```text
Update finalized ledger → rejected
Delete finalized ledger → rejected
```

Do not rely only on frontend restrictions.

---

# 42. PERIOD LOCKING

If accounting period locking exists or will be introduced:

Ledger should respect:

```text
Closed Period
```

A finalized movement in a closed period must not be modified.

Correction may require:

```text
new movement in current open period
```

Do not implement a separate accounting-period system if Phase 17 owns it.

Prepare the integration point.

---

# 43. STOCK CARD API

Provide a stock-card style API.

Potential:

```http
GET /inventory-ledger/stock-card
```

Filters:

```text
productId
variantId
warehouseId
fromDate
toDate
```

Response should support:

```text
date
reference
movementType
quantityIn
quantityOut
balance
unitCost
totalCost
```

Example:

```text
Date       Reference       In    Out   Balance
------------------------------------------------
Jan 01     OPENING         100     0      100
Jan 03     PUR-001           50     0      150
Jan 05     INV-001            0    20      130
Jan 07     TRF-001            0    10      120
```

---

# 44. LEDGER LIST API

Potential:

```http
GET /inventory-ledger
```

Filters:

```text
companyId
branchId
warehouseId
productId
variantId
movementType
referenceType
referenceId
fromDate
toDate
createdBy
```

Use:

```text
pagination
sorting
filtering
```

All filters must respect Data Visibility.

---

# 45. LEDGER DETAIL API

Potential:

```http
GET /inventory-ledger/:id
```

Return:

```text
movement information
product
variant
warehouse
company
branch
reference
quantity
balance
cost
user
timestamps
reversal information
```

Do not expose unauthorized records.

---

# 46. LEDGER SUMMARY

If frontend requires summary:

```http
GET /inventory-ledger/summary
```

Possible:

```text
totalIn
totalOut
netMovement
openingBalance
closingBalance
totalCostIn
totalCostOut
```

All summary results must use Data Visibility.

Do not leak unauthorized warehouse totals.

---

# 47. REPORTING

Phase 22 owns complete reporting.

Phase 15 should expose operational ledger data.

Do not create a duplicate reporting engine.

Prepare query/service methods that Phase 22 can reuse.

---

# 48. SEARCH

Search/reference filters may include:

```text
SKU
barcode
productName
variantName
referenceNumber
```

Use indexed queries where appropriate.

Avoid expensive wildcard searches over huge datasets.

---

# 49. DATE RANGE

Support:

```text
fromDate
toDate
```

Use timezone-safe date handling.

Do not mix:

```text
server timezone
user timezone
database timezone
```

without a defined project policy.

Reuse existing date/time conventions.

---

# 50. PAGINATION

Ledger can grow extremely large.

Pagination is mandatory.

Support:

```text
page
limit
```

or the existing cursor-based system.

For very large ledger datasets, prefer cursor/keyset pagination if the existing architecture supports it.

Do not load the entire ledger into memory.

---

# 51. INDEXES

Review indexes for:

```text
warehouseId
productId
variantId
movementDate
createdAt
movementType
referenceType
referenceId
companyId
branchId
```

Potential composite indexes:

```text
warehouseId + productId + variantId + movementDate

companyId + branchId + warehouseId + movementDate

productId + variantId + movementDate
```

Choose based on actual query patterns.

Do not blindly create every possible index.

---

# 52. LEDGER BALANCE CALCULATION

The preferred architecture is:

```text
Phase 14 Inventory
    ↓
Current authoritative balance

Phase 15 Ledger
    ↓
Historical balance verification
```

Do not repeatedly recalculate the entire stock history for every normal API request.

For stock-card queries:

Use appropriate:

```text
opening balance
ordered movements
running balance
```

strategies.

For large datasets, optimize carefully.

---

# 53. BALANCE RECONCILIATION

Implement an internal reconciliation capability.

Concept:

```text
Inventory Current Balance
          vs
Ledger Calculated Balance
```

Example:

```text
Inventory = 1,250

Ledger calculated = 1,250

Status = MATCH
```

If:

```text
Inventory = 1,250
Ledger = 1,240
```

then:

```text
Status = MISMATCH
```

Do NOT silently fix the difference.

Create a diagnostic result.

---

# 54. RECONCILIATION API

If required by administration:

```http
GET /inventory-ledger/reconciliation
```

or:

```http
POST /inventory-ledger/reconciliation/run
```

Potential output:

```text
warehouse
product
variant
inventoryBalance
ledgerBalance
difference
status
```

This endpoint must be strongly permission-protected.

Do not expose it to normal staff.

---

# 55. CONCURRENCY

Ledger creation must be part of the same database transaction as the stock change where possible.

Correct:

```text
BEGIN

Lock inventory row

Calculate balance

Update Inventory

Create Ledger Entry

Create Outbox Event

COMMIT
```

Incorrect:

```text
Update Inventory

COMMIT

Create Ledger later
```

because this can produce:

```text
Inventory changed
Ledger missing
```

---

# 56. ATOMICITY

For a stock-changing operation:

```text
Inventory Update
+
Ledger Entry
+
Outbox Event
+
Audit
```

should be transactionally consistent where the existing architecture supports it.

If one fails:

```text
ROLLBACK
```

Do not allow partial stock history.

---

# 57. IDEMPOTENCY

Ledger creation must protect against duplicate requests.

Example:

```text
Purchase Receive Request
Idempotency-Key: RECEIVE-123
```

Retrying the request must NOT create:

```text
Ledger +100
Ledger +100
```

Instead:

```text
Ledger +100
```

only once.

Use the existing idempotency infrastructure if available.

---

# 58. DUPLICATE REFERENCE PROTECTION

Where a business document should generate exactly one ledger movement:

enforce appropriate uniqueness.

For example:

```text
referenceType
referenceId
movementType
warehouseId
```

depending on the business model.

Do not apply overly broad uniqueness that prevents legitimate:

```text
partial receiving
multiple warehouse movements
multiple sales items
```

Design this carefully based on Phase 12/13/14 implementation.

---

# 59. OUTBOX INTEGRATION

If Phase 18 Outbox is already available, integrate.

Otherwise create the correct extension point.

Potential event:

```text
INVENTORY_LEDGER_ENTRY_CREATED
```

Payload should contain identifiers, not massive duplicated objects.

Example:

```text
{
  ledgerEntryId,
  warehouseId,
  productId,
  variantId,
  movementType,
  referenceType,
  referenceId
}
```

Do not put sensitive unnecessary data into events.

---

# 60. REDIS

Redis may support:

```text
ledger query cache
stock-card cache
summary cache
```

But:

```text
MySQL = source of truth
```

Never use Redis as the permanent ledger.

Do not cache mutable historical data without a clear invalidation strategy.

---

# 61. BULLMQ

Do NOT create ledger entries asynchronously after stock has already changed.

Bad:

```text
Inventory Update
    ↓
BullMQ
    ↓
Ledger
```

Correct:

```text
Transaction
    ↓
Inventory Update
    +
Ledger Entry
    +
Outbox
    ↓
COMMIT
    ↓
BullMQ
    ↓
Notifications / Reports / Analytics / Cache
```

BullMQ is for asynchronous secondary work.

It must not be responsible for preserving the fundamental stock ledger.

---

# 62. AUDIT LOG

Reuse existing Audit Log.

Ledger operations to audit:

```text
LEDGER_CREATED
LEDGER_REVERSED
LEDGER_CORRECTION_CREATED
RECONCILIATION_RUN
```

Capture where supported:

```text
user
account
company
branch
warehouse
entity
entityId
reason
timestamp
```

Do not create a duplicate audit system.

---

# 63. API SECURITY

Every endpoint must verify:

```text
Authentication
+
Permission
+
Data Visibility
```

Do not rely on:

```text
frontend route protection
```

alone.

---

# 64. SERVER-SIDE DATA SCOPE

Never trust:

```text
companyId
branchId
warehouseId
```

from the client.

The server must derive/validate accessible scope from:

```text
authenticated user
account
role permissions
data scope
```

according to Phase 06.

---

# 65. DTO VALIDATION

Create appropriate DTOs.

Potential:

```text
LedgerQueryDto
StockCardQueryDto
LedgerSummaryQueryDto
LedgerDetailQueryDto
LedgerReversalDto
ReconciliationQueryDto
```

Do not expose internal entity structure directly.

---

# 66. ERROR HANDLING

Use existing global exception architecture.

Expected errors:

```text
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Business Rule Violation
```

Examples:

```text
Ledger entry not found
Ledger entry already reversed
Ledger entry immutable
Invalid reference
Invalid movement
Invalid warehouse scope
Duplicate ledger movement
Period is closed
Reconciliation mismatch
```

---

# 67. TESTING — IMMUTABILITY

Test:

```text
Create ledger
Update ledger → rejected
Delete ledger → rejected
```

---

# 68. TESTING — MOVEMENTS

Test:

```text
Purchase receipt
Sales issue
Sales return
Purchase return
Transfer in
Transfer out
Adjustment in
Adjustment out
Opening balance
```

---

# 69. TESTING — BALANCE

Test:

```text
Opening 100
Purchase +50
Sale -20
Transfer -10
Adjustment +5
```

Expected:

```text
100
150
130
120
125
```

Verify:

```text
balanceBefore
balanceAfter
```

at every step.

---

# 70. TESTING — REVERSAL

Test:

```text
Original +100
Reversal -100
```

Final balance effect:

```text
0
```

Verify:

```text
original unchanged
reversal linked
second reversal rejected
audit exists
```

---

# 71. TESTING — PURCHASE

Test:

```text
Purchase Order created
→ no ledger entry

Purchase received
→ ledger entry

Partial receive
→ ledger entry for actual received quantity

Second receive
→ second ledger entry

Duplicate request
→ no duplicate ledger
```

---

# 72. TESTING — SALES

Test:

```text
Draft sale
→ no physical stock ledger

Confirmed/fulfilled sale
→ stock-out ledger

Sale cancellation
→ correct reversal/release behavior

Sales return
→ stock-in ledger
```

Follow actual Phase 12 rules.

---

# 73. TESTING — TRANSFER

Test:

```text
Warehouse A → Warehouse B

A OUT = 20
B IN = 20
```

Verify:

```text
same transfer reference
atomicity
visibility
authorization
```

---

# 74. TESTING — VISIBILITY

Test:

```text
Warehouse A user
→ sees Warehouse A ledger

Warehouse A user
→ cannot see Warehouse B ledger

Branch Manager
→ sees branch warehouses

Unauthorized branch
→ hidden

Super Admin
→ authorized global scope
```

Also test:

```text
ledger summary
stock card
reconciliation
```

for visibility leaks.

---

# 75. TESTING — CONCURRENCY

Simulate:

```text
User A creates stock-out
User B creates stock-out
```

at the same time.

Verify:

```text
No incorrect balance
No duplicate ledger
No lost update
No negative stock when disabled
```

---

# 76. TESTING — IDEMPOTENCY

Test:

```text
same request
same idempotency key
multiple retries
```

Expected:

```text
one stock movement
one ledger movement
```

---

# 77. TESTING — RECONCILIATION

Test:

```text
Inventory = 100
Ledger = 100
→ MATCH
```

and:

```text
Inventory = 100
Ledger = 95
→ MISMATCH
```

Never auto-correct.

---

# 78. BRUNO API TESTING

Create:

```text
bruno/
└── phase-15-inventory-ledger/
    ├── ledger/
    │   ├── list
    │   ├── detail
    │   ├── stock-card
    │   └── summary
    │
    ├── reversal/
    │   └── reverse
    │
    ├── reconciliation/
    │   ├── run
    │   └── result
    │
    └── visibility/
```

Test:

```text
authentication
permissions
data visibility
pagination
filters
sorting
date range
stock card
movement types
references
reversal
immutability
reconciliation
```

Follow existing Bruno environment/auth conventions.

---

# 79. SWAGGER

Update OpenAPI documentation.

Document:

```text
GET /inventory-ledger
GET /inventory-ledger/:id
GET /inventory-ledger/stock-card
GET /inventory-ledger/summary
POST /inventory-ledger/:id/reverse
GET /inventory-ledger/reconciliation
```

Only expose endpoints that are actually implemented.

Document:

```text
permissions
scope
request
response
errors
```

---

# 80. PERFORMANCE

Inventory Ledger can become one of the largest tables in the ERP.

Design for large datasets.

Use:

```text
pagination
indexes
date filtering
warehouse filtering
product filtering
projection
keyset pagination where appropriate
```

Avoid:

```text
SELECT *
```

for large lists.

Avoid N+1 relations.

Avoid recalculating entire history for every request.

---

# 81. PARTITIONING — FUTURE CONSIDERATION

Do not implement database partitioning unless required now.

But document that a very large ledger may eventually need:

```text
date partitioning
company partitioning
archive strategy
```

Do not prematurely complicate Phase 15.

---

# 82. ARCHIVE POLICY

Do not delete historical ledger entries to keep the table small.

If archival becomes necessary:

```text
active ledger
      ↓
archive strategy
```

must preserve:

```text
auditability
references
reconciliation
reporting
```

Document as future architecture unless currently required.

---

# 83. LEDGER REBUILD / REPLAY

Do not implement automatic destructive ledger rebuild.

If a repair/replay utility is needed:

make it:

```text
admin-only
explicit
dry-run capable
audited
non-destructive
```

It must never silently rewrite production history.

---

# 84. INVENTORY VS LEDGER RECONCILIATION

The architecture should support:

```text
Current Inventory
       │
       │ compare
       ▼
Historical Ledger
       │
       ▼
Reconciliation Result
```

Possible causes of mismatch:

```text
missing ledger
duplicate ledger
incorrect balance
manual database modification
failed transaction
legacy data
migration issue
```

The reconciliation system should diagnose, not silently hide.

---

# 85. ACCOUNTING INTEGRATION

Phase 17 will consume inventory information.

Potential mapping:

```text
Inventory Receipt
      ↓
Inventory Asset

Sales Issue
      ↓
COGS

Sales Return
      ↓
Inventory reversal

Purchase Return
      ↓
Inventory reduction
```

Do not create journal entries in Phase 15 unless Phase 17 architecture explicitly requires an integration service.

Prefer:

```text
Inventory Ledger Event
        ↓
Accounting Integration
```

---

# 86. OUTBOX + LEDGER

The ideal transaction boundary is:

```text
BEGIN TRANSACTION

Update Inventory
Create Ledger Entry
Create Audit Event
Create Outbox Event

COMMIT
```

Then:

```text
Outbox Worker
      ↓
BullMQ
      ↓
Accounting / Notification / Analytics
```

Do not reverse this dependency.

---

# 87. EVENT PAYLOAD

Potential:

```text
{
  "eventType": "INVENTORY_LEDGER_ENTRY_CREATED",
  "ledgerEntryId": "...",
  "companyId": "...",
  "branchId": "...",
  "warehouseId": "...",
  "productId": "...",
  "variantId": "...",
  "movementType": "SALES_ISSUE",
  "referenceType": "SALE",
  "referenceId": "..."
}
```

Do not send unnecessary full entities.

---

# 88. TRANSACTION FAILURE

Example:

```text
Inventory update succeeds
Ledger insert fails
```

This must result in:

```text
ROLLBACK INVENTORY
```

Similarly:

```text
Ledger insert succeeds
Outbox insert fails
```

if Outbox is part of the same transaction:

```text
ROLLBACK
```

No partial state.

---

# 89. SECURITY REVIEW

Before completion verify:

```text
[ ] Authentication required
[ ] Permission required
[ ] Data scope enforced
[ ] Warehouse scope enforced
[ ] Branch scope enforced
[ ] Company scope enforced
[ ] No unauthorized aggregate leakage
[ ] Ledger immutable
[ ] Reversal protected
[ ] Reconciliation protected
[ ] No client-controlled balance
[ ] No client-controlled company scope
[ ] No client-controlled warehouse scope
```

---

# 90. DATABASE DESIGN REVIEW

Before migration verify:

```text
[ ] Foreign keys
[ ] Unique constraints
[ ] Indexes
[ ] Decimal precision
[ ] Timestamp strategy
[ ] Soft delete policy
[ ] Immutable ledger policy
[ ] Reference strategy
[ ] Reversal relationship
```

Do not create unnecessary nullable columns.

---

# 91. IMPLEMENTATION ORDER

Implement in this exact order:

```text
Step 1
Inspect frontend ledger requirements

Step 2
Inspect Phase 14 Inventory implementation

Step 3
Inspect existing transaction infrastructure

Step 4
Inspect existing Outbox if available

Step 5
Inspect existing Audit Log

Step 6
Inspect Product / Variant / Warehouse relationships

Step 7
Design Ledger entity

Step 8
Design movement types

Step 9
Design reference model

Step 10
Design reversal model

Step 11
Create migration

Step 12
Implement immutable ledger repository

Step 13
Implement ledger service

Step 14
Integrate Purchase Receiving

Step 15
Integrate Sales Stock Issue

Step 16
Integrate Sales Return

Step 17
Integrate Purchase Return

Step 18
Integrate Warehouse Transfer

Step 19
Integrate Stock Adjustment

Step 20
Integrate Opening Balance

Step 21
Separate reservation history from physical stock movement

Step 22
Implement stock-card query

Step 23
Implement ledger list

Step 24
Implement ledger detail

Step 25
Implement summary

Step 26
Implement reversal

Step 27
Implement reconciliation

Step 28
Integrate Dynamic RBAC

Step 29
Integrate Data Visibility

Step 30
Integrate Audit Log

Step 31
Integrate Outbox

Step 32
Integrate Redis where appropriate

Step 33
Prepare BullMQ integration

Step 34
Implement indexes

Step 35
Implement DTO validation

Step 36
Implement Swagger

Step 37
Implement automated tests

Step 38
Implement Bruno tests

Step 39
Run migrations

Step 40
Run tests

Step 41
Run typecheck

Step 42
Run lint

Step 43
Run build

Step 44
Run concurrency tests

Step 45
Run immutability tests

Step 46
Run reconciliation tests

Step 47
Perform security review

Step 48
Perform Data Visibility review

Step 49
Perform historical integrity review

Step 50
Generate Phase 15 implementation report
```

---

# 92. CRITICAL AI RULES

You MUST follow all rules below.

1. Inspect existing code before implementation.
2. Inspect frontend ledger requirements.
3. Reuse Phase 14 Inventory.
4. Reuse Phase 10 Product/Variant.
5. Reuse Phase 07 Warehouse.
6. Reuse Phase 12 Sales.
7. Reuse Phase 13 Purchase.
8. Reuse Phase 06 Dynamic RBAC.
9. Reuse Phase 06 Data Visibility.
10. Reuse existing Audit Log.
11. Reuse existing transaction infrastructure.
12. Reuse existing Outbox infrastructure if available.
13. Do not create duplicate Product entities.
14. Do not create duplicate Variant entities.
15. Do not create duplicate Warehouse entities.
16. Do not create duplicate User/Account entities.
17. Do not create duplicate Audit Log.
18. Do not create duplicate Event Bus.
19. Do not create duplicate Outbox.
20. Do not use Redis as ledger source of truth.
21. Do not use BullMQ to create the fundamental ledger asynchronously.
22. Do not modify finalized ledger entries.
23. Do not delete finalized ledger entries.
24. Use reversal/correction instead.
25. Do not trust client-provided balances.
26. Do not trust client-provided company scope.
27. Do not trust client-provided warehouse scope.
28. Apply Data Visibility everywhere.
29. Protect aggregates from visibility leaks.
30. Use database transactions.
31. Protect against concurrent updates.
32. Protect against duplicate operations.
33. Support idempotency where appropriate.
34. Preserve historical integrity.
35. Do not implement full Accounting in Phase 15.
36. Do not implement complete Reporting in Phase 15.
37. Do not implement a second stock balance system.
38. Phase 14 remains current stock source.
39. Phase 15 remains historical movement source.
40. Never claim completion without verification.

---

# 93. DEFINITION OF DONE

Phase 15 is complete only when:

```text
[ ] Frontend Ledger requirements inspected
[ ] Phase 14 Inventory inspected

[ ] Ledger entity implemented
[ ] Movement types implemented
[ ] Reference tracking implemented
[ ] Balance before implemented
[ ] Balance after implemented

[ ] Purchase Receipt ledger integration
[ ] Sales Issue ledger integration
[ ] Sales Return ledger integration
[ ] Purchase Return ledger integration
[ ] Transfer In ledger integration
[ ] Transfer Out ledger integration
[ ] Adjustment In ledger integration
[ ] Adjustment Out ledger integration
[ ] Opening Balance integration

[ ] Reservation separated from physical movement

[ ] Ledger immutable
[ ] Reversal implemented
[ ] Correction strategy implemented
[ ] Duplicate reversal protected

[ ] Stock Card implemented
[ ] Ledger List implemented
[ ] Ledger Detail implemented
[ ] Summary implemented

[ ] Data Visibility implemented
[ ] Company scope implemented
[ ] Branch scope implemented
[ ] Warehouse scope implemented

[ ] Dynamic RBAC implemented
[ ] Audit Log integrated
[ ] Outbox integration implemented/prepared

[ ] Reconciliation implemented
[ ] Reconciliation mismatch detected
[ ] No automatic silent correction

[ ] Database constraints implemented
[ ] Indexes reviewed
[ ] DTO validation implemented

[ ] Concurrency tests
[ ] Idempotency tests
[ ] Immutability tests
[ ] Visibility tests
[ ] Movement tests
[ ] Reversal tests
[ ] Reconciliation tests

[ ] Bruno tests implemented
[ ] Swagger updated

[ ] Existing tests pass
[ ] Typecheck passes
[ ] ESLint passes
[ ] Build passes

[ ] Security review completed
[ ] Data Visibility review completed
[ ] Historical integrity review completed
[ ] Performance review completed
```

---

# 94. FINAL ARCHITECTURE

The final inventory architecture should conceptually be:

```text
                    ┌──────────────────┐
                    │     PURCHASE     │
                    │    Phase 13      │
                    └────────┬─────────┘
                             │
                          RECEIVE
                             │
                             ▼
                    ┌──────────────────┐
                    │    INVENTORY     │
                    │    Phase 14      │
                    │                  │
                    │ Current Balance  │
                    │                  │
                    │ On Hand          │
                    │ Reserved         │
                    │ Available        │
                    └────────┬─────────┘
                             │
                    SAME DB TRANSACTION
                             │
                             ▼
                    ┌──────────────────┐
                    │ INVENTORY LEDGER │
                    │    Phase 15      │
                    │                  │
                    │ Historical       │
                    │ Movement         │
                    │                  │
                    │ IN / OUT         │
                    │ Before / After   │
                    │ Cost             │
                    │ Reference        │
                    └────────┬─────────┘
                             │
                             ▼
                       ┌─────────────┐
                       │   OUTBOX    │
                       │  Phase 18   │
                       └──────┬──────┘
                              │
                              ▼
                         ┌─────────┐
                         │ BullMQ  │
                         │ Phase20 │
                         └────┬────┘
                              │
                 ┌────────────┼────────────┐
                 ▼            ▼            ▼
            Accounting    Notification   Reports
              Phase 17      Phase 21      Phase 22
```

---

# 95. MOST IMPORTANT DESIGN RULE

Always preserve this separation:

```text
┌────────────────────────────────────────────┐
│ Phase 14 — Inventory                       │
│                                            │
│ "How much stock do we have RIGHT NOW?"    │
└────────────────────────────────────────────┘

                    VS

┌────────────────────────────────────────────┐
│ Phase 15 — Inventory Ledger                │
│                                            │
│ "HOW did that stock quantity change?"     │
└────────────────────────────────────────────┘
```

Example:

```text
Current Inventory:

Warehouse A
Product X
On Hand = 125
Reserved = 20
Available = 105
```

Ledger:

```text
Jan 01   Opening Balance   +100   Balance 100
Jan 03   Purchase          +50    Balance 150
Jan 05   Sale               -20   Balance 130
Jan 07   Adjustment          -5   Balance 125
```

The two systems complement each other.

They must NOT compete with each other.

---

# 96. FINAL IMPLEMENTATION REPORT

After implementation provide:

```text
Phase 15 — Inventory Ledger Implementation Report

1. Frontend Ledger requirements discovered
2. Existing Phase 14 architecture reused
3. Files created
4. Files modified
5. Entities created/modified
6. Migration
7. Movement types
8. Reference model
9. Balance model
10. Cost model
11. Purchase integration
12. Sales integration
13. Return integration
14. Transfer integration
15. Adjustment integration
16. Opening balance integration
17. Reservation separation
18. Immutability strategy
19. Reversal strategy
20. Correction strategy
21. Data Visibility
22. Dynamic RBAC
23. Audit Log
24. Outbox integration
25. Redis usage
26. BullMQ integration point
27. Reconciliation
28. APIs
29. Swagger
30. Automated tests
31. Bruno tests
32. Commands executed
33. Test results
34. Typecheck result
35. Lint result
36. Build result
37. Concurrency review
38. Security review
39. Historical integrity review
40. Performance review
41. Known limitations
42. Recommended Phase 16 integration
```

---

# FINAL RULE

Before saying:

```text
Phase 15 completed
```

verify the actual repository.

Run:

```text
tests
typecheck
lint
build
migration validation
Bruno API tests
```

and report the actual results.

Never claim that something is implemented merely because the code was generated.

The implementation must be verified against the real repository.
