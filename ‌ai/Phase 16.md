# Phase 16 — Payment

## Fashion ERP Backend

## NestJS + TypeScript + MySQL + TypeORM + Redis + BullMQ + Docker

## Production-Ready Implementation Prompt

You are implementing **Phase 16 — Payment** of the Fashion ERP Backend.

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
Phase 15 — Inventory Ledger
```

Do NOT rewrite completed phases unnecessarily.

The existing repository is the source of truth.

---

# 2. PHASE 16 OBJECTIVE

Implement a production-ready **Payment Management subsystem**.

The Payment module must handle:

```text
Customer Payments
Supplier Payments
Sales Payments
Purchase Payments
Payment Receipts
Payment Refunds
Payment Allocations
Payment Methods
Payment Accounts
Payment Status
Payment References
Payment Reconciliation
Payment Audit Trail
```

The architecture must support future:

```text
Phase 17 — Accounting / Double Entry
Phase 18 — Outbox Pattern
Phase 19 — Redis
Phase 20 — BullMQ Workers
Phase 21 — Notifications
Phase 22 — Reports / Dashboard
```

---

# 3. CRITICAL ACCOUNTING BOUNDARY

Do NOT confuse:

```text
Payment
```

with:

```text
Accounting Journal Entry
```

Phase 16 owns:

```text
"What money was received or paid?"
"How was it paid?"
"Which document was it allocated to?"
"How much remains?"
```

Phase 17 owns:

```text
"Which accounting accounts are debited and credited?"
```

Conceptually:

```text
                    PAYMENT
                       │
                       ▼
              ┌─────────────────┐
              │ Phase 16        │
              │ Payment         │
              │                 │
              │ Receipt/Payment │
              │ Allocation      │
              │ Method          │
              │ Status          │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Phase 17        │
              │ Accounting      │
              │                 │
              │ Journal Entry   │
              │ Debit / Credit  │
              └─────────────────┘
```

Do NOT implement the full accounting engine in Phase 16.

---

# 4. FIRST STEP — INSPECT BEFORE CODING

Before writing code, inspect the existing repository.

Inspect:

```text
Phase 03 — Database Architecture
Phase 06 — Dynamic RBAC + Data Visibility
Phase 07 — Company / Branch / Warehouse
Phase 08 — User / Employee / Account
Phase 09 — Master Data
Phase 11 — Customer / Supplier
Phase 12 — Sales
Phase 13 — Purchase
Phase 15 — Inventory Ledger
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
money/decimal utilities
document numbering
status enums
pagination
response format
error handling
tests
```

Reuse existing infrastructure.

Do NOT create duplicate:

```text
Customer
Supplier
User
Account
Company
Branch
Warehouse
Currency
AuditLog
Outbox
Money utility
Document number generator
```

---

# 5. FRONTEND INSPECTION

Inspect the actual Fashion ERP frontend.

Search for:

```text
Payment
Payments
Receive Payment
Receive
Pay Supplier
Payment Entry
Payment Method
Payment Type
Payment Status
Paid
Unpaid
Partially Paid
Outstanding
Refund
Refund Payment
Cash
Bank
Transfer
Credit
Payment Account
Customer Payment
Supplier Payment
```

Also inspect:

```text
sales pages
purchase pages
customer pages
supplier pages
invoice pages
payment dialogs
payment forms
payment tables
payment filters
payment summaries
outstanding balances
```

Map:

```text
Frontend Feature
       ↓
Backend API
       ↓
Payment Service
       ↓
Payment Entity
       ↓
Allocation
       ↓
Future Accounting
```

Do not invent frontend business behavior without checking the actual frontend first.

---

# 6. PAYMENT DOMAIN MODEL

The conceptual model should be:

```text
Payment
├── id
├── paymentNumber
├── companyId
├── branchId
├── customerId
├── supplierId
├── paymentType
├── direction
├── status
├── paymentDate
├── currencyId
├── exchangeRate
├── amount
├── receivedAmount
├── refundedAmount
├── paymentMethodId
├── paymentAccountId
├── referenceNumber
├── externalReference
├── notes
├── metadata
├── createdBy
├── createdAt
└── updatedAt
```

Adapt to the actual architecture.

Do not blindly create all fields.

---

# 7. PAYMENT TYPES

Support explicit payment types.

Potential:

```text
CUSTOMER_PAYMENT
SUPPLIER_PAYMENT
SALES_REFUND
PURCHASE_REFUND
```

If the frontend/business model requires:

```text
ADVANCE_PAYMENT
DOWN_PAYMENT
DEPOSIT
```

support them.

Do not create unnecessary payment types.

---

# 8. PAYMENT DIRECTION

Payment direction must be explicit.

For example:

```text
RECEIPT
```

means money comes into the company.

```text
PAYMENT
```

means money leaves the company.

Conceptually:

```text
Customer Payment
    ↓
Money IN

Supplier Payment
    ↓
Money OUT
```

Do not infer direction only from the payment type in random parts of the code.

Use a consistent domain rule.

---

# 9. CUSTOMER PAYMENT

Customer payment:

```text
Customer
   ↓
Payment
   ↓
Money Received
```

Example:

```text
Invoice = 1,000
Customer pays = 600
```

Payment:

```text
amount = 600
```

Outstanding:

```text
400
```

---

# 10. SUPPLIER PAYMENT

Supplier payment:

```text
Supplier
   ↓
Payment
   ↓
Money Paid
```

Example:

```text
Purchase Invoice = 2,000
Paid = 1,500
```

Outstanding:

```text
500
```

---

# 11. PAYMENT ALLOCATION

A payment should not necessarily belong to only one invoice.

Example:

```text
Customer pays 3,000
```

Outstanding invoices:

```text
INV-001 = 1,000
INV-002 = 1,200
INV-003 = 800
```

Allocation:

```text
INV-001 → 1,000
INV-002 → 1,200
INV-003 → 800
```

Total:

```text
3,000
```

Therefore implement a separate:

```text
PaymentAllocation
```

concept.

---

# 12. PAYMENT ALLOCATION MODEL

Conceptually:

```text
PaymentAllocation
├── id
├── paymentId
├── referenceType
├── referenceId
├── allocatedAmount
├── allocatedCurrency
├── exchangeRate
├── allocatedAt
└── metadata
```

Adapt to existing Sales/Purchase document architecture.

Do not duplicate invoice entities.

---

# 13. ALLOCATION RULE

For a payment:

```text
allocatedAmount <= payment.amount
```

Example:

```text
Payment = 1,000

Allocation A = 600
Allocation B = 400

Total = 1,000
```

Valid.

But:

```text
Payment = 1,000

Allocation A = 700
Allocation B = 500

Total = 1,200
```

must be rejected unless the system explicitly supports overpayment.

---

# 14. OVERPAYMENT

Design for possible overpayment.

Example:

```text
Invoice = 1,000
Payment = 1,200
```

Possible:

```text
Allocated = 1,000
Unallocated = 200
```

The 200 may become:

```text
Customer Credit
Advance
Unallocated Payment
Refundable Balance
```

Do not automatically invent accounting behavior.

If the frontend supports overpayment, implement it.

Otherwise reject:

```text
allocated > outstanding
```

according to business rules.

---

# 15. UNALLOCATED PAYMENT

Support unallocated payments if the business model requires them.

Example:

```text
Customer pays 5,000
```

but no invoice is selected.

Payment:

```text
amount = 5,000
allocated = 0
unallocated = 5,000
```

This is different from:

```text
Payment = 0
```

Do not lose unallocated money.

---

# 16. OUTSTANDING BALANCE

For Sales:

```text
Invoice Total
-
Allocated Customer Payments
-
Valid Credits/Returns where applicable
=
Outstanding
```

For Purchase:

```text
Purchase Total
-
Allocated Supplier Payments
-
Valid adjustments
=
Outstanding
```

Reuse existing document totals and status logic.

Do not duplicate financial calculations across many modules.

---

# 17. PAYMENT STATUS

Use explicit states.

Potential:

```text
DRAFT
PENDING
CONFIRMED
PARTIALLY_ALLOCATED
FULLY_ALLOCATED
CANCELLED
REFUNDED
PARTIALLY_REFUNDED
```

Do not use statuses that have overlapping meanings.

Separate:

```text
Payment Status
```

from:

```text
Allocation Status
```

if the architecture requires it.

---

# 18. IMPORTANT STATE MACHINE

Design a clear state machine.

Example:

```text
DRAFT
  │
  ▼
CONFIRMED
  │
  ├───────────────┐
  ▼               ▼
PARTIALLY       FULLY
ALLOCATED       ALLOCATED
  │               │
  └───────┬───────┘
          ▼
       REFUND
          │
          ▼
PARTIALLY_REFUNDED
          │
          ▼
       REFUNDED
```

Cancellation:

```text
DRAFT → CANCELLED
```

or according to the actual business rules.

Do not allow arbitrary status changes from the client.

---

# 19. PAYMENT IMMUTABILITY

Once a payment is:

```text
CONFIRMED
```

do not casually allow:

```text
amount update
currency update
payment method update
payment account update
payment date update
```

Prefer controlled:

```text
cancel
reverse
refund
correction
```

depending on the business operation.

This protects financial history.

---

# 20. PAYMENT NUMBER

If the system uses payment numbers:

```text
PAY-2026-000001
PAY-2026-000002
```

generate them server-side.

Protect against concurrency.

Reuse existing document-number infrastructure.

Do NOT generate numbers in the frontend.

---

# 21. PAYMENT METHOD

Create/reuse a payment method architecture.

Examples:

```text
CASH
BANK_TRANSFER
BANK
CARD
MOBILE_PAYMENT
CHEQUE
CREDIT
OTHER
```

The actual methods must follow the frontend/business requirements.

Do not hard-code every payment provider into the Payment entity.

---

# 22. PAYMENT METHOD CONFIGURATION

Potential:

```text
PaymentMethod
├── id
├── companyId
├── name
├── code
├── type
├── isActive
├── requiresReference
├── requiresAccount
└── metadata
```

Example:

```text
Bank Transfer
    requiresReference = true
    requiresAccount = true
```

Cash:

```text
Cash
    requiresReference = false
```

Follow existing Master Data architecture if Payment Methods belong there.

---

# 23. PAYMENT ACCOUNT

Payment should optionally/appropriately identify where money moved.

Examples:

```text
Cash Account
Bank Account
Mobile Wallet
```

Conceptually:

```text
Payment
   ↓
Payment Account
```

Do not create a second accounting Account entity if Phase 08/17 already has an account architecture.

Determine whether the existing:

```text
Account
```

means:

```text
User Account
```

or:

```text
Financial Account
```

and do not confuse them.

---

# 24. IMPORTANT ACCOUNT DISTINCTION

The Fashion ERP has:

```text
User Account
```

for authentication/employee access.

Accounting will have:

```text
Financial Account / Chart of Account
```

These are NOT the same thing.

Do not reuse the User Account table for financial accounts.

---

# 25. PAYMENT REFERENCE

Support:

```text
referenceNumber
externalReference
transactionId
```

where needed.

Examples:

```text
Bank Transaction ID
Card Reference
Mobile Payment Reference
Cheque Number
```

Do not store sensitive payment credentials.

---

# 26. SENSITIVE PAYMENT DATA

Never store:

```text
full card number
CVV
PIN
password
bank login credentials
```

If external payment gateway integration is added later, store only safe identifiers/tokens according to the gateway's architecture.

---

# 27. CASH PAYMENT

Cash payment example:

```text
Customer Invoice
      ↓
Cash Payment
      ↓
Payment Confirmed
      ↓
Allocation
```

Track:

```text
paymentMethod = CASH
paymentAccount = CASH_ACCOUNT
amount
```

---

# 28. BANK PAYMENT

Bank transfer:

```text
Customer
   ↓
Bank Transfer
   ↓
Reference
   ↓
Payment
```

Support:

```text
bank/reference information
```

without storing credentials.

---

# 29. PARTIAL PAYMENT

Example:

```text
Invoice = 10,000

Payment #1 = 3,000
Payment #2 = 2,000
Payment #3 = 5,000
```

The system must support:

```text
Multiple Payments
       ↓
One Invoice
```

and:

```text
One Payment
       ↓
Multiple Invoices
```

---

# 30. MANY-TO-MANY PAYMENT ALLOCATION

Conceptually:

```text
Customer
   │
   ├── Payment A ──┬── Invoice 1
   │               └── Invoice 2
   │
   └── Payment B ───── Invoice 3
```

Do not model Payment → Invoice as a simple one-to-one foreign key.

Use allocation records.

---

# 31. REFUND

Refund must be a controlled operation.

Example:

```text
Customer Payment = 1,000
Refund = 300
```

Result:

```text
Received = 1,000
Refunded = 300
Net = 700
```

Do not modify original payment amount to 700.

Preserve original payment.

Create refund transaction/history.

---

# 32. REFUND MODEL

Potential:

```text
PaymentRefund
├── id
├── paymentId
├── amount
├── reason
├── refundDate
├── refundMethodId
├── referenceNumber
├── status
├── createdBy
└── createdAt
```

Adapt to existing architecture.

---

# 33. PARTIAL REFUND

Support:

```text
Payment = 1,000
Refund = 200
Refund = 300
```

Remaining refundable:

```text
500
```

Never allow:

```text
Refund total > Payment amount
```

unless a separate business rule explicitly supports it.

---

# 34. REFUND STATE

Potential:

```text
REQUESTED
APPROVED
PROCESSING
COMPLETED
FAILED
CANCELLED
```

Do not implement unnecessary asynchronous states if refunds are fully synchronous.

---

# 35. PAYMENT REVERSAL VS REFUND

These are NOT necessarily identical.

```text
Reversal
=
void/cancel an invalid or incorrect payment transaction

Refund
=
return money after a valid payment
```

Example:

```text
Wrong payment entry
    → Reversal

Customer paid correctly
Customer requests money back
    → Refund
```

Keep these concepts separate.

---

# 36. PAYMENT CANCELLATION

A draft payment can be cancelled.

A confirmed payment should generally require:

```text
reversal
```

rather than:

```text
DELETE
```

Never hard-delete confirmed financial transactions.

---

# 37. SOFT DELETE

Do not use ordinary soft-delete semantics to hide confirmed payments.

For example:

```text
isDeleted = true
```

must NOT make a financial transaction disappear from history.

If the project uses soft delete for drafts/master data, follow that convention only where appropriate.

---

# 38. PAYMENT DATE

Support:

```text
paymentDate
createdAt
confirmedAt
```

where required.

Do not confuse:

```text
business transaction date
```

with:

```text
database creation timestamp
```

---

# 39. TIMEZONE

Reuse the project timezone policy.

Payment date/time must be deterministic across:

```text
frontend
API
database
reports
```

Do not silently convert business dates incorrectly.

---

# 40. CURRENCY

Payment must support the project's currency architecture.

Potential:

```text
currencyId
amount
exchangeRate
baseAmount
```

if multi-currency is supported.

Example:

```text
Invoice = USD 1,000
Payment = THB equivalent
```

Do not implement ad-hoc exchange-rate logic.

Reuse existing currency/master-data infrastructure.

---

# 41. ROUNDING

Financial calculations must use precise decimal arithmetic.

Do NOT use JavaScript floating-point arithmetic for:

```text
amount
allocatedAmount
refundAmount
exchangeRate
```

Reuse existing Money/Decimal utilities.

---

# 42. PAYMENT TOTAL INTEGRITY

For a payment:

```text
amount
=
allocatedAmount
+
unallocatedAmount
```

if the system supports unallocated payments.

For refunds:

```text
refundedAmount
<=
amount
```

All financial constraints must be validated server-side.

---

# 43. ALLOCATION INTEGRITY

For each allocation:

```text
allocatedAmount > 0
```

unless the system explicitly supports zero-value allocations.

And:

```text
sum(allocations)
<=
payment.amount
```

according to overpayment rules.

Also:

```text
sum(invoice allocations)
<=
invoice outstanding
```

unless the business explicitly supports overpayment/credit.

---

# 44. CONCURRENCY — PAYMENT ALLOCATION

Important scenario:

Two users allocate the same invoice simultaneously.

Example:

```text
Invoice outstanding = 1,000

User A allocates 700
User B allocates 700
```

The system must NOT end with:

```text
Allocated = 1,400
```

Use transaction + appropriate row locking / concurrency control.

Expected:

```text
One succeeds
One fails or is adjusted
```

according to business rules.

---

# 45. CONCURRENCY — PAYMENT

Prevent duplicate payment creation from:

```text
double-click
network retry
mobile retry
API retry
frontend duplicate request
```

Use idempotency where appropriate.

Example:

```text
Idempotency-Key
```

must not create two payments.

---

# 46. TRANSACTION BOUNDARY

Payment confirmation + allocation must be atomic where appropriate.

Example:

```text
BEGIN

Create/confirm Payment
Create PaymentAllocation
Update outstanding state
Create Audit
Create Outbox event

COMMIT
```

If any critical operation fails:

```text
ROLLBACK
```

No partial payment state.

---

# 47. PAYMENT + INVENTORY

Payment generally does NOT directly change inventory.

Keep:

```text
Sales
  ↓
Inventory Ledger
```

and:

```text
Sales
  ↓
Payment
```

as separate concerns.

Example:

```text
Sale confirmed
    ├── Inventory movement
    └── Payment / outstanding
```

Do not create an inventory ledger entry merely because payment was received.

---

# 48. PAYMENT + SALES

Integrate with Phase 12.

Potential flow:

```text
Sales Invoice
      ↓
Outstanding
      ↓
Customer Payment
      ↓
Allocation
      ↓
Invoice Payment Status
```

Example:

```text
Invoice = 5,000
Paid = 2,000
Outstanding = 3,000
Status = PARTIALLY_PAID
```

---

# 49. PAYMENT + PURCHASE

Integrate with Phase 13.

Flow:

```text
Purchase Invoice
      ↓
Supplier Outstanding
      ↓
Supplier Payment
      ↓
Allocation
      ↓
Purchase Payment Status
```

Example:

```text
Purchase = 10,000
Paid = 7,000
Outstanding = 3,000
```

---

# 50. PAYMENT STATUS ON SALES/PURCHASE

Do not duplicate payment totals in multiple places without a clear source of truth.

Prefer:

```text
Payment
  +
PaymentAllocation
```

as the payment history.

Sales/Purchase can expose derived:

```text
paidAmount
outstandingAmount
paymentStatus
```

where useful.

Ensure these values remain consistent.

---

# 51. PAYMENT SUMMARY

Potential:

```http
GET /payments/summary
```

Possible:

```text
totalReceived
totalPaid
totalRefunded
totalUnallocated
totalOutstanding
```

All summary calculations must respect Data Visibility.

Do not expose unauthorized totals.

---

# 52. CUSTOMER PAYMENT LIST

Potential:

```http
GET /payments/customer
```

Filters:

```text
customerId
companyId
branchId
paymentMethodId
status
fromDate
toDate
```

All filters must be scope-safe.

---

# 53. SUPPLIER PAYMENT LIST

Potential:

```http
GET /payments/supplier
```

Filters:

```text
supplierId
companyId
branchId
paymentMethodId
status
fromDate
toDate
```

---

# 54. GENERAL PAYMENT LIST

Potential:

```http
GET /payments
```

Support:

```text
paymentType
direction
status
customer
supplier
company
branch
paymentMethod
paymentAccount
date range
reference
```

Use pagination.

---

# 55. PAYMENT DETAIL

Potential:

```http
GET /payments/:id
```

Response should provide:

```text
payment
customer/supplier
payment method
payment account
allocations
refunds
references
status
createdBy
audit information
```

Do not expose unauthorized records.

---

# 56. CREATE PAYMENT

Potential:

```http
POST /payments
```

Request may contain:

```text
customerId / supplierId
paymentType
amount
currencyId
paymentMethodId
paymentAccountId
paymentDate
referenceNumber
notes
allocations[]
```

But the server must calculate/validate:

```text
direction
status
allocated total
outstanding
scope
```

Do not trust client-calculated totals.

---

# 57. CONFIRM PAYMENT

Potential:

```http
POST /payments/:id/confirm
```

Confirmation must validate:

```text
payment exists
user has permission
scope valid
amount valid
payment method valid
payment account valid
allocation valid
period open
```

Then:

```text
transaction
    ↓
confirm
    ↓
allocate
    ↓
audit
    ↓
outbox
```

---

# 58. ALLOCATE PAYMENT

Potential:

```http
POST /payments/:id/allocations
```

Validate:

```text
payment confirmed
reference exists
reference belongs to same customer/supplier
reference is payable/receivable
outstanding sufficient
currency compatible
scope valid
```

---

# 59. REMOVE ALLOCATION

If business requirements require unallocation:

```http
DELETE /payments/:paymentId/allocations/:allocationId
```

BUT:

For confirmed financial history, prefer:

```text
controlled unallocation / reversal
```

rather than destructive deletion.

Inspect frontend/business requirements first.

---

# 60. REFUND API

Potential:

```http
POST /payments/:id/refunds
```

Validate:

```text
payment confirmed
refund amount > 0
refund amount <= refundable amount
user permission
payment scope
period
refund method
reason
```

Create refund record.

Do not modify original payment amount.

---

# 61. REVERSAL API

Potential:

```http
POST /payments/:id/reverse
```

Validate:

```text
payment confirmed
not already reversed
reason required
permission
scope
period
```

Create controlled reversal.

Preserve original.

---

# 62. PAYMENT ACCOUNT VISIBILITY

Payment accounts can be sensitive.

Example:

```text
Cash Counter A
Bank Account A
Bank Account B
```

Apply:

```text
company scope
branch scope
user scope
permission
```

Do not allow any user to select arbitrary payment accounts.

---

# 63. SALES STAFF PAYMENT VISIBILITY

The project requires account-based data visibility.

Therefore:

```text
Sales Staff
    ↓
Own Account / Assigned Scope
    ↓
Own Sales
    ↓
Own Customer Payments
```

while:

```text
Sales Manager / Super Admin
    ↓
Broader authorized payment visibility
```

Do NOT hard-code:

```text
if role == "sales_staff"
```

Use:

```text
Dynamic RBAC
+
Data Visibility
+
Account scope
```

from Phase 06/08.

---

# 64. CUSTOMER/SUPPLIER VISIBILITY

If a user cannot see a customer:

```text
GET /payments
```

must not expose that customer's payment records.

Likewise supplier.

Do not allow payment endpoints to bypass customer/supplier scope.

---

# 65. BRANCH / COMPANY SCOPE

Every payment should be associated with the correct:

```text
company
branch
```

according to the business context.

The backend must validate that:

```text
payment account
customer/supplier
invoice
branch
company
```

are compatible.

Do not allow cross-company allocations accidentally.

---

# 66. CROSS-COMPANY PROTECTION

Reject scenarios such as:

```text
Company A Payment
      ↓
Company B Invoice
```

unless the system explicitly supports intercompany transactions.

Do not silently accept cross-company references.

---

# 67. CROSS-BRANCH RULE

Determine whether branches share:

```text
customers
payment accounts
invoices
```

based on existing Phase 07 architecture.

Do not invent cross-branch behavior.

Enforce existing organizational scope.

---

# 68. PAYMENT METHOD MASTER DATA

If Payment Method belongs to Master Data:

Reuse Phase 09.

Do not create:

```text
PaymentMethod
```

twice.

If Phase 09 does not yet contain it, add it there or create the correct extension according to architecture.

---

# 69. CUSTOMER/SUPPLIER ACCOUNT MAPPING

Phase 11 includes:

```text
Account / Ledger Mapping
```

Payment should prepare for:

```text
Customer Receivable
Supplier Payable
Cash
Bank
```

mapping.

But Phase 17 owns actual journal posting.

---

# 70. ACCOUNTING INTEGRATION CONTRACT

Prepare an integration interface such as:

```text
PaymentConfirmedEvent
PaymentRefundedEvent
PaymentReversedEvent
```

Potential payload:

```json
{
  "paymentId": "...",
  "paymentType": "CUSTOMER_PAYMENT",
  "direction": "RECEIPT",
  "amount": 1000,
  "currencyId": "...",
  "paymentAccountId": "...",
  "customerId": "...",
  "companyId": "...",
  "branchId": "..."
}
```

Phase 17 can consume this later.

Do not create journal entries here unless existing architecture explicitly requires it.

---

# 71. OUTBOX INTEGRATION

If Phase 18 is not implemented yet, create a clean integration point.

Potential events:

```text
PAYMENT_CREATED
PAYMENT_CONFIRMED
PAYMENT_ALLOCATED
PAYMENT_REFUNDED
PAYMENT_REVERSED
```

Use Outbox once Phase 18 becomes available.

Do not publish critical events directly to external systems before transaction commit.

---

# 72. BULLMQ

Do not use BullMQ for the core payment transaction.

Correct:

```text
BEGIN
Payment
Allocation
Audit
Outbox
COMMIT

BullMQ
    ↓
Notification
Receipt generation
Reporting cache
External integration
```

Incorrect:

```text
Payment created
    ↓
BullMQ
    ↓
Allocation
```

Core financial state must be transactionally reliable.

---

# 73. REDIS

Redis may be used for:

```text
payment method cache
payment account lookup cache
summary cache
idempotency keys
```

But:

```text
MySQL = source of truth
```

Never use Redis as permanent payment history.

---

# 74. IDEMPOTENCY

Payment creation should support idempotency.

Example:

```text
POST /payments
Idempotency-Key: PAY-CLIENT-12345
```

Retry:

```text
same key
same request
```

must not create duplicate payment.

If the same key is reused with a materially different request:

```text
409 Conflict
```

or equivalent existing project behavior.

---

# 75. PAYMENT RECEIPT NUMBER

If receipts are required:

```text
REC-2026-000001
```

or equivalent.

Do not create duplicate numbering infrastructure.

Reuse existing document numbering.

---

# 76. RECEIPT GENERATION

If frontend requires printable receipt:

Payment service should expose data for:

```text
receipt
PDF
print
```

But do not build a heavy PDF worker in Phase 16 unless required.

Prepare:

```text
Payment Receipt DTO
```

for Phase 21/22 or document generation infrastructure.

---

# 77. PAYMENT AUDIT LOG

Audit important operations:

```text
PAYMENT_CREATED
PAYMENT_CONFIRMED
PAYMENT_ALLOCATED
PAYMENT_UNALLOCATED
PAYMENT_REFUNDED
PAYMENT_REVERSED
PAYMENT_CANCELLED
```

Capture:

```text
user
account
company
branch
paymentId
action
reason
timestamp
```

Reuse existing Audit Log.

---

# 78. AUDIT IMMUTABILITY

Audit records must not be editable/deletable through normal Payment APIs.

Do not allow users to erase financial history.

---

# 79. DATA VISIBILITY

Every Payment endpoint MUST apply:

```text
Authentication
+
Permission
+
Company Scope
+
Branch Scope
+
Account Scope
+
Customer/Supplier Scope
```

according to Phase 06.

Do not create endpoint-specific hard-coded role checks.

---

# 80. RBAC PERMISSIONS

Potential permissions:

```text
payment.read
payment.detail
payment.create
payment.confirm
payment.allocate
payment.unallocate
payment.refund
payment.reverse
payment.cancel
payment.export
payment.summary
payment.reconciliation
```

Adapt naming to the existing permission architecture.

Do not create fixed roles.

---

# 81. PAYMENT RECONCILIATION

Phase 16 should support operational reconciliation.

Examples:

```text
Payment Total
vs
Allocated Total
vs
Invoice Paid Total
```

Also:

```text
Payment Account
vs
External Bank/Cash Statement
```

if the project supports bank reconciliation.

Do not build a full bank reconciliation engine unless frontend requirements require it.

---

# 82. PAYMENT RECONCILIATION MODEL

Potential:

```text
Payment
   ↓
Reconciliation Status
```

Possible:

```text
UNRECONCILED
MATCHED
PARTIALLY_MATCHED
DISPUTED
```

Only implement if required.

---

# 83. PAYMENT SEARCH

Support:

```text
paymentNumber
referenceNumber
externalReference
customer name
supplier name
invoice number
```

Use indexed fields where appropriate.

Avoid expensive full-table scans.

---

# 84. PAGINATION

All list APIs must support pagination.

Examples:

```text
GET /payments?page=1&limit=50
```

or existing cursor architecture.

Never return millions of payments in one request.

---

# 85. INDEXES

Review indexes for:

```text
paymentNumber
companyId
branchId
customerId
supplierId
paymentDate
status
paymentType
paymentMethodId
paymentAccountId
referenceNumber
createdAt
```

Payment allocations:

```text
paymentId
referenceType
referenceId
```

Use composite indexes based on actual query patterns.

Do not blindly index everything.

---

# 86. DATABASE CONSTRAINTS

Implement appropriate:

```text
foreign keys
unique constraints
check constraints where supported
decimal precision
indexes
```

Important:

```text
amount > 0
allocatedAmount > 0
refundAmount > 0
```

where applicable.

---

# 87. FINANCIAL PRECISION

Use:

```text
DECIMAL
```

in MySQL.

Do NOT use:

```text
FLOAT
DOUBLE
```

for monetary amounts.

Follow existing project precision policy.

Example:

```text
DECIMAL(18,2)
```

only if consistent with the existing architecture.

---

# 88. PAYMENT CREATION VALIDATION

Before creating a payment:

```text
customer/supplier exists
active
company valid
branch valid
payment method valid
payment account valid
currency valid
amount valid
reference valid
user scope valid
```

Do not trust frontend validation.

---

# 89. PAYMENT ALLOCATION VALIDATION

Before allocation:

```text
payment exists
payment confirmed
reference exists
reference type valid
customer/supplier matches
company matches
branch compatible
currency compatible
outstanding sufficient
allocation amount valid
```

---

# 90. REFUND VALIDATION

Before refund:

```text
payment exists
payment confirmed
payment not fully refunded
refund amount valid
refund method valid
permission valid
scope valid
reason provided
```

---

# 91. REVERSAL VALIDATION

Before reversal:

```text
payment exists
payment confirmed
not already reversed
reason required
permission valid
scope valid
period open
```

---

# 92. PAYMENT PERIOD LOCK

If accounting period locking exists:

```text
Closed Period
    ↓
No new reversal/refund/correction
```

unless the project explicitly supports adjustment in a later period.

Prepare integration with Phase 17.

---

# 93. API ERROR HANDLING

Use existing global exception architecture.

Expected:

```text
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity
```

Examples:

```text
Payment not found
Invalid payment method
Invalid payment account
Insufficient outstanding balance
Allocation exceeds payment
Allocation exceeds outstanding
Payment already confirmed
Payment already reversed
Payment already refunded
Cross-company allocation
Cross-branch allocation
Unauthorized payment account
Duplicate idempotency key
Closed accounting period
```

---

# 94. DTO DESIGN

Potential DTOs:

```text
CreatePaymentDto
UpdateDraftPaymentDto
ConfirmPaymentDto
CreatePaymentAllocationDto
BulkAllocatePaymentDto
RefundPaymentDto
ReversePaymentDto
PaymentQueryDto
PaymentSummaryQueryDto
CustomerPaymentQueryDto
SupplierPaymentQueryDto
```

Only create DTOs actually needed.

Do not expose TypeORM entities directly.

---

# 95. PAYMENT SERVICE

The service should encapsulate:

```text
create()
confirm()
allocate()
unallocate()
refund()
reverse()
cancel()
findOne()
findMany()
summary()
```

Use domain-oriented methods.

Do not put all business logic inside controllers.

---

# 96. PAYMENT REPOSITORY

Repository/query layer should support:

```text
findPayment
findPayments
findOutstanding
findAllocations
findRefunds
calculateAllocatedAmount
calculateRefundedAmount
```

Use efficient SQL/QueryBuilder where necessary.

Avoid N+1 queries.

---

# 97. OUTSTANDING CALCULATION

Avoid:

```text
load all payments into JavaScript
```

for large datasets.

Prefer database aggregation:

```text
SUM(allocated_amount)
```

with appropriate indexes.

Do not introduce performance problems.

---

# 98. PAYMENT SUMMARY PERFORMANCE

For:

```text
GET /payments/summary
```

use database aggregation.

Respect:

```text
Data Visibility
date range
company
branch
account
customer
supplier
```

Do not calculate global totals and then filter them in application memory.

---

# 99. BRUNO TESTING

Create:

```text
bruno/
└── phase-16-payment/
    ├── payments/
    │   ├── create
    │   ├── list
    │   ├── detail
    │   ├── confirm
    │   ├── cancel
    │   └── reverse
    │
    ├── allocations/
    │   ├── allocate
    │   └── unallocate
    │
    ├── refunds/
    │   └── refund
    │
    ├── customer/
    │   └── customer-payments
    │
    ├── supplier/
    │   └── supplier-payments
    │
    ├── summary/
    │   └── summary
    │
    └── visibility/
        ├── company-scope
        ├── branch-scope
        └── account-scope
```

Follow existing Bruno environment and authentication conventions.

---

# 100. AUTOMATED TESTING

Test:

```text
create payment
confirm payment
cancel draft
reverse confirmed payment
partial payment
full payment
multiple payments → one invoice
one payment → multiple invoices
unallocated payment
overpayment
refund
partial refund
full refund
duplicate payment
idempotency
allocation concurrency
refund concurrency
visibility
permissions
cross-company protection
cross-branch protection
```

---

# 101. CUSTOMER PAYMENT TEST

Scenario:

```text
Invoice = 10,000

Payment = 3,000
```

Expected:

```text
Allocated = 3,000
Outstanding = 7,000
Payment Status = PARTIALLY_PAID
```

Second:

```text
Payment = 7,000
```

Expected:

```text
Outstanding = 0
Payment Status = PAID
```

---

# 102. MULTIPLE INVOICE TEST

Customer payment:

```text
5,000
```

Invoices:

```text
INV-001 = 2,000
INV-002 = 1,500
INV-003 = 1,500
```

Expected:

```text
Allocation total = 5,000
```

All invoices:

```text
PAID
```

---

# 103. PARTIAL ALLOCATION TEST

Payment:

```text
10,000
```

Allocation:

```text
Invoice A = 6,000
```

Expected:

```text
Allocated = 6,000
Unallocated = 4,000
```

if unallocated payments are supported.

---

# 104. SUPPLIER PAYMENT TEST

Purchase:

```text
20,000
```

Payment:

```text
12,000
```

Expected:

```text
Outstanding = 8,000
```

---

# 105. REFUND TEST

Payment:

```text
10,000
```

Refund:

```text
3,000
```

Expected:

```text
Refunded = 3,000
Refundable = 7,000
Net received = 7,000
```

Second refund:

```text
7,000
```

Expected:

```text
Refunded = 10,000
Refundable = 0
Status = REFUNDED
```

---

# 106. INVALID REFUND TEST

Payment:

```text
10,000
```

Refund:

```text
11,000
```

Expected:

```text
409 / 422
```

No database changes.

---

# 107. IMMUTABILITY TEST

Confirmed payment:

```text
amount = 10,000
```

Attempt:

```text
PATCH amount = 5,000
```

Expected:

```text
Rejected
```

Original remains:

```text
10,000
```

---

# 108. REVERSAL TEST

Payment:

```text
10,000
```

Reverse:

```text
reason = duplicate payment
```

Expected:

```text
original payment preserved
reversal recorded
audit recorded
accounting integration event prepared
```

---

# 109. DUPLICATE REQUEST TEST

Send:

```text
same payment request
same Idempotency-Key
```

multiple times.

Expected:

```text
one payment
one payment number
one audit operation
one outbox event
```

---

# 110. CONCURRENCY ALLOCATION TEST

Invoice:

```text
Outstanding = 1,000
```

Two concurrent allocations:

```text
500
700
```

Expected:

```text
Total <= 1,000
```

No:

```text
1,200
```

allocation.

---

# 111. DATA VISIBILITY TEST

Example:

```text
User A
Branch A
```

must not see:

```text
Branch B Payments
```

Also test:

```text
User A
Account A
```

must not see:

```text
Account B Payments
```

if account-level visibility is configured.

---

# 112. CROSS-COMPANY TEST

Create:

```text
Company A Payment
Company B Invoice
```

Attempt allocation.

Expected:

```text
Rejected
```

unless explicitly supported.

---

# 113. PERMISSION TEST

Test:

```text
payment.read
payment.create
payment.confirm
payment.allocate
payment.refund
payment.reverse
```

Each endpoint must reject unauthorized users.

Do not use role-name conditionals.

---

# 114. SWAGGER

Update Swagger/OpenAPI.

Document:

```text
GET /payments
GET /payments/:id
POST /payments
POST /payments/:id/confirm
POST /payments/:id/allocations
POST /payments/:id/refunds
POST /payments/:id/reverse
GET /payments/summary
GET /payments/customer
GET /payments/supplier
```

Only expose endpoints actually implemented.

Document:

```text
permissions
scope
request DTOs
responses
errors
status transitions
```

---

# 115. PERFORMANCE

Payment tables can grow significantly.

Use:

```text
pagination
indexes
aggregation
projection
date filtering
customer/supplier filtering
```

Avoid:

```text
SELECT *
```

for large lists.

Avoid N+1 queries.

---

# 116. TRANSACTION SAFETY

Critical operations should use database transactions:

```text
confirm
allocate
refund
reverse
```

Where appropriate:

```text
Payment
+
Allocation
+
Audit
+
Outbox
```

must remain consistent.

---

# 117. PAYMENT + OUTBOX TRANSACTION

Preferred:

```text
BEGIN

Confirm Payment
Create Allocation
Create Audit
Create Outbox Event

COMMIT
```

Then:

```text
Outbox
   ↓
BullMQ
   ↓
Notifications / Accounting / External Integration
```

Never publish a successful payment event before the database transaction commits.

---

# 118. PAYMENT + INVENTORY SEPARATION

Never do:

```text
Payment Confirmed
    ↓
Stock OUT
```

unless the business flow explicitly defines this.

Normally:

```text
Sales Fulfillment
    ↓
Inventory Ledger

Payment
    ↓
Receivable / Payment
```

They are separate domain operations.

---

# 119. PAYMENT + ACCOUNTING PREPARATION

Prepare future mapping:

```text
Customer Payment
    ↓
Cash/Bank
    +
Accounts Receivable
```

Supplier Payment:

```text
Accounts Payable
    ↓
Cash/Bank
```

Refund:

```text
Payment Reversal / Refund
    ↓
Accounting adjustment
```

Phase 17 will own journal creation.

---

# 120. SECURITY REVIEW

Before completion verify:

```text
[ ] Authentication required
[ ] Permission required
[ ] Company scope enforced
[ ] Branch scope enforced
[ ] Account scope enforced
[ ] Customer/supplier scope enforced
[ ] Payment account scope enforced
[ ] Cross-company allocation blocked
[ ] Cross-branch rules enforced
[ ] Client cannot control calculated totals
[ ] Client cannot control status transitions
[ ] Client cannot bypass refund limits
[ ] Client cannot reverse another scope
[ ] Sensitive payment credentials not stored
[ ] Confirmed payments immutable
```

---

# 121. DATABASE REVIEW

Verify:

```text
[ ] Foreign keys
[ ] Decimal precision
[ ] Currency relation
[ ] Payment method relation
[ ] Payment account relation
[ ] Customer/supplier relation
[ ] Allocation relation
[ ] Refund relation
[ ] Reversal relation
[ ] Unique payment number
[ ] Idempotency protection
[ ] Indexes
[ ] Timestamps
```

---

# 122. IMPLEMENTATION ORDER

Implement in this order:

```text
Step 1
Inspect frontend Payment requirements

Step 2
Inspect Phase 11 Customer/Supplier

Step 3
Inspect Phase 12 Sales payment-related flows

Step 4
Inspect Phase 13 Purchase payment-related flows

Step 5
Inspect Phase 06 Data Visibility

Step 6
Inspect Phase 08 User/Account scope

Step 7
Inspect existing Money/Currency infrastructure

Step 8
Inspect document numbering

Step 9
Inspect Audit Log

Step 10
Inspect Outbox/Event infrastructure

Step 11
Design Payment entity

Step 12
Design PaymentAllocation

Step 13
Design PaymentRefund

Step 14
Design Payment state machine

Step 15
Create migration

Step 16
Implement repository/query layer

Step 17
Implement Payment service

Step 18
Implement Payment Method integration

Step 19
Implement Payment Account integration

Step 20
Implement Customer Payment

Step 21
Implement Supplier Payment

Step 22
Implement Payment Allocation

Step 23
Implement Partial Payment

Step 24
Implement Full Payment

Step 25
Implement Unallocated Payment if required

Step 26
Implement Overpayment rules if required

Step 27
Implement Refund

Step 28
Implement Reversal

Step 29
Integrate Sales

Step 30
Integrate Purchase

Step 31
Integrate Dynamic RBAC

Step 32
Integrate Data Visibility

Step 33
Integrate Audit Log

Step 34
Integrate Outbox

Step 35
Prepare Accounting integration

Step 36
Implement idempotency

Step 37
Implement concurrency protection

Step 38
Implement indexes

Step 39
Implement DTO validation

Step 40
Implement APIs

Step 41
Implement Swagger

Step 42
Implement automated tests

Step 43
Implement Bruno tests

Step 44
Run migrations

Step 45
Run tests

Step 46
Run typecheck

Step 47
Run lint

Step 48
Run build

Step 49
Run concurrency tests

Step 50
Run security review

Step 51
Run Data Visibility review

Step 52
Run financial integrity review

Step 53
Generate Phase 16 implementation report
```

---

# 123. CRITICAL AI RULES

You MUST follow these rules:

1. Inspect existing code before implementation.
2. Inspect frontend Payment requirements.
3. Reuse Phase 11 Customer/Supplier.
4. Reuse Phase 12 Sales.
5. Reuse Phase 13 Purchase.
6. Reuse Phase 06 Dynamic RBAC.
7. Reuse Phase 06 Data Visibility.
8. Reuse Phase 08 User/Account scope.
9. Reuse existing Currency/Money utilities.
10. Reuse existing document numbering.
11. Reuse existing Audit Log.
12. Reuse existing Outbox.
13. Do not create duplicate Customer.
14. Do not create duplicate Supplier.
15. Do not create duplicate User Account.
16. Do not confuse User Account with Financial Account.
17. Do not create full Accounting in Phase 16.
18. Do not create Inventory Ledger entries from payments.
19. Do not use Redis as payment source of truth.
20. Do not use BullMQ for core payment state.
21. Do not hard-delete confirmed payments.
22. Do not freely edit confirmed payments.
23. Use reversal/refund/correction workflows.
24. Do not trust client-calculated amounts.
25. Do not trust client scope.
26. Protect cross-company allocations.
27. Protect cross-branch allocations.
28. Protect account-level visibility.
29. Protect customer/supplier visibility.
30. Protect payment-account visibility.
31. Use database transactions.
32. Protect against concurrent allocations.
33. Protect against duplicate payments.
34. Support idempotency.
35. Preserve financial history.
36. Never expose sensitive payment credentials.
37. Never claim implementation without verification.

---

# 124. DEFINITION OF DONE

Phase 16 is complete only when:

```text
[ ] Frontend Payment requirements inspected

[ ] Payment entity implemented
[ ] Payment Allocation implemented
[ ] Payment Refund implemented if required
[ ] Payment state machine implemented
[ ] Payment number implemented
[ ] Payment method implemented/reused
[ ] Payment account integrated

[ ] Customer Payment implemented
[ ] Supplier Payment implemented

[ ] Partial Payment implemented
[ ] Full Payment implemented
[ ] Multiple Payment → Invoice implemented
[ ] One Payment → Multiple Invoice implemented
[ ] Unallocated Payment implemented if required
[ ] Overpayment handled if required

[ ] Payment confirmation
[ ] Payment cancellation
[ ] Payment reversal
[ ] Refund
[ ] Partial refund
[ ] Full refund

[ ] Sales integration
[ ] Purchase integration

[ ] Dynamic RBAC
[ ] Data Visibility
[ ] Company scope
[ ] Branch scope
[ ] Account scope
[ ] Customer/Supplier scope
[ ] Payment Account scope

[ ] Audit Log
[ ] Outbox integration/preparation
[ ] Accounting integration contract

[ ] Idempotency
[ ] Concurrency protection

[ ] Payment list
[ ] Payment detail
[ ] Customer payment API
[ ] Supplier payment API
[ ] Allocation API
[ ] Refund API
[ ] Reversal API
[ ] Summary API

[ ] Database constraints
[ ] Indexes
[ ] Decimal precision
[ ] DTO validation

[ ] Automated tests
[ ] Bruno tests
[ ] Swagger

[ ] Existing tests pass
[ ] Typecheck passes
[ ] ESLint passes
[ ] Build passes

[ ] Security review completed
[ ] Data Visibility review completed
[ ] Financial integrity review completed
[ ] Performance review completed
```

---

# 125. FINAL ARCHITECTURE

The final architecture should conceptually be:

```text
                         SALES
                      Phase 12
                          │
                          │ Invoice
                          ▼
                 ┌──────────────────┐
                 │    CUSTOMER      │
                 │    OUTSTANDING   │
                 └────────┬─────────┘
                          │
                       Payment
                          │
                          ▼
                 ┌──────────────────┐
                 │     PAYMENT      │
                 │    PHASE 16      │
                 │                  │
                 │ Receipt/Payment  │
                 │ Method           │
                 │ Account          │
                 │ Status           │
                 └────────┬─────────┘
                          │
                          ▼
                 ┌──────────────────┐
                 │    ALLOCATION    │
                 │                  │
                 │ Payment → Invoice│
                 └────────┬─────────┘
                          │
                          ▼
                 ┌──────────────────┐
                 │    OUTBOX        │
                 │    PHASE 18      │
                 └────────┬─────────┘
                          │
                          ▼
                 ┌──────────────────┐
                 │   ACCOUNTING     │
                 │    PHASE 17      │
                 │                  │
                 │ Debit / Credit   │
                 │ Journal Entries  │
                 └──────────────────┘
```

Purchase side:

```text
                      PURCHASE
                      Phase 13
                          │
                          ▼
                 Supplier Outstanding
                          │
                       Payment
                          │
                          ▼
                 ┌──────────────────┐
                 │     PAYMENT      │
                 │    PHASE 16      │
                 └────────┬─────────┘
                          │
                          ▼
                    Allocation
                          │
                          ▼
                    Accounting
```

Inventory remains separate:

```text
SALE
 │
 ├──────────────► INVENTORY
 │                Phase 14
 │                    │
 │                    ▼
 │              INVENTORY LEDGER
 │                 Phase 15
 │
 └──────────────► PAYMENT
                  Phase 16
                       │
                       ▼
                  ACCOUNTING
                  Phase 17
```

---

# 126. MOST IMPORTANT DOMAIN SEPARATION

Always preserve:

```text
┌───────────────────────────────────────────┐
│ Phase 15 — Inventory Ledger               │
│                                           │
│ "How did physical stock move?"            │
└───────────────────────────────────────────┘

┌───────────────────────────────────────────┐
│ Phase 16 — Payment                        │
│                                           │
│ "How did money move?"                     │
└───────────────────────────────────────────┘

┌───────────────────────────────────────────┐
│ Phase 17 — Accounting                     │
│                                           │
│ "What accounting entry represents it?"    │
└───────────────────────────────────────────┘
```

Example:

```text
Sale Invoice = 10,000
        │
        ├───────────────┐
        │               │
        ▼               ▼
Inventory OUT        Payment
5,000 Cost           10,000 Received
        │               │
        ▼               ▼
Inventory Ledger    Payment Allocation
Phase 15            Phase 16
        │               │
        └───────┬───────┘
                ▼
          Accounting
           Phase 17
```

Never collapse these three domains into one service or one table.

---

# 127. FINAL IMPLEMENTATION REPORT

After implementation provide:

```text
Phase 16 — Payment Implementation Report

1. Frontend Payment requirements discovered
2. Existing architecture reused
3. Files created
4. Files modified
5. Entities created/modified
6. Migration
7. Payment state machine
8. Payment types
9. Payment directions
10. Payment methods
11. Payment accounts
12. Customer Payment
13. Supplier Payment
14. Payment Allocation
15. Partial Payment
16. Full Payment
17. Unallocated Payment
18. Overpayment behavior
19. Refund
20. Reversal
21. Sales integration
22. Purchase integration
23. Dynamic RBAC
24. Data Visibility
25. Account-level visibility
26. Audit Log
27. Outbox integration
28. Accounting integration contract
29. Redis usage
30. BullMQ integration point
31. Idempotency
32. Concurrency protection
33. APIs
34. Swagger
35. Automated tests
36. Bruno tests
37. Commands executed
38. Test results
39. Typecheck result
40. Lint result
41. Build result
42. Security review
43. Data Visibility review
44. Financial integrity review
45. Performance review
46. Known limitations
47. Recommended Phase 17 integration
```

---

# FINAL RULE

Before saying:

```text
Phase 16 completed
```

you MUST verify the real repository.

Run the actual:

```text
tests
typecheck
lint
build
migration validation
Bruno API tests
```

and report actual results.

Never claim that something is implemented simply because code was generated.

The implementation must be verified against the real repository.
