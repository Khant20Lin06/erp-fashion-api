# Phase 13 — Purchase

## NestJS + TypeScript + MySQL + TypeORM + Redis + BullMQ + Docker

## Implementation Prompt

You are implementing **Phase 13 — Purchase** of the Fashion ERP Backend.

The backend stack is:

* NestJS
* TypeScript
* MySQL
* TypeORM
* Redis
* BullMQ
* Docker
* REST API
* Bruno for API testing

The following phases are already completed:

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
```

Frontend references:

* GitHub: https://github.com/Khant20Lin06/Fashion-ERP
* Frontend: https://fashion-erp.vercel.app/

The existing backend implementation and completed phases are the technical source of truth.

Before coding, inspect the actual backend and frontend code.

Do not guess requirements that can be verified from the codebase.

Do not rewrite previous phases unnecessarily.

---

# 1. Phase Objective

Implement a production-ready **Purchase Management module** supporting:

```text
Purchase
├── Purchase Order / Purchase Transaction
├── Purchase Invoice / Bill
├── Purchase Items
├── Supplier
├── Product / Variant
├── Purchase Pricing
├── Discount
├── Tax Integration
├── Company
├── Branch
├── Warehouse
├── Purchase Account / User
├── Payment Integration Point
├── Inventory Integration Point
├── Purchase Approval
├── Purchase Cancellation
├── Purchase Return Integration Point
├── Data Visibility
├── Dynamic RBAC
├── Audit Log
├── Purchase Dashboard / Summary Integration
└── API + Validation + Tests
```

Do NOT implement the complete Inventory, Inventory Ledger, Payment, or Accounting modules in this phase.

Prepare clean integration points for their future phases.

---

# 2. FIRST STEP — Inspect Before Coding

Before writing code, inspect:

## Backend

Inspect Phase 00–12 implementation, especially:

```text
entities
repositories
services
controllers
DTOs
guards
authentication
RBAC
Data Visibility
Company
Branch
Warehouse
User
Employee
Account
Product
Variant
Pricing
Supplier
Customer
Audit Log
transactions
migrations
tests
API response conventions
error handling
```

Pay particular attention to:

```text
Phase 06 — Dynamic RBAC + Data Visibility
Phase 07 — Organization / Company / Branch / Warehouse
Phase 08 — User / Employee / Account
Phase 10 — Product / Variant / Pricing
Phase 11 — Customer / Supplier
Phase 12 — Sales
```

Reuse existing infrastructure.

Do not create duplicate systems.

---

# 3. Frontend Inspection

Inspect the Fashion ERP frontend for actual Purchase requirements.

Search for:

```text
Purchase
Purchasing
Purchase Order
Purchase Invoice
Supplier
Supplier Group
Purchase Item
Purchase Price
Purchase Discount
Purchase Tax
Warehouse
Receiving
Purchase Return
Purchase Dashboard
Purchase Report
```

Inspect:

* routes
* pages
* components
* forms
* tables
* filters
* state management
* TypeScript types
* API clients
* mock data
* validation
* status handling
* supplier selection
* product selection
* warehouse selection
* totals
* discount
* tax
* approval UI
* payment UI
* purchase dashboard
* reports

Create an implementation map before coding.

---

# 4. Purchase Domain Model

Purchase should follow a transactional domain model.

Conceptually:

```text
PurchaseTransaction
    │
    ├── Supplier
    ├── Purchase Account / User
    ├── Company
    ├── Branch
    ├── Warehouse
    │
    ├── Purchase Items
    │      ├── Product
    │      └── Variant
    │
    ├── Pricing
    ├── Discount
    ├── Tax
    ├── Payment Integration
    ├── Inventory Integration
    └── Audit
```

Adapt naming to the existing project conventions.

Do not create duplicate entities if equivalent entities already exist.

---

# 5. Purchase Number

Every Purchase document must have a unique business number.

Example:

```text
PUR-2026-000001
PUR-2026-000002
PUR-2026-000003
```

If the frontend/business rules distinguish Purchase Order and Purchase Invoice, use separate document numbering only if required.

For example:

```text
PO-2026-000001
PI-2026-000001
```

Do not invent separate numbering systems unnecessarily.

Requirements:

* unique
* server generated
* concurrency safe
* never rely on frontend-generated numbers
* support company/branch configuration if existing architecture supports document sequences

---

# 6. Purchase Types

Inspect frontend/business requirements first.

Potential examples:

```text
PURCHASE_ORDER
PURCHASE_INVOICE
CASH_PURCHASE
CREDIT_PURCHASE
LOCAL_PURCHASE
IMPORT_PURCHASE
```

Do not hard-code unnecessary types.

If the existing architecture supports configurable types, reuse it.

---

# 7. Purchase Header

The Purchase transaction should contain appropriate information such as:

```text
id
purchaseNumber
purchaseType
supplierId
purchaseAccountId
companyId
branchId
warehouseId
transactionDate
expectedDate
status
subtotal
discountAmount
taxAmount
shippingAmount
otherCharges
roundingAmount
grandTotal
paidAmount
balanceAmount
currency
supplierReference
notes
createdBy
updatedBy
createdAt
updatedAt
deletedAt
```

This is a conceptual model.

Adapt it to the actual Phase 03 database architecture and existing conventions.

---

# 8. Purchase Items

Each Purchase must contain one or more items.

Conceptually:

```text
Purchase
   │
   └── PurchaseItem[]
          │
          ├── Product
          ├── Variant
          ├── Quantity
          ├── Unit Cost
          ├── Discount
          ├── Tax
          └── Line Total
```

Each item must preserve transaction-time values.

A completed Purchase must retain historical:

```text
product
variant
SKU
unitCost
quantity
discount
tax
lineTotal
```

Do not rely on current Product/Pricing records to reconstruct old purchases.

---

# 9. Supplier Integration

Reuse Phase 11 Supplier.

Purchase must connect to:

```text
Supplier
    ↓
Purchase
```

Validate:

* supplier exists
* supplier is active
* supplier belongs to the accessible scope
* supplier can be used by the current user
* supplier/company relationship is valid where applicable

Never trust arbitrary `supplierId` submitted by the frontend.

Apply Data Visibility.

---

# 10. Supplier Data Visibility

Purchase must follow the existing Phase 06 visibility architecture.

Example:

```text
Purchase Staff
    ↓
Own assigned purchases

Purchase Manager
    ↓
Branch purchases

Super Admin
    ↓
All authorized purchases
```

These are examples only.

Do not create fixed roles.

Use:

```text
Permission
+
Data Scope
+
Company
+
Branch
+
Warehouse
+
Purchase Account
```

through the existing Dynamic RBAC system.

---

# 11. Purchase Account / User

A Purchase transaction must identify the user/account responsible for it.

Use Phase 08.

Conceptually:

```text
Purchase
 ├── purchaseAccountId
 ├── purchaseUserId
 └── employeeId
```

Do NOT create another user/account/employee system.

Preserve the responsible account for:

* visibility
* reporting
* audit
* approval
* ownership

---

# 12. Product / Variant Validation

When creating Purchase:

1. Verify Product exists.
2. Verify Variant exists when required.
3. Verify Product/Variant is active.
4. Verify product belongs to the valid organization scope where applicable.
5. Verify supplier/product relationship if supported.
6. Verify warehouse.
7. Validate unit cost.
8. Validate quantity.
9. Validate tax.
10. Validate discount.

Never trust frontend-supplied product names, SKU, totals, or costs.

---

# 13. Purchase Pricing

Purchase pricing must be separate from Sales pricing conceptually.

Do NOT accidentally reuse the Sales price as Purchase Cost.

Possible sources:

```text
Supplier-specific price
Last purchase cost
Supplier contract price
Manual purchase cost
Product default cost
```

Inspect Phase 10 and frontend requirements.

If the existing Pricing architecture supports purchase pricing, reuse it.

If not, create the minimum purchase-cost integration needed.

Do not create an unrelated pricing engine.

---

# 14. Purchase Cost Snapshot

When Purchase is confirmed, preserve the actual cost.

Example:

```text
Current Supplier Cost
80,000

Purchase Cost
75,000
```

The Purchase Item must retain:

```text
unitCost = 75,000
```

If supplier cost later changes to:

```text
85,000
```

the historical Purchase remains:

```text
75,000
```

Historical transactions must not change because master data changed.

---

# 15. Quantity Validation

Validate:

```text
quantity > 0
```

Use the project's decimal/quantity conventions.

Some products may support fractional quantities.

Do not automatically force integer quantities if the frontend/product configuration supports decimals.

---

# 16. Discount

Support the discount functionality actually required by the frontend.

Potential:

```text
LINE_DISCOUNT
ORDER_DISCOUNT
PERCENTAGE
FIXED_AMOUNT
```

Backend must validate:

```text
discount >= 0
discount <= applicable amount
```

Do not trust frontend-calculated discounts.

---

# 17. Purchase Discount Permission

Integrate discount authority with Dynamic RBAC.

Example:

```text
Purchase Staff
    ↓
limited discount authority

Purchase Manager
    ↓
higher discount authority

Super Admin
    ↓
configured/unrestricted
```

These values must NOT be hard-coded unless already defined in the existing system.

Use a configurable policy if the existing RBAC architecture supports policy values.

Backend must enforce the limit.

---

# 18. Tax Integration

Inspect existing Master Data and frontend.

If Tax already exists:

```text
reuse it
```

If Tax does not exist:

```text
create only the minimum integration point
```

Do not build full accounting/tax infrastructure in Phase 13.

Preserve applied tax rate/amount on the transaction.

---

# 19. Company / Branch / Warehouse

Purchase must respect Phase 07.

Conceptually:

```text
Company
   ↓
Branch
   ↓
Warehouse
   ↓
Purchase
```

Validate:

* company exists
* branch belongs to company
* warehouse belongs to branch/company
* current user can access company
* current user can access branch
* current user can access warehouse

Never trust client-provided organization IDs.

---

# 20. Warehouse / Receiving Integration

Purchase is closely related to inventory receiving.

However:

**Phase 14 — Inventory** owns inventory operations.

**Phase 15 — Inventory Ledger** owns stock ledger behavior.

Therefore Phase 13 must not create duplicate stock logic.

Prepare the integration:

```text
Purchase
   ↓
CONFIRMED / RECEIVED
   ↓
Inventory Receipt
   ↓
Inventory Ledger
```

If Inventory is not yet implemented:

* do not fake stock updates
* do not create a second inventory table
* document the integration point

---

# 21. Purchase Order vs Purchase Invoice

Inspect the frontend carefully.

If both exist, distinguish:

```text
Purchase Order
    ↓
Supplier commitment

Purchase Receipt / Receiving
    ↓
Goods received

Purchase Invoice
    ↓
Supplier liability
```

Do not automatically collapse these into one entity if the frontend/business workflow requires separate documents.

However, do not create three separate systems if the existing application only needs a single Purchase transaction.

Base the decision on actual frontend requirements and existing architecture.

---

# 22. Purchase Status

Implement a controlled state machine.

Potential states:

```text
DRAFT
PENDING_APPROVAL
APPROVED
ORDERED
PARTIALLY_RECEIVED
RECEIVED
PARTIALLY_PAID
PAID
COMPLETED
CANCELLED
```

Do not blindly implement every state.

Use only states required by the actual business flow.

Define valid transitions.

Example:

```text
DRAFT
   ↓
PENDING_APPROVAL
   ↓
APPROVED
   ↓
ORDERED
   ↓
PARTIALLY_RECEIVED
   ↓
RECEIVED
   ↓
PARTIALLY_PAID / PAID
   ↓
COMPLETED
```

Do not allow arbitrary status modification through generic PATCH.

Use business operations.

---

# 23. Purchase Approval

If the frontend contains approval workflow:

```text
Purchase Staff
    ↓
Create Purchase
    ↓
PENDING_APPROVAL
    ↓
Purchase Manager
    ↓
APPROVE
    ↓
APPROVED
```

Approval must validate:

* permission
* company
* branch
* warehouse
* purchase account visibility
* discount authority
* approval policy

If self-approval is prohibited, enforce it server-side.

Do not allow frontend-only approval controls.

---

# 24. Confirm Purchase

Confirmation is a critical business operation.

When confirming:

1. Verify Purchase exists.
2. Verify current status.
3. Verify supplier access.
4. Verify product/variant.
5. Verify quantity.
6. Verify purchase cost.
7. Verify discount.
8. Verify tax.
9. Verify company.
10. Verify branch.
11. Verify warehouse.
12. Verify purchase account.
13. Verify permissions.
14. Recalculate totals.
15. Persist final values.
16. Create required audit event.
17. Prepare future inventory/payment/accounting integrations.

Use a database transaction where appropriate.

---

# 25. Server-Side Calculation

Never trust:

```text
subtotal
discountAmount
taxAmount
grandTotal
```

from the frontend.

Backend must calculate:

```text
Line Subtotal
+
Line Discounts
+
Order Discount
+
Tax
+
Shipping
+
Other Charges
+
Rounding
=
Grand Total
```

Use decimal-safe financial calculations.

---

# 26. Money Handling

Use appropriate DECIMAL precision.

Example:

```text
DECIMAL(18,2)
```

or existing project convention.

Never use floating-point numbers for money.

Define explicit rounding rules.

Do not silently lose precision.

---

# 27. Supplier Reference

Support supplier-side reference information if the frontend/business process requires it.

Example:

```text
supplierInvoiceNumber
supplierReference
supplierOrderNumber
```

These values may be important for:

* duplicate detection
* reconciliation
* accounting
* supplier communication

If duplicate supplier invoice prevention is required, implement a database/business-level uniqueness strategy appropriate to company/supplier scope.

Do not blindly make supplier invoice numbers globally unique.

---

# 28. Duplicate Purchase Protection

Prevent accidental duplicate purchases where practical.

Potential identifiers:

```text
idempotencyKey
supplierInvoiceNumber
clientTransactionId
```

Do not assume one identifier is sufficient for every business case.

For create/confirm operations:

* protect against retries
* protect against duplicate requests
* preserve transaction integrity

This is especially important for POS/mobile/network retry scenarios.

---

# 29. Concurrency

Protect:

```text
Purchase number generation
Purchase confirmation
Approval
Receiving integration
Duplicate creation
```

Use:

* database transactions
* unique constraints
* locking where appropriate

Do not rely on frontend synchronization.

---

# 30. Payment Integration

Phase 16 owns the full Payment module.

Phase 13 should expose the necessary purchase payable information.

Conceptually:

```text
Purchase
   ↓
grandTotal
   ↓
paidAmount
   ↓
balanceAmount
   ↓
Payment
```

Do not create a duplicate payment system.

Prepare clean integration points.

---

# 31. Accounts Payable Integration

Phase 17 owns full Accounting / Double Entry.

Purchase should preserve the information required for future accounting:

```text
supplier
purchase amount
tax
discount
payable amount
company
branch
currency
transaction date
```

Do not post accounting journal entries directly in Phase 13 unless Phase 17 architecture already exists and explicitly requires it.

Prepare the integration point.

---

# 32. Purchase Return Integration

Do not implement the complete Purchase Return system unless explicitly required by the roadmap.

However, Purchase must support future references to:

```text
originalPurchaseId
originalPurchaseItemId
supplierId
productId
variantId
warehouseId
quantity
unitCost
tax
discount
```

A future return must support partial quantities.

Do not design Purchase in a way that prevents partial returns.

---

# 33. Cancellation

Cancellation must be controlled.

Before cancellation validate:

```text
current status
permission
data visibility
company scope
branch scope
warehouse scope
payment state
receiving/inventory state
accounting state where applicable
```

Do not hard-delete confirmed purchases.

Use cancellation/reversal semantics.

Future inventory/accounting modules must be able to reverse the relevant effects.

---

# 34. Purchase Search / Filtering

Follow existing pagination conventions.

Potential filters:

```text
purchaseNumber
supplierId
purchaseAccountId
companyId
branchId
warehouseId
status
purchaseType
dateFrom
dateTo
paymentStatus
receivingStatus
```

Search:

```text
purchaseNumber
supplier name
supplier phone
SKU
supplier invoice number
```

Only expose filters actually supported by the implementation/frontend.

Every query must apply Data Visibility.

---

# 35. Purchase Dashboard

If frontend contains Purchase Dashboard, support the required scoped aggregates.

Potential:

```text
Total Purchases
Purchase Count
Total Purchase Cost
Total Discount
Total Tax
Paid Amount
Outstanding Amount
Purchases by Supplier
Purchases by Staff
Purchases by Branch
Top Purchased Products
```

CRITICAL:

The dashboard must use the same visibility rules as Purchase list/detail APIs.

Example:

```text
Purchase Staff
→ own purchase totals

Purchase Manager
→ branch totals

Super Admin
→ authorized company/system totals
```

Never expose global aggregates to a user who cannot see the underlying records.

---

# 36. Data Visibility

This is a critical security requirement.

Every Purchase endpoint must enforce:

```text
Authentication
+
Permission
+
Company Scope
+
Branch Scope
+
Warehouse Scope
+
Purchase Account Scope
+
Existing Data Visibility
```

Apply to:

```text
GET /purchases
GET /purchases/:id
POST /purchases
PATCH /purchases/:id
POST /purchases/:id/confirm
POST /purchases/:id/approve
POST /purchases/:id/reject
POST /purchases/:id/cancel
GET /purchases/summary
GET /purchases/dashboard
```

Do not manually duplicate visibility logic in every controller.

Reuse the centralized Phase 06 mechanism.

---

# 37. Dynamic RBAC Permissions

Integrate with the existing Dynamic RBAC.

Recommended permissions:

```text
purchase.read
purchase.create
purchase.update
purchase.delete

purchase.confirm
purchase.cancel

purchase.approve
purchase.reject

purchase.discount.apply
purchase.discount.override

purchase.dashboard.read
purchase.report.read

purchase.supplier.select
purchase.warehouse.select
```

Adapt naming to existing Phase 06 conventions.

Do NOT create fixed roles.

Roles are dynamic.

Permissions belong to roles.

Data scopes belong to the existing visibility system.

---

# 38. Example Role Behavior

These are examples only.

Example:

```text
Role: Purchase Staff

Permissions:
    purchase.read
    purchase.create
    purchase.update
    purchase.confirm

Data Scope:
    OWN_ACCOUNT
```

Purchase Manager:

```text
Permissions:
    purchase.read
    purchase.create
    purchase.update
    purchase.confirm
    purchase.cancel
    purchase.approve
    purchase.dashboard.read
    purchase.report.read

Data Scope:
    BRANCH
```

Super Admin:

```text
Permissions:
    purchase.read
    purchase.create
    purchase.update
    purchase.delete
    purchase.confirm
    purchase.cancel
    purchase.approve
    purchase.dashboard.read
    purchase.report.read
    purchase.discount.override

Data Scope:
    ALL
```

Do not hard-code these roles.

---

# 39. API Design

Follow existing API conventions.

Potential:

```http
GET    /purchases
POST   /purchases
GET    /purchases/:id
PATCH  /purchases/:id
DELETE /purchases/:id
```

Business operations:

```http
POST /purchases/:id/confirm
POST /purchases/:id/approve
POST /purchases/:id/reject
POST /purchases/:id/cancel
```

Dashboard:

```http
GET /purchases/summary
GET /purchases/dashboard
```

Do not use these exact routes if the existing backend convention differs.

---

# 40. DTOs

Create appropriate DTOs.

Potential:

```text
CreatePurchaseDto
UpdatePurchaseDto
CreatePurchaseItemDto
UpdatePurchaseItemDto
ConfirmPurchaseDto
ApprovePurchaseDto
RejectPurchaseDto
CancelPurchaseDto
PurchaseQueryDto
PurchaseSummaryQueryDto
```

Use the existing validation framework.

Never expose TypeORM entities as request contracts.

---

# 41. API Response

Follow the existing API response envelope.

Do not create a new response structure.

Use dedicated response DTOs/serializers where appropriate.

Never expose internal database implementation details unnecessarily.

---

# 42. Database Constraints

Use:

* foreign keys
* unique constraints
* indexes
* decimal precision
* timestamps
* soft delete where applicable

Review indexes for:

```text
purchaseNumber
supplierId
purchaseAccountId
companyId
branchId
warehouseId
status
transactionDate
supplierInvoiceNumber
```

Use composite indexes only when query patterns justify them.

Do not over-index.

---

# 43. Historical Integrity

Once Purchase is confirmed, critical historical values should not be arbitrarily changed.

Examples:

```text
unitCost
quantity
discount
tax
grandTotal
supplier
warehouse
```

If changes are required:

* use controlled business operations
* preserve audit history
* ensure future inventory/accounting reversal remains possible

Do not allow generic PATCH to mutate finalized financial transactions.

---

# 44. Audit Log

Reuse existing Audit Log.

Audit important operations:

```text
PURCHASE_CREATED
PURCHASE_UPDATED
PURCHASE_CONFIRMED
PURCHASE_APPROVED
PURCHASE_REJECTED
PURCHASE_CANCELLED
PURCHASE_DISCOUNT_CHANGED
PURCHASE_SUPPLIER_CHANGED
PURCHASE_ACCOUNT_CHANGED
PURCHASE_WAREHOUSE_CHANGED
PURCHASE_STATUS_CHANGED
```

Capture old/new values where existing Audit Log supports it.

Do not create another audit system.

---

# 45. Outbox Integration

Phase 18 owns Outbox Pattern.

Potential Purchase events:

```text
PurchaseCreated
PurchaseConfirmed
PurchaseApproved
PurchaseRejected
PurchaseCancelled
PurchaseReceived
```

If Outbox infrastructure already exists, use it.

If not, prepare the integration point.

Do not create a separate event publishing architecture.

---

# 46. Redis / BullMQ

Do not move critical Purchase transaction logic into asynchronous jobs.

Critical operations must remain transactional.

Potential future async jobs:

```text
invoice generation
notifications
large exports
supplier synchronization
analytics
```

Only implement if the current architecture requires it.

Phase 20 owns the complete BullMQ worker architecture.

---

# 47. Automated Testing

Implement comprehensive tests.

## Purchase Creation

Test:

```text
create purchase
multiple items
supplier validation
product validation
variant validation
quantity validation
cost validation
discount
tax
total calculation
company scope
branch scope
warehouse scope
purchase account assignment
```

## Visibility

Test:

```text
Purchase Staff sees own purchases
Purchase Staff cannot see another account's purchases
Purchase Manager sees branch purchases
Purchase Manager cannot see another branch
Super Admin sees all authorized purchases
```

## Dashboard

Test:

```text
staff totals are scoped
manager totals are branch scoped
admin totals follow authorization scope
```

## Authorization

Test:

```text
401
403
permission denied
scope denied
```

## State Machine

Test:

```text
DRAFT → PENDING_APPROVAL
PENDING_APPROVAL → APPROVED
APPROVED → ORDERED
ORDERED → RECEIVED
invalid transitions
unauthorized approval
unauthorized cancellation
```

## Financial

Test:

```text
subtotal
line discount
order discount
tax
shipping
other charges
rounding
grand total
paid
balance
decimal precision
```

## Duplicate Protection

Test:

```text
duplicate idempotency key
duplicate request
supplier invoice duplicate where applicable
concurrent purchase number generation
```

---

# 48. Bruno API Tests

Create:

```text
bruno/
└── phase-13-purchase/
    ├── purchases/
    │   ├── create
    │   ├── list
    │   ├── detail
    │   ├── update
    │   ├── confirm
    │   ├── approve
    │   ├── reject
    │   └── cancel
    │
    ├── dashboard/
    └── visibility/
```

Test:

```text
happy path
validation errors
401
403
404
duplicate request
invalid supplier
invalid product
invalid variant
invalid warehouse
invalid quantity
invalid cost
invalid discount
invalid status transition
company scope
branch scope
warehouse scope
purchase account visibility
dashboard visibility
pagination
search
filtering
```

Follow existing Bruno environment/auth conventions.

---

# 49. API Documentation

Update Swagger/OpenAPI.

Document:

```text
method
path
authentication
permission
data scope
request body
query parameters
response
errors
status transitions
```

Do not create a separate documentation system.

---

# 50. Security Rules

Never trust frontend-provided:

```text
supplierId
productId
variantId
companyId
branchId
warehouseId
purchaseAccountId
unitCost
subtotal
discountAmount
taxAmount
grandTotal
```

without server-side validation.

Backend is the source of truth.

Never allow a user to:

```text
view unauthorized purchases
modify unauthorized purchases
approve unauthorized purchases
cancel unauthorized purchases
use unauthorized supplier
use unauthorized warehouse
bypass discount policy
change finalized financial values
```

---

# 51. Implementation Order

Implement in this order:

```text
Step 1
Inspect frontend Purchase requirements

Step 2
Inspect backend Phase 00–12

Step 3
Create Purchase domain design

Step 4
Identify reusable Supplier/Product/Pricing/RBAC/Visibility infrastructure

Step 5
Create Purchase entities

Step 6
Create Purchase Item entities

Step 7
Create migrations

Step 8
Implement Supplier integration

Step 9
Implement Product/Variant integration

Step 10
Implement Purchase Cost/Pricing

Step 11
Implement Purchase Account integration

Step 12
Implement Company/Branch/Warehouse scope

Step 13
Implement Purchase creation

Step 14
Implement server-side calculations

Step 15
Implement discount validation

Step 16
Implement status/state machine

Step 17
Implement approval

Step 18
Implement confirm

Step 19
Implement cancellation

Step 20
Implement Data Visibility

Step 21
Implement dashboard/summary

Step 22
Implement Audit Log

Step 23
Prepare Inventory integration

Step 24
Prepare Payment integration

Step 25
Prepare Accounting integration

Step 26
Prepare Purchase Return integration

Step 27
Implement DTO validation

Step 28
Create TypeORM migrations

Step 29
Implement automated tests

Step 30
Implement Bruno tests

Step 31
Update Swagger/OpenAPI

Step 32
Run lint

Step 33
Run typecheck

Step 34
Run tests

Step 35
Run build

Step 36
Perform security review

Step 37
Perform data visibility review

Step 38
Generate Phase 13 implementation report
```

---

# 52. Important AI Rules

You MUST follow:

1. Inspect existing code before implementation.
2. Inspect frontend Purchase requirements before designing APIs.
3. Reuse Phase 06 Data Visibility.
4. Reuse Phase 07 Organization.
5. Reuse Phase 08 User/Employee/Account.
6. Reuse Phase 10 Product/Variant/Pricing.
7. Reuse Phase 11 Supplier.
8. Reuse Phase 12 architecture patterns where appropriate.
9. Do not create duplicate Supplier/Product/Account systems.
10. Do not create fixed roles.
11. Do not hard-code visibility based on role names.
12. Do not trust frontend financial values.
13. Do not trust frontend organization IDs.
14. Do not trust frontend supplier/customer/product access.
15. Preserve historical purchase values.
16. Do not hard-delete finalized purchases.
17. Do not implement full Inventory in Phase 13.
18. Do not implement full Inventory Ledger in Phase 13.
19. Do not implement full Payment in Phase 13.
20. Do not implement full Accounting in Phase 13.
21. Do not create duplicate Outbox architecture.
22. Do not create unnecessary BullMQ jobs.
23. Use database transactions for critical operations.
24. Protect document-number generation from concurrency.
25. Prevent duplicate purchase creation where required.
26. Use decimal-safe money handling.
27. Enforce authorization server-side.
28. Enforce Data Visibility server-side.
29. Apply visibility rules to dashboard aggregates.
30. Never expose unauthorized aggregate information.
31. Run all existing tests.
32. Fix regressions before completion.
33. Never claim implementation is complete without verification.
34. If architecture conflicts are discovered, explain them before destructive changes.

---

# 53. Definition of Done

Phase 13 is complete only when:

```text
[ ] Frontend Purchase requirements inspected
[ ] Backend Phase 00–12 inspected
[ ] Purchase domain implemented
[ ] Purchase Items implemented
[ ] Purchase Number implemented
[ ] Supplier integration implemented
[ ] Product integration implemented
[ ] Variant integration implemented
[ ] Purchase Cost/Pricing implemented
[ ] Cost snapshot implemented
[ ] Discount implemented
[ ] Discount authorization implemented
[ ] Tax integration implemented
[ ] Company scope implemented
[ ] Branch scope implemented
[ ] Warehouse scope implemented
[ ] Purchase Account/User integration implemented
[ ] Dynamic RBAC integrated
[ ] Data Visibility integrated
[ ] Purchase Staff scoped visibility supported
[ ] Purchase Manager scoped visibility supported
[ ] Super Admin authorized visibility supported
[ ] Dashboard aggregates respect visibility
[ ] State machine implemented
[ ] Approval implemented where required
[ ] Confirm implemented
[ ] Cancellation implemented
[ ] Payment integration point prepared
[ ] Inventory integration point prepared
[ ] Inventory Ledger integration point prepared
[ ] Accounting integration point prepared
[ ] Purchase Return integration point prepared
[ ] Audit Log integrated
[ ] Idempotency considered/implemented where required
[ ] Concurrency protection implemented
[ ] REST APIs implemented
[ ] DTO validation implemented
[ ] TypeORM migrations created
[ ] Database indexes reviewed
[ ] Automated tests implemented
[ ] Bruno tests implemented
[ ] Swagger/OpenAPI updated
[ ] Existing tests pass
[ ] TypeScript typecheck passes
[ ] ESLint passes
[ ] Build passes
[ ] No duplicated infrastructure
[ ] No visibility bypass
[ ] No historical data corruption
```

---

# 54. Final Implementation Report

After implementation, provide:

```text
Phase 13 — Purchase Implementation Report

1. Frontend Purchase requirements discovered
2. Backend architecture reused
3. Files created
4. Files modified
5. Entities created/modified
6. Migrations created
7. APIs added
8. Permissions added
9. Data Visibility rules
10. Purchase Account rules
11. Supplier integration
12. Product/Variant integration
13. Purchase Cost/Pricing
14. Discount rules
15. Company/Branch/Warehouse scope
16. Approval flow
17. State transitions
18. Audit events
19. Dashboard/summary APIs
20. Inventory integration point
21. Payment integration point
22. Accounting integration point
23. Purchase Return integration point
24. Automated tests
25. Bruno tests
26. API documentation
27. Commands executed
28. Test results
29. Typecheck result
30. Lint result
31. Build result
32. Security review
33. Data visibility review
34. Known limitations
35. Recommended Phase 14 implementation
```

The final implementation must support:

```text
Supplier
    ↓
Purchase
    ↓
Purchase Items
    ↓
Product / Variant
    ↓
Warehouse
    ↓
Future Inventory
    ↓
Future Inventory Ledger

Purchase
    ↓
Payment
    ↓
Future Accounting

Purchase
    ↓
Future Purchase Return

Purchase
    ↓
Dynamic RBAC
    ↓
Data Visibility
    ↓
Audit Log
```

The goal is not merely CRUD.

Build a production-ready ERP Purchase domain with:

```text
Purchase
+
Supplier
+
Product/Variant
+
Purchase Cost
+
Discount
+
Tax
+
Company
+
Branch
+
Warehouse
+
Purchase Account
+
Dynamic RBAC
+
Data Visibility
+
Approval
+
Audit Log
+
Future Inventory
+
Future Payment
+
Future Accounting
+
Future Purchase Return
```

while preserving historical financial integrity and enforcing all authorization and visibility rules on the backend.
