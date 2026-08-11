# Phase 12 — Sales

## NestJS + TypeScript + MySQL + TypeORM + Redis + BullMQ + Docker

## Implementation Prompt

You are implementing **Phase 12 — Sales** of the Fashion ERP Backend.

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
```

The existing Fashion ERP frontend is the primary business/UI reference.

Before implementing anything, inspect the existing backend AND inspect the frontend repository to understand the actual Sales/POS requirements.

Frontend references:

* GitHub: https://github.com/Khant20Lin06/Fashion-ERP
* Frontend: https://fashion-erp.vercel.app/

Do not assume the frontend contains only the obvious Sales screens. Inspect its routes, components, forms, state management, API expectations, types/interfaces, mock data, tables, filters, POS screens, discount logic, customer selection, product selection, payment UI, return UI, and sales dashboards.

The existing backend architecture and completed phases are the technical source of truth.

Do not rewrite previous phases unnecessarily.

---

# 1. Phase Objective

Implement a production-ready **Sales Management module** supporting:

```text
Sales
├── Sales Order / Sales Transaction
├── POS Sales
├── Sales Invoice
├── Sales Items
├── Product / Variant Selection
├── Pricing
├── Discount
├── Tax integration
├── Customer
├── Sales Account / Sales Staff
├── Company
├── Branch
├── Warehouse
├── Stock Availability
├── Payment integration point
├── Sales Status
├── Sales Approval
├── Sales Cancellation
├── Sales Return integration point
├── Data Visibility
├── Dynamic RBAC
├── Audit Log
├── Reporting integration
└── API + Validation + Tests
```

Do NOT implement full Purchase, Inventory Ledger, Payment Accounting, or Double Entry Accounting in this phase.

Create clean integration points for future phases.

---

# 2. FIRST STEP — Inspect Before Coding

Before writing code, inspect:

## Backend

Inspect:

* Phase 00–11 implementation
* entities
* repositories
* services
* controllers
* DTO conventions
* response format
* exception handling
* authentication
* RBAC
* Data Visibility
* Company
* Branch
* Warehouse
* User
* Employee
* Account
* Product
* Variant
* Pricing
* Customer
* Supplier
* Payment Terms
* Audit Log
* transactions
* migrations
* tests

## Frontend

Inspect the Fashion ERP frontend and identify:

* Sales pages
* POS pages
* Sales dashboard
* Sales list
* Sales detail
* Create Sale
* Edit Sale
* Customer selection
* Product selection
* Variant selection
* Pricing UI
* Discount UI
* Tax UI
* Payment UI
* Sales staff/account UI
* Branch selection
* Warehouse selection
* Return UI
* Invoice UI
* status filters
* date filters
* reports
* permissions/visibility behavior
* API-related types
* mock data
* existing business rules

Search the codebase rather than guessing.

Create a short internal implementation map before modifying files.

---

# 3. Sales Domain Model

Design Sales as a transactional domain.

Recommended conceptual structure:

```text
SalesTransaction
    │
    ├── Customer
    ├── Sales Account / User
    ├── Company
    ├── Branch
    ├── Warehouse
    ├── Sales Items
    │      ├── Product
    │      └── Product Variant
    │
    ├── Pricing
    ├── Discount
    ├── Tax
    ├── Payment Integration
    └── Audit
```

Adapt names to existing project conventions.

Do not blindly create entities with these exact names if the codebase already has established terminology.

---

# 4. Sales Number

Every sales transaction must have a unique business document number.

Example:

```text
SAL-2026-000001
SAL-2026-000002
SAL-2026-000003
```

If POS has a separate numbering scheme, support it.

Possible:

```text
POS-2026-000001
```

Rules:

* Must be unique.
* Must not depend on client-generated IDs.
* Must be generated safely under concurrent requests.
* Must not create duplicate numbers.
* Must support company/branch configuration if the existing architecture supports document numbering.

Do not use random frontend-generated invoice numbers as the source of truth.

---

# 5. Sales Types

Support the actual business types found in the frontend.

Potential types include:

```text
POS
RETAIL
WHOLESALE
CREDIT
CASH
ONLINE
```

Do not create unnecessary hard-coded types.

Inspect the frontend and existing master data first.

If Sales Type is configurable in the architecture, make it configurable.

---

# 6. Sales Header

Sales transaction should contain appropriate information such as:

```text
id
salesNumber
salesType
customerId
salesAccountId
companyId
branchId
warehouseId
transactionDate
status
subtotal
discountAmount
taxAmount
shippingAmount
roundingAmount
grandTotal
paidAmount
balanceAmount
currency
notes
createdBy
updatedBy
createdAt
updatedAt
deletedAt
```

Do not blindly use this exact schema.

Adapt it to:

* Phase 03 database rules
* Phase 07 organization structure
* Phase 08 account structure
* Phase 10 pricing
* Phase 11 customer structure

---

# 7. Sales Items

Each Sale must contain one or more items.

Conceptually:

```text
Sales
   │
   └── SalesItem[]
          │
          ├── Product
          ├── Variant
          ├── Quantity
          ├── Unit Price
          ├── Discount
          ├── Tax
          └── Line Total
```

Each item should preserve the transaction-time values.

IMPORTANT:

Do not depend entirely on the current Product/Pricing records after the sale is completed.

A completed transaction must retain its historical:

```text
product
variant
SKU
unit price
discount
tax
quantity
line total
```

even if the product price changes later.

---

# 8. Product / Variant Validation

When creating a Sale:

1. Verify Product exists.
2. Verify Variant exists when required.
3. Verify Product/Variant is active.
4. Verify it belongs to the valid company/scope where applicable.
5. Verify pricing is valid.
6. Verify warehouse is valid.
7. Verify stock availability according to current inventory architecture.
8. Verify the user has permission to sell the product.

Do not trust:

```text
productName
SKU
price
discount
tax
```

provided by the frontend.

The backend must calculate/validate authoritative transaction values.

---

# 9. Pricing Integration

Integrate with Phase 10 Product / Variant / Pricing.

The Sales service must be able to resolve the applicable price according to existing pricing rules.

Potential inputs:

```text
customer
customerGroup
product
variant
priceList
quantity
company
branch
salesType
transactionDate
```

The actual pricing priority must follow Phase 10.

Do not create a second pricing engine.

Reuse the existing Pricing service.

---

# 10. Price Snapshot

When the sale is confirmed, preserve the actual transaction price.

For example:

```text
Current Product Price
100,000

Sale Price
90,000
```

The Sales Item should preserve:

```text
unitPrice = 90,000
```

If the Product price later changes to:

```text
110,000
```

the old sale must remain:

```text
90,000
```

Historical transactions must never change because master data changed.

---

# 11. Discount System

Implement controlled discount handling.

Support the discount capabilities actually required by the frontend.

Potentially:

```text
LINE_DISCOUNT
ORDER_DISCOUNT
PERCENTAGE
FIXED_AMOUNT
```

Do not implement every possible discount type unless the frontend/business requirements require them.

Validate:

```text
discount >= 0
discount <= applicable amount
```

Prevent users from manipulating the frontend to create unauthorized discounts.

---

# 12. Discount Permission

Discount authority must integrate with Dynamic RBAC.

Example:

```text
Sales Staff
    ↓
maximum discount = 5%

Sales Manager
    ↓
maximum discount = 15%

Super Admin
    ↓
configured/unrestricted
```

IMPORTANT:

Do NOT hard-code these percentages.

If the existing RBAC/permission architecture supports policy values, use it.

Otherwise design a configurable Sales Discount Policy that can later integrate with RBAC.

The backend must enforce discount limits.

Never rely only on frontend validation.

---

# 13. Tax Integration

Inspect the frontend and existing Master Data for tax requirements.

If Tax already exists:

* reuse it.

If Tax does not yet exist:

* create only the minimal integration point required by the existing roadmap.

Do not create a large accounting/tax subsystem in Phase 12.

Sales must preserve the applied tax amount/rate at transaction time.

---

# 14. Customer Integration

Integrate directly with Phase 11 Customer.

Sales should support:

```text
Customer
    ↓
Sales
```

Customer selection must respect Data Visibility.

For example:

```text
Sales Staff A
    ↓
Only customers assigned to Account A

Sales Staff B
    ↓
Only customers assigned to Account B

Sales Manager
    ↓
Branch customers

Super Admin
    ↓
All authorized customers
```

Do not allow a Sales Staff user to submit an arbitrary customerId and bypass visibility.

The backend must verify customer accessibility.

---

# 15. Sales Account / User Assignment

This is CRITICAL.

A Sale must record the Sales Account / User responsible for the transaction.

Conceptually:

```text
Sale
 ├── salesAccountId
 ├── salesUserId
 └── employeeId
```

Use the existing Phase 08 model.

Do NOT create another employee/user/account system.

A Sale should preserve who actually created/owned the transaction.

---

# 16. Sales Data Visibility

Integrate with Phase 06 Data Visibility.

Example:

```text
Sales Staff
    ↓
OWN
```

can see:

```text
their own sales
```

or sales assigned to their account.

Sales Manager:

```text
BRANCH
```

can see:

```text
all sales in their branch
```

Super Admin:

```text
ALL
```

can see:

```text
all authorized sales
```

Do not implement this using only:

```text
if role === "admin"
```

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
Sales Account
+
Existing Visibility Rules
```

Reuse the Phase 06 centralized visibility mechanism.

---

# 17. Sales Overall Dashboard Visibility

The frontend may have Sales Overview / Sales Dashboard.

Backend must support scope-aware aggregation.

Example:

```text
Sales Staff
→ own sales totals

Sales Manager
→ branch sales totals

Super Admin
→ company/system sales totals
```

The same Data Visibility rules used for list APIs must apply to:

* totals
* counts
* revenue
* discounts
* tax
* paid amount
* outstanding
* top products
* sales by staff
* sales by branch

CRITICAL:

Do not filter the table but expose global totals through an unfiltered dashboard endpoint.

All aggregate queries must enforce the same visibility scope.

---

# 18. Company / Branch / Warehouse

Every Sale must be associated with the correct organization scope.

Use Phase 07.

Potential structure:

```text
Company
   ↓
Branch
   ↓
Warehouse
   ↓
Sale
```

Validate:

* company exists
* branch belongs to company
* warehouse belongs to branch/company
* authenticated user can access branch
* authenticated user can access warehouse

Never trust client-provided company/branch/warehouse IDs without authorization checks.

---

# 19. Warehouse Validation

Before confirming a sale:

```text
Warehouse
   ↓
Product / Variant
   ↓
Available Stock
```

Verify stock availability using the existing inventory architecture.

IMPORTANT:

Do NOT create a duplicate inventory system.

Phase 14 — Inventory and Phase 15 — Inventory Ledger own the complete inventory architecture.

For Phase 12, create the correct integration point.

If Phase 14/15 is not implemented yet, do not invent fake stock deduction logic.

Document the integration requirement.

---

# 20. Sales Status

Implement a controlled state machine.

Potential states:

```text
DRAFT
PENDING_APPROVAL
CONFIRMED
PARTIALLY_PAID
PAID
CANCELLED
COMPLETED
```

Do not blindly implement every state.

Inspect frontend requirements and existing conventions.

Define valid transitions.

Example:

```text
DRAFT
   ↓
PENDING_APPROVAL
   ↓
CONFIRMED
   ↓
PAID / PARTIALLY_PAID
   ↓
COMPLETED
```

Cancellation must be controlled.

Do not allow arbitrary status changes through PATCH.

Use dedicated business operations where necessary.

---

# 21. Approval

If the frontend contains approval workflows, implement the required integration.

Potential flow:

```text
Sales Staff
   ↓
Create Sale
   ↓
PENDING_APPROVAL
   ↓
Manager
   ↓
APPROVE
   ↓
CONFIRMED
```

Approval must respect:

* permission
* branch
* company
* data visibility
* discount authority

Do not allow the creator to approve their own transaction if business rules prohibit it.

If approval workflow is not yet required by the frontend, prepare the architecture without overengineering.

---

# 22. Confirm Sale

Sale confirmation is a critical business operation.

When confirming:

1. Validate Sale exists.
2. Validate Sale is in a confirmable state.
3. Validate Customer access.
4. Validate Product/Variant.
5. Validate Pricing.
6. Validate Discount.
7. Validate Tax.
8. Validate Warehouse.
9. Validate Stock integration.
10. Validate Sales Account.
11. Validate permissions.
12. Recalculate totals server-side.
13. Persist final values.
14. Trigger required future integration events.
15. Write Audit Log.

Use a database transaction where appropriate.

---

# 23. Server-Side Total Calculation

Never trust frontend totals.

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
Rounding
=
Grand Total
```

Use decimal-safe numeric handling.

Do not use JavaScript floating-point arithmetic carelessly for money.

Follow the project's existing money/decimal conventions.

---

# 24. Money Handling

Financial fields must use appropriate database precision.

Example:

```text
DECIMAL(18,2)
```

or the project's established standard.

Do not use floating-point types for monetary values.

Do not silently round values.

Define explicit rounding rules.

---

# 25. Payment Integration

Phase 12 should prepare payment integration.

Do NOT implement the full Payment module here.

The Sale should expose enough information for:

```text
Phase 16 — Payment
```

to connect.

Potential integration:

```text
Sale
   ↓
grandTotal
   ↓
paidAmount
   ↓
balanceAmount
   ↓
Payment
```

If Payment entity does not yet exist, do not duplicate it.

Document the integration point.

---

# 26. Invoice

Inspect the frontend.

If the frontend has a Sales Invoice screen, implement the necessary Sales document/invoice representation.

A completed sale should be able to generate/retrieve invoice information.

Potential:

```text
invoiceNumber
invoiceDate
```

If invoice numbering belongs to a future Accounting module, create an integration point rather than duplicating invoice/accounting infrastructure.

---

# 27. Sales Return Integration

Do NOT implement the full Sales Return module unless the roadmap explicitly assigns it to Phase 12.

However, Sales must be designed so future Returns can reference:

```text
originalSaleId
originalSaleItemId
customerId
productId
variantId
warehouseId
quantity
unitPrice
tax
discount
```

A future return must be able to identify the original transaction.

Do not design Sales in a way that makes partial returns impossible.

---

# 28. Cancellation

Implement controlled cancellation.

Before cancellation validate:

* current status
* permission
* data visibility
* branch/company access
* payment state
* inventory state
* accounting state where applicable

Do not physically delete a confirmed transaction.

Use cancellation/reversal semantics.

Future accounting/inventory reversal must be possible.

---

# 29. Sales Search / Filtering

Sales list APIs should support existing pagination conventions.

Potential filters:

```text
salesNumber
customer
salesAccount
employee
company
branch
warehouse
status
salesType
dateFrom
dateTo
paymentStatus
```

Search:

```text
salesNumber
customer name
customer phone
SKU
```

Only implement fields actually supported by the database/frontend requirements.

Every query MUST pass through Data Visibility.

---

# 30. Sales Dashboard / Reports Integration

Prepare APIs for:

```text
Total Sales
Total Orders
Total Revenue
Total Discount
Total Tax
Paid
Outstanding
Sales by Staff
Sales by Branch
Sales by Product
Sales by Customer
```

But:

Do not create the full reporting engine in Phase 22.

Phase 12 can expose transactional aggregate endpoints needed by the frontend.

Phase 22 owns the complete Reports/Dashboard architecture.

All aggregates must respect visibility scope.

---

# 31. POS Support

The frontend contains/should be inspected for POS requirements.

Support POS transaction creation using the same Sales domain.

Prefer:

```text
POS UI
   ↓
Sales API
   ↓
Sales Domain
```

Do NOT create a completely separate POS sales database.

POS and normal Sales should share the same core transaction model where possible.

POS-specific fields can be represented using:

```text
salesType = POS
```

or the project's equivalent design.

---

# 32. Idempotency

POS and Sales APIs may be retried due to:

* network problems
* mobile devices
* frontend retries
* payment callbacks
* timeouts

Design important create/confirm operations to support idempotency.

Potential:

```text
idempotencyKey
clientTransactionId
```

Use the existing infrastructure if available.

Prevent duplicate sales when the same request is submitted multiple times.

---

# 33. Concurrency

Protect against concurrent:

```text
Sale creation
Sale confirmation
Document number generation
Stock validation
Discount validation
```

Use database transactions and locking where appropriate.

Do not solve concurrency only in frontend code.

---

# 34. Audit Log

Integrate with the existing Audit Log system.

Audit important actions:

```text
SALE_CREATED
SALE_UPDATED
SALE_CONFIRMED
SALE_APPROVED
SALE_REJECTED
SALE_CANCELLED
DISCOUNT_CHANGED
CUSTOMER_CHANGED
SALES_ACCOUNT_CHANGED
WAREHOUSE_CHANGED
STATUS_CHANGED
```

Audit should capture appropriate old/new values where supported.

Do not create another audit system.

---

# 35. Permissions

Integrate with Dynamic RBAC.

Recommended permissions:

```text
sale.read
sale.create
sale.update
sale.delete
sale.confirm
sale.cancel
sale.approve
sale.reject

sale.discount.apply
sale.discount.override

sale.dashboard.read
sale.report.read

sale.customer.select
sale.warehouse.select
```

Adapt naming to the existing Phase 06 permission conventions.

Do NOT create fixed roles.

Permissions belong to dynamically created Roles.

---

# 36. Example Dynamic Role Behavior

The system must support configurations such as:

```text
Role: Sales Staff
Permissions:
    sale.read
    sale.create
    sale.update
    sale.confirm

Data Scope:
    OWN_ACCOUNT
```

Another:

```text
Role: Sales Manager
Permissions:
    sale.read
    sale.create
    sale.update
    sale.confirm
    sale.cancel
    sale.approve
    sale.dashboard.read
    sale.report.read

Data Scope:
    BRANCH
```

Another:

```text
Role: Super Admin
Permissions:
    sale.read
    sale.create
    sale.update
    sale.delete
    sale.confirm
    sale.cancel
    sale.approve
    sale.dashboard.read
    sale.report.read
    sale.discount.override

Data Scope:
    ALL
```

These are examples only.

Do not hard-code these roles or scopes.

The existing Dynamic RBAC system controls them.

---

# 37. Data Visibility Security

This is one of the most important requirements of Phase 12.

For EVERY Sales endpoint verify:

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
Sales Account Scope
+
Existing Data Visibility Rules
```

Do not implement:

```text
WHERE sales.user_id = currentUser.id
```

everywhere manually if the existing Phase 06 system provides centralized visibility.

Instead reuse the centralized mechanism.

The same visibility rules must apply to:

* GET /sales
* GET /sales/:id
* dashboard
* totals
* search
* filtering
* exports
* customer lookup
* product lookup where relevant
* approval queues

---

# 38. API Design

Follow existing REST conventions.

Potential APIs:

```http
GET    /sales
POST   /sales
GET    /sales/:id
PATCH  /sales/:id
DELETE /sales/:id
```

Business operations:

```http
POST   /sales/:id/confirm
POST   /sales/:id/cancel
POST   /sales/:id/approve
POST   /sales/:id/reject
```

Dashboard:

```http
GET /sales/summary
GET /sales/dashboard
```

Search/filter:

```http
GET /sales?search=
GET /sales?status=
GET /sales?branchId=
GET /sales?salesAccountId=
GET /sales?dateFrom=&dateTo=
```

Do not blindly follow these URLs if the existing API conventions differ.

---

# 39. DTOs

Create appropriate DTOs:

```text
CreateSaleDto
UpdateSaleDto
CreateSaleItemDto
UpdateSaleItemDto
ConfirmSaleDto
CancelSaleDto
ApproveSaleDto
RejectSaleDto
SalesQueryDto
SalesSummaryQueryDto
```

Use class-validator or the project's existing validation system.

Never expose entity classes directly as request contracts.

---

# 40. API Response

Follow the existing API response envelope.

Do not create a new response structure.

Responses should not expose internal fields unnecessarily.

Use dedicated response DTOs/serializers where appropriate.

---

# 41. Database Constraints

Use appropriate:

* foreign keys
* indexes
* unique constraints
* check constraints where supported
* decimal precision
* timestamps
* soft delete

Potential indexes:

```text
salesNumber
customerId
salesAccountId
companyId
branchId
warehouseId
status
transactionDate
```

Potential composite indexes should be based on actual query patterns.

Do not over-index.

---

# 42. Historical Integrity

Once a Sale is confirmed:

DO NOT allow arbitrary mutation of critical historical values.

Examples:

```text
unitPrice
discount
tax
customer
warehouse
quantity
grandTotal
```

If business requirements allow changes, use controlled operations.

Do not let generic PATCH mutate finalized transactions.

ERP historical data must remain reliable.

---

# 43. TypeORM Rules

Follow existing TypeORM conventions.

Do NOT:

* use synchronize in production
* expose entities directly
* use uncontrolled cascades
* hard-delete confirmed transactions
* create duplicate Account entities
* create duplicate Product entities
* create duplicate Customer entities
* create duplicate Inventory entities

Use migrations.

Use transactions.

Use appropriate relations.

---

# 44. Redis / BullMQ

Do not use Redis/BullMQ for every Sales operation.

Use synchronous database transactions for critical transaction creation/confirmation.

Potential asynchronous jobs can be introduced for:

```text
invoice generation
notifications
large exports
analytics aggregation
external synchronization
```

Only implement them if required by the existing architecture.

Future Phase 20 owns the complete BullMQ worker architecture.

---

# 45. Outbox Integration

Phase 18 owns the Outbox Pattern.

Do not create a second event delivery system.

However, Sales should be designed so important events can later be published through Outbox.

Potential events:

```text
SaleCreated
SaleConfirmed
SaleCancelled
SaleApproved
SaleRejected
```

If the existing Outbox infrastructure is already available, integrate with it according to its established pattern.

If not, document the required integration for Phase 18.

Do not create an independent event bus.

---

# 46. Automated Testing

Implement comprehensive tests.

## Sales Creation

Test:

```text
create sale
multiple items
customer validation
product validation
variant validation
price validation
discount validation
tax calculation
total calculation
company scope
branch scope
warehouse scope
sales account assignment
```

## Sales Visibility

Test:

```text
Sales Staff sees own sales
Sales Staff cannot see another account's sales
Sales Manager sees branch sales
Sales Manager cannot see another branch
Super Admin sees all authorized data
```

## Dashboard

Test:

```text
staff totals are scoped
manager totals are branch scoped
admin totals are global within authorization scope
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
DRAFT → CONFIRMED
DRAFT → CANCELLED
PENDING_APPROVAL → APPROVED
invalid transition
cancel confirmed sale
unauthorized cancellation
```

## Financial

Test:

```text
subtotal
discount
tax
grand total
paid
balance
rounding
decimal precision
```

## Concurrency

Test important transaction/document-number behavior where practical.

---

# 47. Bruno API Tests

Create:

```text
bruno/
└── phase-12-sales/
    ├── sales/
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
invalid customer
invalid product
invalid variant
invalid warehouse
invalid discount
invalid state transition
company scope
branch scope
sales account visibility
dashboard visibility
pagination
search
filtering
```

Follow the existing Bruno environment/authentication conventions.

---

# 48. API Documentation

Update existing Swagger/OpenAPI documentation.

Document:

```text
method
path
authentication
permission
scope
request body
query parameters
response
error responses
state transitions
```

Do not create a separate documentation system.

---

# 49. Security Rules

Never trust frontend-provided:

```text
price
subtotal
discountAmount
taxAmount
grandTotal
companyId
branchId
warehouseId
salesAccountId
customerId
```

without server-side verification.

The backend is the source of truth.

Never allow a Sales Staff user to:

* view another account's sales
* modify another account's sale without permission
* apply unauthorized discount
* select unauthorized branch
* select unauthorized warehouse
* select inaccessible customer
* bypass approval
* cancel unauthorized sales
* manipulate totals

---

# 50. Implementation Order

Implement in this order:

```text
Step 1
Inspect frontend Sales/POS requirements

Step 2
Inspect backend Phase 00–11

Step 3
Create Sales domain design

Step 4
Identify reusable Product/Pricing/Customer/RBAC/Visibility infrastructure

Step 5
Create Sales entities

Step 6
Create Sales Item entities

Step 7
Create migrations

Step 8
Implement pricing integration

Step 9
Implement customer integration

Step 10
Implement Sales Account integration

Step 11
Implement Company/Branch/Warehouse scope

Step 12
Implement Sales creation

Step 13
Implement server-side calculations

Step 14
Implement discount validation

Step 15
Implement status/state machine

Step 16
Implement confirm/approve/reject/cancel operations

Step 17
Implement Data Visibility

Step 18
Implement dashboard/summary APIs

Step 19
Implement Audit Log

Step 20
Implement API validation

Step 21
Implement automated tests

Step 22
Implement Bruno tests

Step 23
Update API documentation

Step 24
Run lint

Step 25
Run typecheck

Step 26
Run tests

Step 27
Run build

Step 28
Perform security review

Step 29
Perform data visibility review

Step 30
Generate Phase 12 implementation report
```

---

# 51. Important AI Rules

You MUST follow these rules:

1. Inspect existing code before implementation.
2. Inspect the frontend before deciding Sales requirements.
3. Do not guess frontend behavior when it can be verified from code.
4. Do not rewrite previous phases unnecessarily.
5. Reuse Phase 06 Data Visibility.
6. Reuse Phase 08 User/Employee/Account.
7. Reuse Phase 10 Product/Pricing.
8. Reuse Phase 11 Customer/Supplier.
9. Do not create duplicate Customer/Product/Account/Inventory systems.
10. Do not create fixed roles.
11. Do not hard-code Sales Staff visibility.
12. Do not hard-code discount percentages unless already defined by the existing system.
13. Never trust frontend totals.
14. Never trust frontend pricing.
15. Never trust frontend company/branch/warehouse scope.
16. Do not hard-delete confirmed sales.
17. Preserve historical transaction values.
18. Do not implement full accounting in Phase 12.
19. Do not implement full payment in Phase 12.
20. Do not implement full inventory ledger in Phase 12.
21. Do not create duplicate Outbox architecture.
22. Do not create unnecessary BullMQ jobs.
23. Use database transactions for critical operations.
24. Prevent duplicate transactions where retries are possible.
25. Use decimal-safe monetary calculations.
26. Enforce authorization server-side.
27. Enforce Data Visibility server-side.
28. Apply the same visibility rules to dashboard aggregates.
29. Do not expose unauthorized aggregate data.
30. Run existing tests after implementation.
31. Fix regressions before completion.
32. Never claim implementation is complete without verifying the actual code.
33. If a conflict with previous architecture is discovered, explain it before making a destructive change.

---

# 52. Definition of Done

Phase 12 is complete only when:

```text
[ ] Frontend Sales/POS requirements inspected
[ ] Sales domain implemented
[ ] Sales Items implemented
[ ] Sales Number generation implemented
[ ] Customer integration implemented
[ ] Product integration implemented
[ ] Variant integration implemented
[ ] Pricing integration implemented
[ ] Price snapshot implemented
[ ] Discount implemented
[ ] Discount authorization implemented
[ ] Tax integration implemented
[ ] Company scope implemented
[ ] Branch scope implemented
[ ] Warehouse scope implemented
[ ] Sales Account/User integration implemented
[ ] Dynamic RBAC integrated
[ ] Data Visibility integrated
[ ] Sales Staff own-data visibility supported
[ ] Sales Manager branch visibility supported
[ ] Super Admin authorized global visibility supported
[ ] Dashboard aggregates respect visibility
[ ] Sales state machine implemented
[ ] Confirm operation implemented
[ ] Approval integration implemented where required
[ ] Cancellation implemented
[ ] Payment integration point prepared
[ ] Sales Return integration point prepared
[ ] Accounting integration point prepared
[ ] Audit Log integrated
[ ] Idempotency considered/implemented where required
[ ] Concurrency protection implemented where required
[ ] REST APIs implemented
[ ] DTO validation implemented
[ ] TypeORM migrations created
[ ] Database indexes reviewed
[ ] Automated tests implemented
[ ] Bruno tests implemented
[ ] API documentation updated
[ ] Existing tests pass
[ ] TypeScript typecheck passes
[ ] ESLint passes
[ ] Build passes
[ ] No duplicated infrastructure
[ ] No visibility bypass
[ ] No historical data corruption
```

---

# 53. Final Implementation Report

After implementation, provide:

```text
Phase 12 — Sales Implementation Report

1. Frontend Sales requirements discovered
2. Backend architecture reused
3. Files created
4. Files modified
5. Entities created/modified
6. Migrations created
7. APIs added
8. Permissions added
9. Data Visibility rules
10. Sales Account rules
11. Discount rules
12. Pricing integration
13. Customer integration
14. Product/Variant integration
15. Warehouse integration
16. Audit events
17. Dashboard/summary APIs
18. Automated tests
19. Bruno tests
20. API documentation
21. Commands executed
22. Test results
23. Typecheck result
24. Lint result
25. Build result
26. Security review
27. Data visibility review
28. Known limitations
29. Future integration requirements
30. Recommended Phase 13 implementation
```

IMPORTANT:

The implementation must be based on the actual existing Fashion ERP codebase.

Do not invent frontend features that do not exist.

Do not silently change previous architecture.

Do not claim a feature is complete unless the implementation and tests actually verify it.

The goal is not merely to make CRUD APIs.

The goal is to build a production-ready ERP Sales domain that can support:

```text
POS
+
Normal Sales
+
Customer
+
Product/Variant
+
Pricing
+
Discount
+
Sales Account
+
Company
+
Branch
+
Warehouse
+
Dynamic RBAC
+
Data Visibility
+
Audit Log
+
Future Payment
+
Future Inventory
+
Future Accounting
+
Future Sales Return
```

while preserving historical transaction integrity and enforcing server-side authorization.
