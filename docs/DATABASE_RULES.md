# DATABASE_RULES.md

# Database Architecture & Rules

This document is the authoritative source for database structure, data integrity, persistence behavior, migrations, indexing, transactions, and database safety.

AI MUST follow these rules when creating or modifying database-related code.

AI MUST NOT invent, silently change, or remove database behavior.

If a database requirement is ambiguous or conflicts with the existing schema, STOP and ask the human engineer.

---

# 1. DATABASE PRINCIPLES

The database must prioritize:

* data integrity
* consistency
* correctness
* traceability
* performance
* scalability
* security
* maintainability

Database design must reflect the domain model.

Do not design tables merely to make the current API implementation easier.

---

# 2. DATABASE TECHNOLOGY

### Primary Database

```text
MySQL
```

### ORM

```text
TypeORM
```

### Cache

```text
Redis
```

### Queue

```text
BullMQ
```

Actual versions and configuration must be defined in the project configuration.

AI must use the existing database stack.

Do not introduce another database or ORM without explicit approval.

---

# 3. SOURCE OF TRUTH

Database structure must be consistent across:

```text
DOMAIN_RULES.md
ARCHITECTURE.md
DATABASE_RULES.md
Entity definitions
Migrations
Tests
```

If these sources conflict:

1. STOP.
2. Identify the conflict.
3. Report the affected entities.
4. Ask the human engineer which definition is authoritative.

Do not silently choose one.

---

# 4. ENTITY DESIGN

Every important domain entity should have an explicit database representation.

Examples:

```text
User
Role
Permission
Organization
Branch
Warehouse
Product
ProductVariant
Customer
Supplier
Purchase
PurchaseItem
Sale
SaleItem
Payment
Return
StockMovement
Account
JournalEntry
JournalEntryLine
```

Actual project entities must be documented separately.

AI must not create duplicate entities representing the same business concept.

---

# 5. TABLE NAMING

Use one consistent naming convention.

Example:

```text
users
roles
permissions
organizations
branches
warehouses
products
product_variants
sales
sale_items
stock_movements
```

Do not mix conventions such as:

```text
user
Users
tbl_users
salesItems
sale_items
```

unless the existing project explicitly requires it.

---

# 6. PRIMARY KEYS

Every persistent entity must have a primary key.

Preferred project strategy:

```text
UUID
```

if UUID is the project's established architecture.

Example:

```text
id: UUID
```

Primary keys must be:

* unique
* stable
* non-null
* immutable

Do not use business values such as:

```text
email
SKU
invoice number
phone number
```

as the primary key unless explicitly designed that way.

---

# 7. BUSINESS IDENTIFIERS

Business identifiers are different from database primary keys.

Examples:

```text
Product
    id → database identity
    sku → business identifier

Sale
    id → database identity
    invoice_number → business identifier
```

Business identifiers must have appropriate uniqueness rules.

Do not assume a business identifier is unique unless the domain requires it.

---

# 8. FOREIGN KEYS

Relationships between entities must be explicitly represented.

Example:

```text
Sale
  ↓
SaleItem
  ↓
Product
```

Foreign keys must enforce valid relationships where appropriate.

Do not store relational IDs as plain text without a reason.

Bad:

```text
product_id VARCHAR(255)
```

when the actual relationship is a foreign key to `products.id`.

Prefer an actual database relationship.

---

# 9. REFERENTIAL INTEGRITY

The database must prevent invalid references.

Examples:

```text
SaleItem.product_id
    ↓
must reference an existing Product
```

```text
Sale.organization_id
    ↓
must reference an existing Organization
```

Do not rely only on application-level validation for critical referential integrity.

Use database constraints where appropriate.

---

# 10. NULLABILITY

A field should be nullable only when the domain allows the value to be absent.

Do not use nullable fields merely because they make implementation easier.

For every important field determine:

```text
Required?
Optional?
Nullable?
Default?
```

Example:

```text
email
    NOT NULL
```

if every user must have an email.

---

# 11. DEFAULT VALUES

Defaults must represent real domain behavior.

Good examples:

```text
created_at → current timestamp
status → DRAFT
is_active → true
```

Do not add arbitrary defaults to hide missing business logic.

Avoid:

```text
quantity → 0
price → 0
user_id → random/default user
```

unless explicitly required by the domain.

---

# 12. ENUM / STATUS VALUES

Status values must be explicitly defined.

Example:

```text
DRAFT
CONFIRMED
COMPLETED
CANCELLED
```

AI must not invent additional statuses.

Before adding a status:

1. Check `DOMAIN_RULES.md`.
2. Check existing database values.
3. Check application state transitions.
4. Check API consumers.
5. Check tests.

---

# 13. IMMUTABLE DATA

Some database records become immutable after a business operation is completed.

Examples:

```text
Completed Sale
Accounting Journal
Payment Confirmation
Stock Movement
```

Do not allow arbitrary updates to immutable transactional records.

If a correction is required, use the domain-approved mechanism:

```text
Return
Reversal
Adjustment
Cancellation
Correction Entry
```

according to the project's rules.

---

# 14. SOFT DELETE

Soft delete must be used only where appropriate.

Example:

```text
deleted_at
```

or:

```text
is_active
```

Do not automatically add soft delete to every table.

Transactional records should generally remain traceable.

Examples that may require retention:

```text
Sales
Payments
Stock Movements
Accounting Entries
Audit Logs
```

Actual project policy must be defined here.

---

# 15. AUDIT FIELDS

Important entities should use standard audit fields where appropriate.

Example:

```text
id
created_at
updated_at
created_by
updated_by
deleted_at
```

Not every table necessarily needs every field.

AI must follow the existing project convention.

---

# 16. TIMESTAMP RULES

Use consistent timestamp handling.

Document:

```text
Storage timezone:
Application timezone:
Business timezone:
```

Recommended:

```text
Database
    ↓
UTC

Application
    ↓
Business/user timezone conversion
```

Do not mix:

```text
UTC
local server time
user local time
```

without an explicit policy.

---

# 17. MONEY & DECIMAL TYPES

Never use floating-point database types for financial values.

Avoid:

```text
FLOAT
DOUBLE
```

for money.

Prefer an exact decimal representation such as:

```text
DECIMAL(precision, scale)
```

Example:

```text
DECIMAL(18,2)
```

Actual precision and scale must be defined by the project.

All monetary columns must follow the same currency/precision rules unless explicitly different.

---

# 18. QUANTITY TYPES

Inventory quantities may require decimal values depending on the business.

Examples:

```text
integer quantity
decimal quantity
```

The database type must match the business requirement.

Do not automatically use integers for all inventory quantities.

---

# 19. CURRENCY

Document how currency is represented.

Example:

```text
currency_code
amount
```

Avoid storing currency only as an implicit assumption.

If a transaction can contain multiple currencies, document the exchange-rate rules.

AI must not invent currency conversion behavior.

---

# 20. PRICE STORAGE

Prices must be stored consistently.

Example:

```text
unit_price
discount_amount
tax_amount
subtotal
grand_total
```

Define:

* precision
* scale
* currency
* rounding behavior

Do not recalculate historical transaction prices from current product prices.

A completed transaction should preserve the price used at transaction time.

---

# 21. INVENTORY DATA

Stock must be traceable.

Important concepts may include:

```text
stock_balances
stock_movements
```

A stock balance represents the current state.

A stock movement represents why the state changed.

Example:

```text
PURCHASE
SALE
SALE_RETURN
PURCHASE_RETURN
TRANSFER
ADJUSTMENT
```

AI must not directly modify stock without following the project's inventory architecture.

---

# 22. STOCK CONSISTENCY

If the project uses stock movements:

```text
Current Stock
=
Valid Stock Movement Result
```

must remain consistent.

If stock balances are cached/materialized:

```text
Stock Movement
    ↓
Stock Balance Update
```

must be atomic where required.

Never update one side without considering the other.

---

# 23. TRANSACTION BOUNDARIES

Use database transactions when multiple writes must succeed or fail together.

Example:

```text
Create Sale
    ↓
Create Sale Items
    ↓
Update Stock
    ↓
Create Payment
    ↓
Create Accounting Entry
```

If these operations form one business transaction, they should share an appropriate database transaction boundary.

Do not assume multiple ORM operations are automatically atomic.

---

# 24. TRANSACTION ISOLATION

Use the lowest isolation level that safely satisfies the business requirement.

Increase isolation only when necessary.

Document special cases such as:

```text
stock reservation
payment processing
financial posting
concurrent approval
```

Do not change transaction isolation globally without justification.

---

# 25. CONCURRENCY CONTROL

The database must protect shared state against concurrent operations.

Examples:

```text
User A sells last stock
User B sells last stock
```

Both requests must not incorrectly succeed.

Possible mechanisms:

* row locking
* optimistic locking
* unique constraints
* atomic updates
* transactions

Use the mechanism appropriate to the existing architecture.

---

# 26. UNIQUE CONSTRAINTS

Use database-level unique constraints for values that must be unique.

Examples:

```text
organization.code
product.sku
user.email
invoice.invoice_number
```

Only add uniqueness when the domain requires it.

Do not rely only on:

```text
SELECT → check → INSERT
```

because concurrent requests can bypass application-level checks.

---

# 27. CHECK CONSTRAINTS

Use database constraints where appropriate for fundamental invariants.

Examples:

```text
quantity > 0
price >= 0
amount >= 0
```

However, complex business rules should remain in the application/domain layer when database constraints would become difficult to maintain.

---

# 28. INDEXING

Indexes must support real query patterns.

Before creating an index, identify:

* query pattern
* filter columns
* join columns
* sort columns
* uniqueness requirements

Common candidates:

```text
foreign keys
frequently searched fields
unique business identifiers
common filtering fields
```

Do not add indexes blindly.

Every unnecessary index increases:

* storage
* write cost
* update cost
* maintenance cost

---

# 29. COMPOSITE INDEXES

Use composite indexes when query patterns require them.

Example:

```text
organization_id
branch_id
created_at
```

For queries such as:

```text
WHERE organization_id = ?
AND branch_id = ?
ORDER BY created_at DESC
```

Index order must follow actual query patterns.

Do not create composite indexes based only on column names.

---

# 30. QUERY SAFETY

Never construct unsafe SQL from raw user input.

Avoid directly concatenating:

```text
WHERE
ORDER BY
LIMIT
table names
column names
```

from untrusted input.

Use:

* parameterized queries
* ORM query parameters
* allowlists for sortable/filterable fields

---

# 31. N+1 QUERY PREVENTION

Be aware of N+1 queries.

Example:

```text
Get 100 sales
    ↓
100 separate customer queries
```

Prefer appropriate:

* joins
* eager loading where justified
* batching
* query optimization

Do not blindly eager-load every relationship.

---

# 32. PAGINATION AT DATABASE LEVEL

Large datasets must be paginated at the database/query level.

Never:

```text
SELECT all rows
    ↓
load into memory
    ↓
slice results
```

Prefer database-level:

```text
LIMIT
OFFSET
cursor pagination
```

according to the project's API contract.

---

# 33. LARGE DATASETS

Do not assume tables will remain small.

Consider:

* indexes
* pagination
* archival
* partitioning where justified
* batch processing
* query optimization

Do not introduce partitioning prematurely.

---

# 34. MIGRATIONS

All schema changes must be represented through migrations.

Never rely on manually changing production tables.

Migration files must be:

* deterministic
* reviewable
* reversible where practical
* ordered
* tested

---

# 35. MIGRATION SAFETY

Before creating a migration:

1. Inspect the current schema.
2. Identify affected tables.
3. Identify affected indexes.
4. Identify foreign keys.
5. Identify existing data.
6. Consider production size.
7. Consider rollback.
8. Test migration.

Do not assume an empty development database represents production.

---

# 36. DESTRUCTIVE MIGRATIONS

Destructive changes require explicit approval.

Examples:

```text
DROP TABLE
DROP COLUMN
TRUNCATE
DELETE large dataset
change incompatible column type
remove constraint
remove index used by production queries
```

AI must STOP before executing or proposing an irreversible production operation without approval.

---

# 37. ZERO-DOWNTIME / SAFE MIGRATIONS

For production systems, prefer safe migration strategies.

Example:

```text
Step 1
Add nullable/new column

Step 2
Deploy application supporting both versions

Step 3
Backfill data

Step 4
Switch application behavior

Step 5
Add constraints

Step 6
Remove old column later
```

Do not combine risky schema changes into one migration unnecessarily.

---

# 38. DATA BACKFILL

Backfills must consider:

* dataset size
* transaction duration
* locking
* memory usage
* retries
* failure recovery
* idempotency

Large backfills should generally be processed in batches.

Never assume a production table contains only a few thousand rows.

---

# 39. CASCADE RULES

Foreign-key cascade behavior must be explicitly chosen.

Possible behaviors:

```text
CASCADE
RESTRICT
SET NULL
```

Do not use:

```text
ON DELETE CASCADE
```

automatically.

Consider whether deleting a parent should delete historical business data.

Financial and transactional records generally require special care.

---

# 40. ARCHIVAL

If historical data becomes large, define archival behavior.

Archive rules must specify:

* eligible records
* retention period
* archive storage
* restore process
* reporting behavior
* authorization

Do not delete old business data merely to improve performance.

---

# 41. SECRETS & SENSITIVE DATA

Never store secrets or sensitive credentials unnecessarily.

Never store:

* plaintext passwords
* API secret keys in database rows without explicit security design
* access tokens unnecessarily
* encryption keys as plaintext

Passwords must use secure one-way password hashing.

---

# 42. PERSONAL DATA

Protect personally identifiable information.

Examples:

```text
email
phone
address
identity information
payment-related information
```

Only store data required by the business.

Avoid exposing sensitive fields through generic ORM serialization.

---

# 43. DATABASE LOGGING

Do not log sensitive database values.

Avoid logging:

* passwords
* tokens
* payment credentials
* personal information unnecessarily

SQL logging should be carefully controlled in production.

---

# 44. DATABASE CONNECTION MANAGEMENT

Database connections must have appropriate:

* pool size
* timeout
* retry behavior
* connection lifetime

Do not create a new database connection for every request manually.

Use the project's ORM connection management.

---

# 45. REDIS RULES

Redis is not automatically the source of truth.

Define what Redis stores.

Examples:

```text
cache
sessions
rate limits
distributed locks
BullMQ queues
temporary data
```

Important persistent business data must remain in the primary database unless explicitly designed otherwise.

Cache invalidation must be considered whenever underlying data changes.

---

# 46. QUEUE / DATABASE CONSISTENCY

When database transactions interact with BullMQ or other queues, consider transaction boundaries.

Example:

```text
Database transaction
        ↓
Commit
        ↓
Publish/queue job
```

Do not enqueue a job that assumes database state exists before the transaction commits.

For critical workflows, use an appropriate pattern such as an outbox mechanism when required by the architecture.

---

# 47. SOFT DELETE & QUERY RULES

If soft delete is used:

Every normal query must respect deleted records according to the domain rules.

Be explicit when querying:

```text
active records
deleted records
all records
```

Do not accidentally expose deleted data through:

* APIs
* reports
* exports
* search
* background jobs

---

# 48. TENANT ISOLATION

If the system is multi-tenant:

Every tenant-owned query must enforce the tenant boundary.

Example:

```text
WHERE organization_id = authenticatedOrganizationId
```

Do not trust:

```text
organizationId
```

from the client when it can be derived from authentication context.

Tenant isolation must be enforced server-side.

---

# 49. BRANCH / WAREHOUSE ISOLATION

Where applicable, queries must respect:

```text
Organization
    ↓
Branch
    ↓
Warehouse
```

Users must only access records within their authorized scope.

This applies to:

* CRUD
* search
* reports
* exports
* background jobs
* bulk operations

---

# 50. ORM RULES

When using TypeORM:

Prefer explicit entities and relationships.

Avoid exposing ORM entities directly as API responses.

Be careful with:

* lazy loading
* eager loading
* cascading
* orphan removal
* soft delete
* transactions
* query builders

Do not use ORM cascade behavior without understanding its database consequences.

---

# 51. REPOSITORY RULES

Repositories should handle persistence concerns.

Business decisions should not be hidden inside generic repositories.

Avoid repositories containing unrelated domain logic.

Prefer:

```text
Controller
    ↓
Application Service
    ↓
Domain Logic
    ↓
Repository
    ↓
Database
```

according to the project's architecture.

---

# 52. ENTITY RELATIONSHIP RULES

Relationships must reflect actual domain ownership.

Example:

```text
Sale
 ├── SaleItems
 ├── Payments
 └── Customer
```

Document whether relationships are:

* one-to-one
* one-to-many
* many-to-one
* many-to-many

AI must not change cardinality without approval.

---

# 53. MANY-TO-MANY RELATIONSHIPS

Many-to-many relationships should use explicit join tables when the relationship itself contains business data.

Example:

```text
Role
    ↓
RolePermission
    ↓
Permission
```

If the relationship has fields such as:

```text
created_at
assigned_by
scope
```

the join table should be modeled explicitly.

---

# 54. DENORMALIZATION

Do not duplicate data without a reason.

Denormalization may be used for:

* performance
* reporting
* caching
* materialized views
* historical snapshots

When duplicating data, document:

```text
source of truth
synchronization strategy
update timing
failure behavior
```

---

# 55. HISTORICAL SNAPSHOTS

Transactional records should preserve historical values when required.

Example:

A sale should generally preserve:

```text
product name at sale time
SKU at sale time
unit price at sale time
discount at sale time
tax at sale time
```

Do not assume the current Product record represents historical transaction data.

---

# 56. DATABASE PERFORMANCE

Before optimizing:

1. Identify the slow query.
2. Measure it.
3. Inspect the execution plan.
4. Identify the bottleneck.
5. Apply the smallest appropriate optimization.
6. Measure again.

Do not optimize based on assumptions alone.

---

# 57. QUERY OPTIMIZATION

Do not solve every performance problem by adding indexes.

Possible solutions include:

* better query
* correct index
* pagination
* batching
* caching
* denormalization
* background processing

Choose based on evidence.

---

# 58. DATABASE TESTING

Database-related tests should cover:

* migrations
* constraints
* relationships
* transactions
* unique constraints
* authorization boundaries
* concurrency-sensitive operations
* soft delete behavior
* business invariants

Important database behavior must not be tested only through mocks.

Use integration tests where real database behavior matters.

---

# 59. DATABASE CHANGE CHECKLIST

Before completing a database change:

```text
[ ] Schema inspected
[ ] Existing relationships inspected
[ ] Domain rules checked
[ ] API impact checked
[ ] Migration created
[ ] Migration tested
[ ] Existing data considered
[ ] Constraints checked
[ ] Indexes checked
[ ] Transaction impact checked
[ ] Concurrency impact checked
[ ] Authorization impact checked
[ ] Tests updated
[ ] Documentation updated
```

---

# 60. AI DATABASE RULES

AI MUST:

1. Inspect the existing schema before modifying it.
2. Inspect related entities.
3. Inspect existing migrations.
4. Check `DOMAIN_RULES.md`.
5. Check `API_CONTRACTS.md`.
6. Consider existing data.
7. Consider indexes and constraints.
8. Consider transactions.
9. Consider concurrency.
10. Create/update migrations.
11. Update tests.
12. Explain database impact.

AI MUST NOT:

* drop tables without approval
* delete production data
* reset databases
* invent relationships
* invent columns without domain justification
* remove constraints casually
* add indexes blindly
* use FLOAT/DOUBLE for money
* expose database entities directly
* bypass tenant boundaries
* trust client-provided tenant IDs
* silently change existing schema behavior

---

# 61. DATABASE CHANGE REPORT

When completing a database-related task, AI should report:

### Schema Changes

```text
[Describe]
```

### Migration

```text
[Migration name]
```

### Data Impact

```text
[Describe]
```

### Index Impact

```text
[Describe]
```

### Constraint Impact

```text
[Describe]
```

### Transaction / Concurrency Impact

```text
[Describe]
```

### Tests Executed

```text
[Describe actual tests]
```

### Risks

```text
[Describe remaining risks]
```

---

# 62. FINAL DATABASE PRINCIPLE

The database is a system of record.

Therefore:

Protect data integrity.

Protect historical data.

Protect relationships.

Protect financial correctness.

Protect tenant boundaries.

Protect transactional consistency.

Prefer explicit constraints over assumptions.

Prefer measured optimization over guesswork.

The AI may implement database changes.

The AI does not own the database design.

The human engineer owns the final schema and data decisions.
