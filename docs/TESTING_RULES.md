# TESTING_RULES.md

# Testing Rules & Quality Gates

This document is the authoritative source for testing strategy, test coverage expectations, test structure, test data, regression testing, integration testing, and quality gates.

AI MUST follow these rules when implementing or modifying code.

AI MUST NOT claim that a feature is complete without appropriate testing.

AI MUST NOT remove or weaken existing tests merely to make the test suite pass.

If testing requirements are ambiguous, STOP and ask the human engineer when the ambiguity can affect correctness or business behavior.

---

# 1. TESTING PRINCIPLES

The project follows these principles:

* Tests verify behavior, not implementation details.
* Business-critical behavior must be tested.
* Security boundaries must be tested.
* Existing behavior must not regress silently.
* Tests must be deterministic.
* Tests must be repeatable.
* Tests must be isolated.
* Production data must never be used in tests.
* A passing test suite does not automatically mean the implementation is correct.

AI must write tests together with implementation changes.

---

# 2. TESTING PYRAMID

Use an appropriate testing distribution.

```text
                    E2E
                   /   \
                API / Integration
               /         \
          Unit Tests       \
```

Preferred strategy:

```text
Unit Tests
    ↓
Application / Service behavior

Integration Tests
    ↓
Database / Redis / Queue / external boundaries

E2E Tests
    ↓
Critical user/business workflows
```

Do not make every test an E2E test.

Do not mock everything.

Use the lowest level that can reliably verify the behavior.

---

# 3. TEST TYPES

The project may contain:

```text
Unit Tests
Integration Tests
API Tests
E2E Tests
Database Tests
Authorization Tests
Concurrency Tests
Queue Tests
Contract Tests
Regression Tests
Performance Tests
Security Tests
```

Each test type has a specific purpose.

---

# 4. UNIT TESTS

Unit tests should verify isolated business/application behavior.

Examples:

```text
SaleService
InventoryService
PaymentService
ReturnService
PermissionService
PricingService
```

Unit tests should cover:

* normal behavior
* invalid input
* business rules
* state transitions
* edge cases
* error handling

Example:

```text
SaleService.createSale()
    ↓
valid sale
    → succeeds

invalid quantity
    → fails

insufficient stock
    → fails

unauthorized operation
    → fails
```

---

# 5. UNIT TEST MOCKING

Mocks may be used for external dependencies.

Examples:

```text
Repository
Redis
BullMQ
Payment Provider
Email Provider
External API
```

However, do not mock the behavior that the test is supposed to verify.

Bad:

```text
Mock SaleService
    ↓
Test SaleService
```

The test should exercise the actual behavior being tested.

---

# 6. INTEGRATION TESTS

Integration tests verify that multiple real components work together.

Examples:

```text
Service
    ↓
TypeORM
    ↓
MySQL
```

or:

```text
Service
    ↓
Redis
```

or:

```text
Application
    ↓
BullMQ
    ↓
Worker
```

Use integration tests when correctness depends on actual infrastructure behavior.

---

# 7. DATABASE TESTS

Database tests should verify:

* migrations
* constraints
* relationships
* foreign keys
* unique constraints
* nullable behavior
* defaults
* transactions
* soft deletes
* indexes where behaviorally relevant

Do not rely only on mocked repositories for database correctness.

---

# 8. MIGRATION TESTS

Every important schema migration must be tested.

At minimum verify:

```text
Current schema
    ↓
Migration
    ↓
Expected schema
```

For production-relevant migrations consider:

```text
Existing data
    ↓
Migration
    ↓
Data remains valid
```

Destructive migrations require additional review.

---

# 9. API TESTS

API tests must verify:

### Request

* valid request
* missing fields
* invalid fields
* invalid types
* boundary values

### Authentication

* unauthenticated request
* valid authenticated request
* expired/invalid authentication where applicable

### Authorization

* permitted user
* denied user
* wrong organization
* wrong branch
* wrong visibility scope

### Response

* HTTP status
* response structure
* response fields
* error structure

---

# 10. API CONTRACT TESTING

API tests must remain consistent with:

```text
API_CONTRACTS.md
```

When an API contract changes, update:

* DTOs
* API tests
* OpenAPI documentation
* frontend/mobile consumers where applicable

Do not modify tests simply because the implementation no longer matches the contract.

First determine whether:

```text
Implementation is wrong
```

or:

```text
Contract intentionally changed
```

---

# 11. AUTHORIZATION TESTING

Authorization must be tested explicitly.

For protected endpoints test:

```text
No authentication
    → 401

Authenticated but no permission
    → 403

Correct permission
    → allowed
```

Also test data scope.

Example:

```text
User A
    ↓
Sale A
    → visible

Sale B
    → not visible
```

Do not test authorization only by checking the frontend.

---

# 12. TENANT ISOLATION TESTING

If the system is multi-tenant, every tenant-sensitive operation must be tested.

Example:

```text
Organization A
    ↓
User A
```

must not access:

```text
Organization B
    ↓
Data B
```

Test:

* list
* get by ID
* update
* delete
* search
* export
* report
* bulk operations

A direct ID lookup must also enforce tenant isolation.

---

# 13. BRANCH / WAREHOUSE VISIBILITY TESTING

Where branch or warehouse scope exists, test:

```text
Branch A user
    ↓
Branch A data
    → allowed

Branch B data
    → denied / hidden
```

Also test users with:

```text
single branch
multiple branches
all branches
```

according to the domain rules.

---

# 14. DOMAIN RULE TESTING

Every critical rule in:

```text
DOMAIN_RULES.md
```

should have corresponding tests.

Examples:

```text
Sale cannot exceed available stock.

Return cannot exceed returnable quantity.

Completed transaction cannot return to draft.

User cannot access another organization.

Unauthorized user cannot approve restricted operation.
```

Business rules should not exist only as documentation.

Important rules must be executable through tests.

---

# 15. STATE TRANSITION TESTING

Every stateful entity should test valid and invalid transitions.

Example:

```text
DRAFT
  ↓
CONFIRMED
  ↓
COMPLETED
```

Test:

```text
DRAFT → CONFIRMED
    → allowed

CONFIRMED → COMPLETED
    → allowed

COMPLETED → DRAFT
    → rejected
```

Every prohibited transition that could cause data corruption should have a regression test.

---

# 16. INVENTORY TESTING

Inventory is business-critical.

Test:

```text
Purchase
    → increases stock

Sale
    → decreases stock

Sales Return
    → increases stock

Purchase Return
    → decreases stock

Stock Adjustment
    → follows adjustment rules

Stock Transfer
    → decreases source
    → increases destination
```

The exact behavior must follow `DOMAIN_RULES.md`.

---

# 17. STOCK CONSISTENCY TESTING

Test the invariant:

```text
Current Stock
=
Valid Stock Movement Result
```

where this is the project's inventory model.

Test scenarios such as:

```text
single sale
multiple sales
return
cancellation
adjustment
concurrent sale
failed transaction
retry
```

If an operation fails halfway, verify that invalid partial stock changes do not remain.

---

# 18. FINANCIAL TESTING

Financial calculations must have dedicated tests.

Test:

```text
Subtotal
Discount
Tax
Grand Total
Payment
Balance
Refund
```

Include:

* zero values where allowed
* decimal values
* rounding
* maximum values
* partial payments
* overpayments if supported
* refunds
* cancelled transactions

Never rely on visual UI verification for financial correctness.

---

# 19. MONEY PRECISION TESTING

Money calculations must not rely on floating-point behavior.

Test cases should include:

```text
10.10 + 20.20
0.01
0.10
multiple decimal operations
rounding boundaries
tax calculations
discount calculations
```

Verify exact expected values according to the project's rounding rules.

---

# 20. RETURN TESTING

Sales return behavior must test:

```text
Valid return
Invalid return
Return quantity > sold quantity
Return quantity > remaining returnable quantity
Already fully returned item
Partial return
Multiple returns
Unauthorized return
Return after prohibited state
```

Example:

```text
Sold = 10
Already Returned = 3

Return 7
    → allowed

Return 8
    → rejected
```

---

# 21. PAYMENT TESTING

Payment flows should test:

```text
UNPAID
PARTIALLY_PAID
PAID
FAILED
REFUNDED
```

where those states exist.

Test:

* duplicate payment
* retry
* callback/webhook
* invalid payment
* failed payment
* refund
* unauthorized refund

Payment operations must be idempotent where required.

---

# 22. IDEMPOTENCY TESTING

For idempotent operations:

```text
Request A
Idempotency-Key = ABC
```

followed by:

```text
Request B
Idempotency-Key = ABC
```

must not create duplicate business transactions.

Test:

```text
same key
same payload

same key
different payload

retry after timeout

concurrent duplicate requests
```

The exact expected behavior must follow the API/domain contract.

---

# 23. CONCURRENCY TESTING

Critical shared-state operations must be tested under concurrent execution.

Examples:

```text
Two users sell the last stock.

Two workers process the same payment.

Two users update the same transaction.

Two users approve the same request.
```

Verify that domain invariants remain valid.

Do not assume single-request tests prove concurrency safety.

---

# 24. TRANSACTION ROLLBACK TESTING

For multi-step operations:

```text
Operation A
Operation B
Operation C
```

simulate failure at:

```text
A
B
C
```

Verify that the database does not remain in an invalid partial state.

Example:

```text
Create Sale
Create Items
Update Stock
Create Payment
```

If payment creation fails and the operation is transactional:

```text
Sale
Items
Stock
```

must be rolled back according to the domain design.

---

# 25. QUEUE / BULLMQ TESTING

Queue-based workflows must test:

* job creation
* job processing
* successful completion
* failure
* retry
* retry limit
* duplicate job
* idempotency
* dead-letter/failure behavior where applicable

Example:

```text
SaleCompleted
    ↓
Queue Job
    ↓
Worker
    ↓
Inventory Update
```

Verify that retries do not create duplicate business effects.

---

# 26. REDIS TESTING

Where Redis is part of correctness, test:

* cache creation
* cache retrieval
* invalidation
* expiration
* lock behavior
* rate limiting
* duplicate prevention where applicable

Do not treat Redis as the source of truth unless explicitly designed that way.

---

# 27. EXTERNAL API TESTING

External services should be tested with controlled test doubles or sandbox environments.

Test:

```text
Success
Timeout
Connection failure
Invalid response
Rate limit
Authentication failure
Provider error
Duplicate callback
```

Never make production external API calls from automated tests unless explicitly designed and isolated.

---

# 28. WEBHOOK TESTING

Webhook tests must verify:

```text
Valid signature
Invalid signature
Invalid payload
Unknown event
Duplicate event
Out-of-order event where applicable
Replay attempt
```

Test idempotent processing.

A duplicate webhook must not duplicate the business operation.

---

# 29. FILE UPLOAD TESTING

If file uploads exist, test:

```text
Allowed file type
Invalid file type
Maximum size
Oversized file
Missing file
Malformed file
Unauthorized upload
Unauthorized download
```

Do not trust only the filename extension.

---

# 30. SEARCH / FILTER TESTING

Test:

```text
search
filter
sort
pagination
```

and ensure they respect authorization.

Example:

```text
User can only see Branch A
```

then:

```text
GET /sales?search=...
```

must not return Branch B records.

---

# 31. PAGINATION TESTING

Test:

```text
page = 1
page = 2
empty page
limit = minimum
limit = maximum
limit > maximum
invalid page
invalid limit
```

Also test ordering stability.

If cursor pagination is used, test:

```text
next cursor
previous cursor where supported
duplicate records
missing records
```

---

# 32. ERROR TESTING

Every important business error should be tested.

Examples:

```text
NOT_FOUND
UNAUTHORIZED
FORBIDDEN
VALIDATION_ERROR
CONFLICT
INSUFFICIENT_STOCK
INVALID_STATE_TRANSITION
DUPLICATE_REQUEST
PAYMENT_FAILED
```

Tests should verify both:

```text
HTTP status
```

and:

```text
machine-readable error code
```

Do not assert only human-readable messages unless necessary.

---

# 33. REGRESSION TESTING

Every bug that reaches a meaningful development/testing stage should result in a regression test when practical.

Process:

```text
Bug
 ↓
Reproduce
 ↓
Write failing test
 ↓
Fix
 ↓
Test passes
 ↓
Keep regression test
```

Do not remove the regression test after fixing the bug.

---

# 34. TEST NAMING

Test names should describe behavior.

Prefer:

```text
should reject a sale when stock is insufficient
```

over:

```text
testSale2
```

Good test names explain:

```text
condition
+
expected behavior
```

---

# 35. TEST STRUCTURE

Prefer a clear structure such as:

```text
Arrange
Act
Assert
```

Example:

```text
Arrange
    create user
    create product
    create stock

Act
    create sale

Assert
    sale created
    stock decreased
```

Keep tests readable.

Avoid unnecessary setup.

---

# 36. TEST DATA

Test data should be:

* deterministic
* minimal
* isolated
* explicit

Avoid relying on random data unless randomness is part of the test.

Use factories/builders/fixtures where appropriate.

Example:

```text
UserFactory
ProductFactory
SaleFactory
CustomerFactory
```

---

# 37. TEST DATABASE ISOLATION

Tests must not corrupt each other's data.

Possible strategies:

```text
transaction rollback
database reset
isolated schema
test database
```

Use the strategy appropriate to the project.

Never run destructive test setup against production.

---

# 38. TEST ENVIRONMENT

Tests should use dedicated configuration.

Example:

```text
NODE_ENV=test
DATABASE_URL=<test-database>
REDIS_URL=<test-redis>
```

Never accidentally connect automated tests to production databases.

---

# 39. ENVIRONMENT SAFETY

Before running destructive database commands, verify:

```text
environment
database host
database name
credentials
```

AI must never execute:

```text
DROP DATABASE
TRUNCATE
RESET
DELETE *
```

against a production environment.

---

# 40. TEST COVERAGE

Coverage is a quality signal, not the only definition of quality.

Track:

```text
statement coverage
branch coverage
function coverage
line coverage
```

More importantly, prioritize coverage of:

* business rules
* authorization
* financial operations
* inventory
* state transitions
* transactions
* concurrency-sensitive logic
* API contracts

Do not write meaningless tests merely to increase a coverage percentage.

---

# 41. COVERAGE THRESHOLDS

Project-specific thresholds:

```text
Global:
[DEFINE]

Unit:
[DEFINE]

Critical business modules:
[DEFINE]

Branches:
[DEFINE]
```

AI must not lower coverage thresholds simply to make CI pass.

Any threshold change requires explicit approval.

---

# 42. CRITICAL MODULES

The following modules should have stronger testing requirements:

```text
Authentication
Authorization
RBAC
Data Visibility
Inventory
Sales
Sales Returns
Purchases
Payments
Accounting
Financial Reports
```

Add project-specific critical modules here.

---

# 43. SECURITY TESTING

Security-sensitive functionality must include tests for:

* authentication bypass
* authorization bypass
* tenant isolation
* IDOR
* privilege escalation
* invalid tokens
* expired tokens
* rate limiting
* sensitive data exposure
* unsafe input

Example:

```text
User A requests:
GET /sales/{User-B-sale-id}
```

Expected:

```text
Access denied
```

according to the authorization model.

---

# 44. PERFORMANCE TESTING

Performance tests should be used for known critical paths.

Examples:

```text
Large sales list
Inventory lookup
Dashboard queries
Reports
Exports
Search
Bulk operations
```

Measure before optimizing.

Do not define arbitrary performance claims without measurement.

---

# 45. LOAD TESTING

For load testing define:

```text
Concurrent users:
Requests per second:
Expected latency:
Maximum acceptable error rate:
Dataset size:
```

Project-specific values:

```text
Concurrent users:
[DEFINE]

RPS:
[DEFINE]

p95 latency:
[DEFINE]

Error rate:
[DEFINE]
```

---

# 46. E2E TESTING

E2E tests should focus on critical business workflows.

Examples:

```text
Login
 ↓
Create Product
 ↓
Create Purchase
 ↓
Receive Stock
 ↓
Create Sale
 ↓
Payment
 ↓
Sale Completed
 ↓
Inventory Updated
```

Another example:

```text
Sale
 ↓
Return
 ↓
Refund
 ↓
Accounting updated
```

Do not create E2E tests for every small utility function.

---

# 47. TEST ORDER

Recommended development order:

```text
1. Unit tests
2. Integration tests
3. API tests
4. E2E tests
5. Performance/security tests where required
```

Run focused tests during development.

Run the full regression suite before completing major work.

---

# 48. CI QUALITY GATES

CI should verify at minimum:

```text
Type checking
Linting
Unit tests
Integration tests
API tests
Coverage threshold
Build
```

For applicable projects also run:

```text
E2E
Security checks
Migration checks
```

A feature is not considered complete if required CI checks fail.

---

# 49. FAILURE INVESTIGATION

When a test fails:

Do not immediately modify the test.

First determine:

```text
Is the implementation wrong?
Is the test wrong?
Did the business rule change?
Did the API contract change?
Did the database schema change?
Is the test environment broken?
```

Fix the root cause.

---

# 50. FLAKY TESTS

Tests must not depend on:

* execution order
* arbitrary timing
* real external services
* random ports where avoidable
* system clock without control
* network availability
* shared mutable state

If a test is flaky:

```text
Identify
 ↓
Reproduce
 ↓
Fix root cause
 ↓
Verify stability
```

Do not simply add arbitrary delays such as:

```text
sleep(5000)
```

unless there is a justified reason.

---

# 51. TIME-DEPENDENT TESTS

Tests involving:

```text
created_at
expired_at
token expiry
payment timeout
queue delay
date ranges
reports
```

should use controlled/fake time where appropriate.

Do not rely on the actual machine clock when deterministic time is required.

---

# 52. RANDOMNESS

If randomness is required:

* use a controlled seed
* record the seed on failure
* make reproduction possible

A failed test must be reproducible.

---

# 53. TESTING API + DATABASE TOGETHER

For important APIs, verify both:

```text
API response
```

and:

```text
database state
```

Example:

```text
POST /sales
```

should verify:

```text
HTTP response
Sale record
Sale items
Stock movement
Stock balance
Payment
```

according to the domain workflow.

---

# 54. TESTING EVENTUAL CONSISTENCY

For asynchronous workflows:

```text
API
 ↓
Queue
 ↓
Worker
 ↓
Database
```

tests should wait for the actual condition rather than relying on arbitrary sleep.

Prefer:

```text
wait until expected state
```

with a bounded timeout.

---

# 55. TESTING OBSERVABILITY

Critical workflows should produce enough observability to investigate failures.

Where applicable verify:

```text
requestId
jobId
eventId
audit record
error code
```

Do not expose sensitive information.

---

# 56. TEST DOCUMENTATION

Tests should be understandable without reading the implementation first.

For complex workflows, document:

```text
Business scenario
Expected result
Important invariant
```

Avoid comments that merely repeat the code.

---

# 57. DEFINITION OF DONE

A task is not considered complete until:

```text
[ ] Implementation complete
[ ] Unit tests updated
[ ] Integration tests updated where required
[ ] API tests updated where required
[ ] E2E tests updated where required
[ ] Regression tests added for bugs
[ ] Authorization tested
[ ] Data visibility tested
[ ] Error cases tested
[ ] Edge cases tested
[ ] Type check passes
[ ] Lint passes
[ ] Relevant test suite passes
[ ] Full regression suite passes when required
[ ] Documentation updated
```

Do not claim completion when required checks have not been executed.

---

# 58. AI TESTING RULES

AI MUST:

1. Inspect existing tests before writing new tests.
2. Follow existing test conventions.
3. Identify affected tests before modifying code.
4. Add tests for new business behavior.
5. Add regression tests for important bugs.
6. Test authorization.
7. Test data visibility.
8. Test validation.
9. Test error cases.
10. Test important state transitions.
11. Test database behavior where required.
12. Test concurrency/idempotency where required.
13. Run relevant tests.
14. Report actual test results.
15. Report tests that could not be executed.

AI MUST NOT:

* delete tests merely to make CI pass
* weaken assertions without justification
* skip failing tests silently
* change coverage thresholds silently
* mock away the behavior being tested
* claim tests passed without running them
* claim 100% coverage without measuring it
* use production data for tests
* use production databases for automated tests
* add meaningless tests only to increase coverage

---

# 59. AI TEST REPORT

After completing a testing-related task, AI should report:

### Tests Added

```text
[Describe]
```

### Tests Modified

```text
[Describe]
```

### Tests Executed

```text
[Actual commands/results]
```

### Passed

```text
[Number / result]
```

### Failed

```text
[Number / result]
```

### Skipped

```text
[Number / reason]
```

### Coverage

```text
[Actual measured coverage]
```

### Remaining Risks

```text
[Describe]
```

AI must report actual results.

Never invent test results.

---

# 60. FINAL TESTING PRINCIPLE

Tests are executable documentation of system behavior.

Therefore:

Test business rules.

Test security boundaries.

Test data integrity.

Test API contracts.

Test failure paths.

Test edge cases.

Test concurrency where required.

Test regressions.

Prefer meaningful tests over high numbers.

A green test suite is evidence.

It is not permission to ignore the domain rules.

The AI writes and runs tests.

The AI does not decide that untested behavior is correct.
