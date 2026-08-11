# Phase 14 — Inventory

## NestJS + TypeScript + MySQL + TypeORM + Redis + BullMQ + Docker

## Production-Ready Implementation Prompt

You are implementing **Phase 14 — Inventory** of the Fashion ERP Backend.

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

# 1. Completed Phases

The following phases have already been implemented:

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
```

Do NOT rewrite completed phases unnecessarily.

Reuse existing architecture.

The existing codebase is the source of truth.

---

# 2. Phase 14 Objective

Implement a production-ready Inventory Management domain supporting:

```text
Inventory
│
├── Stock
├── Warehouse Stock
├── Stock Balance
├── Stock In
├── Stock Out
├── Stock Transfer
├── Stock Adjustment
├── Stock Reservation
├── Stock Release
├── Purchase Receiving Integration
├── Sales Deduction Integration
├── Warehouse Integration
├── Product / Variant Integration
├── Batch / Lot integration point
├── Serial Number integration point
├── Inventory Status
├── Stock Availability
├── Reorder Information
├── Data Visibility
├── Dynamic RBAC
├── Audit Log
├── Inventory Dashboard
└── API + Validation + Tests
```

Do not implement the complete Inventory Ledger in this phase.

Phase 15 owns the detailed inventory movement ledger.

Do not implement complete Accounting in this phase.

Phase 17 owns accounting.

Do not implement complete Payment in this phase.

Phase 16 owns payment.

---

# 3. CRITICAL ARCHITECTURE RULE

Inventory is responsible for the **current operational stock state**.

Inventory Ledger is responsible for the **historical stock movement record**.

Keep the responsibilities separated:

```text
Phase 14 — Inventory
        ↓
Current Stock State
        ↓
Available / Reserved / On Hand

Phase 15 — Inventory Ledger
        ↓
Historical Movements
        ↓
Stock In / Stock Out / Transfer / Adjustment
```

Do NOT create two competing stock-balance systems.

There must be one authoritative current stock state.

There must be one authoritative historical inventory movement system.

---

# 4. FIRST STEP — Inspect Before Coding

Before implementation, inspect the existing backend.

Inspect:

```text
Phase 03 — Database Architecture
Phase 06 — Dynamic RBAC + Data Visibility
Phase 07 — Company / Branch / Warehouse
Phase 08 — User / Employee / Account
Phase 09 — Master Data
Phase 10 — Product / Variant / Pricing
Phase 12 — Sales
Phase 13 — Purchase
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
audit logs
error handling
pagination
response format
tests
```

Do not invent architecture that already exists.

---

# 5. FRONTEND INSPECTION

Inspect the actual frontend repository.

Search for:

```text
Inventory
Stock
Stock Balance
Stock In
Stock Out
Stock Transfer
Warehouse
Adjustment
Reservation
Available Stock
On Hand
Low Stock
Out of Stock
Product Stock
Variant Stock
```

Inspect:

```text
routes
pages
components
forms
tables
filters
state management
API clients
types
mock data
validation
status handling
warehouse selectors
product selectors
quantity inputs
transfer forms
adjustment forms
dashboard
reports
```

Before implementation create an internal mapping:

```text
Frontend Inventory Feature
        ↓
Backend API
        ↓
Backend Service
        ↓
Entity
        ↓
Permission
        ↓
Data Visibility
```

Do not implement frontend features that do not actually exist unless required for backend integrity.

---

# 6. INVENTORY DOMAIN

Conceptually:

```text
Company
   ↓
Branch
   ↓
Warehouse
   ↓
Inventory
   ↓
Product / Variant
```

Inventory should identify stock at minimum by:

```text
company
branch
warehouse
product
variant
```

If the existing product model does not require variant-level stock for all products, respect the existing Product/Variant architecture.

Do not duplicate Product or Variant entities.

---

# 7. INVENTORY BALANCE

The current stock balance should support concepts such as:

```text
onHandQuantity
reservedQuantity
availableQuantity
```

Conceptually:

```text
availableQuantity =
    onHandQuantity
    - reservedQuantity
```

If additional stock states exist in the frontend, inspect and implement them consistently.

Never allow:

```text
availableQuantity > onHandQuantity
```

unless the business rules explicitly support another state.

---

# 8. STOCK STATUS

Possible status:

```text
IN_STOCK
LOW_STOCK
OUT_OF_STOCK
```

Do not necessarily persist these as independent fields if they can be safely derived.

Prefer deriving status from:

```text
onHandQuantity
reorderLevel
```

when appropriate.

Avoid duplicated state that can become inconsistent.

---

# 9. INVENTORY ENTITY

Use the existing database conventions.

Conceptual structure:

```text
Inventory
├── id
├── companyId
├── branchId
├── warehouseId
├── productId
├── variantId
├── onHandQuantity
├── reservedQuantity
├── availableQuantity
├── reorderLevel
├── reorderQuantity
├── lastStockMovementAt
├── createdAt
├── updatedAt
└── deletedAt
```

Do not blindly use every field.

Adapt to the actual frontend and existing architecture.

---

# 10. UNIQUE STOCK BALANCE

For a normal warehouse stock model, enforce uniqueness around:

```text
company
branch
warehouse
product
variant
```

Example conceptual constraint:

```text
UNIQUE(
    warehouseId,
    productId,
    variantId
)
```

If company/branch are necessary to guarantee tenant isolation, include them according to the existing architecture.

The database must prevent duplicate stock-balance rows.

Do not rely only on application checks.

---

# 11. PRODUCT / VARIANT

Inventory must reuse Phase 10.

Do not create:

```text
InventoryProduct
InventoryVariant
```

if Product/Variant already exists.

Validate:

```text
product exists
variant exists when required
variant belongs to product
product is active
variant is active
```

Do not trust frontend IDs.

---

# 12. WAREHOUSE

Reuse Phase 07.

Inventory must validate:

```text
warehouse exists
warehouse is active
warehouse belongs to branch
branch belongs to company
current user can access warehouse
```

Never allow:

```text
Warehouse A
    ↓
Inventory
    ↓
Company B
```

through a forged frontend request.

---

# 13. STOCK IN

Inventory must support stock-in operations.

Sources may include:

```text
Purchase Receiving
Opening Stock
Stock Adjustment
Transfer In
Return In
```

Do not hard-code all sources unless required.

Conceptual flow:

```text
Purchase
   ↓
Approved / Received
   ↓
Stock In
   ↓
Inventory Balance + Quantity
```

---

# 14. PURCHASE RECEIVING

Phase 13 owns Purchase.

Phase 14 owns the resulting stock state.

Conceptually:

```text
Purchase
    ↓
RECEIVE
    ↓
Inventory
    ↓
onHandQuantity += receivedQuantity
```

Important:

Do not automatically increase stock when a Purchase is merely created.

Stock should change only at the appropriate receiving/confirmation point.

Inspect Phase 13 state machine before implementing.

---

# 15. PARTIAL RECEIVING

Support partial receiving where the business flow requires it.

Example:

```text
Purchase Order
Quantity = 100

First receiving
= 40

Remaining
= 60

Second receiving
= 60
```

Do NOT increase stock by 100 during the first receiving.

Track received quantity separately.

The system must prevent:

```text
receivedQuantity > orderedQuantity
```

unless over-receiving is explicitly supported.

---

# 16. STOCK OUT

Inventory must support stock-out operations.

Sources may include:

```text
Sales
Stock Adjustment
Transfer Out
Return Out
```

For Sales:

```text
Confirmed / Completed Sale
        ↓
Inventory Stock Out
        ↓
onHandQuantity -= quantity
```

Do not deduct stock merely because a draft Sales transaction exists.

Follow the actual Phase 12 sales status flow.

---

# 17. NEGATIVE STOCK

Implement an explicit policy.

Possible:

```text
NEGATIVE_STOCK_ALLOWED = false
```

or configurable by:

```text
company
branch
warehouse
product
```

If negative stock is not allowed:

```text
requestedQuantity <= availableQuantity
```

must be enforced inside the database transaction.

Never rely on frontend validation.

If negative stock is allowed, it must be an explicit business configuration.

Do not silently permit negative stock.

---

# 18. STOCK RESERVATION

Support reservation where the frontend/business flow requires it.

Concept:

```text
On Hand = 100
Reserved = 30

Available = 70
```

Reservation should NOT immediately reduce:

```text
onHandQuantity
```

Instead:

```text
reservedQuantity += quantity
```

and:

```text
availableQuantity =
    onHandQuantity - reservedQuantity
```

---

# 19. RESERVE STOCK

Potential operation:

```http
POST /inventory/reservations
```

Conceptual flow:

```text
Check Available Stock
        ↓
Reserve
        ↓
reservedQuantity += quantity
```

Must validate:

```text
quantity > 0
availableQuantity >= requestedQuantity
```

unless backorder/negative reservation is explicitly supported.

---

# 20. RELEASE RESERVATION

When an order is cancelled or reservation expires:

```text
reservedQuantity -= quantity
```

Never allow:

```text
reservedQuantity < 0
```

Use transaction-safe updates.

---

# 21. SALES INTEGRATION

Reuse Phase 12.

Inventory must integrate with Sales.

Conceptually:

```text
Sales Order
    ↓
Reservation
    ↓
Confirmation / Fulfillment
    ↓
Stock Out
```

The exact flow must follow the actual Phase 12 implementation.

Do not duplicate Sales logic.

---

# 22. SALES CANCELLATION

If stock was reserved:

```text
Sales Cancel
    ↓
Release Reservation
```

If stock was already deducted:

```text
Sales Cancel
    ↓
Stock Reversal
```

Do not simply modify the current stock number without creating the appropriate historical movement integration.

Phase 15 will own the historical ledger entry.

---

# 23. WAREHOUSE TRANSFER

Inventory must support transfers between warehouses.

Concept:

```text
Warehouse A
    ↓
Transfer Out
    ↓
Transfer
    ↓
Transfer In
    ↓
Warehouse B
```

Example:

```text
Warehouse A
Product X = 100

Transfer 20

Warehouse A = 80
Warehouse B = +20
```

The operation must be atomic where appropriate.

---

# 24. TRANSFER ENTITY

Conceptually:

```text
StockTransfer
├── id
├── transferNumber
├── companyId
├── branchId
├── sourceWarehouseId
├── destinationWarehouseId
├── status
├── transactionDate
├── notes
├── createdBy
├── approvedBy
├── createdAt
└── updatedAt
```

Items:

```text
StockTransferItem
├── transferId
├── productId
├── variantId
├── quantity
└── receivedQuantity
```

Do not create this entity if an equivalent transfer model already exists.

---

# 25. TRANSFER STATUS

Possible:

```text
DRAFT
PENDING
APPROVED
IN_TRANSIT
RECEIVED
CANCELLED
```

Use only required states.

Implement a controlled state machine.

Do not allow arbitrary status updates.

---

# 26. TRANSFER VALIDATION

Before transfer:

```text
sourceWarehouse != destinationWarehouse
quantity > 0
product exists
variant valid
source warehouse accessible
destination warehouse accessible
sufficient available stock
```

If branch-to-branch transfer is allowed:

```text
validate company/branch scope
```

Do not assume source and destination are always in the same branch.

---

# 27. STOCK ADJUSTMENT

Support controlled inventory adjustments.

Examples:

```text
DAMAGE
LOSS
FOUND
COUNT_CORRECTION
OPENING_BALANCE
OTHER
```

Do not let users arbitrarily change stock.

Adjustment must create a business transaction.

Example:

```text
Current = 100

Adjustment +5

New = 105
```

or:

```text
Current = 100

Adjustment -3

New = 97
```

---

# 28. ADJUSTMENT APPROVAL

Where required:

```text
Inventory Staff
    ↓
Create Adjustment
    ↓
Pending Approval
    ↓
Inventory Manager
    ↓
Approve
    ↓
Stock Updated
```

The exact workflow should follow Dynamic RBAC.

Do not hard-code role names.

---

# 29. COUNT / STOCKTAKE

If frontend contains stock counting:

support:

```text
Expected Quantity
Actual Quantity
Difference
```

Example:

```text
Expected = 100
Actual = 97
Difference = -3
```

The difference can generate an adjustment.

Do not directly overwrite:

```text
onHandQuantity
```

without an auditable business operation.

---

# 30. BATCH / LOT

Inspect frontend.

If batch/lot management exists, create an integration point.

Potential:

```text
Batch
├── productId
├── variantId
├── warehouseId
├── batchNumber
├── manufactureDate
├── expiryDate
└── quantity
```

If not required yet:

Do NOT build a large batch system.

Prepare architecture so Phase 14/15 can support it later.

---

# 31. SERIAL NUMBER

Inspect frontend.

If serial tracking is required:

```text
SerialNumber
├── productId
├── variantId
├── warehouseId
├── serialNumber
└── status
```

Potential states:

```text
IN_STOCK
RESERVED
SOLD
TRANSFERRED
DAMAGED
```

If serial tracking is not required by the frontend, do not unnecessarily implement it.

---

# 32. INVENTORY ACCOUNTING INTEGRATION

Do not implement full accounting.

Phase 17 owns:

```text
Inventory Asset
Cost of Goods Sold
Purchase Accounting
Sales Accounting
Stock Adjustment Accounting
```

Inventory only provides the necessary operational information.

Prepare clean integration points.

---

# 33. INVENTORY COST

Inventory quantity management and accounting valuation are separate concerns.

Do not implement a complicated valuation engine unless required by the frontend/current architecture.

Potential future valuation:

```text
FIFO
Weighted Average
Specific Identification
```

If valuation is not yet specified:

Do not arbitrarily choose one and hard-code the architecture.

Document the decision required before Phase 17.

---

# 34. DATA VISIBILITY

Every Inventory API must use Phase 06.

Visibility must support:

```text
Company
Branch
Warehouse
User
Account
```

Examples:

```text
Warehouse Staff
    ↓
Own warehouse stock

Branch Manager
    ↓
Branch warehouses

Super Admin
    ↓
All authorized warehouses
```

These are examples.

Do NOT hard-code roles.

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

# 35. INVENTORY PERMISSIONS

Integrate with Dynamic RBAC.

Possible permissions:

```text
inventory.read
inventory.create
inventory.update
inventory.delete

inventory.receive
inventory.issue

inventory.transfer.create
inventory.transfer.read
inventory.transfer.approve
inventory.transfer.receive
inventory.transfer.cancel

inventory.adjustment.create
inventory.adjustment.read
inventory.adjustment.approve
inventory.adjustment.cancel

inventory.reservation.create
inventory.reservation.read
inventory.reservation.release

inventory.dashboard.read
inventory.report.read
```

Adapt to existing Phase 06 naming conventions.

Do NOT create fixed roles.

---

# 36. EXAMPLE ROLE BEHAVIOR

Example only.

Warehouse Staff:

```text
inventory.read
inventory.receive
inventory.issue
inventory.transfer.read
inventory.reservation.read

Scope:
OWN_WAREHOUSE
```

Warehouse Manager:

```text
inventory.read
inventory.receive
inventory.issue
inventory.transfer.create
inventory.transfer.approve
inventory.adjustment.create
inventory.adjustment.approve
inventory.dashboard.read

Scope:
BRANCH
```

Super Admin:

```text
inventory.*
```

with authorized global scope.

Again:

Do NOT hard-code these roles.

---

# 37. DATA VISIBILITY ON AGGREGATES

This is critical.

If:

```http
GET /inventory/dashboard
```

returns:

```text
Total Stock
Total Warehouses
Low Stock
Out of Stock
Reserved Stock
```

the aggregation must use the exact same visibility filter as:

```http
GET /inventory
```

A user must never be able to infer unauthorized stock from aggregate data.

---

# 38. INVENTORY SEARCH

Support appropriate filters:

```text
productId
variantId
warehouseId
branchId
companyId
stockStatus
lowStock
outOfStock
```

Search:

```text
SKU
product name
variant name
barcode
```

Use pagination.

Every query must apply Data Visibility.

---

# 39. LOW STOCK

If product/variant has:

```text
reorderLevel
```

then:

```text
onHandQuantity <= reorderLevel
```

can identify low stock.

Do not duplicate reorder configuration in Inventory if it already exists in Product/Master Data.

Reuse existing configuration.

---

# 40. INVENTORY DASHBOARD

If frontend requires Inventory dashboard, support:

```text
Total Stock Items
Total On Hand
Total Reserved
Total Available
Low Stock Count
Out of Stock Count
Stock by Warehouse
Stock by Branch
Top Stocked Products
Low Stock Products
```

All results must be visibility scoped.

---

# 41. INVENTORY TRANSACTION SAFETY

Stock-changing operations MUST use database transactions.

Examples:

```text
Receive
Issue
Transfer
Adjustment
Reserve
Release
```

Never do:

```text
SELECT quantity

// application calculation

UPDATE quantity
```

without concurrency protection.

Use appropriate:

```text
transaction
row locking
atomic update
constraints
```

depending on the operation.

---

# 42. CONCURRENCY

Example:

```text
Stock = 10

User A sells 7
User B sells 6
```

The system must not incorrectly allow:

```text
Stock = -3
```

when negative stock is disabled.

Use database transaction + locking/atomic update.

Test concurrent stock changes.

---

# 43. IDEMPOTENCY

Stock-changing operations are highly sensitive to duplicate requests.

Support idempotency where appropriate.

Example:

```text
POST /inventory/receive
Idempotency-Key: abc-123
```

If the same request is retried:

```text
Do not apply stock twice.
```

Do not blindly duplicate stock movements.

---

# 44. STOCK REVERSAL

Never manually edit stock to undo a previous transaction.

Bad:

```text
onHand = 100
```

changing it directly to:

```text
onHand = 90
```

to compensate for an error.

Instead:

```text
Original movement
       ↓
Reversal movement
       ↓
Corrected stock
```

Phase 15 will preserve the movement history.

---

# 45. AUDIT LOG

Reuse existing Audit Log.

Record important operations:

```text
INVENTORY_RECEIVED
INVENTORY_ISSUED

STOCK_TRANSFER_CREATED
STOCK_TRANSFER_APPROVED
STOCK_TRANSFER_RECEIVED
STOCK_TRANSFER_CANCELLED

STOCK_ADJUSTMENT_CREATED
STOCK_ADJUSTMENT_APPROVED
STOCK_ADJUSTMENT_CANCELLED

STOCK_RESERVED
STOCK_RESERVATION_RELEASED

INVENTORY_UPDATED
```

Capture:

```text
user
account
company
branch
warehouse
entity
entityId
oldValue
newValue
reason
timestamp
```

where supported by the existing Audit architecture.

Do not create another Audit system.

---

# 46. INVENTORY LEDGER INTEGRATION

Phase 15 owns the full ledger.

Phase 14 must expose integration events such as:

```text
STOCK_RECEIVED
STOCK_ISSUED
STOCK_TRANSFERRED_OUT
STOCK_TRANSFERRED_IN
STOCK_ADJUSTED
STOCK_RESERVED
STOCK_RELEASED
STOCK_REVERSED
```

The exact event architecture must follow the existing Outbox architecture when available.

Do not create a duplicate event bus.

---

# 47. OUTBOX INTEGRATION

Phase 18 owns Outbox Pattern.

Inventory is highly suitable for transactional events.

Example:

```text
Database Transaction
        ↓
Update Inventory
        ↓
Create Outbox Event
        ↓
Commit
        ↓
Future Worker
        ↓
Inventory Ledger / Notification / Analytics
```

If Outbox is not yet implemented, prepare the integration point.

Do not publish unreliable events directly after a database update.

---

# 48. REDIS

Redis may be used for:

```text
inventory cache
availability cache
dashboard cache
```

But:

CRITICAL stock quantity must not depend solely on Redis.

Database remains authoritative.

Do not:

```text
Redis stock = source of truth
```

Use:

```text
MySQL = source of truth
Redis = cache
```

---

# 49. BULLMQ

Do not put critical stock updates into asynchronous jobs unless the architecture explicitly requires it.

Bad:

```text
Sale confirmed
    ↓
BullMQ
    ↓
Stock deduction
```

This can create temporary stock inconsistency.

Prefer:

```text
Sale transaction
    ↓
Database transaction
    ↓
Stock update
    ↓
Outbox
    ↓
BullMQ
```

Use workers for non-critical tasks such as:

```text
reports
notifications
exports
analytics
cache warming
```

where appropriate.

---

# 50. API DESIGN

Follow existing API conventions.

Potential:

```http
GET    /inventory
GET    /inventory/:id
GET    /inventory/availability
GET    /inventory/dashboard
```

Stock operations:

```http
POST   /inventory/receive
POST   /inventory/issue
```

Transfers:

```http
POST   /inventory/transfers
GET    /inventory/transfers
GET    /inventory/transfers/:id
POST   /inventory/transfers/:id/approve
POST   /inventory/transfers/:id/receive
POST   /inventory/transfers/:id/cancel
```

Adjustments:

```http
POST   /inventory/adjustments
GET    /inventory/adjustments
GET    /inventory/adjustments/:id
POST   /inventory/adjustments/:id/approve
POST   /inventory/adjustments/:id/cancel
```

Reservations:

```http
POST   /inventory/reservations
GET    /inventory/reservations
POST   /inventory/reservations/:id/release
```

Do NOT use these exact routes if existing project conventions differ.

---

# 51. DTOs

Create appropriate DTOs.

Potential:

```text
InventoryQueryDto
InventoryAvailabilityQueryDto

ReceiveStockDto
ReceiveStockItemDto

IssueStockDto
IssueStockItemDto

CreateStockTransferDto
StockTransferItemDto
TransferQueryDto

CreateStockAdjustmentDto
AdjustmentItemDto
AdjustmentQueryDto

CreateStockReservationDto
ReleaseStockReservationDto
```

Use existing validation conventions.

Never expose TypeORM entities directly as request contracts.

---

# 52. SERVER-SIDE VALIDATION

Validate:

```text
product
variant
warehouse
company
branch
quantity
stock availability
reservation availability
transfer destination
adjustment reason
permissions
data visibility
```

Never trust frontend:

```text
availableQuantity
onHandQuantity
newStockQuantity
```

These must be calculated server-side.

---

# 53. DATABASE CONSTRAINTS

Use:

```text
foreign keys
unique constraints
indexes
decimal precision
timestamps
soft delete
```

Review indexes for:

```text
warehouseId
productId
variantId
companyId
branchId
stock status
createdAt
updatedAt
```

Use composite indexes according to actual query patterns.

Do not over-index.

---

# 54. HISTORICAL INTEGRITY

Do not allow users to arbitrarily modify finalized stock transactions.

For example:

```text
Receive 100
```

must not later become:

```text
Receive 50
```

through generic PATCH without reversal/audit semantics.

Use:

```text
reversal
correction
adjustment
```

depending on business rules.

---

# 55. PURCHASE → INVENTORY FLOW

Implement the integration carefully.

Expected conceptual flow:

```text
Purchase
   ↓
APPROVED / ORDERED
   ↓
Receiving
   ↓
Inventory Transaction
   ↓
Increase On-Hand
   ↓
Inventory Ledger Event
```

Partial receiving:

```text
Ordered = 100

Receive 40
    ↓
Stock +40

Receive 60
    ↓
Stock +60
```

Final:

```text
Stock +100
```

Never double count.

---

# 56. SALES → INVENTORY FLOW

Conceptually:

```text
Sales
   ↓
Reservation
   ↓
Fulfillment
   ↓
Stock Issue
   ↓
On-Hand decreases
```

The exact state transition must follow Phase 12.

Do not create duplicate Sales status logic.

---

# 57. TRANSFER FLOW

Conceptually:

```text
Create Transfer
      ↓
Approve
      ↓
Transfer Out
      ↓
IN_TRANSIT
      ↓
Transfer In
      ↓
RECEIVED
```

Depending on business rules, transfer may be atomic:

```text
Warehouse A -20
Warehouse B +20
```

or two-step:

```text
Warehouse A -20
      ↓
IN_TRANSIT
      ↓
Warehouse B +20
```

Inspect frontend and choose the architecture accordingly.

Do not assume.

---

# 58. STOCK ADJUSTMENT FLOW

Conceptually:

```text
Create Adjustment
       ↓
Pending Approval
       ↓
Approve
       ↓
Calculate Difference
       ↓
Update Inventory
       ↓
Create Ledger Integration Event
       ↓
Audit
```

Never allow:

```text
PUT /inventory/:id
{
    "onHandQuantity": 999999
}
```

to change stock.

---

# 59. INVENTORY ACCOUNT / USER

Use Phase 08.

Track:

```text
createdBy
updatedBy
receivedBy
issuedBy
adjustedBy
approvedBy
```

according to existing audit/user conventions.

Do not create another user model.

---

# 60. API ERROR HANDLING

Use existing global exception handling.

Expected:

```text
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Validation / Business Rule Error
```

Use project conventions.

Examples:

```text
Insufficient stock
Duplicate transfer
Invalid warehouse
Invalid product variant
Invalid status transition
Reservation exceeds available stock
Concurrent modification
Duplicate idempotency key
```

---

# 61. TESTING

Implement comprehensive tests.

## Stock Balance

Test:

```text
initial stock
stock in
stock out
available quantity
reserved quantity
low stock
out of stock
```

## Purchase Receiving

Test:

```text
full receive
partial receive
multiple receiving
over-receive rejection
duplicate receive prevention
```

## Sales Deduction

Test:

```text
sale stock deduction
insufficient stock
reservation
release
cancellation
reversal
```

## Transfer

Test:

```text
same warehouse rejection
valid transfer
insufficient stock
transfer approval
transfer receiving
transfer cancellation
```

## Adjustment

Test:

```text
positive adjustment
negative adjustment
approval
unauthorized adjustment
invalid quantity
reason validation
```

## Concurrency

Test:

```text
two simultaneous stock issues
two simultaneous reservations
simultaneous transfers
```

## Visibility

Test:

```text
warehouse staff sees own warehouse
warehouse staff cannot see another warehouse
branch manager sees branch warehouses
manager cannot see unauthorized branch
super admin sees authorized scope
```

## Authorization

Test:

```text
401
403
permission denied
scope denied
```

---

# 62. Bruno API Testing

Create:

```text
bruno/
└── phase-14-inventory/
    ├── inventory/
    │   ├── list
    │   ├── detail
    │   ├── availability
    │   └── dashboard
    │
    ├── receiving/
    │   ├── receive
    │   └── partial-receive
    │
    ├── issuing/
    │   └── issue
    │
    ├── transfers/
    │   ├── create
    │   ├── list
    │   ├── detail
    │   ├── approve
    │   ├── receive
    │   └── cancel
    │
    ├── adjustments/
    │   ├── create
    │   ├── list
    │   ├── approve
    │   └── cancel
    │
    ├── reservations/
    │   ├── create
    │   ├── list
    │   └── release
    │
    └── visibility/
```

Test:

```text
happy path
validation errors
401
403
404
409
insufficient stock
duplicate requests
concurrency
warehouse scope
branch scope
company scope
purchase receiving
sales deduction
transfer
adjustment
reservation
dashboard visibility
```

Follow existing Bruno environment/auth conventions.

---

# 63. API DOCUMENTATION

Update Swagger/OpenAPI.

Document:

```text
endpoint
authentication
permission
data scope
request
response
errors
status transitions
business rules
```

Do not create a second documentation system.

---

# 64. SECURITY RULES

Never trust frontend-provided:

```text
companyId
branchId
warehouseId
productId
variantId
onHandQuantity
availableQuantity
reservedQuantity
stockQuantity
```

Backend must calculate and validate.

Never allow a user to:

```text
view unauthorized stock
modify unauthorized stock
transfer from unauthorized warehouse
transfer to unauthorized warehouse
adjust unauthorized stock
reserve unauthorized stock
release another user's reservation without permission
bypass negative-stock policy
```

---

# 65. TRANSACTION BOUNDARIES

Use database transactions for:

```text
receive
issue
transfer
adjustment approval
reservation
reservation release
reversal
```

Example:

```text
BEGIN TRANSACTION

lock inventory row

validate available quantity

update stock balance

create inventory operation record

create outbox event if available

create audit event

COMMIT
```

If anything fails:

```text
ROLLBACK
```

Stock must not be partially updated.

---

# 66. CACHE INVALIDATION

If Redis caching is implemented:

When stock changes:

```text
Stock Update
    ↓
Invalidate:
    inventory:{warehouse}:{product}:{variant}
    inventory:availability:{...}
    dashboard cache where required
```

Never return stale stock as authoritative transactional data.

For critical availability checks:

```text
Database = source of truth
```

---

# 67. PERFORMANCE

Inventory queries can become large.

Use:

```text
pagination
proper indexes
selective joins
projection
aggregation optimization
cache where appropriate
```

Avoid:

```text
N+1 queries
loading every inventory record
loading entire product catalog for one stock lookup
```

Review TypeORM relation loading carefully.

Do not use eager relations blindly.

---

# 68. BULK OPERATIONS

If frontend supports bulk stock operations:

```text
bulk adjustment
bulk transfer
bulk receiving
```

do not implement them as thousands of independent HTTP requests if avoidable.

Use controlled bulk APIs.

But preserve:

```text
transaction integrity
validation
authorization
audit
idempotency
```

Do not sacrifice correctness for speed.

---

# 69. INVENTORY REPORTING

Phase 22 owns the complete Reporting/Dashboard architecture.

Phase 14 may expose basic operational queries:

```text
stock balance
availability
low stock
warehouse stock
```

Do not create a second reporting engine.

---

# 70. INVENTORY NUMBERING

If business transactions require numbers:

```text
STK-IN-2026-000001
STK-OUT-2026-000001
TRF-2026-000001
ADJ-2026-000001
```

Use server-side generation.

Protect against concurrent generation.

Reuse existing document sequence infrastructure if available.

Do not create a duplicate numbering system.

---

# 71. DELETE POLICY

Never hard-delete historical stock transactions.

For master/current stock records:

Use the existing soft-delete policy where applicable.

For finalized transactions:

```text
NO HARD DELETE
```

Use:

```text
cancel
reverse
adjust
```

according to business rules.

---

# 72. IMPLEMENTATION ORDER

Implement in this order:

```text
Step 1
Inspect frontend Inventory requirements

Step 2
Inspect backend Phase 00–13

Step 3
Map Product / Variant / Warehouse architecture

Step 4
Map Sales → Inventory integration

Step 5
Map Purchase → Inventory integration

Step 6
Design Inventory balance

Step 7
Create Inventory entity

Step 8
Create migration

Step 9
Implement stock balance

Step 10
Implement stock availability

Step 11
Implement stock receiving

Step 12
Implement Purchase receiving integration

Step 13
Implement stock issuing

Step 14
Implement Sales stock deduction integration

Step 15
Implement reservations

Step 16
Implement reservation release

Step 17
Implement warehouse transfers

Step 18
Implement transfer state machine

Step 19
Implement stock adjustments

Step 20
Implement adjustment approval

Step 21
Implement negative-stock policy

Step 22
Implement Data Visibility

Step 23
Implement Dynamic RBAC

Step 24
Implement Audit Log

Step 25
Prepare Phase 15 Inventory Ledger integration

Step 26
Prepare Phase 18 Outbox integration

Step 27
Prepare Phase 19 Redis integration

Step 28
Prepare Phase 20 BullMQ integration

Step 29
Implement dashboard/summary

Step 30
Implement DTO validation

Step 31
Implement database constraints

Step 32
Implement indexes

Step 33
Implement automated tests

Step 34
Implement Bruno tests

Step 35
Update Swagger/OpenAPI

Step 36
Run migrations

Step 37
Run tests

Step 38
Run typecheck

Step 39
Run lint

Step 40
Run build

Step 41
Perform concurrency review

Step 42
Perform security review

Step 43
Perform Data Visibility review

Step 44
Generate Phase 14 implementation report
```

---

# 73. IMPORTANT AI RULES

You MUST follow all rules below.

1. Inspect existing code before implementation.
2. Inspect frontend Inventory requirements.
3. Reuse Phase 07 Warehouse architecture.
4. Reuse Phase 10 Product/Variant architecture.
5. Reuse Phase 12 Sales architecture.
6. Reuse Phase 13 Purchase architecture.
7. Reuse Phase 06 Data Visibility.
8. Reuse existing Dynamic RBAC.
9. Reuse existing Audit Log.
10. Reuse existing transaction infrastructure.
11. Do not create duplicate Product entities.
12. Do not create duplicate Variant entities.
13. Do not create duplicate Warehouse entities.
14. Do not create duplicate User/Account entities.
15. Do not create fixed roles.
16. Do not hard-code visibility based on role names.
17. Do not trust frontend stock quantities.
18. Do not trust frontend available quantity.
19. Do not trust frontend organization scope.
20. Do not allow arbitrary stock modification.
21. Do not allow stock-changing operations without transactions.
22. Protect against concurrency.
23. Prevent duplicate stock operations.
24. Implement idempotency where appropriate.
25. Do not use Redis as the source of truth.
26. Do not put critical stock updates into BullMQ.
27. Do not implement full Inventory Ledger in Phase 14.
28. Do not implement full Accounting in Phase 14.
29. Do not implement full Payment in Phase 14.
30. Do not create duplicate event infrastructure.
31. Do not hard-delete finalized inventory transactions.
32. Preserve historical integrity.
33. Apply Data Visibility to lists.
34. Apply Data Visibility to details.
35. Apply Data Visibility to dashboard aggregates.
36. Apply Data Visibility to availability checks.
37. Use database-level constraints.
38. Use server-side financial/quantity calculations.
39. Run all existing tests.
40. Fix regressions.
41. Never claim completion without verification.
42. Explain architectural conflicts before making destructive changes.

---

# 74. DEFINITION OF DONE

Phase 14 is complete only when:

```text
[ ] Frontend Inventory requirements inspected
[ ] Backend Phase 00–13 inspected

[ ] Inventory domain implemented
[ ] Inventory balance implemented
[ ] On-hand quantity implemented
[ ] Reserved quantity implemented
[ ] Available quantity implemented

[ ] Warehouse integration implemented
[ ] Product integration implemented
[ ] Variant integration implemented

[ ] Stock In implemented
[ ] Stock Out implemented

[ ] Purchase Receiving integration implemented
[ ] Partial Receiving supported where required

[ ] Sales Stock Deduction integration implemented
[ ] Sales Reservation integration implemented where required
[ ] Reservation Release implemented

[ ] Warehouse Transfer implemented
[ ] Transfer state machine implemented

[ ] Stock Adjustment implemented
[ ] Adjustment approval implemented where required

[ ] Negative stock policy implemented
[ ] Concurrency protection implemented
[ ] Idempotency protection implemented where required

[ ] Company scope implemented
[ ] Branch scope implemented
[ ] Warehouse scope implemented

[ ] Dynamic RBAC integrated
[ ] Data Visibility integrated
[ ] Inventory Staff scope supported
[ ] Warehouse Manager scope supported
[ ] Super Admin authorized scope supported

[ ] Dashboard visibility protected
[ ] Availability visibility protected

[ ] Audit Log integrated

[ ] Phase 15 Inventory Ledger integration prepared
[ ] Phase 16 Payment integration prepared
[ ] Phase 17 Accounting integration prepared
[ ] Phase 18 Outbox integration prepared
[ ] Phase 19 Redis integration prepared
[ ] Phase 20 BullMQ integration prepared

[ ] Database constraints implemented
[ ] Indexes reviewed
[ ] DTO validation implemented
[ ] REST APIs implemented
[ ] Swagger updated

[ ] Automated tests implemented
[ ] Bruno tests implemented

[ ] Existing tests pass
[ ] Typecheck passes
[ ] ESLint passes
[ ] Build passes

[ ] Concurrency review completed
[ ] Security review completed
[ ] Data Visibility review completed
[ ] Historical integrity review completed
```

---

# 75. FINAL IMPLEMENTATION REPORT

After implementation, provide:

```text
Phase 14 — Inventory Implementation Report

1. Frontend Inventory requirements discovered
2. Backend architecture reused
3. Files created
4. Files modified
5. Entities created/modified
6. Migrations
7. Database constraints
8. Database indexes
9. Inventory balance design
10. Stock In implementation
11. Stock Out implementation
12. Purchase integration
13. Sales integration
14. Reservation implementation
15. Warehouse Transfer implementation
16. Stock Adjustment implementation
17. Negative Stock Policy
18. Concurrency strategy
19. Idempotency strategy
20. Dynamic RBAC integration
21. Data Visibility rules
22. Audit Log integration
23. Inventory Ledger integration point
24. Outbox integration point
25. Redis integration point
26. BullMQ integration point
27. APIs
28. Swagger documentation
29. Automated tests
30. Bruno tests
31. Commands executed
32. Test results
33. Typecheck result
34. Lint result
35. Build result
36. Security review
37. Concurrency review
38. Data Visibility review
39. Known limitations
40. Recommended Phase 15 implementation
```

---

# 76. FINAL ARCHITECTURE

The final architecture should conceptually follow:

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
                    │  On Hand         │
                    │  Reserved        │
                    │  Available       │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
          STOCK IN       STOCK OUT      TRANSFER
              │              │              │
              │              │              │
              ▼              ▼              ▼
        PURCHASE         SALES         WAREHOUSE
        RECEIVING        PHASE 12      TRANSFER
              │              │              │
              └──────────────┼──────────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ INVENTORY LEDGER │
                    │    Phase 15      │
                    │                  │
                    │ Historical       │
                    │ Movements        │
                    └────────┬─────────┘
                             │
                             ▼
                       PHASE 17
                      ACCOUNTING
```

Security architecture:

```text
                    USER
                     │
                     ▼
              AUTHENTICATION
                Phase 05
                     │
                     ▼
             DYNAMIC RBAC
                Phase 06
                     │
                     ▼
             DATA VISIBILITY
                     │
          ┌──────────┼──────────┐
          │          │          │
       COMPANY     BRANCH    WAREHOUSE
          │          │          │
          └──────────┼──────────┘
                     │
                     ▼
                 INVENTORY
```

The most important principle is:

```text
MySQL
  =
Source of Truth

Redis
  =
Cache

Inventory
  =
Current Stock State

Inventory Ledger
  =
Historical Stock Movement

Outbox
  =
Reliable Event Boundary

BullMQ
  =
Asynchronous Work

Dynamic RBAC
  =
Permission

Data Visibility
  =
Which Records User Can See
```

Do not mix these responsibilities.
