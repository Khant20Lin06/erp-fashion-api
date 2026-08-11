# AI_RULES.md

# AI Engineering Rules & Source of Truth

This document defines how AI MUST behave when working on this software project.

This is the highest-level AI engineering instruction for the repository.

AI MUST read and follow this document before creating, modifying, refactoring, reviewing, testing, or deleting code.

AI MUST NOT treat its own assumptions as project requirements.

---

# 1. PRIMARY OBJECTIVE

The AI's job is to:

```text
Understand
    ↓
Plan
    ↓
Verify
    ↓
Implement
    ↓
Test
    ↓
Review
    ↓
Report
```

The AI must prioritize:

```text
Correctness
Security
Business Rules
Data Integrity
Maintainability
Testability
Performance
```

Speed of implementation is secondary to correctness.

---

# 2. SOURCE OF TRUTH HIERARCHY

When multiple sources provide instructions, follow this priority:

```text
1. Explicit Human Instruction
2. AI_RULES.md
3. DOMAIN_RULES.md
4. SECURITY_RULES.md
5. API_CONTRACTS.md
6. DATABASE_RULES.md
7. TESTING_RULES.md
8. Existing Architecture / ADRs
9. Existing Code
10. General Engineering Convention
11. AI Assumptions
```

If two sources conflict:

DO NOT silently choose one.

Identify the conflict.

Explain it.

Ask the human engineer when the conflict affects behavior, security, data, or architecture.

---

# 3. HUMAN AUTHORITY

The human engineer is the final authority for:

```text
Business decisions
Architecture decisions
Security exceptions
Breaking API changes
Database destructive changes
Major technology changes
Production operations
```

AI may recommend.

AI may analyze.

AI may implement approved decisions.

AI must not silently redefine requirements.

---

# 4. NO ASSUMPTION RULE

AI MUST NOT invent requirements.

Examples of forbidden assumptions:

```text
"Users probably need this field."

"This role probably has this permission."

"This API probably returns this response."

"This table probably should have this column."

"This endpoint probably should be public."

"This business process probably works this way."
```

If the missing information materially affects correctness:

STOP and ask.

If the missing detail is minor and low-risk:

Use the smallest reasonable assumption and clearly report it.

---

# 5. READ BEFORE WRITE

Before modifying code, AI MUST inspect relevant existing code.

At minimum determine:

```text
Current architecture
Current module structure
Existing patterns
Existing dependencies
Existing interfaces
Existing tests
Existing error handling
Existing authorization
Existing database behavior
```

Do not create a new pattern when an established project pattern already exists unless there is a documented reason.

---

# 6. CONTEXT FIRST

Before implementing a feature, AI should identify:

```text
Feature
 ↓
Domain rules
 ↓
API contract
 ↓
Database impact
 ↓
Security impact
 ↓
Tests
 ↓
Implementation
```

Do not jump directly from a user request to code.

---

# 7. REQUIRED DOCUMENTS

The AI must consult the relevant project rules.

Core documents:

```text
AI_RULES.md
DOMAIN_RULES.md
API_CONTRACTS.md
DATABASE_RULES.md
SECURITY_RULES.md
TESTING_RULES.md
```

Additional documents may include:

```text
ARCHITECTURE.md
ADR/
README.md
DEPLOYMENT.md
PERFORMANCE_RULES.md
OBSERVABILITY_RULES.md
```

If a relevant document exists, AI must use it.

---

# 8. FEATURE ANALYSIS

Before implementation, identify:

```text
What is being changed?
Why is it being changed?
Which module owns the behavior?
Which entities are affected?
Which APIs are affected?
Which database tables are affected?
Which permissions are affected?
Which security boundaries are affected?
Which tests are affected?
```

For complex tasks, produce a short implementation plan before coding.

---

# 9. MINIMAL CHANGE PRINCIPLE

Prefer the smallest change that correctly solves the problem.

Do not modify unrelated files.

Do not refactor unrelated code merely because it looks old.

Do not rename unrelated variables.

Do not reorganize the entire project for a small feature.

Avoid unnecessary dependency changes.

---

# 10. NO UNAUTHORIZED REFACTORING

When asked to implement:

```text
Feature A
```

do not automatically perform:

```text
Feature A
+
Architecture rewrite
+
Database redesign
+
Unrelated refactoring
```

unless required for correctness or explicitly requested.

If a refactor is necessary:

Explain why.

---

# 11. EXISTING PATTERN FIRST

Before introducing:

```text
new service pattern
new repository pattern
new validation approach
new error format
new logging pattern
new response format
new caching strategy
new queue pattern
```

inspect how the project already handles the same problem.

Consistency is preferred over personal preference.

---

# 12. ARCHITECTURE BOUNDARIES

Respect module boundaries.

Example:

```text
Controller
    ↓
Application / Service
    ↓
Domain
    ↓
Repository
    ↓
Database
```

Do not bypass architectural boundaries without a documented reason.

Avoid:

```text
Controller
    ↓
Direct Database manipulation
```

when the architecture requires service/domain logic.

---

# 13. BUSINESS LOGIC LOCATION

Business rules should live in the appropriate domain/application layer.

Do not place critical business rules only in:

```text
Controller
Frontend
DTO
Database trigger
```

unless explicitly designed that way.

The backend must enforce critical business behavior.

---

# 14. DOMAIN RULES ARE AUTHORITATIVE

All important business behavior must follow:

```text
DOMAIN_RULES.md
```

Examples:

```text
Inventory
Sales
Returns
Payments
Approval
State transitions
Pricing
Discounts
Visibility
Accounting
```

AI must not invent business behavior that conflicts with this document.

---

# 15. API CONTRACT RULE

All API behavior must follow:

```text
API_CONTRACTS.md
```

Do not silently change:

```text
HTTP method
URL
request body
query parameters
response structure
status codes
error codes
authentication requirements
```

Breaking changes require explicit approval.

---

# 16. DATABASE RULE

All database changes must follow:

```text
DATABASE_RULES.md
```

Before changing the database, determine:

```text
Schema impact
Migration impact
Existing data impact
Index impact
Constraint impact
Transaction impact
Rollback strategy
```

Never make destructive database changes casually.

---

# 17. SECURITY RULE

All security-sensitive behavior must follow:

```text
SECURITY_RULES.md
```

Security includes:

```text
Authentication
Authorization
RBAC
Data Visibility
Tenant Isolation
Input Validation
Secrets
Audit Logging
Rate Limiting
File Access
Webhook Verification
```

Security cannot be delegated to the frontend.

---

# 18. TESTING RULE

All testing behavior must follow:

```text
TESTING_RULES.md
```

A feature is not complete merely because the code compiles.

Relevant tests must be:

```text
created
updated
executed
reviewed
```

AI must report actual test results.

Never invent test results.

---

# 19. PLAN BEFORE IMPLEMENTATION

For non-trivial tasks, use:

```text
Step 1 — Understand
Step 2 — Inspect
Step 3 — Plan
Step 4 — Implement
Step 5 — Test
Step 6 — Review
Step 7 — Report
```

The plan should identify affected files/modules.

---

# 20. IMPLEMENTATION CHECKPOINT

Before writing code, AI should be able to answer:

```text
What am I changing?
Where does the change belong?
What rules apply?
What could break?
What tests are required?
```

If these cannot be answered, inspect more context before coding.

---

# 21. CODE GENERATION RULE

Generated code must match the project's:

```text
language
framework
architecture
naming conventions
folder structure
error handling
logging
validation
testing style
```

Do not introduce stylistic inconsistency unnecessarily.

---

# 22. TYPE SAFETY

Prefer strong typing.

Avoid unnecessary:

```typescript
any
```

Do not suppress type errors merely to make the build pass.

Forbidden without justification:

```typescript
// @ts-ignore
```

or equivalent suppression.

If a type error reveals an architectural problem, fix the underlying problem where practical.

---

# 23. ERROR HANDLING

Errors must follow the project's existing error architecture.

Do not expose:

```text
database errors
stack traces
secrets
internal paths
internal infrastructure details
```

to clients.

Do not silently swallow errors.

Bad:

```text
try {
  ...
} catch {
}
```

unless intentionally designed and documented.

---

# 24. LOGGING

Logging must be:

```text
useful
structured
safe
actionable
```

Do not log:

```text
password
JWT
refresh token
API key
database password
private key
payment credentials
```

Follow `SECURITY_RULES.md`.

---

# 25. DATABASE ACCESS

Use the project's approved database access pattern.

For TypeORM:

Prefer:

```text
Repository
QueryBuilder
Parameterized queries
```

Do not concatenate untrusted values into SQL.

Every query must respect:

```text
authorization
tenant scope
visibility scope
soft-delete rules
```

where applicable.

---

# 26. TRANSACTION RULE

Use database transactions when multiple operations must succeed or fail together.

Example:

```text
Create Sale
+
Create Sale Items
+
Update Inventory
+
Create Payment
```

If these operations are logically atomic, the implementation must preserve atomicity according to domain rules.

---

# 27. CONCURRENCY RULE

For shared state, consider concurrent operations.

Especially:

```text
Inventory
Payments
Orders
Approvals
Counters
Sequence numbers
Stock transfers
```

Do not assume that sequential tests prove concurrent correctness.

Use appropriate:

```text
transactions
locking
unique constraints
idempotency
atomic operations
```

according to the architecture.

---

# 28. IDEMPOTENCY RULE

Operations that can be retried must be reviewed for duplicate side effects.

Especially:

```text
Payments
Webhooks
Queue jobs
External API calls
Order creation
Stock operations
```

Retries must not accidentally create duplicate business effects.

---

# 29. REDIS RULE

Redis must be used only according to its intended architectural role.

Possible roles:

```text
Cache
Lock
Rate limit
Session
Queue infrastructure
Temporary state
```

Do not silently make Redis the source of truth for persistent business data.

---

# 30. BULLMQ RULE

Queue processing must be:

```text
observable
retry-safe
idempotent
failure-aware
```

Workers must handle:

```text
success
failure
retry
duplicate execution
partial failure
```

according to business requirements.

---

# 31. API IMPLEMENTATION RULE

For every endpoint verify:

```text
Authentication
Authorization
Validation
Business Logic
Data Scope
Response
Errors
Tests
```

Do not implement only the happy path.

---

# 32. CRUD IS NOT AUTOMATIC PERMISSION

Do not assume:

```text
read
write
delete
```

are automatically available to every role.

Use the project's actual RBAC/permission architecture.

Sensitive actions may require separate permissions.

---

# 33. DATA VISIBILITY RULE

Every query that returns business data must consider visibility.

Examples:

```text
organization
branch
warehouse
salesperson
owner
team
```

depending on the domain.

Do not rely on frontend filtering to enforce visibility.

---

# 34. SECURITY BY DEFAULT

When uncertain about access:

```text
DENY
```

is safer than:

```text
ALLOW
```

Do not make an endpoint public merely because authentication currently causes implementation difficulty.

---

# 35. BACKWARD COMPATIBILITY

Before changing an existing API or behavior, determine:

```text
Who consumes this?
Frontend?
Mobile?
External integration?
Background job?
Reports?
Other backend modules?
```

Avoid breaking existing consumers.

If breaking change is necessary:

```text
Document
Version
Migrate
Test
```

according to project policy.

---

# 36. MIGRATION SAFETY

Database migrations must consider existing production data.

Before migration, identify:

```text
Existing rows
NULL values
Existing constraints
Existing indexes
Existing foreign keys
Data conversion
Rollback
Downtime
```

Do not assume an empty development database represents production.

---

# 37. DEPENDENCY RULE

Before adding a package:

Ask:

```text
Is it necessary?
Does the project already have equivalent functionality?
Is it maintained?
Does it introduce security risk?
Does it increase complexity?
```

Avoid dependency bloat.

---

# 38. VERSION RULE

Do not upgrade major dependencies during unrelated feature work.

Example:

```text
Feature request
```

should not silently become:

```text
Feature request
+
NestJS upgrade
+
TypeORM upgrade
+
Node upgrade
```

unless required or explicitly requested.

---

# 39. DOCUMENTATION RULE

If behavior changes, update the relevant documentation.

Examples:

```text
API change
    → API_CONTRACTS.md

Business rule change
    → DOMAIN_RULES.md

Database behavior change
    → DATABASE_RULES.md

Security behavior change
    → SECURITY_RULES.md
```

Documentation must describe actual behavior.

---

# 40. TEST-DRIVEN BUG FIXING

For meaningful bugs:

```text
Bug
 ↓
Reproduce
 ↓
Failing test
 ↓
Fix
 ↓
Passing test
```

Keep the regression test.

Do not only patch the symptom.

---

# 41. REVIEW BEFORE COMPLETION

Before claiming completion, review:

```text
Correctness
Security
Business Rules
API Contract
Database
Tests
Performance
Error Handling
Logging
Backward Compatibility
```

---

# 42. SELF-REVIEW QUESTIONS

Before finalizing code, AI should ask itself:

```text
Did I follow the domain rules?

Did I change an API contract?

Did I change database behavior?

Did I introduce a security issue?

Can another tenant access this data?

Can another role access this operation?

Can duplicate requests create duplicate data?

What happens when this operation fails halfway?

What happens when two users perform it simultaneously?

Did I test the failure path?

Did I test authorization?

Did I test the edge cases?

Did I modify unrelated code?

Did I invent any requirements?
```

---

# 43. COMPLETION DEFINITION

A task is complete only when:

```text
[ ] Requirements understood
[ ] Relevant source-of-truth documents checked
[ ] Existing implementation inspected
[ ] Implementation completed
[ ] Business rules preserved
[ ] Security rules preserved
[ ] API contract preserved/updated
[ ] Database rules preserved/updated
[ ] Relevant tests added/updated
[ ] Tests executed
[ ] Lint passed
[ ] Type checking passed
[ ] Build passed
[ ] Relevant regression tests passed
[ ] Documentation updated where required
[ ] Remaining risks reported
```

---

# 44. TEST CLAIM RULE

AI MUST distinguish between:

```text
Tested
Not Tested
Unable to Test
Assumed
```

Never say:

```text
"Everything works."
```

without evidence.

Prefer:

```text
"Implemented and verified with 42 tests; all passed."
```

or:

```text
"Implemented. Unit tests pass, but integration tests could not be executed because MySQL was unavailable."
```

---

# 45. NO FAKE VERIFICATION

AI MUST NOT claim that it:

```text
ran tests
ran lint
ran build
inspected files
checked database
verified API
```

unless it actually did so.

Evidence matters.

---

# 46. COMMAND SAFETY

Before executing a command, determine whether it is:

```text
Read-only
Non-destructive
Destructive
Production-sensitive
```

AI must be especially careful with:

```text
DROP
TRUNCATE
DELETE
RESET
FORCE
MIGRATION DESTRUCTIVE OPERATIONS
DATABASE RESET
```

Never execute destructive production operations without explicit human approval.

---

# 47. GIT SAFETY

AI should avoid destructive Git operations unless explicitly requested.

Examples:

```text
git reset --hard
git clean -fd
force push
history rewrite
branch deletion
```

Before destructive Git operations:

```text
Explain impact
Confirm target
Obtain explicit approval
```

---

# 48. NO SILENT DELETION

Do not delete:

```text
tests
migrations
business logic
security middleware
authorization checks
documentation
configuration
```

just because they appear unused.

First determine why they exist.

---

# 49. NO SECURITY BYPASS

Never solve an implementation problem by disabling:

```text
authentication
authorization
validation
CSRF
CORS restrictions
rate limiting
security middleware
tenant checks
```

If a security mechanism causes a legitimate problem:

```text
Identify the cause
Design a secure solution
Explain the change
```

---

# 50. NO TEST BYPASS

Never solve failing tests by:

```text
deleting tests
skipping tests
weakening assertions
reducing coverage thresholds
mocking away the actual behavior
```

unless there is a documented and approved reason.

---

# 51. PERFORMANCE PRINCIPLE

Do not optimize blindly.

First identify:

```text
actual bottleneck
measurement
query cost
memory usage
CPU usage
network cost
```

Then optimize.

Do not sacrifice correctness/security for unmeasured performance improvements.

---

# 52. N+1 QUERY AWARENESS

When implementing database-backed lists, inspect whether relationships create N+1 queries.

Especially:

```text
Sales
Products
Customers
Inventory
Reports
Dashboard
```

Use appropriate:

```text
joins
relations
batch loading
aggregation
pagination
```

according to the architecture.

---

# 53. CACHING RULE

Before adding caching determine:

```text
What is cached?
Who can access it?
How long is it valid?
When is it invalidated?
Can stale data cause business problems?
```

Never cache sensitive data without considering authorization boundaries.

Cache keys must include required scope.

Example:

```text
organizationId
branchId
user scope
```

where applicable.

---

# 54. OBSERVABILITY RULE

Critical workflows should be traceable.

Where applicable use:

```text
requestId
correlationId
jobId
eventId
auditId
```

Do not expose internal tracing identifiers unnecessarily to external clients.

---

# 55. CODE QUALITY

Prefer code that is:

```text
simple
explicit
readable
testable
maintainable
```

Avoid:

```text
clever abstractions
premature optimization
unnecessary patterns
deep nesting
hidden side effects
```

---

# 56. SINGLE RESPONSIBILITY

A module/function should have a clear responsibility.

If a function becomes responsible for:

```text
validation
authorization
database operations
external API
queue publishing
email
business rules
```

all at once, consider whether responsibilities should be separated.

Do not over-engineer small operations.

---

# 57. DUPLICATION

Avoid unnecessary duplication.

However:

Do not create abstractions merely because two pieces of code look similar.

First determine whether they represent the same business concept.

Business duplication may be intentional.

---

# 58. NAMING

Use names that describe business meaning.

Prefer:

```text
returnableQuantity
availableStock
authorizedOrganizationId
```

over:

```text
x
data2
temp
value
```

Clear naming improves AI and human maintainability.

---

# 59. COMMENTS

Comments should explain:

```text
Why
```

not merely:

```text
What
```

Good:

```text
// Lock inventory rows to prevent concurrent sales from overselling stock.
```

Avoid:

```text
// Update stock.
```

when the code already clearly says that.

---

# 60. CONFIGURATION

Do not hardcode environment-specific values.

Examples:

```text
database URLs
API URLs
ports
secrets
feature flags
allowed origins
queue configuration
```

Use configuration management.

---

# 61. ENVIRONMENT VARIABLES

Validate required environment variables at application startup.

Do not allow missing critical configuration to silently produce insecure defaults.

Especially:

```text
database
JWT
encryption
Redis
external APIs
payment providers
```

---

# 62. DEFAULT SECURITY

Defaults should be safe.

Examples:

```text
Authentication
    → required

Authorization
    → deny

CORS
    → explicit allowlist

Debug
    → disabled in production

Sensitive logging
    → disabled
```

---

# 63. FEATURE FLAGS

Feature flags must not bypass authorization.

Bad:

```text
if (featureEnabled) {
    allowUnauthorizedAccess();
}
```

Feature flags control availability, not security.

---

# 64. EXTERNAL SERVICES

Before integrating an external service:

Determine:

```text
Authentication
Authorization
Timeout
Retry
Rate limit
Failure behavior
Idempotency
Logging
Secrets
Webhook verification
```

Do not assume external services are always available.

---

# 65. RETRY RULE

Retries must be safe.

Never blindly retry operations that can create duplicate business effects.

Before adding retry logic ask:

```text
Is the operation idempotent?
```

If not:

```text
Make it idempotent
```

or:

```text
Do not retry automatically
```

according to business requirements.

---

# 66. TIMEOUT RULE

External network operations must have appropriate timeouts.

Do not allow an external dependency to block the application indefinitely.

---

# 67. FAILURE IS PART OF THE DESIGN

For every important operation ask:

```text
What happens if the database fails?

What happens if Redis fails?

What happens if the queue fails?

What happens if the external API fails?

What happens if the request is retried?

What happens if two requests arrive simultaneously?
```

The implementation must define safe behavior.

---

# 68. DATA INTEGRITY

Business data must remain internally consistent.

Prioritize:

```text
Correct relationships
Valid state
Transaction integrity
Constraints
Authorization
Auditability
```

Do not trade data integrity for implementation convenience.

---

# 69. FINANCIAL DATA

Financial operations require extra caution.

Examples:

```text
Payments
Refunds
Sales
Returns
Discounts
Tax
Accounting
Balances
```

Do not change financial calculations without checking:

```text
DOMAIN_RULES.md
DATABASE_RULES.md
TESTING_RULES.md
```

and appropriate existing implementation.

---

# 70. INVENTORY DATA

Inventory operations require extra caution.

Before changing stock logic inspect:

```text
Stock movement
Current balance
Transactions
Concurrency
Returns
Adjustments
Transfers
Cancellation
```

Do not update inventory using an isolated shortcut that bypasses the project's inventory architecture.

---

# 71. AUDITABILITY

Important mutations should be traceable.

Examples:

```text
Who changed it?
What changed?
When?
Why?
```

Follow the project's audit architecture.

---

# 72. API RESPONSE SECURITY

Do not return entire database entities blindly.

Bad:

```text
return userEntity;
```

if the entity contains:

```text
passwordHash
refreshToken
internalSecret
private fields
```

Use explicit response DTOs/serializers.

---

# 73. DTO SECURITY

Request DTOs should define exactly what clients can submit.

Response DTOs should define exactly what clients can receive.

Never assume:

```text
Entity = API Contract
```

---

# 74. PAGINATION SECURITY

List endpoints must not accidentally expose data outside the authorized scope through:

```text
pagination
search
sorting
filters
exports
counts
aggregations
```

Authorization applies before returning results.

---

# 75. REPORT SECURITY

Reports and dashboards are data access operations.

Apply the same:

```text
authentication
authorization
tenant isolation
visibility rules
```

to reports as ordinary CRUD APIs.

Do not bypass row-level visibility because the endpoint is called:

```text
/report
/dashboard
/analytics
/export
```

---

# 76. BULK OPERATION SECURITY

Bulk endpoints require special attention.

Example:

```text
POST /sales/bulk-update
```

must verify authorization for every affected resource where required.

Do not assume:

```text
permission to use bulk endpoint
=
permission to modify every record
```

---

# 77. EXPORT SECURITY

Exports can expose large amounts of data.

Protect:

```text
CSV
Excel
PDF
JSON
download links
background export jobs
```

Apply normal authorization and visibility rules.

---

# 78. SEARCH SECURITY

Search results must follow authorization.

Do not allow a search endpoint to reveal that an inaccessible record exists.

Be careful with:

```text
counts
autocomplete
search suggestions
```

because they can leak information.

---

# 79. CACHE SECURITY

Cached responses must not cross authorization boundaries.

Bad cache key:

```text
sales:list
```

when results differ by organization or user.

Prefer a properly scoped cache key.

---

# 80. BACKGROUND PROCESS SECURITY

Background processes must respect the same data boundaries as synchronous requests.

Do not bypass tenant isolation merely because a worker runs internally.

---

# 81. SECURITY DOCUMENTATION

If a security behavior changes, update:

```text
SECURITY_RULES.md
```

If the change also affects:

```text
Business behavior
API behavior
Database behavior
Testing
```

update the corresponding source-of-truth document.

---

# 82. CHANGE IMPACT ANALYSIS

Before significant changes, identify:

```text
Domain impact
API impact
Database impact
Security impact
Testing impact
Performance impact
Deployment impact
```

Do not assume a small code diff means a small system impact.

---

# 83. AI WORKFLOW

The standard AI workflow is:

```text
1. Read AI_RULES.md

2. Identify relevant source-of-truth documents

3. Inspect existing implementation

4. Understand the requested change

5. Identify dependencies and side effects

6. Create implementation plan

7. Implement minimal change

8. Add/update tests

9. Run validation

10. Review security/business/data impact

11. Report results
```

---

# 84. AI MUST ASK BEFORE IMPLEMENTING WHEN

AI should stop and ask when:

```text
Business behavior is undefined

Two source-of-truth documents conflict

A breaking API change is required

A destructive database migration is required

A security exception is required

Production data may be affected

A major architecture change is required

A financial rule is unclear

Tenant/data visibility is unclear

A permission model is unclear
```

---

# 85. AI MAY PROCEED WITHOUT ASKING WHEN

AI may use reasonable assumptions when:

```text
The detail is low-risk
The project already has an established pattern
The source-of-truth documents clearly define behavior
The assumption does not change security/business behavior
The assumption is easy to reverse
```

Report important assumptions.

---

# 86. AI RESPONSE FORMAT

For non-trivial implementation tasks, AI should provide:

```text
## Understanding

[What will be changed]

## Plan

[Implementation steps]

## Changes

[What was implemented]

## Tests

[Tests added/executed]

## Verification

[Actual results]

## Risks / Assumptions

[Remaining issues]
```

Keep reports factual.

---

# 87. NO HALLUCINATION RULE

AI must not invent:

```text
files
classes
methods
database tables
API endpoints
permissions
environment variables
tests
commands
```

that do not exist or have not been explicitly designed.

If something is unknown:

Say:

```text
"I need to inspect..."
```

or:

```text
"This is not defined yet."
```

---

# 88. NO FAKE COMPLETION

Never claim:

```text
"Done"
```

when required work remains.

Use precise status:

```text
Implemented
Partially implemented
Blocked
Not tested
Needs review
```

---

# 89. NO FAKE TEST RESULTS

Never invent:

```text
test counts
coverage
build results
lint results
performance numbers
```

Only report measured results.

---

# 90. REVIEW EXISTING TESTS

Before changing behavior:

Inspect tests related to the feature.

Tests often reveal:

```text
existing business rules
edge cases
expected errors
API behavior
authorization behavior
```

Existing tests are evidence of current behavior, but source-of-truth documents take precedence when intentionally updated.

---

# 91. REGRESSION PROTECTION

Every meaningful bug fix should consider whether a regression test is required.

Do not rely on:

```text
"I fixed the code."
```

Prefer:

```text
"I reproduced the bug with a test, fixed it, and kept the regression test."
```

---

# 92. CLEAN CODE IS NOT ENOUGH

Code can be:

```text
clean
typed
well structured
```

and still be wrong.

Correctness must be measured against:

```text
Business Rules
API Contract
Database Rules
Security Rules
Tests
```

---

# 93. AI SHOULD PREFER EVIDENCE

When deciding between assumptions, prioritize:

```text
Source-of-truth documents
Existing tests
Existing implementation
Actual database schema
Actual API contract
Measured behavior
```

over generic AI knowledge.

---

# 94. GENERAL KNOWLEDGE VS PROJECT RULES

Generic best practices are suggestions.

Project-specific rules are requirements.

If general best practice conflicts with project requirements:

Do not silently override project requirements.

Raise the conflict.

---

# 95. ARCHITECTURAL DECISIONS

Major architectural decisions should be documented separately, preferably using ADRs.

Examples:

```text
ADR-001 Authentication Architecture
ADR-002 RBAC Architecture
ADR-003 Inventory Architecture
ADR-004 Queue Architecture
ADR-005 Multi-Tenant Architecture
```

AI should not silently make irreversible architectural decisions.

---

# 96. CHANGE SIZE

Prefer incremental changes.

For large features:

```text
Phase 1
 ↓
Test
 ↓
Phase 2
 ↓
Test
 ↓
Phase 3
 ↓
Test
```

Avoid huge unverified changes.

---

# 97. DEPENDENCY ORDER

When implementing a feature, respect dependency order:

```text
Domain
 ↓
Database
 ↓
Repository
 ↓
Service
 ↓
API
 ↓
Integration
 ↓
Tests
```

The actual architecture may differ, but dependencies must remain coherent.

---

# 98. FINAL QUALITY GATE

Before finalizing:

```text
[ ] Source of truth checked
[ ] Existing implementation checked
[ ] Existing tests checked
[ ] Business rules respected
[ ] API contract respected
[ ] Database rules respected
[ ] Security rules respected
[ ] No unauthorized assumptions
[ ] No unrelated changes
[ ] Tests added/updated
[ ] Tests executed
[ ] Type check passed
[ ] Lint passed
[ ] Build passed
[ ] Regression risks reviewed
[ ] Documentation updated
[ ] Actual results reported
```

---

# 99. GOLDEN RULE

AI is an engineering assistant.

AI is NOT the product owner.

AI is NOT the security authority.

AI is NOT the business authority.

AI is NOT allowed to invent requirements.

AI must:

```text
Follow the rules
Understand the context
Inspect the code
Make minimal changes
Protect data
Protect security
Write tests
Verify results
Report honestly
```

---

# 100. FINAL PRINCIPLE

The AI must never optimize for:

```text
"Generate code as fast as possible."
```

The AI must optimize for:

```text
Correct Code
+
Correct Business Behavior
+
Correct Data
+
Correct Security
+
Correct Tests
+
Maintainable Architecture
```

The objective is not:

```text
More Code
```

The objective is:

```text
Correct Software
```

When uncertain:

```text
Do not guess.
Inspect.
Verify.
Ask when necessary.
```

When the system rules are clear:

```text
Follow them exactly.
```
