# Phase 17 — Accounting / Double Entry

## Fashion ERP Backend

## Production-Ready Implementation Prompt

You are implementing **Phase 17 — Accounting / Double Entry** of the Fashion ERP Backend.

Tech Stack:

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
Phase 16 — Payment
```

Do NOT rewrite completed phases unnecessarily.

The existing repository is the source of truth.

---

# 2. PHASE 17 OBJECTIVE

Implement a production-ready:

```text
Accounting / Double Entry
```

system.

The accounting engine must support:

```text
Chart of Accounts
Account Types
Account Categories
Account Hierarchy
Journal Entries
Journal Entry Lines
Debit / Credit
Posting
Draft Journal
Posted Journal
Journal Reversal
Fiscal Year
Accounting Period
Period Lock
General Ledger
Account Balance
Trial Balance
Opening Balance
Source Document Mapping
Customer Receivable
Supplier Payable
Cash
Bank
Inventory
Revenue
Expense
Cost of Goods Sold
Equity
```

The architecture must prepare for:

```text
Phase 18 — Outbox Pattern
Phase 19 — Redis
Phase 20 — BullMQ Workers
Phase 21 — Notifications
Phase 22 — Reports / Dashboard
Phase 23 — API Security
Phase 24 — Automated Testing
```

---

# 3. CRITICAL ACCOUNTING RULE

This phase is the financial source of truth.

The system MUST follow:

```text
TOTAL DEBIT = TOTAL CREDIT
```

for every posted journal entry.

Never allow:

```text
Debit != Credit
```

for a posted journal.

---

# 4. ACCOUNTING DOMAIN

The conceptual architecture:

```text
                         BUSINESS EVENT
                              │
             ┌────────────────┼────────────────┐
             │                │                │
             ▼                ▼                ▼
           SALES          PURCHASE          PAYMENT
             │                │                │
             └────────────────┼────────────────┘
                              ▼
                     ACCOUNTING ENGINE
                         PHASE 17
                              │
                              ▼
                     JOURNAL ENTRY
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
              DEBIT LINES          CREDIT LINES
                    │                   │
                    └─────────┬─────────┘
                              ▼
                       GENERAL LEDGER
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        Trial Balance    Account Balance    Reports
```

---

# 5. FIRST STEP — INSPECT BEFORE CODING

Before writing code, inspect the real repository.

Inspect:

```text
Phase 03 — Database Architecture
Phase 06 — Dynamic RBAC + Data Visibility
Phase 07 — Company / Branch
Phase 08 — User / Employee / Account
Phase 09 — Master Data
Phase 10 — Product / Variant / Pricing
Phase 11 — Customer / Supplier
Phase 12 — Sales
Phase 13 — Purchase
Phase 14 — Inventory
Phase 15 — Inventory Ledger
Phase 16 — Payment
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
currency
money/decimal utilities
document numbering
status enums
pagination
response format
error handling
tests
```

Do NOT create duplicate infrastructure.

---

# 6. FRONTEND ACCOUNTING INSPECTION

Inspect the actual frontend.

Search for:

```text
Accounting
Accounts
Chart of Accounts
COA
General Ledger
Ledger
Journal
Journal Entry
Debit
Credit
Trial Balance
Balance Sheet
Profit and Loss
P&L
Income Statement
Cash Flow
Opening Balance
Fiscal Year
Accounting Period
Financial Report
Expense
Revenue
Receivable
Payable
```

Also inspect:

```text
accounting pages
account forms
journal forms
ledger tables
financial reports
dashboard cards
account filters
date filters
company filters
branch filters
```

Map:

```text
Frontend Accounting Feature
        ↓
Backend API
        ↓
Accounting Service
        ↓
Accounting Entity
        ↓
Ledger
```

Do not invent frontend-specific functionality without inspecting the actual frontend.

---

# 7. ACCOUNTING ARCHITECTURE

The core entities should conceptually be:

```text
Account
AccountType
AccountCategory
JournalEntry
JournalEntryLine
FiscalYear
AccountingPeriod
OpeningBalance
```

Adapt these to the existing project architecture.

---

# 8. CHART OF ACCOUNTS

Implement a hierarchical Chart of Accounts.

Example:

```text
1000 Assets
│
├── 1100 Cash
│   ├── 1101 Main Cash
│   └── 1102 Branch Cash
│
├── 1200 Bank
│   ├── 1201 Bank A
│   └── 1202 Bank B
│
├── 1300 Accounts Receivable
│
└── 1400 Inventory

2000 Liabilities
│
├── 2100 Accounts Payable
└── 2200 Tax Payable

3000 Equity
│
└── 3100 Owner Equity

4000 Revenue
│
└── 4100 Sales Revenue

5000 Cost of Goods Sold
│
└── 5100 COGS

6000 Expenses
│
├── 6100 Salary Expense
├── 6200 Rent Expense
└── 6300 Utilities
```

Do not hard-code this exact tree unless the frontend/business requirements require it.

---

# 9. ACCOUNT ENTITY

Conceptually:

```text
Account
├── id
├── companyId
├── parentId
├── code
├── name
├── accountType
├── accountCategory
├── normalBalance
├── level
├── isGroup
├── isActive
├── isSystemAccount
├── allowManualEntry
├── currencyId
├── description
├── metadata
├── createdAt
└── updatedAt
```

Adapt to actual architecture.

---

# 10. ACCOUNT CODE

Account code must be unique within the appropriate scope.

Example:

```text
1000
1100
1101
```

Do not allow duplicate account codes inside the same company.

If multi-company architecture exists:

```text
Company A → 1000
Company B → 1000
```

may be valid.

Follow existing company scoping rules.

---

# 11. ACCOUNT HIERARCHY

Support:

```text
parent account
child account
```

Example:

```text
1000 Assets
   ↓
1100 Cash
   ↓
1101 Main Cash
```

A group account should generally not be directly used for transaction posting unless explicitly allowed.

Example:

```text
1000 Assets
```

should usually be:

```text
isGroup = true
```

while:

```text
1101 Main Cash
```

is:

```text
isGroup = false
```

---

# 12. ACCOUNT TYPES

At minimum:

```text
ASSET
LIABILITY
EQUITY
REVENUE
EXPENSE
```

Optional derived/system types may include:

```text
COGS
RECEIVABLE
PAYABLE
CASH
BANK
INVENTORY
TAX
```

Prefer using:

```text
accountType
+
accountCategory
```

rather than creating dozens of unrelated account types.

---

# 13. NORMAL BALANCE

Define:

```text
Assets      → Debit
Expenses    → Debit

Liabilities → Credit
Equity      → Credit
Revenue     → Credit
```

This is critical for account balance calculations.

---

# 14. DEBIT / CREDIT

Never store a journal line as:

```text
amount = -1000
```

Prefer:

```text
debitAmount
creditAmount
```

or a clearly defined equivalent architecture.

A single journal line must NOT contain both debit and credit unless the existing architecture explicitly defines it differently.

Correct:

```text
Cash
Debit  = 10,000
Credit = 0
```

Correct:

```text
Sales Revenue
Debit  = 0
Credit = 10,000
```

Invalid:

```text
Debit  = 5,000
Credit = 5,000
```

---

# 15. JOURNAL ENTRY

Conceptually:

```text
JournalEntry
├── id
├── journalNumber
├── companyId
├── branchId
├── fiscalYearId
├── accountingPeriodId
├── entryDate
├── postingDate
├── status
├── sourceType
├── sourceId
├── reference
├── description
├── currencyId
├── exchangeRate
├── totalDebit
├── totalCredit
├── createdBy
├── postedBy
├── postedAt
├── reversedEntryId
├── metadata
├── createdAt
└── updatedAt
```

Adapt to the existing architecture.

---

# 16. JOURNAL ENTRY LINE

Conceptually:

```text
JournalEntryLine
├── id
├── journalEntryId
├── accountId
├── debitAmount
├── creditAmount
├── currencyId
├── exchangeRate
├── baseDebitAmount
├── baseCreditAmount
├── description
├── customerId
├── supplierId
├── referenceType
├── referenceId
├── branchId
├── costCenterId
├── metadata
└── createdAt
```

Only implement dimensions actually required by the frontend/business model.

---

# 17. JOURNAL STATUS

Use explicit states:

```text
DRAFT
POSTED
REVERSED
CANCELLED
```

Do not allow arbitrary status updates.

---

# 18. JOURNAL STATE MACHINE

Conceptually:

```text
DRAFT
  │
  ▼
POSTED
  │
  ▼
REVERSED
```

Draft:

```text
editable
```

Posted:

```text
immutable
```

Reversed:

```text
original preserved
```

Never directly modify posted accounting history.

---

# 19. POSTING RULE

A journal can only be posted when:

```text
totalDebit == totalCredit
```

and:

```text
totalDebit > 0
```

unless the business explicitly supports zero journals.

Also validate:

```text
valid accounts
valid company
valid branch
valid period
valid currency
valid permissions
```

---

# 20. ATOMIC POSTING

Posting must be transactional.

Conceptually:

```text
BEGIN

Validate journal
Validate period
Validate accounts
Calculate debit
Calculate credit
Validate balanced
Change status → POSTED
Create audit
Create outbox event

COMMIT
```

If anything fails:

```text
ROLLBACK
```

---

# 21. POSTED JOURNAL IMMUTABILITY

Once:

```text
POSTED
```

do not allow:

```text
UPDATE amount
UPDATE account
DELETE line
DELETE journal
```

Instead use:

```text
REVERSAL
CORRECTION
ADJUSTMENT
```

according to business requirements.

---

# 22. JOURNAL REVERSAL

Reversal should preserve original history.

Example:

Original:

```text
Cash      Debit 10,000
Revenue   Credit 10,000
```

Reversal:

```text
Cash      Credit 10,000
Revenue   Debit 10,000
```

The original journal remains.

The reversal becomes a new journal.

---

# 23. REVERSAL RELATION

Support:

```text
originalJournal.reversedBy
```

or:

```text
reversalJournal.originalJournalId
```

Do not physically overwrite the original.

---

# 24. SOURCE DOCUMENT

Every automatically generated journal should identify its source.

Examples:

```text
SALES_INVOICE
PURCHASE_INVOICE
CUSTOMER_PAYMENT
SUPPLIER_PAYMENT
SALES_RETURN
PURCHASE_RETURN
INVENTORY_ADJUSTMENT
EXPENSE
OPENING_BALANCE
MANUAL_JOURNAL
```

Store:

```text
sourceType
sourceId
```

where appropriate.

---

# 25. SOURCE DOCUMENT IMMUTABILITY

If a journal came from:

```text
Payment
```

do not let users edit the journal independently.

The source business document should control the accounting event.

---

# 26. SALES ACCOUNTING

Prepare accounting integration with Phase 12.

Example sale:

```text
Sales Invoice = 10,000
```

Potential accounting:

```text
Accounts Receivable   Debit  10,000
Sales Revenue         Credit 10,000
```

If inventory/cost is involved:

```text
COGS                  Debit   6,000
Inventory             Credit  6,000
```

The exact accounts must come from account mapping/configuration.

Do not hard-code account IDs.

---

# 27. CASH SALE

Example:

```text
Cash Sale = 10,000
```

Potential:

```text
Cash                  Debit  10,000
Sales Revenue         Credit 10,000
```

If inventory cost:

```text
COGS                  Debit
Inventory             Credit
```

---

# 28. CREDIT SALE

Example:

```text
Credit Sale = 10,000
```

Potential:

```text
Accounts Receivable   Debit 10,000
Sales Revenue         Credit 10,000
```

Payment later:

```text
Cash/Bank             Debit 10,000
Accounts Receivable   Credit 10,000
```

---

# 29. CUSTOMER PAYMENT

Integrate Phase 16.

Example:

```text
Customer Payment = 5,000
```

Potential:

```text
Cash/Bank             Debit  5,000
Accounts Receivable   Credit 5,000
```

The Payment module owns:

```text
money received
allocation
refund
```

Accounting owns:

```text
debit
credit
journal
ledger
```

---

# 30. SUPPLIER PAYMENT

Example:

```text
Supplier Payment = 7,000
```

Potential:

```text
Accounts Payable       Debit  7,000
Cash/Bank              Credit 7,000
```

---

# 31. PURCHASE ACCOUNTING

Example:

```text
Purchase = 20,000
```

Potential:

```text
Inventory              Debit  20,000
Accounts Payable       Credit 20,000
```

Actual account selection must use account mapping.

---

# 32. PURCHASE PAYMENT

Example:

```text
Supplier Payment = 8,000
```

Potential:

```text
Accounts Payable       Debit  8,000
Cash/Bank              Credit 8,000
```

---

# 33. INVENTORY ACCOUNTING

Integrate with Phase 14/15.

Inventory movement may generate accounting such as:

```text
Inventory              Debit
Accounts Payable       Credit
```

or:

```text
COGS                   Debit
Inventory              Credit
```

depending on the actual business event.

Do not assume every inventory movement automatically creates accounting.

Define explicit posting rules.

---

# 34. INVENTORY LEDGER VS ACCOUNTING LEDGER

These are different.

Inventory Ledger:

```text
"What physical quantity moved?"
```

Accounting Ledger:

```text
"What financial value was recorded?"
```

Example:

```text
Inventory OUT
10 units
```

Inventory Ledger:

```text
-10 units
```

Accounting:

```text
COGS      Debit 6,000
Inventory Credit 6,000
```

Keep these domains separate.

---

# 35. ACCOUNT MAPPING

Implement configurable account mapping.

Example:

```text
Sales Revenue Account
Accounts Receivable Account
Accounts Payable Account
Inventory Account
COGS Account
Cash Account
Bank Account
Tax Payable Account
```

Do not hard-code:

```text
accountId = "abc123"
```

inside business services.

---

# 36. ACCOUNT MAPPING LEVELS

Support appropriate scope:

```text
Company
Branch
Warehouse
Product Category
Product
Customer Group
Supplier Group
Payment Method
```

Only implement levels required by actual business requirements.

Avoid overengineering.

---

# 37. PAYMENT METHOD ACCOUNT MAPPING

Example:

```text
Cash
   ↓
Cash Account

Bank Transfer
   ↓
Bank Account

Mobile Payment
   ↓
Mobile Wallet Account
```

Phase 16 Payment Method should connect to financial account mapping.

---

# 38. CUSTOMER RECEIVABLE ACCOUNT

Customer may map to:

```text
Accounts Receivable
```

or a specific receivable account.

Example:

```text
Customer Group A
    ↓
AR Account A
```

Use Phase 11 account/ledger mapping.

---

# 39. SUPPLIER PAYABLE ACCOUNT

Supplier may map to:

```text
Accounts Payable
```

or a specific payable account.

Reuse Phase 11 mapping.

---

# 40. TAX ACCOUNTING

If frontend supports tax:

Implement configurable:

```text
Input Tax
Output Tax
Tax Payable
Tax Receivable
```

Example sale:

```text
Sales Revenue       Credit
Output Tax          Credit
Accounts Receivable Debit
```

Do not hard-code tax rates.

Reuse existing Master Data tax configuration.

---

# 41. DISCOUNTS

If Sales/Purchase supports discount:

Accounting should correctly represent:

```text
gross amount
discount
net amount
tax
```

Do not simply post frontend totals without validating accounting rules.

---

# 42. SALES RETURNS

Potential:

```text
Sales Return
```

could reverse/reduce:

```text
Sales Revenue
Tax
Receivable/Cash
```

and inventory may be handled separately.

Do not create arbitrary journal entries.

Use source document mapping.

---

# 43. PURCHASE RETURNS

Potential:

```text
Purchase Return
```

should reverse appropriate:

```text
Inventory
Accounts Payable
Tax
```

according to actual business rules.

---

# 44. EXPENSE

If frontend has Expense Management:

Support:

```text
Expense Account       Debit
Cash/Bank             Credit
```

Example:

```text
Rent Expense          Debit 20,000
Cash                  Credit 20,000
```

Do not mix Expense with Payment incorrectly.

---

# 45. MANUAL JOURNAL

Authorized accounting users may create manual journals.

Example:

```text
Debit:
Rent Expense     10,000

Credit:
Cash             10,000
```

Manual journals must require:

```text
permission
description
date
accounts
balanced amounts
company
branch
```

---

# 46. MANUAL JOURNAL PERMISSION

Do NOT give every user:

```text
accounting.journal.create
```

Use Dynamic RBAC.

Potential permissions:

```text
account.read
account.create
account.update
account.delete

journal.read
journal.create
journal.update
journal.post
journal.reverse

ledger.read
trial_balance.read
financial_report.read
period.lock
```

Adapt to existing permission architecture.

---

# 47. DYNAMIC RBAC

Never hard-code:

```text
if role === "accountant"
```

Use:

```text
Permission
+
Data Visibility
+
Company Scope
+
Branch Scope
+
Account Scope
```

---

# 48. ACCOUNTING DATA VISIBILITY

A user may have permission:

```text
journal.read
```

but still only see:

```text
Company A
Branch A
```

according to Data Visibility.

Never return unauthorized financial records.

---

# 49. ACCOUNT-LEVEL VISIBILITY

If the system supports financial account restrictions:

```text
User A
    ↓
Allowed Account IDs
```

then:

```text
Journal
```

must only expose lines/accounts the user can access.

Be careful not to leak:

```text
total company revenue
total cash
total profit
```

through summary endpoints.

---

# 50. COMPANY SCOPE

Every accounting record must be company-safe.

Reject:

```text
Company A Journal
    ↓
Company B Account
```

unless explicitly supported.

---

# 51. BRANCH SCOPE

If branch-level accounting exists:

```text
Branch A
Branch B
```

must be respected.

Do not allow users to create:

```text
Branch A Journal
    ↓
Branch B financial account
```

unless the architecture explicitly allows shared accounts.

---

# 52. FISCAL YEAR

Implement:

```text
FiscalYear
├── id
├── companyId
├── name
├── startDate
├── endDate
├── status
└── createdAt
```

Statuses:

```text
OPEN
CLOSED
```

or a more appropriate lifecycle.

---

# 53. ACCOUNTING PERIOD

Implement:

```text
AccountingPeriod
├── id
├── fiscalYearId
├── name
├── startDate
├── endDate
├── status
└── lockedAt
```

Example:

```text
January 2026
February 2026
March 2026
```

---

# 54. PERIOD VALIDATION

Before posting:

```text
entryDate
```

must belong to:

```text
open accounting period
```

If period is closed:

```text
reject posting
```

unless an authorized adjustment workflow exists.

---

# 55. PERIOD LOCK

When locked:

```text
No new posting
No modification
No reversal
```

unless a controlled reopening/adjustment mechanism exists.

Never silently modify historical accounting.

---

# 56. FISCAL YEAR CLOSE

Do not overbuild automatic year-end closing unless frontend requirements require it.

Prepare architecture for:

```text
Revenue
Expense
Net Income
Retained Earnings
```

closing.

---

# 57. OPENING BALANCE

Support opening balances.

Example:

```text
Cash                 Debit 100,000
Inventory            Debit 200,000
AR                   Debit 50,000
AP                   Credit 80,000
Equity               Credit 270,000
```

Must balance:

```text
Debit = Credit
```

---

# 58. OPENING BALANCE ENTITY

Potential:

```text
OpeningBalance
├── id
├── companyId
├── fiscalYearId
├── accountId
├── debit
├── credit
├── currencyId
├── reference
└── createdAt
```

Or use a dedicated journal with source:

```text
OPENING_BALANCE
```

Prefer avoiding duplicate ledger mechanisms.

---

# 59. GENERAL LEDGER

General Ledger should answer:

```text
What happened to this account over time?
```

Example:

```text
Cash Account

Date       Reference     Debit    Credit    Balance
01/01      Opening       100,000     0      100,000
02/01      Sale           10,000     0      110,000
03/01      Supplier          0      5,000   105,000
```

---

# 60. LEDGER SOURCE OF TRUTH

General Ledger must derive from:

```text
POSTED JournalEntry
+
JournalEntryLine
```

Do not maintain a second independently editable ledger table unless performance requirements justify a materialized ledger.

If a denormalized ledger is introduced:

```text
Journal = source of truth
```

---

# 61. ACCOUNT BALANCE

Balance depends on normal balance.

For asset/expense:

```text
Debit - Credit
```

For liability/equity/revenue:

```text
Credit - Debit
```

Implement centrally.

Do not duplicate balance formulas across controllers.

---

# 62. TRIAL BALANCE

Trial Balance must show:

```text
Account
Debit
Credit
```

and:

```text
Total Debit = Total Credit
```

Example:

```text
Cash                100,000
Inventory           200,000
AR                   50,000
AP                              80,000
Revenue                         150,000
Equity                          120,000
```

Totals must balance.

---

# 63. TRIAL BALANCE FILTERS

Support appropriate:

```text
company
branch
fiscalYear
period
fromDate
toDate
account
accountType
```

All filters must respect Data Visibility.

---

# 64. GENERAL LEDGER API

Potential:

```http
GET /accounting/ledger
```

Filters:

```text
accountId
companyId
branchId
fromDate
toDate
customerId
supplierId
reference
```

Use pagination.

---

# 65. ACCOUNT BALANCE API

Potential:

```http
GET /accounting/accounts/:id/balance
```

Return:

```text
openingBalance
debit
credit
closingBalance
```

Do not expose unauthorized account information.

---

# 66. TRIAL BALANCE API

Potential:

```http
GET /accounting/reports/trial-balance
```

Return:

```text
accounts
totalDebit
totalCredit
balanced
```

---

# 67. JOURNAL APIs

Potential:

```http
GET    /accounting/journals
GET    /accounting/journals/:id
POST   /accounting/journals
PATCH  /accounting/journals/:id
POST   /accounting/journals/:id/post
POST   /accounting/journals/:id/reverse
```

Only implement endpoints supported by the actual architecture.

---

# 68. ACCOUNT APIs

Potential:

```http
GET    /accounting/accounts
GET    /accounting/accounts/:id
POST   /accounting/accounts
PATCH  /accounting/accounts/:id
POST   /accounting/accounts/:id/activate
POST   /accounting/accounts/:id/deactivate
```

Avoid deleting accounts that already have posted transactions.

---

# 69. ACCOUNT DEACTIVATION

If an account has history:

```text
do not delete
```

Use:

```text
isActive = false
```

An inactive account cannot receive new postings.

Historical journals remain valid.

---

# 70. GROUP ACCOUNT

Do not allow direct posting to:

```text
isGroup = true
```

unless explicitly supported.

Prefer:

```text
Group Account
    ├── Leaf Account A
    └── Leaf Account B
```

Post to leaf accounts.

---

# 71. ACCOUNT DELETE RULE

An account with posted journal history:

```text
DELETE
```

must be rejected.

Use:

```text
deactivate
```

instead.

---

# 72. JOURNAL NUMBER

Use existing document numbering infrastructure.

Example:

```text
JE-2026-000001
JE-2026-000002
```

Generate server-side.

Protect against concurrent generation.

---

# 73. CURRENCY

Accounting must respect existing currency architecture.

Use:

```text
transaction currency
base currency
exchange rate
```

if multi-currency is supported.

Never use JavaScript floating-point arithmetic for financial amounts.

Use MySQL:

```text
DECIMAL
```

---

# 74. MULTI-CURRENCY

Example:

```text
Invoice = USD 1,000
Base Currency = THB
Exchange Rate = 35
```

Potential:

```text
Transaction = USD 1,000
Base = THB 35,000
```

Store sufficient information to reproduce the historical accounting value.

Do not recalculate historical journal amounts using today's exchange rate.

---

# 75. ROUNDING

Define one centralized rounding policy.

All accounting amounts must follow it.

Do not round independently in:

```text
controller
service
repository
frontend
```

---

# 76. ACCOUNTING INTEGRATION WITH PAYMENT

Payment:

```text
Phase 16
```

creates business event:

```text
PAYMENT_CONFIRMED
```

Accounting:

```text
Phase 17
```

creates:

```text
Journal Entry
```

Example:

```text
Payment = 10,000

Debit  Cash/Bank              10,000
Credit Accounts Receivable   10,000
```

---

# 77. ACCOUNTING INTEGRATION WITH SALES

Sales:

```text
Phase 12
```

business event:

```text
SALE_CONFIRMED
```

Accounting creates appropriate journals.

Do not make Sales service directly manipulate JournalEntry rows if an accounting integration service is available.

Prefer:

```text
Sales Event
   ↓
Accounting Posting Service
   ↓
Journal
```

---

# 78. ACCOUNTING INTEGRATION WITH PURCHASE

Purchase:

```text
Phase 13
```

business event:

```text
PURCHASE_CONFIRMED
```

Accounting:

```text
Inventory/Expense Debit
Accounts Payable Credit
```

according to configuration.

---

# 79. ACCOUNTING INTEGRATION WITH INVENTORY

Inventory:

```text
Phase 15
```

business event:

```text
INVENTORY_VALUATION_EVENT
```

Accounting may create:

```text
Inventory
COGS
Adjustment
```

entries.

Do not assume every physical stock movement has a financial posting.

---

# 80. POSTING RULE ENGINE

Do not hard-code all accounting logic directly inside:

```text
SalesService
PurchaseService
PaymentService
```

Create a centralized accounting posting architecture.

Conceptually:

```text
AccountingPostingService
        │
        ├── SalesPostingRule
        ├── PurchasePostingRule
        ├── PaymentPostingRule
        ├── InventoryPostingRule
        ├── ExpensePostingRule
        └── AdjustmentPostingRule
```

Adapt to the project's module architecture.

---

# 81. ACCOUNTING POSTING SERVICE

Potential responsibilities:

```text
createDraftJournal()
validateJournal()
postJournal()
reverseJournal()
postFromSource()
```

Business modules should not duplicate:

```text
debit/credit
balance
period
account validation
```

logic.

---

# 82. ACCOUNTING RULE CONFIGURATION

Prepare configurable mappings:

```text
Sales Revenue
Purchase Inventory
COGS
Accounts Receivable
Accounts Payable
Cash
Bank
Tax
Discount
```

Do not hard-code database IDs.

---

# 83. JOURNAL DUPLICATION PROTECTION

A source event should not accidentally create duplicate journals.

Example:

```text
Payment ID = P001
```

must not create:

```text
JE-001
JE-002
```

unless intentionally retried/reprocessed.

Use a unique source reference such as:

```text
sourceType + sourceId + eventType
```

where appropriate.

---

# 84. IDEMPOTENCY

Accounting posting must be idempotent.

If:

```text
PAYMENT_CONFIRMED
```

is processed twice:

```text
one accounting effect
```

must result.

Not:

```text
two journals
```

---

# 85. OUTBOX

If Phase 18 is not yet implemented, prepare integration.

Potential events:

```text
JOURNAL_CREATED
JOURNAL_POSTED
JOURNAL_REVERSED
ACCOUNT_CREATED
ACCOUNT_DEACTIVATED
PERIOD_LOCKED
```

Once Outbox is available:

```text
DB Transaction
    ↓
Journal
    +
Outbox
    ↓
COMMIT
```

Then workers process asynchronous side effects.

---

# 86. BULLMQ

Do NOT use BullMQ for the atomic accounting posting itself.

Correct:

```text
BEGIN
Create/Post Journal
Create Outbox
COMMIT

BullMQ
    ↓
Reports
Notifications
External integrations
Cache invalidation
```

Accounting source of truth remains MySQL.

---

# 87. REDIS

Redis may be used for:

```text
account lookup cache
report cache
permission cache
idempotency
```

But never use Redis as accounting source of truth.

---

# 88. AUDIT LOG

Audit:

```text
ACCOUNT_CREATED
ACCOUNT_UPDATED
ACCOUNT_DEACTIVATED

JOURNAL_CREATED
JOURNAL_UPDATED
JOURNAL_POSTED
JOURNAL_REVERSED

PERIOD_CREATED
PERIOD_LOCKED
PERIOD_REOPENED
```

Capture:

```text
user
employee/account
company
branch
action
entity
entityId
timestamp
reason
```

Reuse existing Audit Log.

---

# 89. AUDIT IMMUTABILITY

Accounting audit records must not be editable/deletable through normal APIs.

---

# 90. ACCOUNTING PERIOD LOCK

Support:

```text
POST /accounting/periods/:id/lock
```

Only authorized users.

Once locked:

```text
new posting rejected
```

unless controlled reopen exists.

---

# 91. PERIOD REOPEN

If supported:

```text
POST /accounting/periods/:id/reopen
```

Require:

```text
special permission
reason
audit log
```

Do not allow ordinary accountants to reopen closed periods.

---

# 92. FINANCIAL REPORT PREPARATION

Prepare data for Phase 22.

Potential reports:

```text
Trial Balance
General Ledger
Balance Sheet
Profit & Loss
Cash Flow
Accounts Receivable
Accounts Payable
```

Phase 17 should provide correct accounting data.

Do not overbuild dashboards here.

---

# 93. PROFIT & LOSS

P&L is conceptually:

```text
Revenue
-
COGS
-
Expenses
=
Net Profit
```

Use posted journals only.

Do not include:

```text
draft journals
cancelled journals
```

---

# 94. BALANCE SHEET

Conceptually:

```text
Assets
=
Liabilities
+
Equity
```

Use posted accounting balances.

---

# 95. CASH FLOW PREPARATION

Cash flow should derive from accounting/payment classifications.

Do not create an independent cash source of truth.

---

# 96. ACCOUNTING QUERY PERFORMANCE

Use:

```text
indexes
aggregation
date filtering
company filtering
branch filtering
account filtering
pagination
```

Avoid loading all journal lines into application memory.

---

# 97. REQUIRED INDEXES

Review:

```text
Account:
companyId
code
parentId
accountType
isActive

JournalEntry:
companyId
branchId
journalNumber
entryDate
status
sourceType
sourceId
fiscalYearId
accountingPeriodId

JournalEntryLine:
journalEntryId
accountId
customerId
supplierId
referenceType
referenceId
```

Create composite indexes based on actual queries.

---

# 98. DATABASE CONSTRAINTS

Enforce:

```text
unique account code per scope
unique journal number per scope
foreign keys
decimal precision
valid account references
```

Use application validation + database constraints.

---

# 99. JOURNAL BALANCE VALIDATION

Before POST:

```text
SUM(debit)
=
SUM(credit)
```

Do not trust:

```text
client.totalDebit
client.totalCredit
```

Calculate from journal lines server-side.

---

# 100. JOURNAL LINE VALIDATION

Each line:

```text
debit > 0 XOR credit > 0
```

Example valid:

```text
Debit = 100
Credit = 0
```

Valid:

```text
Debit = 0
Credit = 100
```

Invalid:

```text
Debit = 100
Credit = 100
```

Invalid:

```text
Debit = 0
Credit = 0
```

unless explicitly supported.

---

# 101. MINIMUM JOURNAL LINES

A valid double-entry journal should generally contain at least:

```text
2 lines
```

Example:

```text
Debit
Credit
```

Do not allow one-sided posted journals.

---

# 102. SOURCE CONSISTENCY

If:

```text
sourceType = CUSTOMER_PAYMENT
```

then:

```text
sourceId
```

must refer to a valid Payment.

Do not allow:

```text
sourceType = CUSTOMER_PAYMENT
sourceId = random Sales ID
```

---

# 103. ACCOUNT VALIDATION

Before posting:

```text
account exists
account active
account belongs to company
account is posting account
```

Reject:

```text
inactive account
group account
cross-company account
```

where appropriate.

---

# 104. MANUAL JOURNAL RESTRICTIONS

Manual journals should require:

```text
description
reference
date
lines
```

and may require:

```text
reason
attachment
approval
```

if frontend requirements support approval workflow.

Do not implement approval workflow unless required.

---

# 105. APPROVAL PREPARATION

If the ERP needs accounting approval later, prepare:

```text
DRAFT
PENDING_APPROVAL
APPROVED
POSTED
REJECTED
```

But only implement this state machine if frontend/business requirements require approval.

Do not overengineer.

---

# 106. ACCOUNT BALANCE CALCULATION

Create centralized accounting utility/service:

```text
calculateBalance(accountId, dateRange)
```

Respect:

```text
normalBalance
```

and:

```text
opening balance
+
debits
-
credits
```

or inverse depending on account type.

---

# 107. GENERAL LEDGER CALCULATION

For a given account:

```text
Opening
+
Period Debits
-
Period Credits
=
Closing
```

for debit-normal accounts.

For credit-normal accounts, calculate according to centralized normal balance logic.

---

# 108. TRIAL BALANCE CALCULATION

Only include:

```text
POSTED journals
```

Exclude:

```text
DRAFT
CANCELLED
```

Handle:

```text
REVERSED
```

according to the reversal journal model.

---

# 109. REVERSED JOURNALS

Never simply exclude the original journal from history.

History should show:

```text
Original Journal
Reversal Journal
```

Net accounting effect:

```text
0
```

but audit history remains.

---

# 110. OPENING BALANCE + LEDGER

Opening balance should appear as the opening transaction for the appropriate fiscal year.

Do not duplicate it in both:

```text
OpeningBalance table
```

and:

```text
JournalEntry
```

unless one is clearly configuration/source and the other is posting.

Avoid double counting.

---

# 111. REPORT DATE LOGIC

Be precise with:

```text
fromDate
toDate
```

and business timezone.

Do not accidentally include:

```text
toDate + 1 day
```

incorrectly.

---

# 112. API SECURITY

All accounting endpoints require authentication.

Sensitive endpoints require explicit permissions:

```text
journal.post
journal.reverse
period.lock
period.reopen
account.create
account.update
```

Do not expose financial administration operations to normal sales users.

---

# 113. DATA VISIBILITY

Every accounting endpoint must apply:

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
```

and customer/supplier scope where applicable.

---

# 114. SALES STAFF

A sales staff user may be allowed:

```text
sales.read
own sales
own payment
```

but should NOT automatically receive:

```text
accounting.read
trial_balance.read
general_ledger.read
journal.post
```

Do not infer accounting permissions from sales permissions.

---

# 115. ACCOUNTING MANAGER

A custom role may receive:

```text
account.read
journal.read
journal.create
journal.post
ledger.read
trial_balance.read
```

depending on the organization's permission configuration.

Roles remain dynamic.

---

# 116. SUPER ADMIN

Super Admin may receive broad access, but still enforce:

```text
company scope
branch scope
audit
period rules
```

Do not bypass accounting integrity because a user is Super Admin.

---

# 117. FINANCIAL INTEGRITY

Never allow any API to create an unbalanced posted journal.

Even if:

```text
super admin
```

attempts it.

---

# 118. API ERROR HANDLING

Use existing global exception architecture.

Examples:

```text
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity
```

Errors:

```text
Journal is not balanced
Account is inactive
Group account cannot receive postings
Accounting period is closed
Journal already posted
Journal already reversed
Source document already posted
Cross-company account
Duplicate source journal
Invalid currency
Invalid exchange rate
Unauthorized account
```

---

# 119. DTOs

Potential:

```text
CreateAccountDto
UpdateAccountDto

CreateJournalDto
UpdateDraftJournalDto
PostJournalDto
ReverseJournalDto

CreateFiscalYearDto
CreateAccountingPeriodDto
LockAccountingPeriodDto
ReopenAccountingPeriodDto

LedgerQueryDto
TrialBalanceQueryDto
AccountBalanceQueryDto
```

Do not expose entities directly.

---

# 120. BRUNO

Create:

```text
bruno/
└── phase-17-accounting/
    ├── accounts/
    │   ├── create
    │   ├── list
    │   ├── detail
    │   ├── update
    │   └── deactivate
    │
    ├── journals/
    │   ├── create
    │   ├── detail
    │   ├── update-draft
    │   ├── post
    │   └── reverse
    │
    ├── periods/
    │   ├── create
    │   ├── list
    │   ├── lock
    │   └── reopen
    │
    ├── ledger/
    │   └── general-ledger
    │
    ├── reports/
    │   └── trial-balance
    │
    ├── balances/
    │   └── account-balance
    │
    └── visibility/
        ├── company-scope
        ├── branch-scope
        └── account-scope
```

Follow existing Bruno conventions.

---

# 121. AUTOMATED TESTING

Must test:

```text
Account creation
Account hierarchy
Duplicate account code
Group account
Leaf account
Account deactivation

Journal creation
Journal update
Journal balance
Unbalanced journal
Zero journal
One-line journal
Multi-line journal

Posting
Posting to inactive account
Posting to group account
Posting in closed period
Posting cross-company
Posting duplicate source

Reversal
Double reversal
Reversal balance

Customer payment posting
Supplier payment posting
Sales posting
Purchase posting
Inventory posting

Opening balance
Trial balance
General ledger
Account balance

RBAC
Data Visibility
Company scope
Branch scope
Account scope

Idempotency
Concurrency
Audit
Outbox
```

---

# 122. DOUBLE-ENTRY TEST

Test:

```text
Cash Debit 10,000
Sales Credit 10,000
```

Expected:

```text
Balanced = true
```

Then:

```text
Cash Debit 10,000
Sales Credit 9,000
```

Expected:

```text
Rejected
```

No posted journal.

---

# 123. REVERSAL TEST

Original:

```text
Cash Debit 10,000
Revenue Credit 10,000
```

Reverse:

```text
Cash Credit 10,000
Revenue Debit 10,000
```

Expected:

```text
Original remains
Reversal remains
Net effect = 0
```

---

# 124. ACCOUNT BALANCE TEST

Start:

```text
Cash = 100,000
```

Sale:

```text
Debit Cash 10,000
```

Supplier payment:

```text
Credit Cash 5,000
```

Expected:

```text
Closing Cash = 105,000
```

---

# 125. TRIAL BALANCE TEST

Create:

```text
Cash Debit 100,000
Revenue Credit 70,000
Equity Credit 30,000
```

Expected:

```text
Total Debit  = 100,000
Total Credit = 100,000
```

---

# 126. CLOSED PERIOD TEST

Create:

```text
January Period
Status = CLOSED
```

Attempt posting:

```text
entryDate = January
```

Expected:

```text
Rejected
```

No journal posted.

---

# 127. DUPLICATE SOURCE TEST

Source:

```text
Payment P001
```

Attempt accounting posting twice.

Expected:

```text
one accounting effect
```

not:

```text
two journals
```

---

# 128. DATA VISIBILITY TEST

User:

```text
Company A
Branch A
```

must not see:

```text
Company B
Branch B
```

accounting records.

Account-level restrictions must also be tested.

---

# 129. ACCOUNT DEACTIVATION TEST

Account:

```text
Cash 1101
```

has existing journal history.

Deactivate.

Expected:

```text
cannot receive new postings
historical ledger remains visible
account cannot be deleted
```

---

# 130. PERFORMANCE

Accounting can become extremely large.

Use:

```text
indexes
pagination
SQL aggregation
date filtering
account filtering
company filtering
branch filtering
```

Avoid loading all journal lines into Node.js.

---

# 131. N+1 PREVENTION

For:

```text
Trial Balance
General Ledger
```

do not execute one query per account.

Prefer:

```text
GROUP BY account_id
```

and efficient joins.

---

# 132. DATABASE TRANSACTIONS

Use transactions for:

```text
post journal
reverse journal
create opening balance
period lock
period reopen
automatic accounting event
```

where multiple records must remain consistent.

---

# 133. LOCKING / CONCURRENCY

Protect:

```text
journal posting
journal numbering
accounting period
duplicate source posting
```

against concurrent requests.

Example:

Two workers receive:

```text
PAYMENT_CONFIRMED(P001)
```

simultaneously.

Expected:

```text
one journal
```

not two.

---

# 134. ACCOUNTING SOURCE OF TRUTH

The source of truth is:

```text
POSTED JOURNAL ENTRIES
+
POSTED JOURNAL LINES
```

Reports must derive from these.

Do not use:

```text
Sales.paidAmount
Purchase.totalPaid
Payment.amount
```

as the final accounting ledger.

Those are operational data.

---

# 135. OPERATIONAL VS ACCOUNTING DATA

Keep the separation:

```text
Sales
    ↓
Operational transaction

Payment
    ↓
Operational money movement

Inventory Ledger
    ↓
Operational stock movement

Accounting
    ↓
Financial representation
```

Accounting is the financial source of truth.

---

# 136. FINAL ARCHITECTURE

```text
                     BUSINESS MODULES
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
       ▼                   ▼                   ▼
     SALES              PURCHASE            PAYMENT
   Phase 12             Phase 13           Phase 16
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                           ▼
                  ACCOUNTING EVENT
                           │
                           ▼
              ┌────────────────────────┐
              │ Accounting Posting      │
              │ Service                 │
              └────────────┬───────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Journal Entry   │
                  └────────┬────────┘
                           │
                    ┌──────┴──────┐
                    ▼             ▼
                  DEBIT         CREDIT
                    │             │
                    └──────┬──────┘
                           ▼
                   GENERAL LEDGER
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        Trial Balance   P&L       Balance Sheet
```

---

# 137. PHASE 17 DEFINITION OF DONE

Phase 17 is complete only when:

```text
[ ] Frontend Accounting requirements inspected

[ ] Chart of Accounts implemented
[ ] Account hierarchy implemented
[ ] Account types implemented
[ ] Account categories implemented
[ ] Account activation/deactivation implemented
[ ] Group/leaf account rules implemented

[ ] Journal Entry implemented
[ ] Journal Entry Lines implemented
[ ] Debit/Credit validation implemented
[ ] Journal balancing implemented
[ ] Draft Journal implemented
[ ] Posted Journal implemented
[ ] Journal reversal implemented

[ ] Fiscal Year implemented
[ ] Accounting Period implemented
[ ] Period locking implemented
[ ] Period validation implemented

[ ] Opening Balance implemented

[ ] General Ledger implemented
[ ] Account Balance implemented
[ ] Trial Balance implemented

[ ] Sales integration
[ ] Purchase integration
[ ] Payment integration
[ ] Inventory accounting integration

[ ] Customer Receivable mapping
[ ] Supplier Payable mapping
[ ] Cash mapping
[ ] Bank mapping
[ ] Revenue mapping
[ ] Expense mapping
[ ] Inventory mapping
[ ] COGS mapping
[ ] Tax mapping if required

[ ] Dynamic RBAC
[ ] Data Visibility
[ ] Company Scope
[ ] Branch Scope
[ ] Account Scope

[ ] Audit Log
[ ] Outbox integration
[ ] Idempotency
[ ] Duplicate source protection
[ ] Concurrency protection

[ ] REST APIs
[ ] DTO validation
[ ] Swagger
[ ] Bruno tests
[ ] Automated tests

[ ] Database constraints
[ ] Indexes
[ ] Decimal precision
[ ] Transaction safety

[ ] Existing tests pass
[ ] Typecheck passes
[ ] ESLint passes
[ ] Build passes

[ ] Financial integrity review completed
[ ] Security review completed
[ ] Data Visibility review completed
[ ] Performance review completed
```

---

# 138. FINAL ACCOUNTING PRINCIPLE

The most important rule:

```text
                         ACCOUNTING
                             │
                             ▼
                  ┌─────────────────────┐
                  │ POSTED JOURNAL      │
                  └──────────┬──────────┘
                             │
                 ┌───────────┴───────────┐
                 ▼                       ▼
              DEBIT                    CREDIT
                 │                       │
                 └───────────┬───────────┘
                             ▼
                    DEBIT = CREDIT
```

Every posted accounting transaction must satisfy:

```text
TOTAL DEBIT = TOTAL CREDIT
```

And:

```text
POSTED ACCOUNTING DATA
        ↓
IMMUTABLE
        ↓
REVERSAL / ADJUSTMENT
        ↓
NEVER DESTRUCTIVE EDIT
```

---

# 139. FINAL IMPLEMENTATION REPORT

After implementation provide:

```text
Phase 17 — Accounting / Double Entry Implementation Report

1. Frontend Accounting requirements discovered
2. Existing architecture reused
3. Files created
4. Files modified
5. Entities created/modified
6. Database migrations
7. Chart of Accounts structure
8. Account hierarchy
9. Account types/categories
10. Journal architecture
11. Debit/Credit implementation
12. Posting state machine
13. Reversal architecture
14. Fiscal Year
15. Accounting Period
16. Period Lock
17. Opening Balance
18. General Ledger
19. Account Balance
20. Trial Balance
21. Sales integration
22. Purchase integration
23. Payment integration
24. Inventory integration
25. Account mapping
26. Customer Receivable
27. Supplier Payable
28. Cash/Bank
29. Revenue
30. Expense
31. Inventory
32. COGS
33. Tax if implemented
34. Dynamic RBAC
35. Data Visibility
36. Company Scope
37. Branch Scope
38. Account Scope
39. Audit Log
40. Outbox integration
41. Redis usage
42. BullMQ integration
43. Idempotency
44. Concurrency protection
45. API endpoints
46. Swagger
47. Automated tests
48. Bruno tests
49. Commands executed
50. Test results
51. Typecheck result
52. Lint result
53. Build result
54. Financial integrity verification
55. Security verification
56. Performance verification
57. Known limitations
58. Recommended Phase 18 integration
```

---

# FINAL AI RULE

Before saying:

```text
Phase 17 completed
```

you MUST inspect and verify the real repository and run the actual:

```text
tests
typecheck
lint
build
migration validation
Bruno API tests
```

Do not claim success based only on generated code.

Do not rewrite completed phases unnecessarily.

Do not invent frontend functionality.

Do not hard-code account IDs.

Do not allow unbalanced posted journals.

Do not allow destructive edits to posted accounting history.

Do not bypass Dynamic RBAC or Data Visibility.

Do not use Redis/BullMQ as the accounting source of truth.

The final source of truth for financial accounting must be:

```text
POSTED JOURNAL ENTRIES
+
POSTED JOURNAL LINES
```
