# Phase 25 — Bruno API Testing

## Fashion ERP Backend

## Production-Grade Bruno API Testing Implementation Prompt

You are implementing **Phase 25 — Bruno API Testing** of the Fashion ERP Backend.

The goal of this phase is to create a complete, maintainable, production-grade **Bruno API testing collection** for the Fashion ERP Backend.

Bruno must be used as:

```text
API Testing
API Regression Testing
Manual API Verification
Authentication Testing
RBAC Verification
Data Visibility Verification
Business Flow Verification
Security Verification
API Contract Verification
CI/API Automation
```

Do NOT treat Bruno as documentation only.

---

# 1. EXISTING PROJECT

The backend uses:

```text
NestJS
TypeScript
MySQL
TypeORM
Redis
BullMQ
Docker
JWT
Dynamic RBAC
Data Visibility
Audit Log
Outbox Pattern
REST API
```

The backend has completed:

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
Phase 22 — Reports / Dashboard
Phase 23 — API Security
Phase 24 — Automated Testing
```

Before implementing Phase 25, inspect the actual repository.

Do NOT assume endpoints that do not exist.

---

# 2. FIRST STEP — INSPECT THE BACKEND

Inspect:

```text
src/
test/
package.json
.env*
docker-compose*
README*
docs/
```

Find:

```text
Controllers
Routes
HTTP methods
DTOs
Validation
Guards
Decorators
Auth endpoints
RBAC endpoints
Visibility rules
Pagination
Filtering
Sorting
Error responses
Response formats
```

Search for:

```text
@Controller
@Get
@Post
@Put
@Patch
@Delete
@ApiTags
AuthGuard
JwtGuard
RolesGuard
PermissionGuard
CurrentUser
tenant
company
branch
warehouse
salesAccount
```

Also inspect the existing Phase 24 automated tests.

Bruno tests must be consistent with the actual implementation.

---

# 3. BRUNO DIRECTORY

Create a dedicated Bruno collection.

Recommended:

```text
bruno/
└── fashion-erp/
```

or preserve an existing Bruno structure if present.

Recommended organization:

```text
bruno/
└── fashion-erp/
    ├── environments/
    ├── auth/
    ├── users/
    ├── rbac/
    ├── organization/
    ├── master-data/
    ├── products/
    ├── customers/
    ├── suppliers/
    ├── sales/
    ├── purchases/
    ├── inventory/
    ├── payments/
    ├── accounting/
    ├── outbox/
    ├── notifications/
    ├── reports/
    ├── security/
    └── README.md
```

Adapt the structure if the actual API modules use different names.

---

# 4. BRUNO ENVIRONMENTS

Create environments for at least:

```text
local
docker
```

If appropriate:

```text
staging
```

Do NOT include production credentials.

Example variables:

```text
baseUrl
apiVersion
accessToken
refreshToken

companyId
branchId
warehouseId
salesAccountId

userId
roleId
permissionId

customerId
supplierId
productId
variantId

saleId
purchaseId
paymentId
journalEntryId
```

Only create variables that correspond to actual API resources.

---

# 5. SECRET MANAGEMENT

Never hard-code:

```text
password
JWT secret
API key
database password
Redis password
production credential
```

inside Bruno request files.

Use environment variables.

---

# 6. AUTHENTICATION FLOW

Create Bruno requests for the actual authentication endpoints.

Typical flow:

```text
Register
↓
Login
↓
Extract accessToken
↓
Store token
↓
Authenticated API requests
```

Use the actual API implementation.

---

# 7. TOKEN MANAGEMENT

Create reusable authentication setup.

The goal:

```text
Login
→ accessToken
→ Bruno environment variable
→ subsequent requests use token
```

Avoid manually copying JWT tokens into every request.

---

# 8. AUTH REQUEST GROUP

Create:

```text
auth/
├── login
├── refresh-token
├── logout
├── me
```

Only include endpoints that actually exist.

---

# 9. AUTH TEST CASES

For login test:

```text
valid credentials
invalid email
invalid password
disabled user
missing credentials
invalid payload
```

Verify:

```text
HTTP status
response structure
token existence
security-sensitive fields
```

---

# 10. 401 TESTS

For protected endpoints verify:

```text
No Authorization header
Invalid token
Expired token
Malformed token
```

Expected according to Phase 23 security rules:

```text
401 Unauthorized
```

---

# 11. DYNAMIC RBAC COLLECTION

Create:

```text
rbac/
├── roles/
├── permissions/
├── role-permissions/
├── user-roles/
└── authorization/
```

Adapt to actual routes.

---

# 12. CUSTOM ROLE FLOW

Bruno must verify the actual dynamic role architecture.

Example:

```text
Create Permission
↓
Create Custom Role
↓
Assign Permission
↓
Create User
↓
Assign Role
↓
Login
↓
Access permitted endpoint
```

---

# 13. PERMISSION TEST

Create a custom role:

```text
Sales Operator
```

Assign:

```text
sales.read
sales.create
```

Verify:

```text
GET sales
→ allowed

POST sales
→ allowed

PATCH sales
→ denied

DELETE sales
→ denied
```

Use actual permission codes.

Do not hard-code fictional permission names if the backend uses different codes.

---

# 14. PERMISSION REMOVAL TEST

Flow:

```text
User
↓
Role
↓
Permission exists
↓
API allowed
↓
Remove permission
↓
API denied
```

This verifies that authorization changes actually take effect.

---

# 15. PRIVILEGE ESCALATION TEST

Attempt to use a low-privilege user to:

```text
grant themselves admin permission
assign themselves super-admin role
change another user's role
change another user's permissions
access restricted resources
```

Expected:

```text
403 Forbidden
```

or the project's documented security response.

---

# 16. DATA VISIBILITY TESTING

This is one of the most important parts of Phase 25.

Bruno must test:

```text
Company Visibility
Branch Visibility
Warehouse Visibility
Sales Account Visibility
User-specific Visibility
```

---

# 17. COMPANY ISOLATION FLOW

Create:

```text
Company A
Company B
```

Create:

```text
User A → Company A
User B → Company B
```

Create resources in both.

Verify:

```text
User A
→ sees A
→ cannot see B

User B
→ sees B
→ cannot see A
```

Test:

```text
GET
POST
PATCH
DELETE
```

where applicable.

---

# 18. BRANCH ISOLATION FLOW

Create:

```text
Branch A
Branch B
```

under the same company.

Verify branch-restricted users cannot access unauthorized branch data.

---

# 19. WAREHOUSE ISOLATION FLOW

Create:

```text
Warehouse A
Warehouse B
```

Verify:

```text
Warehouse User A
→ sees A inventory
→ cannot access B inventory
```

Test stock:

```text
read
create movement
transfer
ledger
```

according to actual endpoints.

---

# 20. SALES ACCOUNT VISIBILITY

Create:

```text
Sales Account A
Sales Account B
```

Create:

```text
Sales Staff A
Sales Staff B
Sales Manager
Super Admin
```

Expected concept:

```text
Sales Staff A
→ sees own permitted sales/account scope

Sales Staff B
→ sees own permitted sales/account scope

Sales Manager
→ sees overall sales according to policy

Super Admin
→ sees overall sales according to policy
```

Do not assume these roles exist as fixed roles.

Use the actual Dynamic RBAC implementation.

---

# 21. IDOR TESTING

For every important resource:

```text
GET /resource/:id
PATCH /resource/:id
DELETE /resource/:id
```

test:

```text
Authorized ID
Unauthorized ID
Nonexistent ID
```

Example:

```text
User A
→ requests Sale B ID
```

Expected:

```text
403
```

or:

```text
404
```

depending on the project's intentional security policy.

---

# 22. MASTER DATA

Create Bruno requests for actual Phase 09 endpoints:

```text
categories
brands
units
taxes
payment terms
customer groups
supplier groups
```

Test:

```text
create
list
get
update
delete
validation
authorization
visibility
```

---

# 23. PRODUCT API TESTING

Test actual Product endpoints:

```text
create product
get products
get product
update product
delete/deactivate product
create variant
update variant
pricing
```

Verify:

```text
SKU uniqueness
required fields
price validation
variant relationship
visibility
authorization
```

---

# 24. CUSTOMER API TESTING

Test:

```text
create
list
get
update
status
address
contact
group
credit limit
payment terms
opening balance
```

Verify company/branch scope.

---

# 25. SUPPLIER API TESTING

Test:

```text
create
list
get
update
status
address
contact
group
credit terms
payment terms
opening balance
```

Verify company/branch scope.

---

# 26. SALES API TESTING

Create a complete Bruno Sales collection.

Recommended:

```text
sales/
├── create-sale
├── list-sales
├── get-sale
├── update-sale
├── confirm-sale
├── complete-sale
├── cancel-sale
└── sales-visibility
```

Only create endpoints that actually exist.

---

# 27. SALES CREATE TEST

Verify:

```text
customer
sales account
branch
warehouse
items
quantity
price
discount
tax
total
```

according to actual DTO/business rules.

---

# 28. SALES CALCULATION TEST

Bruno should verify important financial values.

Example:

```text
subtotal
discount
tax
grandTotal
```

Do not rely only on frontend-calculated values.

Backend must be authoritative.

---

# 29. SALES AUTHORIZATION TEST

Test:

```text
Sales Staff
Sales Manager
Admin/Super Admin
```

against:

```text
create
read
update
delete
confirm
cancel
```

using actual permissions.

---

# 30. SALES VISIBILITY TEST

Create sales for:

```text
Sales Account A
Sales Account B
```

Login as Sales Staff A.

Verify list results do not contain B.

Then login as authorized management user and verify permitted overall visibility.

---

# 31. PURCHASE API TESTING

Test:

```text
create purchase
list purchases
get purchase
update purchase
confirm purchase
cancel purchase
```

according to actual API.

Verify:

```text
supplier
warehouse
items
quantity
price
tax
discount
total
```

---

# 32. INVENTORY API TESTING

Test:

```text
stock
movement
adjustment
transfer
availability
ledger
```

according to actual API.

---

# 33. INVENTORY BUSINESS FLOW

Example:

```text
Create Opening Stock
↓
Check Stock
↓
Create Sale
↓
Check Stock
↓
Verify Stock Decreased
↓
Check Inventory Ledger
```

---

# 34. STOCK TRANSFER FLOW

```text
Warehouse A
→ Transfer
→ Warehouse B
→ Confirm
→ Check A
→ Check B
→ Check Ledger
```

Verify atomic behavior.

---

# 35. NEGATIVE STOCK TEST

If negative stock is prohibited:

```text
Available = 5
Request = 6
```

must fail.

Use actual project rules.

---

# 36. PAYMENT API TESTING

Test:

```text
create payment
get payment
list payments
update/status
cancel/reverse
```

only where implemented.

Verify:

```text
amount
method
reference
customer/supplier
status
authorization
```

---

# 37. PAYMENT DUPLICATION

Where idempotency exists:

send the same request twice using the same idempotency key.

Verify:

```text
one business operation
one intended financial effect
```

---

# 38. ACCOUNTING API TESTING

Test:

```text
chart of accounts
accounts
journal entries
journal lines
posting
reversal
balances
```

according to actual API.

---

# 39. DOUBLE-ENTRY API TEST

For every posted journal entry verify:

```text
SUM(debit) = SUM(credit)
```

Bruno test scripts must verify the invariant.

---

# 40. ACCOUNTING SECURITY

Verify a user without accounting permissions cannot:

```text
create journal
post journal
reverse journal
modify financial records
```

according to actual permissions.

---

# 41. OUTBOX API / SYSTEM TESTING

If Outbox is not directly exposed through REST, test it indirectly through business operations.

Example:

```text
POST Sale
↓
Query resulting state
↓
Verify Outbox event exists
```

Use an internal/admin endpoint only if one actually exists.

Do not expose new production endpoints solely for testing unless explicitly justified.

---

# 42. REDIS TESTING

Bruno should indirectly verify Redis-backed behavior where it affects APIs:

```text
rate limiting
cache
idempotency
token revocation
```

Do not make Bruno dependent on implementation details that are not observable through the API unless required.

---

# 43. RATE LIMIT TESTING

Send requests rapidly enough to exceed configured limits.

Verify:

```text
429 Too Many Requests
```

and appropriate response headers/body if implemented.

Do not create an excessively aggressive test that destabilizes the environment.

---

# 44. VALIDATION TESTING

Every major POST/PATCH endpoint should include invalid payload tests.

Examples:

```text
missing required field
wrong data type
invalid UUID
invalid enum
negative amount
negative quantity
invalid date
oversized string
unexpected property
```

Expected:

```text
400 Bad Request
```

or actual validation behavior.

---

# 45. API ERROR CONTRACT

Verify error responses have a predictable structure.

Example:

```json
{
  "statusCode": 400,
  "message": "...",
  "error": "Bad Request"
}
```

Use the actual response contract.

Do not force the application into this format if it uses another documented format.

---

# 46. SECURITY INPUT TESTING

Use safe payloads to test:

```text
SQL injection-like input
XSS-like input
invalid sort field
invalid filter
path traversal-like input
```

The purpose is to verify validation and safe handling.

Do not use destructive payloads.

---

# 47. PAGINATION TESTING

For list endpoints test:

```text
page=1
page=2
limit=10
limit=50
empty result
```

and invalid values:

```text
page=0
page=-1
limit=0
limit=-1
very large limit
```

---

# 48. FILTER TESTING

Where filtering exists, test:

```text
valid filter
multiple filters
empty filter
invalid filter
unauthorized filter
cross-company filter
```

---

# 49. SORT TESTING

Test:

```text
valid sort field
ascending
descending
invalid sort field
```

Verify arbitrary SQL fields cannot be injected through sorting.

---

# 50. AUDIT LOG VERIFICATION

For important operations:

```text
login
role change
permission change
user disable
sale
purchase
payment
journal posting
inventory adjustment
```

verify the corresponding audit behavior if an API or observable mechanism exists.

---

# 51. REPORT API TESTING

Test:

```text
dashboard
sales report
purchase report
inventory report
financial report
```

only where endpoints exist.

Verify:

```text
filters
date range
company scope
branch scope
warehouse scope
sales account scope
permission
```

---

# 52. REPORT DATA VISIBILITY

Important:

```text
Sales Staff
→ restricted report

Sales Manager
→ broader report

Super Admin
→ overall report
```

according to actual RBAC and visibility policy.

---

# 53. BRUNO REQUEST VARIABLES

Prefer variables instead of hard-coded IDs.

Example:

```text
{{baseUrl}}
{{accessToken}}
{{companyId}}
{{branchId}}
{{warehouseId}}
{{customerId}}
{{productId}}
```

This makes the collection reusable.

---

# 54. VARIABLE CHAINING

Where Bruno supports scripts/hooks, automatically capture IDs.

Example:

```text
Create Customer
→ extract customerId

Create Product
→ extract productId

Create Sale
→ extract saleId
```

Then use:

```text
{{customerId}}
{{productId}}
{{saleId}}
```

in later requests.

---

# 55. AUTH TOKEN CHAINING

Login should automatically store:

```text
accessToken
refreshToken
```

if supported by the API.

Subsequent requests use:

```text
Authorization: Bearer {{accessToken}}
```

---

# 56. BRUNO TEST SCRIPT PRINCIPLE

Each important request should verify at least:

```text
HTTP status
response shape
critical business values
```

For critical business operations also verify database-visible consequences through API endpoints.

---

# 57. DO NOT OVER-ASSERT

Do not assert unstable fields such as:

```text
timestamps
random UUIDs
generated IDs
```

unless the test is specifically checking their format/existence.

---

# 58. DO ASSERT IMPORTANT FIELDS

Examples:

```text
status
total
quantity
permission
visibility
balance
debit
credit
warehouse
salesAccount
```

---

# 59. BRUNO TEST TAGGING

Organize requests logically into:

```text
smoke
regression
security
business-flow
```

If the Bruno version/project conventions support tags or equivalent organization, use them.

---

# 60. SMOKE TEST SUITE

Create a minimal smoke suite:

```text
Health
Login
Authenticated /me
Create/read basic master data
Create/read product
Create/read customer
Create sale
Check inventory
```

Use actual available endpoints.

Purpose:

```text
Is the backend alive and basically functional?
```

---

# 61. REGRESSION SUITE

Regression should cover:

```text
Auth
RBAC
Visibility
Sales
Purchase
Inventory
Payment
Accounting
Security
```

---

# 62. SECURITY SUITE

Create a dedicated security collection covering:

```text
401
403
IDOR
RBAC
privilege escalation
company isolation
branch isolation
warehouse isolation
sales-account isolation
mass assignment
rate limiting
validation
```

---

# 63. BUSINESS FLOW SUITE

Create complete flows:

```text
RBAC Flow
Sales Flow
Purchase Flow
Inventory Flow
Payment Flow
Accounting Flow
```

Each flow should use variables generated by previous requests.

---

# 64. TEST DATA STRATEGY

Bruno tests must not depend on random existing database data.

Preferred flow:

```text
Setup
↓
Create required data
↓
Test
↓
Cleanup if safe
```

or use a dedicated test database.

---

# 65. TEST USER STRATEGY

Create test users representing permission scenarios.

For example:

```text
super admin
sales manager
sales staff A
sales staff B
warehouse staff
accountant
read-only user
```

These are test fixtures/scenarios.

Use dynamic roles where possible.

---

# 66. DO NOT ASSUME FIXED ROLE ARCHITECTURE

The application uses:

```text
Dynamic RBAC
```

Therefore tests should verify:

```text
Role
+
Permission
+
Scope
+
Visibility
```

rather than simply:

```text
if role == "SALES_STAFF"
```

---

# 67. DATA VISIBILITY TEST MATRIX

Create a test matrix covering:

```text
                 Company  Branch  Warehouse  Sales Account
Super Admin         ✓       ✓        ✓           ✓
Manager             ✓       ✓        ✓           ✓
Staff A             ✓       ✓        scope       A
Staff B             ✓       ✓        scope       B
```

Do not assume this exact matrix if the actual implementation differs.

Generate the matrix from the actual authorization rules.

---

# 68. API CONTRACT CONSISTENCY

Bruno should help detect:

```text
wrong status codes
missing fields
wrong field names
unexpected response changes
validation changes
authorization regressions
```

---

# 69. NO DUPLICATE TEST LOGIC

Do not duplicate the entire Jest suite in Bruno.

Use:

```text
Jest
→ internal logic/database/integration

Bruno
→ HTTP/API/authorization/business-flow verification
```

The two layers complement each other.

---

# 70. BRUNO VS JEST RESPONSIBILITY

Use this boundary:

```text
Jest:
Business logic
Services
Repositories
Guards
Database transactions
Concurrency
Workers
Internal components

Bruno:
HTTP
Authentication
Authorization
API contract
API validation
Data visibility
Business flows
Security regression
Real API behavior
```

---

# 71. CI EXECUTION

If the repository supports Bruno CLI execution, prepare CI execution.

The goal:

```text
CI
↓
Start Docker dependencies
↓
Start backend
↓
Run database migrations
↓
Seed test data
↓
Run Bruno collection
↓
Report failures
```

Use the project's actual available Bruno CLI/tooling.

Do not invent unsupported CLI commands.

---

# 72. LOCAL EXECUTION

Document:

```text
How to open collection in Bruno
How to select environment
How to authenticate
How to run a request
How to run a folder
How to run smoke tests
How to run regression tests
How to run security tests
```

---

# 73. README

Create:

```text
bruno/fashion-erp/README.md
```

Include:

```text
Purpose
Folder structure
Environment setup
Variables
Authentication
Test data
Running requests
Running collections
Smoke testing
Regression testing
Security testing
CI usage
Troubleshooting
```

---

# 74. TEST NAMING

Use descriptive names.

Good:

```text
Create Sale — authorized sales staff
Get Sale — unauthorized sales account denied
List Sales — sales staff sees own account only
Post Journal — debit must equal credit
```

Bad:

```text
test1
sale2
request-new
```

---

# 75. HTTP METHOD COVERAGE

Where applicable test:

```text
GET
POST
PUT
PATCH
DELETE
```

according to actual endpoint design.

---

# 76. STATUS CODE COVERAGE

Verify meaningful statuses:

```text
200
201
204
400
401
403
404
409
422
429
500
```

Only test statuses that the API actually uses.

---

# 77. CONFLICT TESTING

Test duplicate operations that should produce:

```text
409 Conflict
```

or actual documented behavior.

Examples:

```text
duplicate email
duplicate SKU
duplicate invoice number
duplicate reference
```

---

# 78. NOT FOUND TESTING

For every resource endpoint:

```text
GET nonexistent ID
PATCH nonexistent ID
DELETE nonexistent ID
```

verify expected behavior.

---

# 79. DELETE TESTING

Where DELETE exists, test:

```text
authorized delete
unauthorized delete
already deleted
nonexistent resource
```

and verify soft-delete behavior if applicable.

---

# 80. API SECURITY — RESPONSE LEAKAGE

Verify API responses do not expose:

```text
passwordHash
refreshToken
JWT secret
database credentials
internal stack trace
sensitive audit data
```

---

# 81. API PERFORMANCE SMOKE

Bruno is not a full load-testing tool.

Do NOT turn Phase 25 into a load-testing phase.

Only verify basic API response behavior.

Detailed performance testing belongs to:

```text
Phase 26 — Performance
```

---

# 82. BRUNO COLLECTION MAINTAINABILITY

Avoid:

```text
hard-coded IDs
hard-coded tokens
duplicated headers
duplicated environment values
```

Prefer reusable variables and consistent request structure.

---

# 83. API VERSIONING

If the API uses:

```text
/api/v1
```

or another versioning strategy, centralize it in:

```text
{{baseUrl}}
{{apiVersion}}
```

or the project's actual configuration.

---

# 84. HEALTH CHECK

Create:

```text
health/
└── health-check
```

if the backend provides a health endpoint.

Verify:

```text
200
```

and expected health response.

---

# 85. DATABASE RESET SAFETY

Bruno tests must never automatically wipe a database unless:

```text
explicitly configured for a test environment
```

Never implement destructive cleanup against production.

---

# 86. PRODUCTION SAFETY

Before any environment switch:

verify:

```text
baseUrl
database
credentials
environment
```

Do not allow a test collection to accidentally execute destructive requests against production.

---

# 87. TEST DATA CLEANUP

If cleanup endpoints exist, use them only in test environments.

Otherwise:

```text
Use isolated test DB
```

and reset the environment outside the production API.

---

# 88. FAILURE DEBUGGING

When a Bruno test fails, make it easy to determine:

```text
request
headers
payload
response status
response body
expected result
```

Do not hide response bodies for normal debugging.

But never print secrets.

---

# 89. DOCUMENT KNOWN LIMITATIONS

If something cannot be tested through HTTP because it is internal:

document it.

Example:

```text
Outbox internal persistence
Redis internal key
BullMQ internal job state
```

These should be covered by:

```text
Jest / Integration tests
```

rather than forcing Bruno to test internals.

---

# 90. PHASE 24 INTEGRATION

Bruno tests should complement Phase 24.

Before considering Phase 25 complete:

```text
Jest tests pass
+
Bruno smoke tests pass
+
Bruno regression tests pass
+
Bruno security tests pass
```

---

# 91. DEFINITION OF DONE

Phase 25 is complete only when:

```text
[ ] Bruno collection created
[ ] Environment files created
[ ] Local environment configured
[ ] Docker environment configured if needed
[ ] Authentication flow implemented
[ ] Token variable chaining implemented
[ ] Auth tests implemented
[ ] 401 tests implemented
[ ] 403 tests implemented
[ ] Dynamic RBAC tests implemented
[ ] Permission tests implemented
[ ] Privilege escalation tests implemented
[ ] Company isolation tested
[ ] Branch isolation tested
[ ] Warehouse isolation tested
[ ] Sales Account isolation tested
[ ] IDOR tested
[ ] Master Data tested
[ ] Product tested
[ ] Customer tested
[ ] Supplier tested
[ ] Sales tested
[ ] Purchase tested
[ ] Inventory tested
[ ] Inventory Ledger verified
[ ] Payment tested
[ ] Accounting tested
[ ] Double-entry verified
[ ] Reports tested
[ ] Notification APIs tested where applicable
[ ] Validation tested
[ ] Pagination tested
[ ] Filtering tested
[ ] Sorting tested
[ ] Conflict handling tested
[ ] Not-found handling tested
[ ] Rate limiting tested
[ ] API response leakage tested
[ ] Smoke suite created
[ ] Regression suite created
[ ] Security suite created
[ ] Business-flow suite created
[ ] README created
[ ] CI execution prepared
[ ] No production credentials committed
[ ] No production destructive requests configured
[ ] Bruno collection passes against local/test environment
```

---

# 92. FINAL ARCHITECTURE

The final testing architecture should look like:

```text
                    Fashion ERP Backend
                           │
             ┌─────────────┴─────────────┐
             │                           │
          Jest                         Bruno
             │                           │
             ▼                           ▼
      Internal Testing              API Testing
             │                           │
      ┌──────┼──────┐             ┌─────┼─────┐
      ▼      ▼      ▼             ▼     ▼     ▼
    Unit   DB/Int  Worker        Auth  RBAC  HTTP
      │      │      │             │     │     │
      └──────┼──────┘             └─────┼─────┘
             │                           │
             ▼                           ▼
       Business Logic              Data Visibility
       Transactions                API Contract
       Concurrency                 Security
       Accounting                  Business Flow
       Inventory                   Regression
             │                           │
             └─────────────┬─────────────┘
                           ▼
                    CI Test Pipeline
                           │
                           ▼
                    Production Confidence
```

---

# 93. FINAL RULE

Do NOT judge Phase 25 by the number of `.bru` files.

Judge it by whether Bruno can answer these questions:

```text
Can a user login?

Can an unauthenticated user access protected APIs?

Can a user perform only the permissions assigned to them?

Can Super Admin create custom roles?

Can permissions be added/removed dynamically?

Can User A access User B's data by changing an ID?

Can Company A see Company B's data?

Can Branch A see Branch B's data?

Can Warehouse A access Warehouse B's inventory?

Can Sales Staff A see Sales Staff B's sales?

Can Sales Manager see the permitted overall sales?

Can a user perform unauthorized financial operations?

Can a sale correctly affect inventory?

Can payment correctly affect accounting?

Does every posted journal balance?

Can duplicate financial operations occur?

Can invalid API input bypass validation?

Can rate limiting be bypassed?

Can API responses leak sensitive information?

Can the complete Sales/Purchase/Inventory/Accounting flow be verified through HTTP?

Can the entire API regression suite run repeatedly without manual token copying?

Can the same collection run safely in CI?
```

The final goal is:

```text
Bruno
=
Real HTTP API Verification
+
Dynamic RBAC Verification
+
Data Visibility Verification
+
Security Regression
+
Business Flow Testing
+
API Contract Verification
+
CI Regression Protection
```

Do not introduce unnecessary backend changes merely to make Bruno tests easier.

The **existing backend implementation is the source of truth**.

If an endpoint, permission, role, field, status, or business rule does not exist in the repository, do not invent it.

If a required capability is missing, document it as:

```text
TEST GAP / IMPLEMENTATION GAP
```

and continue with the capabilities that actually exist.
