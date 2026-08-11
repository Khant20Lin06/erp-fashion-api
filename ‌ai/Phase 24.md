# Phase 24 — Automated Testing

## Fashion ERP Backend

## Production-Grade Testing Implementation Prompt

You are implementing **Phase 24 — Automated Testing** of the Fashion ERP Backend.

The goal of this phase is to build a **production-grade automated testing architecture** that verifies:

```text
Authentication
Authorization
Dynamic RBAC
Data Visibility
Organization Isolation
User / Employee / Account Management
Master Data
Product / Variant / Pricing
Customer / Supplier
Sales
Purchase
Inventory
Inventory Ledger
Payment
Accounting / Double Entry
Outbox
Redis
BullMQ
Notifications
Reports / Dashboard
API Security
Audit Log
```

The test suite must verify not only that APIs return the correct HTTP response, but also that:

```text
Business Rules
Database State
Transactions
Permissions
Visibility
Concurrency
Financial Integrity
Inventory Integrity
Security
Async Processing
```

are correct.

---

# 1. EXISTING STACK

Use the existing project stack:

```text
NestJS
TypeScript
MySQL
TypeORM
Redis
BullMQ
Docker
REST API
JWT
Dynamic RBAC
Data Visibility
Audit Log
Outbox Pattern
Bruno
```

Testing stack should use the existing project dependencies where possible.

Preferred:

```text
Jest
Supertest
TypeORM test infrastructure
```

Do not introduce another testing framework unless the existing repository requires it.

---

# 2. FIRST STEP — INSPECT THE EXISTING CODEBASE

Before writing tests, inspect:

```text
src/
test/
tests/
package.json
nest-cli.json
tsconfig.json
docker-compose.yml
ormconfig*
data-source*
```

Search for:

```text
*.spec.ts
*.e2e-spec.ts
describe(
it(
test(
beforeAll
afterAll
beforeEach
afterEach
jest
supertest
DataSource
TypeOrmModule
Repository
transaction
QueryRunner
Redis
BullMQ
Queue
Worker
Guard
Interceptor
Pipe
Filter
```

Also inspect every completed Phase 01–23.

Do not assume architecture that is not present.

Do not create duplicate test infrastructure.

---

# 3. TESTING PRINCIPLE

Follow:

```text
Test Pyramid
```

with:

```text
Unit Tests
    ↓
Integration Tests
    ↓
E2E / API Tests
    ↓
Critical Business Flow Tests
```

Do not make every test an E2E test.

Use the cheapest test level capable of verifying the behavior.

---

# 4. TESTING LAYERS

Implement:

```text
24.1 Test Architecture
24.2 Unit Testing
24.3 Integration Testing
24.4 E2E/API Testing
24.5 Database Testing
24.6 Authentication Testing
24.7 RBAC Testing
24.8 Data Visibility Testing
24.9 Organization Isolation Testing
24.10 Sales Testing
24.11 Purchase Testing
24.12 Inventory Testing
24.13 Payment Testing
24.14 Accounting Testing
24.15 Outbox Testing
24.16 Redis Testing
24.17 BullMQ Testing
24.18 Notification Testing
24.19 Reports Testing
24.20 API Security Testing
24.21 Audit Log Testing
24.22 Transaction / Concurrency Testing
24.23 Regression Testing
24.24 Coverage
24.25 CI Test Execution
24.26 Test Documentation
```

---

# 5. TEST ENVIRONMENT

Create a dedicated test environment.

Prefer:

```text
.env.test
```

or the project's existing test configuration.

Never use production database credentials.

Never run automated destructive tests against production.

---

# 6. TEST DATABASE

Tests should use an isolated database.

Recommended:

```text
fashion_erp_test
```

or an automatically created test database.

Never run tests against:

```text
production database
staging database
developer's personal database
```

unless explicitly configured for a safe test environment.

---

# 7. DATABASE RESET

The test environment must be deterministic.

Implement a reliable reset strategy.

Possible:

```text
beforeEach
transaction rollback
truncate
database recreation
```

Choose based on test type.

Do not blindly truncate tables that have dependency constraints.

---

# 8. TEST DATA FACTORIES

Create reusable factories/builders.

Potential:

```text
UserFactory
RoleFactory
PermissionFactory
CompanyFactory
BranchFactory
WarehouseFactory
EmployeeFactory
SalesAccountFactory
CustomerFactory
SupplierFactory
ProductFactory
ProductVariantFactory
PriceListFactory
SaleFactory
PurchaseFactory
InventoryFactory
PaymentFactory
AccountFactory
JournalEntryFactory
ReportJobFactory
```

Use the actual entities from the repository.

Do not create fictional entities that don't exist.

---

# 9. TEST FIXTURES

Create reusable fixtures for common scenarios.

Example:

```text
SuperAdminFixture
CompanyAdminFixture
SalesManagerFixture
SalesStaffFixture
WarehouseStaffFixture
AccountantFixture
```

Important:

These are test scenarios, not necessarily permanent hard-coded production roles.

The real application uses Dynamic RBAC.

---

# 10. AUTH TEST HELPER

Create reusable helpers for:

```text
register user
login user
get access token
refresh token
create authenticated request
```

Avoid repeating login code in every E2E test.

---

# 11. AUTHENTICATION UNIT TESTS

Test:

```text
password hashing
password verification
JWT generation
JWT validation
token expiration
refresh token
logout
token revocation
disabled user
invalid credentials
```

---

# 12. LOGIN TESTS

Test:

```text
valid credentials → success
wrong password → failure
unknown email → failure
disabled user → failure
missing email → validation error
missing password → validation error
malformed payload → validation error
```

Verify response does not expose sensitive information.

---

# 13. JWT TESTS

Test:

```text
valid token
expired token
malformed token
wrong signature
wrong algorithm
missing token
revoked token
```

Expected result should follow Phase 23 security rules.

---

# 14. 401 TESTS

Every protected endpoint should have a test for:

```text
missing authentication
invalid authentication
expired authentication
```

Expected:

```text
401 Unauthorized
```

unless the project's documented security policy intentionally differs.

---

# 15. RBAC TESTING

Test permission-based authorization.

Do not only test role names.

Example:

```text
sales.read
sales.create
sales.update
sales.delete
```

Test each permission.

---

# 16. DYNAMIC ROLE TESTING

Create custom roles dynamically during tests.

Example:

```text
Role:
  Sales Operator

Permissions:
  sales.read
  sales.create
```

Verify:

```text
sales.read → allowed
sales.create → allowed
sales.update → denied
sales.delete → denied
```

Do not assume predefined roles are the only possible roles.

---

# 17. PERMISSION ESCALATION TEST

Test:

```text
User A
```

cannot grant themselves:

```text
admin permission
```

or:

```text
super-admin-only permission
```

unless the authorization model explicitly allows it.

---

# 18. ROLE MODIFICATION TEST

Test:

```text
create role
update role
delete role
assign permission
remove permission
assign role to user
remove role from user
```

Verify authorization for each operation.

---

# 19. DATA VISIBILITY TESTING

This is one of the most important test categories.

Test:

```text
Company
Branch
Warehouse
Sales Account
```

visibility boundaries.

---

# 20. COMPANY ISOLATION

Create:

```text
Company A
Company B
```

Create users in both.

Verify:

```text
Company A user
→ can access A
→ cannot access B
```

and:

```text
Company B user
→ can access B
→ cannot access A
```

Test:

```text
GET
POST
PATCH
PUT
DELETE
```

where applicable.

---

# 21. BRANCH ISOLATION

Create:

```text
Branch A
Branch B
```

under the same company.

Verify unauthorized cross-branch access fails.

---

# 22. WAREHOUSE ISOLATION

Create:

```text
Warehouse A
Warehouse B
```

Verify warehouse-restricted users cannot:

```text
read stock
create movement
transfer stock
view inventory ledger
```

for unauthorized warehouses.

---

# 23. SALES ACCOUNT ISOLATION

Create:

```text
Sales Account A
Sales Account B
```

Create sales staff users.

Verify:

```text
Sales Staff A
→ sees A sales
→ cannot see B sales
```

and:

```text
Sales Manager / authorized management
→ can see overall sales
```

according to the actual visibility policy.

---

# 24. IDOR TESTING

For every important resource:

```text
GET /resource/:id
PATCH /resource/:id
DELETE /resource/:id
```

test:

```text
valid authorized ID
valid unauthorized ID
nonexistent ID
```

Ensure unauthorized resources cannot be accessed by changing IDs.

---

# 25. USER / EMPLOYEE TESTS

Test:

```text
create user
update user
disable user
enable user
assign role
remove role
assign employee
link sales account
```

Verify protected fields cannot be modified by unauthorized users.

---

# 26. MASS ASSIGNMENT TEST

Send malicious fields:

```json
{
  "name": "Test User",
  "roleId": "SUPER_ADMIN",
  "isSuperAdmin": true,
  "companyId": "another-company",
  "branchId": "another-branch"
}
```

Verify protected fields are rejected or ignored according to validation policy.

---

# 27. MASTER DATA TESTS

Test CRUD and business validation for:

```text
categories
brands
units
taxes
payment terms
customer groups
supplier groups
```

Use the actual Phase 09 modules.

---

# 28. PRODUCT TESTING

Test:

```text
product creation
variant creation
SKU uniqueness
variant relationships
pricing
price lists
price validity
duplicate SKU
invalid price
inactive product
```

---

# 29. CUSTOMER TESTING

Test:

```text
create customer
update customer
status
group
credit limit
credit terms
payment terms
opening balance
address
contact
company scope
branch scope
ledger mapping
```

---

# 30. SUPPLIER TESTING

Test equivalent supplier functionality:

```text
supplier
group
address
contact
credit terms
payment terms
opening balance
status
ledger mapping
company scope
branch scope
```

---

# 31. SALES TESTING

Sales is a critical business domain.

Test:

```text
create sale
sale items
price calculation
quantity validation
discount
tax
subtotal
grand total
customer
sales account
branch
warehouse
payment
status
cancel
```

---

# 32. SALES CALCULATION TESTS

Verify:

```text
subtotal
discount
tax
grand total
rounding
```

using deterministic test cases.

Do not rely on approximate floating-point comparisons for money.

Use the project's actual decimal strategy.

---

# 33. SALES STATUS TESTING

Test valid transitions.

Example:

```text
DRAFT
→ CONFIRMED
→ COMPLETED
```

and invalid transitions.

Example:

```text
COMPLETED
→ DRAFT
```

must fail if business rules prohibit it.

Use the actual statuses in the repository.

---

# 34. SALES CANCELLATION

Test:

```text
cancel sale
```

and verify associated effects:

```text
inventory
payment
ledger
accounting
audit
```

according to the implemented business rules.

---

# 35. PURCHASE TESTING

Test:

```text
create purchase
purchase items
supplier
pricing
discount
tax
total
warehouse
payment
status
cancel
```

---

# 36. INVENTORY TESTING

Test:

```text
stock in
stock out
adjustment
transfer
warehouse
product
variant
quantity
```

Verify stock quantities.

---

# 37. INVENTORY LEDGER TESTING

This is a critical accounting/inventory integrity area.

For every movement:

```text
opening
purchase
sale
return
adjustment
transfer
```

verify ledger entries.

---

# 38. INVENTORY CONSISTENCY

Test:

```text
Opening Stock
+
Stock In
-
Stock Out
+
Adjustments
=
Current Stock
```

according to the actual ledger rules.

---

# 39. NEGATIVE STOCK

If negative stock is prohibited:

test:

```text
available = 5
sale quantity = 6
```

must fail.

If negative stock is supported, test the actual configured behavior instead.

Do not invent business rules.

---

# 40. STOCK TRANSFER

Test:

```text
Warehouse A
→ Warehouse B
```

Verify:

```text
A decreases
B increases
ledger records created
transaction atomic
```

If any part fails:

```text
rollback
```

---

# 41. PAYMENT TESTING

Test:

```text
create payment
payment method
amount
customer/supplier
reference
status
```

and associated ledger/business effects.

---

# 42. PAYMENT VALIDATION

Test:

```text
zero amount
negative amount
excessive amount
invalid reference
duplicate payment
unauthorized payment
```

according to business rules.

---

# 43. ACCOUNTING TESTING

Accounting tests must focus on financial integrity.

Test:

```text
Chart of Accounts
Journal Entry
Journal Entry Lines
Debit
Credit
Posting
Reversal
Account balance
```

---

# 44. DOUBLE-ENTRY TEST

Every posted journal entry must satisfy:

```text
SUM(debit)
=
SUM(credit)
```

Test this invariant.

---

# 45. ACCOUNTING TRANSACTION TEST

For business operations such as:

```text
sale
purchase
payment
inventory adjustment
```

verify the correct accounting entries are generated according to the implemented rules.

Do not invent account mappings if they are not already implemented.

---

# 46. ACCOUNTING ROLLBACK TEST

Force an error during a financial transaction.

Verify:

```text
business record rollback
accounting rollback
inventory rollback
payment rollback
```

according to the transaction boundary.

---

# 47. OUTBOX TESTING

Test:

```text
business transaction
+
outbox record
```

must commit atomically when the Outbox Pattern requires it.

---

# 48. OUTBOX FAILURE TEST

Simulate:

```text
business operation success
outbox failure
```

and verify the transaction does not produce inconsistent state.

---

# 49. OUTBOX PROCESSING

Test:

```text
pending event
→ worker
→ processed
```

and:

```text
failed event
→ retry
```

according to implementation.

---

# 50. IDEMPOTENCY TESTING

For idempotent operations:

send the same request twice with the same:

```text
Idempotency-Key
```

Verify the operation is not duplicated.

Critical examples:

```text
payment
inventory transfer
journal posting
```

where implemented.

---

# 51. REDIS TESTING

Test Redis-backed functionality:

```text
cache
rate limit
token revocation
idempotency
locks
```

where applicable.

---

# 52. REDIS FAILURE TEST

Simulate Redis unavailable.

Verify each feature behaves according to its intended failure policy.

For security-sensitive functions:

```text
authorization
rate limiting
token revocation
```

do not silently fail open.

---

# 53. CACHE TESTING

Test:

```text
cache miss
cache hit
cache invalidation
cache expiration
```

Verify stale data is not returned after relevant updates.

---

# 54. CACHE ISOLATION

Critical:

User A must never receive User B's cached data.

Test cache keys for:

```text
company
branch
warehouse
sales account
user
```

where applicable.

---

# 55. BULLMQ TESTING

Test workers independently.

Example:

```text
Job created
→ Queue
→ Worker
→ Processing
→ Completed
```

---

# 56. BULLMQ FAILURE

Test:

```text
worker throws error
```

Verify:

```text
retry
backoff
failed state
```

according to configured behavior.

---

# 57. BULLMQ IDEMPOTENCY

Verify retrying a job does not duplicate critical business effects.

Especially:

```text
notifications
reports
financial operations
inventory operations
```

where applicable.

---

# 58. JOB AUTHORIZATION

Verify users cannot manipulate another user's:

```text
report job
notification
export
```

through job IDs.

---

# 59. NOTIFICATION TESTING

Test:

```text
notification creation
recipient
read/unread
mark read
authorization
```

and ensure users cannot read other users' private notifications.

---

# 60. REPORT TESTING

Test:

```text
report generation
filters
permissions
visibility
pagination
export
download
```

Verify a Sales Staff user cannot generate or download reports outside their permitted scope.

---

# 61. API SECURITY TESTING

Phase 23 security controls must be covered by automated tests.

Test:

```text
401
403
429
CORS
validation
mass assignment
IDOR
company isolation
branch isolation
warehouse isolation
sales-account isolation
```

---

# 62. RATE LIMIT TEST

Send requests beyond the configured threshold.

Expected:

```text
429 Too Many Requests
```

Verify rate limiting does not incorrectly block unrelated users when using distributed Redis-backed limits.

---

# 63. VALIDATION TEST

Test:

```text
missing required field
wrong type
invalid UUID
invalid enum
negative number
oversized string
unexpected property
invalid date
invalid decimal
```

---

# 64. SQL INJECTION TEST

Test safe handling of malicious input in:

```text
search
filter
sort
customer name
product name
SKU
query parameters
```

Example test payloads should be harmless and must not execute SQL.

---

# 65. XSS INPUT TEST

Test that user-provided text is safely handled.

Example:

```text
<script>alert(1)</script>
```

The API must not execute code or incorrectly treat it as trusted HTML.

---

# 66. PAGINATION ABUSE TEST

Test:

```text
limit=-1
limit=0
limit=99999999
page=-1
```

and verify safe validation.

---

# 67. SORTING ABUSE TEST

Test unsupported sort fields.

Verify only allowed fields can be used.

---

# 68. ERROR RESPONSE TESTING

Verify errors do not expose:

```text
SQL
stack trace
filesystem
password
JWT secret
database host
Redis credentials
internal service details
```

---

# 69. AUDIT LOG TESTING

For security-sensitive actions verify audit records.

Examples:

```text
login
failed login
role change
permission change
user disable
financial approval
report export
```

Verify:

```text
userId
action
resource
resourceId
requestId
timestamp
```

according to the implemented audit schema.

---

# 70. AUDIT LOG SECURITY

Verify audit records do not contain:

```text
password
access token
refresh token
API key
secret
```

---

# 71. TRANSACTION TESTING

Test transactional operations with intentional failures.

Example:

```text
create sale
↓
inventory update
↓
payment
↓
accounting
```

Force failure at each stage.

Verify no partial state remains when the operation should be atomic.

---

# 72. CONCURRENCY TESTING

Test simultaneous requests.

Important examples:

```text
two users selling the last item
two payments against same invoice
two stock transfers
two approvals
two journal postings
```

Verify database locking / transaction rules prevent inconsistent state.

---

# 73. RACE CONDITION TEST

Example:

```text
stock = 1

Request A → sell 1
Request B → sell 1
```

The final result must follow the actual business rule.

If only one sale is allowed:

```text
one succeeds
one fails
```

and stock must never become invalid.

---

# 74. UNIQUE CONSTRAINT TESTS

Test unique fields such as:

```text
email
SKU
invoice number
order number
reference number
account code
```

using actual project constraints.

---

# 75. SOFT DELETE TESTING

If entities use soft delete:

verify:

```text
deleted record not returned
deleted record cannot be modified
deleted record cannot be accidentally reused
```

according to business rules.

---

# 76. REST API E2E TEST STRUCTURE

Organize E2E tests by domain:

```text
test/e2e/
├── auth/
├── users/
├── rbac/
├── organization/
├── master-data/
├── products/
├── customers/
├── suppliers/
├── sales/
├── purchase/
├── inventory/
├── payments/
├── accounting/
├── reports/
├── notifications/
└── security/
```

Adapt to the existing project structure if one already exists.

---

# 77. UNIT TEST STRUCTURE

Keep unit tests close to their modules where appropriate:

```text
*.service.spec.ts
*.guard.spec.ts
*.pipe.spec.ts
*.interceptor.spec.ts
*.controller.spec.ts
```

Follow existing conventions.

---

# 78. MOCKING RULE

Unit tests may mock:

```text
Repository
Redis
Queue
External service
```

when appropriate.

But do not mock the business logic being tested.

---

# 79. INTEGRATION TEST RULE

Integration tests should use real:

```text
MySQL
TypeORM
Redis
```

where their actual interaction is part of the behavior being verified.

---

# 80. E2E TEST RULE

E2E tests should use:

```text
Nest application
HTTP
real authentication
real authorization
real database
```

for critical flows.

---

# 81. TEST NAMING

Use descriptive test names.

Good:

```text
should reject a sales request when the user cannot access the sales account
```

Bad:

```text
test1
```

---

# 82. TEST ARRANGE / ACT / ASSERT

Prefer:

```text
Arrange
Act
Assert
```

structure.

Example:

```text
Arrange:
create company
create user
assign permission

Act:
POST /sales

Assert:
201
sale created
inventory updated
audit created
```

---

# 83. TEST INVARIANTS

Define critical invariants.

Examples:

```text
Debit = Credit

Stock quantity never becomes invalid

Unauthorized user never receives restricted data

Company A cannot access Company B

Sales Staff cannot access another Sales Account

Completed accounting records cannot be silently modified

Duplicate idempotent requests do not duplicate effects
```

---

# 84. REGRESSION TESTING

Every bug fixed in future development should receive a regression test.

Do not fix a security/business bug without adding a test that would fail before the fix.

---

# 85. COVERAGE

Measure:

```text
Statements
Branches
Functions
Lines
```

But do not chase a meaningless 100% number.

Prioritize critical business logic.

---

# 86. COVERAGE TARGET

Use an appropriate baseline.

Recommended target:

```text
Overall:
≥ 80%

Critical business/security modules:
≥ 90%
```

Critical modules:

```text
Auth
RBAC
Data Visibility
Sales
Inventory
Payment
Accounting
Security
```

If the existing codebase has a different baseline, improve it incrementally rather than creating artificial tests.

---

# 87. COVERAGE THRESHOLDS

Configure Jest thresholds where appropriate.

Do not set impossible thresholds that make the project unmaintainable.

---

# 88. TEST PERFORMANCE

Avoid unnecessarily slow tests.

Use:

```text
unit tests
```

for pure business logic.

Use:

```text
integration tests
```

for database behavior.

Use:

```text
E2E
```

for critical API flows.

---

# 89. TEST PARALLELIZATION

Be careful when tests share:

```text
database
Redis
queues
```

Do not parallelize tests that can corrupt shared state.

Use isolated data or controlled workers.

---

# 90. TIME-DEPENDENT TESTS

For:

```text
JWT expiration
price validity
payment terms
reports
notifications
```

use deterministic time mocking where appropriate.

Avoid flaky tests based on real-time delays.

---

# 91. RANDOM DATA

Do not use uncontrolled random values that make failures impossible to reproduce.

If factories use random data:

ensure the seed or generated values are reproducible.

---

# 92. TEST CLEANUP

After tests:

```text
database cleanup
Redis cleanup
queue cleanup
temporary files cleanup
```

must happen reliably.

---

# 93. NO TEST POLLUTION

One test must not depend on another test's execution order.

Tests should be independently runnable where practical.

---

# 94. TEST CONFIGURATION

Add appropriate scripts.

Example:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:unit": "...",
    "test:integration": "...",
    "test:e2e": "...",
    "test:coverage": "jest --coverage"
  }
}
```

Adapt to the existing package.json rather than blindly replacing scripts.

---

# 95. DOCKER TEST ENVIRONMENT

If the project uses Docker:

provide a test environment capable of running:

```text
MySQL
Redis
BullMQ
NestJS
```

where required.

Do not accidentally connect tests to production services.

---

# 96. CI TESTING

Prepare tests for CI.

CI should run:

```text
install
lint
typecheck
unit tests
integration tests
e2e tests
coverage
build
```

according to project constraints.

---

# 97. TEST ORDER

Recommended CI order:

```text
Lint
↓
TypeCheck
↓
Unit Tests
↓
Integration Tests
↓
E2E Tests
↓
Coverage
↓
Build
```

If the repository already has a better pipeline, preserve it.

---

# 98. FAILURE REPORTING

When tests fail, output should clearly identify:

```text
test
module
expected
received
database state if relevant
```

Do not hide failures.

---

# 99. FLaky TEST DETECTION

Identify tests that pass/fail nondeterministically.

Do not simply increase timeout to hide race conditions.

Investigate:

```text
async cleanup
database state
Redis state
queue state
time
concurrency
```

---

# 100. TEST SECURITY SECRETS

Test environment secrets must not appear in:

```text
test output
CI logs
snapshots
error messages
```

---

# 101. SNAPSHOT TESTS

Use snapshots only where they provide real value.

Do not snapshot entire dynamic database responses if that makes tests fragile.

---

# 102. API RESPONSE TESTS

For API tests verify:

```text
status code
response schema
important fields
business result
database state
```

Do not assert every irrelevant field.

---

# 103. DATABASE ASSERTIONS

For critical operations:

API response alone is insufficient.

Example:

```text
POST /sales
```

must verify:

```text
sale created
sale items created
inventory updated
ledger updated
accounting entry created
audit created
outbox event created
```

according to actual implementation.

---

# 104. FINANCIAL TEST PRECISION

Money tests must use the application's decimal representation.

Avoid JavaScript floating-point assumptions such as:

```text
0.1 + 0.2 === 0.3
```

Use the project's:

```text
Decimal
string
numeric
```

strategy.

---

# 105. INVENTORY TEST PRECISION

Stock quantity calculations must respect the application's unit/precision rules.

Test:

```text
integer quantity
decimal quantity
zero quantity
negative quantity
```

only where supported.

---

# 106. ACCOUNTING TEST PRECISION

Test:

```text
debit
credit
balance
rounding
```

using exact numeric comparisons.

---

# 107. SECURITY REGRESSION SUITE

Create a dedicated group:

```text
test/security/
```

covering:

```text
401
403
IDOR
RBAC
company isolation
branch isolation
warehouse isolation
sales-account isolation
mass assignment
rate limit
validation
injection
```

---

# 108. CRITICAL BUSINESS FLOW TESTS

Create end-to-end flows.

## Flow 1 — Sales

```text
Login
→ Create Sale
→ Confirm
→ Inventory deduction
→ Payment
→ Accounting
→ Audit
→ Outbox
```

Use only steps that actually exist.

---

# 109. CRITICAL BUSINESS FLOW — PURCHASE

```text
Login
→ Create Purchase
→ Confirm
→ Inventory increase
→ Payment
→ Accounting
→ Audit
→ Outbox
```

Adapt to actual implementation.

---

# 110. CRITICAL BUSINESS FLOW — INVENTORY TRANSFER

```text
Login
→ Create Transfer
→ Confirm
→ Warehouse A decreases
→ Warehouse B increases
→ Ledger records
→ Audit
```

---

# 111. CRITICAL BUSINESS FLOW — ACCOUNTING

```text
Login
→ Create Journal Entry
→ Validate
→ Post
→ Debit = Credit
→ Audit
```

---

# 112. CRITICAL BUSINESS FLOW — RBAC

```text
Create User
→ Create Custom Role
→ Assign Permission
→ Login
→ Access allowed endpoint
→ Remove Permission
→ Access denied
```

---

# 113. CRITICAL BUSINESS FLOW — VISIBILITY

```text
Company A
→ User A
→ Sales Account A

Company B
→ User B
→ Sales Account B

User A
→ sees A
→ cannot see B
```

---

# 114. CRITICAL BUSINESS FLOW — SECURITY

```text
Unauthenticated
→ 401

Authenticated without permission
→ 403

Authorized
→ success

Unauthorized resource ID
→ denied / hidden according to policy
```

---

# 115. TEST DOCUMENTATION

Create:

```text
docs/testing/testing-strategy.md
docs/testing/test-environment.md
docs/testing/e2e-guide.md
docs/testing/security-testing.md
```

Document:

```text
how to run tests
how to reset test database
how to start Redis
how to start BullMQ
how to run E2E
how to run coverage
how to run security tests
```

---

# 116. TEST COMMAND DOCUMENTATION

Document commands such as:

```text
npm test
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:coverage
```

using the actual project package manager and scripts.

---

# 117. DEFINITION OF DONE

Phase 24 is complete only when:

```text
[ ] Test architecture established
[ ] Test environment isolated
[ ] Test database configured
[ ] Test factories created
[ ] Test fixtures created
[ ] Unit tests implemented
[ ] Integration tests implemented
[ ] E2E tests implemented
[ ] Authentication tested
[ ] JWT tested
[ ] RBAC tested
[ ] Dynamic roles tested
[ ] Permission escalation tested
[ ] Data Visibility tested
[ ] Company isolation tested
[ ] Branch isolation tested
[ ] Warehouse isolation tested
[ ] Sales Account isolation tested
[ ] IDOR tested
[ ] Mass assignment tested
[ ] Master Data tested
[ ] Product tested
[ ] Customer tested
[ ] Supplier tested
[ ] Sales tested
[ ] Purchase tested
[ ] Inventory tested
[ ] Inventory Ledger tested
[ ] Payment tested
[ ] Accounting tested
[ ] Double-entry invariant tested
[ ] Outbox tested
[ ] Redis tested
[ ] BullMQ tested
[ ] Notifications tested
[ ] Reports tested
[ ] API Security tested
[ ] Audit Log tested
[ ] Transactions tested
[ ] Concurrency tested
[ ] Idempotency tested where applicable
[ ] Regression tests implemented
[ ] Coverage measured
[ ] Critical modules have strong coverage
[ ] CI test execution prepared
[ ] No flaky tests
[ ] Test documentation completed
[ ] Full test suite passes
[ ] TypeScript passes
[ ] ESLint passes
[ ] Build passes
```

---

# 118. FINAL RULE

Do NOT measure testing quality only by:

```text
"How many tests were created?"
```

Measure it by:

```text
Can the test suite detect a real production bug?
```

The most important tests are those that prevent:

```text
Unauthorized access
Cross-company data leakage
Cross-branch data leakage
Cross-warehouse data leakage
Cross-sales-account data leakage
Privilege escalation
Incorrect inventory
Duplicate payments
Unbalanced accounting
Duplicate financial operations
Broken transactions
Lost Outbox events
Duplicate BullMQ effects
Unauthorized report downloads
Sensitive information leakage
```

The final architecture should be:

```text
                    Automated Testing
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
       Unit Tests      Integration       E2E/API
          │                │                │
          ▼                ▼                ▼
    Pure Business       MySQL/Redis       HTTP
       Logic            TypeORM/Queue     Auth/RBAC
          │                │                │
          └────────────────┼────────────────┘
                           ▼
                   Critical Flows
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
       Security         Financial        Inventory
          │             Integrity          │
          ▼                ▼                ▼
       RBAC            Accounting         Stock
       IDOR            Double Entry       Ledger
       Visibility      Payments           Transfer
                           │
                           ▼
                    Regression Suite
                           │
                           ▼
                     CI / Production
                       Confidence
```

The objective of Phase 24 is:

```text
Code works
+
Business rules work
+
Database state is correct
+
Security works
+
Permissions work
+
Visibility works
+
Transactions are atomic
+
Financial calculations are correct
+
Inventory is correct
+
Async processing is reliable
+
Future changes cannot silently break existing behavior
```

Do not consider Phase 24 complete merely because Jest runs successfully.

It is complete only when the automated test suite provides meaningful confidence that the Fashion ERP Backend is safe to evolve toward production.
