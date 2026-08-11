# Phase 22 — Reports / Dashboard

## Fashion ERP Backend

## Production-Ready Implementation Prompt

You are implementing **Phase 22 — Reports / Dashboard** of the Fashion ERP Backend.

The goal is to build a scalable reporting and dashboard architecture for the Fashion ERP/POS system.

---

# 1. PROJECT STACK

Use the existing project stack:

* NestJS
* TypeScript
* MySQL
* TypeORM
* Redis
* BullMQ
* Docker
* REST API
* Bruno
* JWT Authentication
* Dynamic RBAC
* Data Visibility
* Audit Log
* Outbox Pattern

Do not introduce another backend framework, ORM, database, or queue system.

The existing repository is the primary source of truth.

---

# 2. COMPLETED PHASES

These phases are already completed:

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
Phase 17 — Accounting / Double Entry
Phase 18 — Outbox Pattern
Phase 19 — Redis
Phase 20 — BullMQ Workers
Phase 21 — Notifications
```

Do not rewrite completed phases.

Reuse their existing entities, services, repositories, visibility rules, queue infrastructure, and shared utilities.

---

# 3. PHASE 22 OBJECTIVE

Build a production-ready:

```text
Reports
Dashboard
KPI
Analytics
Aggregation
Filtering
Date Range Reporting
Company Reporting
Branch Reporting
Warehouse Reporting
Sales Account Reporting
Inventory Reporting
Purchase Reporting
Payment Reporting
Accounting Reporting
Customer/Supplier Reporting
Export
Caching
Async Report Generation
```

The architecture must support both:

```text
Real-time / near-real-time dashboard queries
```

and:

```text
Heavy / long-running reports
```

without blocking normal API requests.

---

# 4. CORE PRINCIPLE

Do NOT treat Reports as normal CRUD.

Reports are primarily:

```text
READ / AGGREGATION / ANALYTICS
```

The architecture should conceptually be:

```text
Frontend
   │
   ▼
Report API
   │
   ├── Simple Query
   │       ↓
   │    MySQL
   │
   ├── Cached Query
   │       ↓
   │    Redis
   │
   └── Heavy Report
           ↓
        BullMQ
           ↓
        Report Worker
           ↓
        MySQL
           ↓
        File / Result
```

---

# 5. IMPORTANT ARCHITECTURAL RULE

Do not create one giant:

```text
ReportsService
```

containing every ERP report.

Separate reports by domain.

Recommended:

```text
reports/
├── sales/
├── purchase/
├── inventory/
├── payment/
├── accounting/
├── customer/
├── supplier/
├── dashboard/
└── shared/
```

Follow the actual project module structure if it differs.

---

# 6. FIRST STEP — INSPECT REPOSITORY

Before implementation, inspect:

```text
src/
modules/
common/
database/
sales/
purchase/
inventory/
payment/
accounting/
customer/
supplier/
users/
organization/
redis/
queues/
workers/
notifications/
audit/
```

Search for:

```text
dashboard
report
analytics
summary
aggregate
stats
kpi
export
csv
excel
pdf
query
repository
pagination
cache
redis
bullmq
```

Also inspect the frontend project if available through the repository.

Determine:

1. What dashboard widgets already exist?
2. What KPI cards exist?
3. What charts exist?
4. What tables exist?
5. What filters exist?
6. What date ranges exist?
7. What reports are already represented in frontend?
8. What API contracts may already be expected?
9. What Sales Account visibility exists?
10. What Company/Branch/Warehouse scope exists?

Do not invent frontend requirements when they already exist in the repository.

---

# 7. FRONTEND → BACKEND REPORT MAPPING

Create a mapping document:

```text
Frontend Dashboard Widget
        ↓
Required Metric
        ↓
Source Tables
        ↓
Filters
        ↓
Visibility Scope
        ↓
Backend Query
        ↓
Response DTO
```

For every existing dashboard/report UI, identify:

```text
Widget
Metric
Data source
Calculation
Filters
Permissions
Visibility
Refresh strategy
Cache strategy
```

---

# 8. DASHBOARD ARCHITECTURE

Dashboard should be composed from independent widgets.

Conceptually:

```text
Dashboard
├── Sales KPI
├── Purchase KPI
├── Inventory KPI
├── Payment KPI
├── Customer KPI
├── Supplier KPI
├── Accounting KPI
├── Low Stock
├── Top Products
├── Top Customers
├── Sales Trend
├── Purchase Trend
├── Payment Trend
└── Recent Activity
```

Do not force every dashboard to execute one enormous SQL query.

---

# 9. DASHBOARD WIDGET ABSTRACTION

Use a clean architecture such as:

```text
DashboardService
      │
      ├── SalesDashboardService
      ├── PurchaseDashboardService
      ├── InventoryDashboardService
      ├── PaymentDashboardService
      └── AccountingDashboardService
```

or equivalent architecture appropriate to the repository.

Avoid one huge switch statement.

---

# 10. DASHBOARD DATE RANGE

Support standard ranges where required:

```text
TODAY
YESTERDAY
THIS_WEEK
LAST_WEEK
THIS_MONTH
LAST_MONTH
THIS_QUARTER
THIS_YEAR
CUSTOM
```

Do not blindly implement every range if the frontend does not use them.

---

# 11. DATE FILTER

Every report must define clearly:

```text
date field used for filtering
timezone
inclusive/exclusive boundaries
```

Example:

```text
Sales Report
→ saleDate

Payment Report
→ paymentDate

Purchase Report
→ purchaseDate

Accounting Report
→ postingDate
```

Do not accidentally use:

```text
createdAt
```

when the business report should use:

```text
transactionDate
```

---

# 12. TIMEZONE

Follow the project's existing timezone strategy.

Do not perform inconsistent timezone conversion between reports.

For date filters:

```text
2026-08-01 → 2026-08-31
```

calculate the correct database boundaries according to the ERP timezone.

---

# 13. DATA VISIBILITY

This is a critical requirement.

Every report must respect Phase 06:

```text
Dynamic RBAC
+
Data Visibility
```

A report must NOT bypass visibility rules merely because it uses aggregate SQL.

---

# 14. USER VISIBILITY EXAMPLE

Sales Staff:

```text
Sales Staff
   ↓
only assigned Sales Account data
```

Sales Manager:

```text
Sales Manager
   ↓
branch/company sales
```

Super Admin:

```text
Super Admin
   ↓
global/company-wide data
```

Do not hard-code role names.

Use permission + visibility policy.

---

# 15. AGGREGATION VISIBILITY

This is extremely important.

Suppose:

```text
User A
```

can see only:

```text
Sales Account A
```

Then:

```text
GET /reports/sales/total
```

must calculate:

```text
SUM(visible sales only)
```

not:

```text
SUM(all sales)
```

then hide the result.

The aggregation itself must operate on the authorized dataset.

---

# 16. COMPANY SCOPE

Reports must support:

```text
Company
```

scope.

Company A users must not see Company B aggregate values.

Do not leak cross-company totals through:

```text
COUNT
SUM
AVG
MIN
MAX
```

---

# 17. BRANCH SCOPE

Branch-level users must only see authorized branches.

Example:

```text
Branch A
Branch B
Branch C
```

If user can access:

```text
Branch A + Branch B
```

the report must aggregate only:

```text
A + B
```

---

# 18. WAREHOUSE SCOPE

Inventory reports must respect Warehouse Visibility.

Examples:

```text
Stock On Hand
Stock Value
Low Stock
Stock Movement
Stock Transfer
```

must not aggregate unauthorized warehouses.

---

# 19. SALES ACCOUNT SCOPE

Sales reports must respect Sales Account visibility.

Examples:

```text
Sales Total
Sales by Staff
Sales by Account
Top Customers
Top Products
Sales Commission
Sales Trend
```

must operate on visible sales only.

---

# 20. PERMISSION DESIGN

Reports should use existing Dynamic RBAC permissions.

Potential permissions:

```text
report.sales.read
report.purchase.read
report.inventory.read
report.payment.read
report.accounting.read
report.customer.read
report.supplier.read
dashboard.read
dashboard.sales.read
dashboard.inventory.read
dashboard.accounting.read
report.export
report.async
```

Only implement permissions that match the existing permission model.

Do not create hard-coded roles.

---

# 21. SALES REPORTS

Implement reports based on actual Sales domain fields.

Potential reports:

```text
Sales Summary
Sales Trend
Sales by Date
Sales by Branch
Sales by Warehouse
Sales by Sales Account
Sales by Staff
Sales by Customer
Sales by Product
Sales by Category
Sales by Payment Method
Sales by Status
Sales Returns
Net Sales
Gross Sales
Discount Summary
Tax Summary
```

Do not implement a metric if the underlying data does not exist.

---

# 22. SALES KPI

Potential:

```text
Gross Sales
Net Sales
Sales Count
Average Order Value
Discount Total
Tax Total
Return Total
Paid Amount
Outstanding Amount
```

Clearly define each formula.

For example:

```text
Net Sales
=
Gross Sales
- Discounts
- Returns
```

Only use this formula if it matches the actual accounting/business model.

Do not assume.

---

# 23. SALES TREND

Support:

```text
daily
weekly
monthly
```

depending on selected date range.

Response concept:

```json
{
  "date": "2026-08-09",
  "sales": 125000,
  "orders": 35
}
```

Follow project DTO conventions.

---

# 24. SALES COMPARISON

If the frontend supports comparison:

```text
Current Period
vs
Previous Period
```

calculate:

```text
current
previous
difference
percentageChange
```

Example:

```text
Current Sales = 1,200,000
Previous Sales = 1,000,000
Change = 200,000
Change % = 20%
```

Handle zero previous values safely.

Do not produce:

```text
Infinity
NaN
```

---

# 25. PURCHASE REPORTS

Potential:

```text
Purchase Summary
Purchase Trend
Purchase by Supplier
Purchase by Product
Purchase by Branch
Purchase by Warehouse
Purchase Returns
Purchase Status
Outstanding Supplier Amount
Purchase Tax
```

Use actual Purchase domain fields.

---

# 26. INVENTORY REPORTS

Potential:

```text
Stock On Hand
Stock Value
Low Stock
Out of Stock
Stock Movement
Stock In
Stock Out
Stock Transfer
Inventory Adjustment
Inventory by Warehouse
Inventory by Product
Inventory by Category
```

Use Inventory Ledger where appropriate.

---

# 27. INVENTORY SOURCE OF TRUTH

Do not calculate stock using arbitrary Sales/Purchase joins if Phase 15 Inventory Ledger is the authoritative source.

Prefer:

```text
Inventory Ledger
      ↓
Stock Movement
      ↓
Stock Balance
```

according to actual implementation.

---

# 28. STOCK VALUE

Define the valuation method from the existing Inventory/Accounting implementation.

Possible methods:

```text
Average Cost
FIFO
Specific Cost
```

Do not invent valuation logic inside Reports.

Reuse the existing inventory valuation service.

---

# 29. LOW STOCK REPORT

Low stock should use:

```text
currentStock
vs
reorderLevel
```

if those fields exist.

Example:

```text
currentStock <= reorderLevel
```

Do not hard-code a threshold.

---

# 30. PAYMENT REPORTS

Potential:

```text
Payment Summary
Payments by Method
Payments by Date
Payments by Customer
Payments by Supplier
Outstanding Receivables
Outstanding Payables
Payment Status
Failed Payments
Refunds
```

Use Phase 16 Payment as source of truth.

---

# 31. RECEIVABLES

If accounting/payment architecture supports it:

```text
Total Receivable
Paid
Outstanding
Overdue
```

Do not calculate receivables independently if Accounting already provides authoritative balances.

Reuse the correct ledger/accounting source.

---

# 32. PAYABLES

Similarly:

```text
Total Payable
Paid
Outstanding
Overdue
```

must use the authoritative accounting/payment data.

---

# 33. ACCOUNTING REPORTS

Phase 17 is double-entry accounting.

Potential reports:

```text
Trial Balance
General Ledger
Profit & Loss
Balance Sheet
Cash Flow
Account Balance
Journal Summary
Debit / Credit Summary
```

Only implement reports supported by the Accounting domain.

---

# 34. ACCOUNTING SOURCE OF TRUTH

Accounting reports must use:

```text
Accounting Journal
Journal Entry
Ledger
Account
```

from Phase 17.

Do not calculate:

```text
Revenue
Expense
Profit
Asset
Liability
Equity
```

from Sales/Purchase tables directly if the accounting ledger is authoritative.

---

# 35. PROFIT & LOSS

Potential:

```text
Revenue
COGS
Gross Profit
Operating Expense
Net Profit
```

Define the formula according to the actual Chart of Accounts and accounting implementation.

Do not hard-code account IDs.

Use account classifications.

---

# 36. GENERAL LEDGER

General Ledger should support:

```text
Account
Date Range
Debit
Credit
Running Balance
Reference
```

Use pagination.

Do not load millions of journal rows into application memory.

---

# 37. TRIAL BALANCE

Return:

```text
Account
Debit
Credit
Balance
```

and verify:

```text
Total Debit = Total Credit
```

where the underlying accounting model requires it.

---

# 38. BALANCE SHEET

Use account classifications:

```text
Assets
Liabilities
Equity
```

Do not infer account type from account name.

---

# 39. CUSTOMER REPORTS

Potential:

```text
Customer Count
Active Customers
New Customers
Customer Sales
Customer Outstanding
Top Customers
Customer Purchase Frequency
```

Respect Customer visibility.

---

# 40. SUPPLIER REPORTS

Potential:

```text
Supplier Count
Active Suppliers
Purchase by Supplier
Supplier Outstanding
Top Suppliers
```

Respect Supplier visibility.

---

# 41. PRODUCT REPORTS

Potential:

```text
Top Selling Products
Low Stock Products
Product Sales
Product Profit
Product Movement
Product Stock Value
```

Do not calculate product profit unless the cost model is available.

---

# 42. CATEGORY REPORTS

Potential:

```text
Sales by Category
Purchase by Category
Inventory by Category
Profit by Category
```

Only expose Profit if accounting/cost data supports it.

---

# 43. KPI DEFINITIONS

Every KPI must have a documented definition.

Create something like:

```text
docs/architecture/report-kpi-definitions.md
```

Document:

```text
KPI Name
Formula
Source Tables
Date Field
Visibility
Permission
Cache Strategy
```

Example:

```text
Net Sales
Formula: ...
Source: Sales + Returns
Date Field: saleDate
Scope: Company + Branch + Sales Account
Permission: report.sales.read
```

---

# 44. REPORT QUERY LAYER

Do not put large reporting queries inside Controllers.

Use:

```text
Controller
   ↓
Report Service
   ↓
Report Query / Repository
   ↓
MySQL
```

For complex SQL, isolate it in dedicated query classes.

---

# 45. TYPEORM

Use TypeORM appropriately.

For simple reports:

```text
QueryBuilder
```

may be sufficient.

For complex aggregation:

```text
raw SQL
```

may be acceptable where necessary.

If raw SQL is used:

```text
parameterize everything
```

Never concatenate user input into SQL.

---

# 46. NO N+1 QUERIES

Avoid:

```text
load 100 products
→ query sales for each product
```

Instead use:

```text
GROUP BY
JOIN
aggregate query
```

where appropriate.

---

# 47. REPORT FILTER OBJECT

Create reusable validated filter DTOs.

Potential:

```text
ReportDateFilter
ReportScopeFilter
ReportPagination
```

Possible fields:

```text
from
to
companyId
branchId
warehouseId
salesAccountId
customerId
supplierId
productId
categoryId
status
```

Only expose filters allowed by visibility policy.

---

# 48. FILTER SECURITY

A user must not bypass visibility by sending:

```text
branchId=unauthorizedBranch
```

Backend must validate:

```text
requested scope
```

against:

```text
Data Visibility
```

---

# 49. QUERY RESULT SECURITY

Do not assume that because:

```text
branchId
```

was passed to the query, data is secure.

Visibility constraints must be applied at the query/data-access level.

---

# 50. DASHBOARD RESPONSE

A dashboard API may return:

```json
{
  "filters": {},
  "kpis": {},
  "charts": [],
  "tables": []
}
```

or use multiple widget endpoints.

Choose based on actual frontend architecture.

Do not create a massive response if independent widget loading is better.

---

# 51. DASHBOARD ENDPOINT STRATEGY

Consider:

```text
GET /dashboard/summary
GET /dashboard/sales
GET /dashboard/purchase
GET /dashboard/inventory
GET /dashboard/payment
GET /dashboard/accounting
```

Alternatively:

```text
GET /dashboard
```

with widget selection.

Choose the approach that matches frontend needs and performance.

---

# 52. DASHBOARD PERFORMANCE

Do not execute expensive reports every time the user opens the dashboard.

Use:

```text
Redis caching
```

for appropriate KPIs.

---

# 53. REDIS CACHE

Potential keys:

```text
dashboard:{scope}:{dateRange}:{hash}
report:{type}:{scope}:{filtersHash}
```

Do not use raw user input directly in cache keys without normalization.

---

# 54. CACHE ISOLATION

Cache keys must include all relevant visibility dimensions.

For example:

```text
companyId
branchId
warehouseId
salesAccountId
user visibility scope
date range
filters
```

Do not create:

```text
dashboard:today
```

if different users have different visibility.

That could leak data.

---

# 55. CACHE INVALIDATION

Choose a clear strategy.

Possible:

```text
TTL
```

for dashboards.

Example:

```text
30 seconds
60 seconds
5 minutes
```

Choose based on business requirements.

Do not assume one TTL is correct for every report.

---

# 56. FINANCIAL REPORT CACHE

Be careful with:

```text
Accounting
Payment
Financial balances
```

If stale data is unacceptable, use:

```text
short TTL
or
no cache
```

according to business requirements.

---

# 57. CACHE STAMPEDE

If many users request the same expensive dashboard simultaneously:

```text
100 users
→ cache expires
→ 100 DB queries
```

can overload MySQL.

Use:

```text
locking
single-flight
BullMQ precomputation
```

where appropriate.

Reuse existing locking infrastructure if available.

---

# 58. HEAVY REPORTS

Heavy reports should not block HTTP requests.

Example:

```text
Large General Ledger
Large Sales Export
Large Inventory Report
```

Use:

```text
POST /reports/jobs
      ↓
BullMQ
      ↓
Report Worker
      ↓
Generate result
```

---

# 59. ASYNC REPORT JOB

Conceptually:

```text
ReportJob
├── id
├── userId
├── type
├── status
├── filters
├── progress
├── result
├── error
├── createdAt
├── startedAt
└── completedAt
```

Adapt to existing job architecture.

---

# 60. REPORT JOB STATUS

Support:

```text
PENDING
PROCESSING
COMPLETED
FAILED
CANCELLED
```

if cancellation is actually supported.

---

# 61. REPORT JOB API

Potential:

```text
POST /reports/jobs
GET  /reports/jobs/:id
GET  /reports/jobs
```

Only expose cancellation if worker architecture supports safe cancellation.

---

# 62. REPORT JOB SECURITY

A user must only see their own report jobs unless:

```text
report.admin
```

or equivalent permission exists.

Do not allow:

```text
User A
→ GET /reports/jobs/User B
```

---

# 63. EXPORT

Support export only where useful.

Potential formats:

```text
CSV
XLSX
PDF
```

Do not generate huge PDFs synchronously.

---

# 64. EXPORT ARCHITECTURE

For small exports:

```text
HTTP
 ↓
generate
 ↓
return
```

For large exports:

```text
HTTP
 ↓
BullMQ
 ↓
Worker
 ↓
file
 ↓
download
```

---

# 65. EXPORT SECURITY

Generated report files must respect:

```text
user
company
branch
warehouse
sales account
```

visibility.

A report file must never contain unauthorized rows.

---

# 66. FILE STORAGE

If report files are generated:

inspect existing file/storage architecture.

Do not automatically introduce:

```text
S3
MinIO
```

unless required.

Reuse existing infrastructure where possible.

---

# 67. FILE EXPIRATION

Temporary report exports should have a retention policy.

Example:

```text
generated file
 ↓
expires
 ↓
cleanup
```

Do not keep large export files forever.

---

# 68. REPORT QUEUE

Reuse Phase 20 BullMQ.

Potential:

```text
erp.report
```

Do not create another queue library.

---

# 69. REPORT WORKER

Worker responsibilities:

```text
load job
validate authorization context
execute report
generate file
store result
update progress
handle failure
```

Do not trust client-supplied authorization context.

Persist enough scope information when creating the job to reproduce the authorized query safely.

---

# 70. IMPORTANT ASYNC SECURITY RULE

When creating an async report:

```text
User A
```

creates:

```text
Report Job
```

At job creation time, resolve/store the authorized scope.

Do not later execute the job as:

```text
Super Admin
```

or with unrestricted visibility.

---

# 71. REPORT SNAPSHOT

For sensitive financial reports, consider whether the generated result should represent:

```text
data at execution time
```

or:

```text
data at request time
```

Document the chosen behavior.

Do not silently assume.

---

# 72. ACCOUNTING REPORT CONSISTENCY

For accounting reports:

```text
Trial Balance
P&L
Balance Sheet
```

ensure all queries use a consistent accounting date boundary.

Do not combine different periods accidentally.

---

# 73. SALES VS ACCOUNTING CONSISTENCY

Do not assume:

```text
Sales Total
=
Accounting Revenue
```

without verifying the accounting rules.

Differences may exist due to:

```text
returns
tax
discount
posting status
payment timing
recognition rules
```

Document the actual implementation.

---

# 74. REPORT STATUS FILTERS

Define whether reports include:

```text
DRAFT
CONFIRMED
CANCELLED
RETURNED
POSTED
VOID
```

according to each domain.

Never include all statuses blindly.

---

# 75. CANCELLED RECORDS

Most financial reports should explicitly define treatment of:

```text
cancelled
voided
deleted
```

records.

Use the actual domain business rules.

---

# 76. RETURN HANDLING

Sales/Purchase reports must clearly distinguish:

```text
Gross
Returns
Net
```

Do not double-count returned transactions.

---

# 77. TAX REPORTING

If Tax exists:

```text
Tax Collected
Tax Paid
Tax by Rate
Tax by Period
```

must use actual tax data.

Do not reconstruct tax from totals using:

```text
total × rate
```

if tax lines already exist.

---

# 78. DISCOUNT REPORTING

Use actual discount fields/lines.

Support where applicable:

```text
Item Discount
Order Discount
Promotion Discount
```

Do not double-count them.

---

# 79. PAYMENT METHOD REPORT

Potential:

```text
Cash
Bank
Card
Mobile Payment
Credit
```

Use actual configured payment methods.

Do not hard-code provider names.

---

# 80. TOP PRODUCTS

Define ranking by:

```text
quantity
revenue
profit
```

The report must explicitly specify which metric is being ranked.

---

# 81. TOP CUSTOMERS

Define ranking by:

```text
sales amount
order count
outstanding balance
```

Do not ambiguously label a report as "Top Customers".

---

# 82. TOP SALES STAFF

If Sales Account/Staff exists:

```text
Sales Staff
Sales Account
```

must be clearly distinguished.

Respect existing account ownership/visibility rules.

---

# 83. RECENT ACTIVITY

Dashboard recent activity may include:

```text
recent sales
recent purchases
recent payments
recent inventory movements
recent approvals
```

Do not query every table independently if one optimized activity architecture already exists.

---

# 84. EMPTY RESULTS

Reports must return valid empty structures.

Example:

```json
{
  "total": 0,
  "items": [],
  "summary": {
    "sales": 0,
    "orders": 0
  }
}
```

Do not return:

```text
null
```

where the frontend expects a number/list.

---

# 85. NUMERIC PRECISION

Financial values must use appropriate decimal handling.

Do not use floating-point arithmetic carelessly.

Follow the existing Money/Decimal strategy.

Avoid:

```text
0.1 + 0.2 = 0.30000000000000004
```

type problems.

---

# 86. CURRENCY

If multi-currency exists:

```text
currency
exchangeRate
baseCurrency
```

must be handled correctly.

Do not sum:

```text
USD + THB + MMK
```

without conversion.

If multi-currency is not yet implemented, document the limitation.

---

# 87. REPORT RESPONSE CONTRACT

Create stable DTOs.

Example:

```text
SalesSummaryDto
SalesTrendDto
InventorySummaryDto
PaymentSummaryDto
TrialBalanceDto
DashboardSummaryDto
```

Do not return arbitrary raw database rows directly from controllers.

---

# 88. API VERSIONING

Follow the existing API versioning strategy.

Do not introduce a different versioning system for reports.

---

# 89. ERROR HANDLING

Use standard application errors.

Potential:

```text
REPORT_NOT_FOUND
INVALID_DATE_RANGE
UNAUTHORIZED_REPORT
INVALID_FILTER
REPORT_JOB_FAILED
EXPORT_FAILED
```

Use the project's existing error code convention.

---

# 90. TESTING

Implement unit/integration tests for:

```text
Sales reports
Purchase reports
Inventory reports
Payment reports
Accounting reports
Dashboard
Filters
Date ranges
Pagination
Sorting
Aggregation
Visibility
RBAC
Company scope
Branch scope
Warehouse scope
Sales Account scope
Caching
Cache isolation
Async jobs
Exports
```

---

# 91. SECURITY TESTS

Critical tests:

```text
User A cannot aggregate User B's sales
Company A cannot see Company B totals
Branch A cannot see Branch B inventory
Warehouse A cannot see Warehouse B stock
Sales Staff cannot see unauthorized Sales Accounts
Unauthorized user cannot access accounting reports
Unauthorized user cannot export restricted data
```

---

# 92. DATA LEAK TEST

Specifically test this scenario:

```text
User can see 10 sales
Database contains 10,000 sales
```

The report must calculate:

```text
SUM(10 visible sales)
```

not:

```text
SUM(10,000 sales)
```

then attempt to hide rows.

---

# 93. CACHE LEAK TEST

Test:

```text
User A
→ dashboard
→ cache created

User B
→ same dashboard
```

Expected:

```text
User B receives only User B's authorized data.
```

Never reuse User A's restricted aggregate.

---

# 94. ASYNC REPORT SECURITY TEST

Test:

```text
User A creates report
User A later loses permission
```

Define and implement the intended policy:

```text
snapshot authorization at job creation
```

or:

```text
revalidate authorization at execution
```

Document the decision.

Do not leave this ambiguous.

---

# 95. PERFORMANCE TESTS

Measure:

```text
Dashboard response time
Sales summary query
Sales trend query
Inventory summary
Trial balance
General ledger
Top products
Top customers
```

Test realistic data volumes.

Consider:

```text
100k sales
1M sales
5M inventory ledger rows
```

where practical.

---

# 96. QUERY PERFORMANCE

Inspect:

```text
EXPLAIN
EXPLAIN ANALYZE
```

for heavy queries where supported.

Identify:

```text
full table scans
bad joins
missing indexes
temporary tables
filesort
```

Optimize only based on evidence.

---

# 97. REPORT INDEXES

Add indexes based on actual query patterns.

Potential fields:

```text
transactionDate
postingDate
companyId
branchId
warehouseId
salesAccountId
customerId
supplierId
productId
status
```

Prefer composite indexes matching real WHERE/GROUP BY patterns.

Do not create excessive indexes.

---

# 98. MATERIALIZED / SUMMARY TABLES

Do not immediately create summary tables.

First implement:

```text
correct query
```

Then measure.

If a dashboard becomes too expensive:

```text
Query
 ↓
Profile
 ↓
Optimize
 ↓
Cache
 ↓
Summary table / precomputation
```

only when justified.

---

# 99. PRECOMPUTED REPORTS

For extremely heavy recurring reports, BullMQ may precompute:

```text
daily sales summary
daily inventory summary
monthly accounting summary
```

Only implement this if actual performance requirements justify it.

---

# 100. REDIS USAGE

Redis may be used for:

```text
dashboard cache
report cache
distributed locks
short-lived job state
```

Do not store authoritative financial report data only in Redis.

---

# 101. CACHE INVALIDATION STRATEGY

For dashboards, prefer predictable TTL unless event-driven invalidation is clearly required.

For financial data:

```text
short TTL
or explicit invalidation
```

depending on requirements.

Document the strategy.

---

# 102. REPORT AUDIT

Audit sensitive actions:

```text
report.export
report.async.created
report.downloaded
admin.report.access
```

Only audit what the business/security requirements require.

Do not create huge audit volume for every dashboard GET unless required.

---

# 103. REPORT ACCESS LOG

If security requirements require tracking access to sensitive financial reports, create a lightweight access log or use existing Audit Log.

Do not create duplicate audit systems.

---

# 104. DOCUMENTATION

Create/update:

```text
docs/architecture/reports.md
docs/architecture/dashboard.md
docs/architecture/report-kpi-definitions.md
```

Document:

```text
Report architecture
Dashboard architecture
Data sources
KPI formulas
Visibility rules
Permissions
Caching
Async reports
Export
BullMQ
Performance
```

---

# 105. BRUNO

Create Bruno requests for:

```text
Dashboard
Sales Reports
Purchase Reports
Inventory Reports
Payment Reports
Accounting Reports
Customer Reports
Supplier Reports
Report Jobs
Export
```

Only include implemented endpoints.

---

# 106. API EXAMPLES

Examples may include:

```text
GET /dashboard/summary

GET /reports/sales/summary
GET /reports/sales/trend
GET /reports/sales/by-product
GET /reports/sales/by-customer

GET /reports/inventory/summary
GET /reports/inventory/low-stock

GET /reports/payment/summary

GET /reports/accounting/trial-balance
GET /reports/accounting/general-ledger
GET /reports/accounting/profit-loss
```

Adapt URLs to the project's conventions.

---

# 107. NO RAW SQL INPUT

Never accept:

```text
sort=some_sql
groupBy=some_sql
where=some_sql
```

from clients.

Use whitelisted enums.

---

# 108. REPORT FILTER VALIDATION

Validate:

```text
from <= to
```

and sensible maximum ranges.

For example, a synchronous dashboard endpoint should not accidentally allow:

```text
10-year full-detail query
```

if it is intended for daily dashboard use.

---

# 109. SYNCHRONOUS VS ASYNCHRONOUS

Define a clear rule.

Synchronous:

```text
Dashboard KPI
Small summary
Small chart
Small table
```

Asynchronous:

```text
Huge detail report
Large export
Complex General Ledger
Large Excel/PDF
```

Do not block HTTP for heavy work.

---

# 110. REPORT LIMITS

Protect the API with reasonable limits.

Examples:

```text
maximum date range
maximum page size
maximum export size
maximum concurrent report jobs
```

Use configuration rather than magic constants where appropriate.

---

# 111. REPORT JOB RETRY

Use BullMQ retry.

Temporary failure:

```text
retry
```

Permanent validation failure:

```text
fail immediately
```

Do not endlessly retry invalid report filters.

---

# 112. REPORT JOB IDEMPOTENCY

If the same report request is submitted repeatedly, determine whether duplicate jobs are acceptable.

For expensive reports, consider:

```text
idempotency key
```

or request hash.

Do not introduce duplicate report generation unnecessarily.

---

# 113. DASHBOARD REFRESH

Dashboard should support:

```text
manual refresh
automatic refresh
```

if frontend requires it.

Backend must remain efficient under repeated polling.

---

# 114. REALTIME DASHBOARD

Do not make the entire dashboard dependent on WebSocket.

A safe architecture is:

```text
Dashboard API
+
optional WebSocket invalidation/event
```

WebSocket can tell frontend:

```text
dashboard data changed
```

and frontend can refresh the relevant widget.

---

# 115. NOTIFICATION INTEGRATION

Phase 21 Notifications may be used for report job completion.

Example:

```text
Large Report
   ↓
BullMQ
   ↓
Completed
   ↓
Notification
   ↓
"Your Sales Report is ready"
```

Do not send notification before report generation completes.

---

# 116. REPORT FILE SECURITY

If a report creates a file:

```text
user A
```

must not be able to guess:

```text
/user-b/report.xlsx
```

Use authorized download endpoints or signed/secure references.

Do not expose filesystem paths.

---

# 117. REPORT DOWNLOAD

Potential:

```text
GET /reports/jobs/:id/download
```

must verify:

```text
job ownership
permission
visibility
job status
file existence
expiration
```

---

# 118. ACCOUNTING EXPORT

Financial exports should include enough metadata:

```text
Company
Branch
Period
Generated At
Currency
Report Type
```

if appropriate.

---

# 119. REPORT METADATA

Reports may return:

```text
generatedAt
period
filters
currency
scope
```

so frontend can clearly display what the numbers represent.

---

# 120. REPORT CORRECTNESS

Correctness is more important than performance.

Do not optimize a report by changing its business meaning.

For example:

```text
faster wrong profit
```

is unacceptable.

---

# 121. SOURCE OF TRUTH RULE

Use the correct domain source of truth:

```text
Sales
→ Sales domain

Purchase
→ Purchase domain

Inventory
→ Inventory Ledger / Inventory domain

Payment
→ Payment domain

Accounting
→ Accounting Ledger

Customer
→ Customer domain

Supplier
→ Supplier domain
```

Do not create shadow financial logic inside Reports.

---

# 122. FINAL ARCHITECTURE

Target:

```text
                    FRONTEND
                       │
                       ▼
                ┌──────────────┐
                │ Report APIs  │
                └──────┬───────┘
                       │
            ┌──────────┼──────────┐
            │          │          │
            ▼          ▼          ▼
         Simple      Cached      Heavy
         Query       Query       Report
            │          │          │
            ▼          ▼          ▼
          MySQL      Redis      BullMQ
                                  │
                                  ▼
                           Report Worker
                                  │
                                  ▼
                                MySQL
                                  │
                                  ▼
                            File / Result
                                  │
                                  ▼
                              Notification
```

---

# 123. DEFINITION OF DONE

Phase 22 is complete only when:

```text
[ ] Repository inspected
[ ] Existing frontend dashboard/report scope inspected
[ ] Frontend → Backend report mapping documented

[ ] Report architecture implemented
[ ] Dashboard architecture implemented
[ ] Domain report separation implemented

[ ] Sales reports implemented as required
[ ] Purchase reports implemented as required
[ ] Inventory reports implemented as required
[ ] Payment reports implemented as required
[ ] Accounting reports implemented as required
[ ] Customer reports implemented as required
[ ] Supplier reports implemented as required

[ ] KPI definitions documented
[ ] Date filters implemented
[ ] Date range validation implemented
[ ] Timezone handling verified

[ ] Dynamic RBAC integrated
[ ] Data Visibility integrated
[ ] Company scope enforced
[ ] Branch scope enforced
[ ] Warehouse scope enforced
[ ] Sales Account scope enforced

[ ] Aggregate queries respect visibility
[ ] No unauthorized data leakage
[ ] Cache isolation verified

[ ] Dashboard caching implemented where appropriate
[ ] Redis cache keys include authorization scope
[ ] Cache TTL documented
[ ] Cache invalidation strategy documented

[ ] Heavy reports use BullMQ
[ ] Report Worker implemented
[ ] Report Job status implemented
[ ] Report Job authorization implemented
[ ] Report retry implemented
[ ] Report idempotency handled

[ ] Export implemented where required
[ ] CSV/XLSX/PDF strategy documented
[ ] Large export is asynchronous
[ ] Report file access is secured
[ ] File retention implemented where required

[ ] Notification integration for completed reports implemented where required

[ ] Audit integration implemented where required

[ ] Unit tests pass
[ ] Integration tests pass
[ ] Security tests pass
[ ] Visibility tests pass
[ ] Performance tests pass
[ ] TypeScript passes
[ ] ESLint passes
[ ] Build passes
[ ] Docker validation passes
[ ] Bruno collection added
[ ] Documentation updated
```

---

# 124. FINAL AI RULES

Before coding:

```text
INSPECT
   ↓
MAP FRONTEND
   ↓
IDENTIFY SOURCE OF TRUTH
   ↓
DESIGN QUERY
   ↓
APPLY DATA VISIBILITY
   ↓
IMPLEMENT
   ↓
TEST
   ↓
PROFILE
   ↓
OPTIMIZE
   ↓
VERIFY
```

Never implement Reports by blindly joining every table.

Never bypass:

```text
Dynamic RBAC
Data Visibility
Company Scope
Branch Scope
Warehouse Scope
Sales Account Scope
```

Never calculate accounting numbers from Sales/Purchase tables if the Accounting Ledger is authoritative.

Never expose unauthorized aggregate data.

Never use unrestricted Redis cache keys.

Never block normal HTTP requests with heavy report generation.

Use:

```text
MySQL
=
Source of Truth

Redis
=
Cache

BullMQ
=
Heavy Async Processing

Report Worker
=
Long-running Report Generation

Notifications
=
Report Completion Communication
```

The most important rule:

```text
REPORT RESULT
=
AGGREGATION OF AUTHORIZED DATA
```

Not:

```text
REPORT RESULT
=
AGGREGATION OF ALL DATA
+
HIDE UNAUTHORIZED ROWS
```

For every report, prove:

```text
WHO can see it?
WHAT data can they see?
WHICH date field is used?
WHICH records are included?
HOW is the metric calculated?
WHERE is the source of truth?
HOW is it cached?
WHEN should it be asynchronous?
```

Do not claim Phase 22 is complete until the actual repository and frontend scope have been inspected and the implementation has passed tests, typecheck, build, security/visibility verification, and performance validation.
