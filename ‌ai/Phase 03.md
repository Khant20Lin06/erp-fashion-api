ရပါတယ်။ **Phase 03 — Database Architecture** က ဒီ project ရဲ့ အရေးအကြီးဆုံး phase တွေထဲက တစ်ခုပါ။ နောက်ပိုင်း **Auth/RBAC → Product → Sales → Purchase → Inventory → Payment → Accounting** အားလုံးက ဒီ database foundation ပေါ်မှာ ဆောက်မှာဖြစ်လို့ AI ကို “entity တွေ create လုပ်” လောက်နဲ့ မထားဘဲ **data ownership, tenant/company isolation, soft delete, audit fields, money/decimal, UUID, indexes, constraints, migrations, transaction boundaries** တွေကို အစကတည်းက ထိန်းထားစေဖို့လိုပါတယ်။

အထူးသဖြင့် မင်းအရင်ပြောထားတဲ့ **user တစ်ယောက်ကို custom role/permission ပေးနိုင်ခြင်း + user/account အလိုက် sales visibility + Super Admin/Sales Manager က overall sales မြင်နိုင်ခြင်း** ကို database architecture က future Phase 06 မှာ support လုပ်နိုင်အောင် foundation ချထားမယ်။ ဒီ Phase မှာ RBAC implementation မလုပ်သေးပါဘူး။

အောက်က prompt ကို **တစ်ခုလုံး copy/paste** လုပ်လို့ရပါတယ်။

# PHASE 03 — DATABASE ARCHITECTURE

# Fashion ERP Backend

You are implementing **Phase 03 — Database Architecture** of the Fashion ERP Backend.

You MUST follow:

**Phase 00 — AI Rules / Source of Truth**

**Phase 01 — Project Foundation**

**Phase 02 — Docker / Infrastructure**

These phases are authoritative.

Do not silently change architectural decisions established by previous phases.

---

# 1. PHASE OBJECTIVE

Design and implement the foundational database architecture for the Fashion ERP Backend using:

```text
MySQL
+
TypeORM
+
NestJS
+
Docker
```

The objective is NOT merely to create tables.

The objective is to establish a:

```text
Consistent
+
Scalable
+
Maintainable
+
Auditable
+
Transaction-safe
+
ERP-friendly
```

database foundation.

This database architecture must support future phases:

```text
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
Phase 22 — Reports / Dashboard
```

Do NOT implement all future business entities in this phase.

Build the database foundation and only the minimum foundational entities required.

---

# 2. FIRST ACTION — INSPECT THE REPOSITORY

Before modifying anything, inspect:

```text
package.json
lockfile
src/
test/
.env
.env.example
Dockerfile
docker-compose.yml
docker-compose.*.yml
tsconfig.json
nest-cli.json
README.md
Phase 01 implementation
Phase 02 implementation
```

Then determine:

1. Is TypeORM already installed?
2. Is MySQL already configured?
3. Is a DataSource already defined?
4. Are entities already present?
5. Are migrations already present?
6. Is `synchronize` enabled?
7. Are existing tables/entities already used by application code?
8. What naming conventions already exist?
9. What UUID strategy already exists?
10. What environment variables are already defined?
11. What database connection strategy is already established?

Do not destroy existing working database code.

Do not create duplicate TypeORM configuration.

---

# 3. DATABASE TECHNOLOGY

The required database stack is:

```text
MySQL
TypeORM
NestJS
```

Use an explicitly defined MySQL version from Phase 02.

Do NOT use:

```text
mysql:latest
```

without an explicit project decision.

Do not replace MySQL with:

```text
PostgreSQL
MongoDB
SQLite
MariaDB
```

unless Phase 00 explicitly requires it.

---

# 4. TYPEORM

Use TypeORM as the ORM.

The project must use:

```text
Entity
Repository
DataSource
Migration
```

appropriately.

Do not mix TypeORM with another ORM.

Do not introduce Prisma or Sequelize.

---

# 5. SYNCHRONIZE MUST NOT BE USED

Do NOT use:

```typescript
synchronize: true
```

for this ERP backend.

Database schema changes must be controlled through migrations.

Preferred:

```typescript
synchronize: false
```

or an equivalent safe configuration.

This is mandatory because ERP systems require predictable schema evolution.

---

# 6. MIGRATION-FIRST DATABASE STRATEGY

Use:

```text
Entity changes
        ↓
Migration generation/review
        ↓
Migration execution
        ↓
Database schema
```

Do NOT use:

```text
Entity changes
        ↓
synchronize: true
        ↓
unknown schema changes
```

Every structural database change must be traceable through a migration.

---

# 7. DATABASE MODULE

Create a clean database infrastructure.

A reasonable structure may be:

```text
src/
├── database/
│   ├── database.module.ts
│   ├── data-source.ts
│   ├── migrations/
│   ├── subscribers/
│   └── ...
```

The exact structure may be adjusted to the existing project.

Do not create unnecessary abstraction layers.

---

# 8. DATABASE CONFIGURATION

Database configuration must come from environment variables.

Do not hard-code:

```text
host
port
username
password
database
```

inside source code.

Use the configuration system established in Phase 01.

---

# 9. DATABASE ENVIRONMENT VARIABLES

Support the project's established convention.

A typical configuration may include:

```text
DB_HOST
DB_PORT
DB_USERNAME
DB_PASSWORD
DB_DATABASE
```

or:

```text
DATABASE_URL
```

If Phase 01 already established one convention, preserve it.

Do not introduce duplicate configuration formats without a reason.

---

# 10. DOCKER DATABASE HOST

When running inside Docker, the API must connect to MySQL using the Docker service name.

For example:

```text
DB_HOST=mysql
DB_PORT=3306
```

Do NOT use:

```text
localhost
127.0.0.1
```

for API → MySQL communication inside Docker.

---

# 11. DATABASE CONNECTION OPTIONS

Configure the TypeORM DataSource appropriately.

The configuration should support:

```text
development
test
staging
production
```

without requiring source-code changes.

Do not expose credentials in logs.

Do not expose connection strings through API responses.

---

# 12. CONNECTION POOL

Configure the MySQL connection pool appropriately.

Do not blindly use huge pool sizes.

The pool should be:

```text
reasonable
configurable
environment-aware
```

Future production tuning belongs to Phase 26.

---

# 13. MYSQL CHARACTER SET

Use a modern Unicode-capable MySQL character set.

Preferred:

```text
utf8mb4
```

The database should correctly support multilingual ERP data.

Do not use old `utf8` configurations that do not provide full Unicode support.

---

# 14. MYSQL COLLATION

Choose an appropriate `utf8mb4` collation.

The selection must be compatible with the chosen MySQL version.

Document the decision.

Do not randomly mix collations across tables.

---

# 15. STORAGE ENGINE

Use:

```text
InnoDB
```

for transactional ERP tables.

Do not use non-transactional storage engines for financial or inventory data.

---

# 16. DATABASE NAMING

Use a consistent naming convention.

Recommended:

```text
snake_case
```

Examples:

```text
users
user_roles
permissions
sales_orders
sales_order_items
inventory_ledgers
```

Do not mix:

```text
camelCase
PascalCase
snake_case
```

randomly in database identifiers.

---

# 17. TABLE NAMING

Use plural table names consistently unless the existing project has an established convention.

Examples:

```text
users
roles
permissions
companies
branches
warehouses
products
customers
sales
```

Document the convention.

---

# 18. COLUMN NAMING

Use:

```text
snake_case
```

Examples:

```text
created_at
updated_at
deleted_at
company_id
branch_id
warehouse_id
```

Entity property names may use normal TypeScript conventions where appropriate, but database column names must remain consistent.

---

# 19. PRIMARY KEY STRATEGY

Use UUIDs for business/application entities unless there is a strong technical reason otherwise.

Preferred:

```text
id: UUID
```

The architecture should avoid exposing sequential IDs as public business identifiers.

Do not use auto-increment integer IDs for all business entities merely because they are easy.

---

# 20. UUID STORAGE

Use a MySQL-compatible UUID representation that balances:

```text
storage efficiency
index performance
TypeORM compatibility
readability
```

Evaluate whether the project should use:

```text
CHAR(36)
```

or:

```text
BINARY(16)
```

before implementation.

Do not choose blindly.

If `BINARY(16)` is selected, create a clean TypeORM-compatible strategy.

Document the decision.

---

# 21. INTERNAL VS PUBLIC IDENTIFIERS

Do not expose database implementation details unnecessarily.

Business/API identifiers should be stable and safe to expose.

Avoid depending on:

```text
auto_increment
row position
database internal ordering
```

for business logic.

---

# 22. TIMESTAMP STRATEGY

Establish consistent timestamp fields.

For most mutable entities:

```text
created_at
updated_at
```

For soft-deletable entities:

```text
deleted_at
```

Use UTC-oriented storage.

Do not mix local timezone timestamps randomly across tables.

---

# 23. TIMEZONE STRATEGY

ERP systems may operate across:

```text
countries
companies
branches
users
```

The database foundation should store timestamps consistently.

Preferred principle:

```text
Store timestamps consistently
+
Convert for presentation/business context
```

Do not store arbitrary local timestamps without documenting the timezone.

Future business-date rules belong to later phases.

---

# 24. MONEY STORAGE

Never use floating-point database types for money.

Do NOT use:

```text
FLOAT
DOUBLE
```

for:

```text
price
cost
subtotal
tax
discount
payment
balance
accounting amount
```

Use an appropriate exact decimal type.

For example:

```text
DECIMAL(18,2)
```

or a more appropriate precision based on ERP requirements.

---

# 25. DECIMAL PRECISION

Do not blindly apply the same precision to every monetary field.

Evaluate:

```text
currency
unit price
quantity
exchange rate
tax rate
percentage
accounting amount
```

Some fields may require different precision.

For example:

```text
Money:
DECIMAL(18,2)

Quantity:
DECIMAL(18,4)

Rate:
DECIMAL(18,6)
```

These are examples, not mandatory values.

Choose and document appropriate precision.

---

# 26. NO FLOATING POINT MONEY

Application code must not convert financial amounts into JavaScript floating-point arithmetic carelessly.

Future accounting/payment logic must preserve exact monetary calculations.

The database foundation must support this.

---

# 27. NULLABILITY

Do not make every field nullable.

Use:

```text
NOT NULL
```

when a value is required.

Use:

```text
NULL
```

only when the business meaning genuinely permits absence.

Avoid:

```text
everything nullable
```

because it creates ambiguous data states.

---

# 28. DEFAULT VALUES

Use database defaults only when they represent genuine invariant behavior.

Examples:

```text
is_active = true
created_at = current timestamp
```

Do not use arbitrary defaults to hide missing application logic.

---

# 29. BOOLEAN STRATEGY

Use a consistent MySQL representation for boolean values through TypeORM.

Examples:

```text
is_active
is_default
is_verified
```

Do not mix:

```text
0/1
Y/N
true/false
```

randomly.

---

# 30. ENUM STRATEGY

Do not overuse MySQL `ENUM`.

For values that may evolve frequently, prefer lookup/reference tables or controlled application-level values.

Use database enums only when the domain is genuinely stable.

Do not create dozens of enums in the schema.

---

# 31. STATUS FIELDS

Future ERP entities will require statuses.

Examples:

```text
draft
confirmed
cancelled
completed
```

Do not implement every future status now.

However, establish the principle that status transitions must be explicit and validated by business logic.

---

# 32. SOFT DELETE

The ERP system should support soft deletion where appropriate.

Typical field:

```text
deleted_at
```

Do not physically delete important business records casually.

Especially protect:

```text
sales
payments
inventory movements
accounting entries
audit records
```

from destructive deletion.

---

# 33. SOFT DELETE SCOPE

Do NOT automatically add `deleted_at` to every table.

Evaluate entity by entity.

For example:

May support soft delete:

```text
users
customers
suppliers
products
branches
warehouses
```

Should generally not be freely soft-deleted as a normal business operation:

```text
ledger entries
accounting journal entries
inventory movements
payment transactions
```

Those require domain-specific reversal/cancellation behavior.

---

# 34. AUDIT FIELDS

Foundational entities should be prepared for:

```text
created_at
updated_at
created_by
updated_by
deleted_at
deleted_by
```

However, do not force `created_by` / `updated_by` onto entities before the authentication/user architecture exists if it creates circular dependencies.

Phase 04/05 may complete the audit architecture.

Document the dependency.

---

# 35. CREATED_BY / UPDATED_BY

Where appropriate, future audit fields may reference:

```text
users.id
```

But Phase 03 must avoid creating invalid circular dependencies.

Do not create a fake user table just to satisfy audit fields unless required by the architecture.

---

# 36. BASE ENTITY

If useful, create a reusable base entity for common fields.

Possible fields:

```text
id
created_at
updated_at
deleted_at
```

But do not put business-specific fields into the base entity.

Avoid a giant:

```text
BaseEntity
```

containing unrelated ERP concerns.

---

# 37. BASE ENTITY RULE

A base entity should contain only truly universal fields.

Do NOT place:

```text
company_id
branch_id
warehouse_id
created_by
updated_by
status
is_active
```

into the universal base entity automatically.

These fields have different business semantics.

---

# 38. ORGANIZATION / MULTI-COMPANY PREPARATION

The Fashion ERP must eventually support organizational data such as:

```text
Company
Branch
Warehouse
User
Employee
```

Phase 03 should prepare the database architecture for this.

However:

Do NOT implement the complete organization module yet.

Phase 07 owns:

```text
Organization / Company / Branch / Warehouse
```

---

# 39. TENANCY / DATA ISOLATION

The future architecture must support data visibility such as:

```text
Super Admin
        ↓
All company data

Company Manager
        ↓
Company data

Branch Manager
        ↓
Branch data

Warehouse User
        ↓
Warehouse data

Sales Staff
        ↓
Own account / assigned data
```

Do NOT implement the RBAC logic in Phase 03.

But the schema design must not prevent this.

---

# 40. USER-SCOPED DATA PREPARATION

Future sales visibility may require relationships such as:

```text
user
employee
sales_account
sales_order
sales_order.created_by
sales_order.sales_rep_id
```

Do not implement the complete Sales schema now.

However, do not design the database in a way where all sales data can only be associated with a global user.

Future row-level visibility must be possible.

---

# 41. ACCOUNT-SCOPED SALES PREPARATION

The system may require:

```text
Sales Staff A
    ↓
Account A
    ↓
Only Account A sales visible

Sales Staff B
    ↓
Account B
    ↓
Only Account B sales visible

Sales Manager
    ↓
Overall sales
```

This must be possible through future relational design.

Do NOT solve this with hard-coded role checks in the database.

Do NOT implement the full feature now.

---

# 42. RBAC DATABASE PREPARATION

Phase 06 will implement Dynamic RBAC.

The architecture must support:

```text
User
  ↓
Role
  ↓
Permission
```

and potentially:

```text
User
  ↓
Direct Permission
```

or other explicit permission overrides if Phase 06 requires them.

Do not create a fixed list of 12 hard-coded roles.

Roles must be data-driven.

---

# 43. DYNAMIC ROLE PREPARATION

The future system should allow Super Admin to create custom roles such as:

```text
Sales Staff
Senior Sales
Sales Manager
Warehouse Staff
Inventory Controller
Accountant
Purchase Staff
Branch Manager
```

without changing source code.

Phase 03 only prepares the database strategy.

Phase 06 implements the actual role/permission system.

---

# 44. PERMISSION GRANULARITY PREPARATION

The future permission model may support:

```text
read
create
update
delete
approve
export
```

and possibly:

```text
view_all
view_own
view_branch
view_company
```

Do not implement these in Phase 03.

But avoid a database architecture that prevents them.

---

# 45. DATA VISIBILITY PREPARATION

Future permissions may involve both:

```text
Action permission
```

and:

```text
Data scope
```

These are different concepts.

Example:

```text
Sales Staff
    action = read
    scope = own

Sales Manager
    action = read
    scope = branch/all

Super Admin
    action = read
    scope = all
```

The database foundation must not confuse these concepts.

---

# 46. FOREIGN KEY STRATEGY

Use foreign keys where referential integrity is important.

Examples:

```text
child.company_id → companies.id
child.user_id → users.id
child.product_id → products.id
```

when those tables exist.

Do not add meaningless foreign keys.

Do not remove referential integrity merely to make migrations easier.

---

# 47. FOREIGN KEY DELETE RULES

Choose `ON DELETE` behavior deliberately.

Do not blindly use:

```text
CASCADE
```

everywhere.

For ERP data, cascading deletes can be dangerous.

Especially avoid destructive cascading across:

```text
sales
inventory
payments
accounting
```

unless the domain explicitly requires it.

---

# 48. FOREIGN KEY UPDATE RULE

Primary keys should normally be immutable.

Do not design business workflows around updating IDs.

Avoid unnecessary:

```text
ON UPDATE CASCADE
```

for primary keys.

---

# 49. UNIQUE CONSTRAINTS

Use unique constraints for genuine business invariants.

Examples may include:

```text
email
SKU
company code
branch code
warehouse code
```

but only when the uniqueness scope is correct.

For example:

A SKU might be unique globally or within a company depending on business requirements.

Do not assume global uniqueness without evaluating scope.

---

# 50. COMPOSITE UNIQUE CONSTRAINTS

Future ERP entities may require scoped uniqueness.

Examples:

```text
(company_id, code)
(company_id, sku)
(branch_id, code)
```

Use composite unique constraints where business rules require them.

Do not create unnecessary global uniqueness.

---

# 51. INDEX STRATEGY

Indexes must be designed based on actual query patterns.

Future common filters include:

```text
company_id
branch_id
warehouse_id
user_id
created_at
status
deleted_at
sku
email
```

Do not create indexes on every column.

Every index has:

```text
storage cost
write cost
maintenance cost
```

---

# 52. COMPOSITE INDEX ORDER

For composite indexes, consider query patterns and column selectivity.

Example:

```text
(company_id, branch_id, created_at)
```

may support:

```text
WHERE company_id = ?
AND branch_id = ?
ORDER BY created_at
```

But do not create this index blindly.

Inspect expected future access patterns.

---

# 53. SOFT DELETE INDEXING

If soft delete is used heavily, evaluate whether queries frequently use:

```text
WHERE deleted_at IS NULL
```

Do not automatically index `deleted_at` alone without considering MySQL query patterns.

Use appropriate composite indexes where needed.

---

# 54. DATE INDEXING

ERP reports will frequently query:

```text
created_at
transaction_date
sale_date
payment_date
```

The schema should allow efficient time-based querying.

Do not add every possible date index now.

Create indexes when the corresponding foundational entities exist.

---

# 55. TRANSACTION STRATEGY

ERP operations require database transactions.

Examples:

```text
Sale confirmation
Payment posting
Inventory movement
Purchase receipt
Accounting posting
```

Phase 03 must establish that TypeORM transaction support will be used.

Do not implement full business transactions yet.

---

# 56. TRANSACTION RULE

Future multi-table business operations must not rely on independent `save()` calls when atomicity is required.

Preferred conceptual pattern:

```text
Transaction
    ↓
Operation A
    ↓
Operation B
    ↓
Operation C
    ↓
COMMIT
```

If any critical operation fails:

```text
ROLLBACK
```

---

# 57. TRANSACTION MANAGER

Do not create an overly abstract transaction framework unless required.

Use TypeORM's supported transaction APIs.

Future Phase 04 may establish shared transaction utilities.

---

# 58. DEADLOCK PREPARATION

MySQL transactions may encounter deadlocks under concurrency.

Do not implement complex retry infrastructure in Phase 03 unless necessary.

However, document that future critical operations may require:

```text
deadlock detection
retry
consistent lock ordering
```

especially for inventory and accounting.

---

# 59. OPTIMISTIC VS PESSIMISTIC LOCKING

Do not add locking everywhere.

Future entities may require:

```text
optimistic locking
pessimistic locking
```

depending on business behavior.

Inventory and financial operations will require careful concurrency design.

Document this as a future concern.

---

# 60. MONEY + CURRENCY

Future ERP transactions should support currencies.

The database architecture must not assume:

```text
USD only
THB only
MMK only
```

Do not hard-code a currency into monetary columns.

Future phases will define:

```text
currency
exchange_rate
```

where required.

---

# 61. CURRENCY STORAGE

Do not store currency symbols such as:

```text
$
฿
Ks
```

inside monetary database fields.

Store a currency code/reference.

Example:

```text
USD
THB
MMK
```

Future master-data phase will define the currency architecture.

---

# 62. QUANTITY STORAGE

Inventory quantities may require decimal precision.

Do not use integers for all quantities.

Examples:

```text
1.5 kg
2.250 meter
0.500 unit-equivalent
```

The exact business model will be defined later.

Use appropriate decimal types for quantity fields when they are introduced.

---

# 63. UNIT OF MEASURE PREPARATION

Future product/inventory modules may need:

```text
piece
box
kg
gram
meter
liter
```

Do not implement the complete UOM system in Phase 03.

Ensure the database architecture can support decimal quantities and unit relationships later.

---

# 64. AUDITABILITY

ERP data must be traceable.

Future architecture should support:

```text
who
what
when
```

for important operations.

Phase 03 should establish common timestamp conventions.

Phase 04 and later phases may introduce a proper audit/event architecture.

Do not create an enormous audit-log table without defining its purpose.

---

# 65. IMMUTABLE FINANCIAL DATA

The database architecture must recognize that some records are fundamentally transactional.

Examples:

```text
inventory ledger
payment transaction
accounting journal
stock movement
```

These should not behave like ordinary CRUD entities.

Future phases should use:

```text
append-only
reversal
cancellation
adjustment
```

patterns where appropriate.

Phase 03 only establishes this principle.

---

# 66. ERP DOCUMENT VS LEDGER

Keep in mind that future architecture will distinguish:

```text
Business Document
        ↓
Ledger / Transaction
```

Example:

```text
Sales Order
    ↓
Inventory Movement
    ↓
Accounting Entry
```

Do not collapse all ERP information into one table.

---

# 67. NORMALIZATION

Use relational normalization where appropriate.

Avoid duplicated master data.

For example, do not store:

```text
customer_name
customer_email
customer_phone
```

inside every future sales record as the authoritative customer master.

Instead establish relationships.

However, controlled snapshots may later be needed for historical accuracy.

---

# 68. HISTORICAL SNAPSHOTS

ERP documents may need immutable historical information.

Examples:

```text
billing address at transaction time
shipping address at transaction time
product price at transaction time
tax rate at transaction time
customer name at transaction time
```

Do not implement all snapshots now.

But do not assume that every historical report should always read current master data.

Future Sales/Purchase/Accounting phases must explicitly decide what must be snapshotted.

---

# 69. BUSINESS DOCUMENT NUMBERS

Future ERP documents will need human-readable numbers:

```text
SO-2026-000001
PO-2026-000001
INV-2026-000001
PAY-2026-000001
```

Do not use database UUID as the human-facing document number.

Do not implement the complete document-number generator in Phase 03.

Prepare the architecture for a safe sequence strategy.

---

# 70. DOCUMENT NUMBER CONCURRENCY

Future document numbering must be concurrency-safe.

Do NOT rely on:

```text
SELECT MAX(number) + 1
```

because concurrent requests can produce duplicates.

Phase 03 should document this as a critical future requirement.

---

# 71. SOFT DELETE + UNIQUE VALUES

Be aware that soft-deleted records can conflict with unique constraints.

Example:

```text
customer email
SKU
code
```

A deleted record may still occupy its unique value.

Do not implement ad-hoc workarounds such as:

```text
email_deleted_123@example.com
```

unless explicitly designed.

Future business rules must decide whether deleted records retain uniqueness.

---

# 72. DATA INTEGRITY

Use database constraints to protect basic invariants where appropriate.

Examples:

```text
NOT NULL
UNIQUE
FOREIGN KEY
CHECK where supported and useful
```

Do not rely exclusively on application-level validation for fundamental relational integrity.

---

# 73. CHECK CONSTRAINTS

Use MySQL-supported check constraints carefully.

Possible examples:

```text
quantity >= 0
amount >= 0
```

But do not add constraints that conflict with legitimate business workflows such as:

```text
negative stock adjustments
refunds
accounting credits
```

Evaluate each domain separately.

---

# 74. DECIMAL + SIGN

Do not assume every financial amount must be positive.

Accounting systems may legitimately represent:

```text
debit
credit
adjustment
refund
```

The schema must support the future accounting model.

Do not enforce positive values blindly.

---

# 75. DATABASE SEEDING

Do not create large business seed data in Phase 03.

If necessary, create only minimal development infrastructure seed data.

Do not create fake:

```text
customers
products
sales
payments
```

unless explicitly needed for tests.

---

# 76. MIGRATION NAMING

Use clear migration names.

Examples:

```text
CreateInitialDatabase
CreateUsersTable
CreateCompaniesTable
AddAuditColumns
```

Do not use meaningless:

```text
migration1
migration2
test
fix
final
final2
```

names.

---

# 77. MIGRATION RULE

Every migration must be:

```text
deterministic
reviewable
reversible where practical
```

Do not manually edit production databases outside the migration process without documenting why.

---

# 78. MIGRATION REVERT

Where practical, migrations should implement a meaningful `down()` operation.

However, for destructive changes, understand that a perfect rollback may be impossible after data loss.

Do not pretend destructive migrations are safely reversible if they are not.

---

# 79. MIGRATION TESTING

Test migrations against a clean database.

At minimum verify:

```text
empty database
    ↓
migration up
    ↓
schema created
```

and, where practical:

```text
migration down
    ↓
schema reverted
```

Do not test migrations only against an already populated developer database.

---

# 80. DATABASE RESET

Provide a safe development workflow for resetting the database.

The reset process must be explicit.

Do not create scripts that can accidentally wipe production.

Production database commands must require an explicit production-safe workflow later.

---

# 81. DATABASE TESTING

Prepare database testing architecture.

Future tests may require:

```text
unit tests
integration tests
repository tests
transaction tests
E2E tests
```

Do not connect automated tests to a developer's real database.

---

# 82. TEST DATABASE

Use a separate test database/environment.

Conceptually:

```text
fashion_erp
fashion_erp_test
```

Do not use:

```text
fashion_erp
```

for destructive automated tests.

---

# 83. TEST DATA ISOLATION

Tests must not depend on test execution order.

Avoid:

```text
Test A creates user 1
Test B expects user 1
```

Tests should be isolated or use controlled fixtures/factories.

---

# 84. REPOSITORY PATTERN

Use TypeORM repositories appropriately.

Do not create a custom repository abstraction for every table merely for the sake of abstraction.

Prefer:

```text
Repository
+
Service
+
Domain logic
```

where appropriate.

---

# 85. ACTIVE RECORD VS DATA MAPPER

Follow TypeORM's Data Mapper-oriented approach unless the existing architecture explicitly uses another pattern.

Prefer business logic in services/domain layers rather than putting complex business logic inside entities.

Entities should represent persistence/domain state, not become massive service classes.

---

# 86. ENTITY RESPONSIBILITY

Entities should contain:

```text
identity
relationships
persistent fields
simple invariants where appropriate
```

Avoid putting:

```text
HTTP logic
authorization logic
email sending
queue processing
complex reporting
```

inside entities.

---

# 87. RELATIONSHIP STRATEGY

Use TypeORM relationships carefully:

```text
@OneToMany
@ManyToOne
@OneToOne
@ManyToMany
```

Do not use `ManyToMany` by default.

For ERP systems, explicit junction entities are often preferable because relationships may require:

```text
metadata
status
timestamps
scope
permissions
```

---

# 88. JUNCTION TABLES

When a relationship has business meaning, use an explicit entity.

For example, future RBAC may require:

```text
user_roles
role_permissions
```

rather than a hidden ORM-generated many-to-many table.

Do not implement the complete RBAC schema now.

---

# 89. CASCADE IN TYPEORM

Do not enable:

```typescript
cascade: true
```

everywhere.

Cascading ORM saves can hide data mutations.

Use cascade behavior only where it is explicitly understood and safe.

---

# 90. EAGER RELATIONS

Avoid excessive:

```typescript
eager: true
```

relationships.

ERP queries can become expensive quickly.

Prefer explicit relation loading based on query requirements.

---

# 91. LAZY RELATIONS

Do not introduce lazy relations simply because they are convenient.

Prefer explicit query design.

Future performance work belongs to Phase 26.

---

# 92. N+1 AWARENESS

Design relationships with N+1 query problems in mind.

Do not assume:

```text
find()
```

will efficiently load a complex ERP graph.

Future query optimization should use:

```text
QueryBuilder
select
join
pagination
```

where appropriate.

---

# 93. PAGINATION PREPARATION

Future list APIs will require pagination.

Database indexes should support:

```text
ORDER BY
LIMIT
cursor/range conditions
```

where appropriate.

Do not implement a universal pagination system in Phase 03.

---

# 94. OFFSET VS CURSOR

Do not prematurely force cursor pagination everywhere.

For moderate datasets:

```text
LIMIT/OFFSET
```

may be sufficient.

For large transactional datasets:

```text
cursor/range pagination
```

may become preferable.

Phase 26 will optimize based on real query patterns.

---

# 95. SOFT DELETE QUERY SAFETY

When soft delete is used, normal queries should not accidentally include deleted records.

TypeORM's soft-delete mechanisms may be used where appropriate.

However, reporting/audit queries may intentionally include deleted records.

Do not globally hide historical data without understanding the use case.

---

# 96. DATABASE TRANSACTION BOUNDARIES

Future business operations should define transaction boundaries at the application service/use-case level.

Example:

```text
Confirm Sale
    ├── update sale
    ├── create inventory movement
    ├── create payment
    └── create accounting entry
```

These may need to be coordinated transactionally.

Phase 03 should document this architecture.

Do not implement the full flow yet.

---

# 97. OUTBOX PREPARATION

Phase 18 will implement the Outbox Pattern.

The database architecture must be compatible with:

```text
Business Transaction
        +
Outbox Event
        ↓
COMMIT
```

Do not implement the outbox table unless Phase 18 is intentionally brought forward.

Do not introduce event publishing directly from entities.

---

# 98. REDIS / BULLMQ BOUNDARY

Database transactions must not depend on Redis/BullMQ being immediately available.

Future asynchronous processing should use an outbox or other reliable mechanism where required.

Do not create:

```text
DB transaction
    ↓
Redis publish
    ↓
commit
```

as the only reliability mechanism.

Phase 18/20 will address this.

---

# 99. DATABASE MODULE BOUNDARY

Keep database infrastructure separate from business modules.

Conceptually:

```text
database/
    ↓
TypeORM infrastructure

modules/
    ↓
business/domain modules
```

Do not create circular dependencies between database configuration and business modules.

---

# 100. INITIAL FOUNDATIONAL ENTITIES

Do NOT implement the complete ERP schema.

Only create foundational entities if required by the architecture.

Possible foundational entities may include:

```text
User
```

However, if Phase 05/08 owns user implementation and no current functionality requires it, it is acceptable to defer the actual User entity.

Do NOT create incomplete versions of:

```text
Company
Branch
Warehouse
Product
Customer
Supplier
Sale
Purchase
Payment
Accounting
```

just to populate the database.

---

# 101. AVOID PREMATURE SCHEMA

Do NOT create 50–100 tables in Phase 03.

The goal is database architecture, not completing the entire ERP schema prematurely.

Future phases should introduce their own entities and migrations.

---

# 102. DATABASE DOCUMENTATION

Create a database architecture document.

It should explain:

```text
Database technology
Naming conventions
Primary key strategy
UUID strategy
Timestamp strategy
Soft delete strategy
Money strategy
Decimal precision
Foreign key strategy
Index strategy
Migration strategy
Transaction strategy
Multi-company preparation
RBAC preparation
Data visibility preparation
```

Do not document features that do not exist yet as if they are implemented.

---

# 103. ERD PREPARATION

If practical, create an initial ERD or database architecture diagram.

At this phase, the ERD should focus on foundational relationships rather than all future ERP tables.

Do not create a fake complete ERD for entities that do not exist.

---

# 104. DATABASE NAMING DOCUMENT

Document examples:

```text
users
companies
branches
warehouses
roles
permissions
sales_orders
sales_order_items
inventory_ledgers
journal_entries
```

These are examples of future naming conventions, not necessarily tables to create now.

---

# 105. BUSINESS ID VS DATABASE ID

Future ERP records may need:

```text
UUID:
technical identifier

Document number:
human-facing identifier
```

Do not mix these responsibilities.

---

# 106. UNIQUE BUSINESS IDENTIFIERS

Future fields such as:

```text
email
SKU
code
document_number
```

must have explicitly defined uniqueness scope.

Do not assume all identifiers are globally unique.

---

# 107. COMPANY-SCOPED UNIQUENESS

Because the system may support multiple companies:

```text
Company A
  SKU = ABC001

Company B
  SKU = ABC001
```

may be valid depending on business requirements.

The schema must allow scoped uniqueness when appropriate.

Do not make every code globally unique.

---

# 108. BRANCH-SCOPED DATA

Future entities may belong to:

```text
company
branch
warehouse
```

Do not automatically put all three foreign keys on every table.

Each relationship must represent a real business ownership concept.

---

# 109. WAREHOUSE-SCOPED DATA

Inventory-related entities will eventually need warehouse context.

Do not make inventory records globally scoped without a warehouse relationship.

Do not implement the full inventory model now.

---

# 110. USER-SCOPED DATA

Future sales data may require:

```text
created_by
sales_rep
sales_account
```

Do not assume `created_by` alone is sufficient to represent business ownership.

The future Sales module should explicitly distinguish:

```text
who created the record
```

from:

```text
who owns/is responsible for the sale
```

---

# 111. ACCOUNT OWNERSHIP PREPARATION

The system may support sales accounts assigned to users/employees.

Future architecture should allow:

```text
User
    ↓
Employee
    ↓
Sales Account
    ↓
Sales
```

without forcing sales visibility to be based only on roles.

This is critical for Phase 06.

Do not implement the full model in Phase 03.

---

# 112. ROLE VS DATA SCOPE

Database architecture must support the distinction:

```text
Role
    = what actions can the user perform?

Data Scope
    = which records can the user access?
```

Do not combine these concepts into one `role` column.

---

# 113. DIRECT USER PERMISSIONS PREPARATION

The future system may support:

```text
Role permissions
+
User-specific permission overrides
```

Do not implement this now.

But the database architecture should allow it without redesigning all business tables.

---

# 114. AUDIT TRAIL PREPARATION

Future critical operations should be auditable.

The database foundation should support:

```text
created_at
updated_at
created_by
updated_by
```

where applicable.

Do not implement a generic audit history for every field yet.

Phase 04/23/27 may extend this.

---

# 115. NO HARD DELETE OF BUSINESS HISTORY

Future architecture must avoid:

```text
DELETE FROM inventory_ledger
DELETE FROM journal_entries
DELETE FROM payment_transactions
```

as normal CRUD operations.

Use reversal/cancellation mechanisms.

Phase-specific implementations will enforce this.

---

# 116. DATABASE ERROR HANDLING

Database errors must not expose raw MySQL errors directly to API clients.

Examples:

```text
duplicate key
foreign key violation
connection failure
deadlock
```

should eventually be mapped into controlled application errors.

Phase 04 may establish the shared exception/error mapping.

Phase 03 must avoid exposing database internals as API contracts.

---

# 117. MIGRATION TRANSACTION SAFETY

Where supported and appropriate, migrations should run safely within transactions.

However, understand that some MySQL schema operations have transactional limitations.

Do not falsely assume every DDL statement behaves like a normal transaction.

Document important limitations when relevant.

---

# 118. DATABASE BACKUP

Do not implement full production backup infrastructure in Phase 03.

However, document that:

```text
Database migrations
≠
Database backups
```

Production backup strategy belongs to Phase 29.

---

# 119. DISASTER RECOVERY

Do not implement disaster recovery in this phase.

Document it as a future production-readiness concern.

---

# 120. DATABASE SECURITY

At minimum:

* no secrets in source code
* no production credentials committed
* application DB user should not unnecessarily use root
* database should not be publicly exposed in production
* least privilege should be considered

Do not use MySQL root credentials for the application in production.

For local development, root may exist only for initialization/admin purposes.

---

# 121. DATABASE USER STRATEGY

Prefer separate credentials for:

```text
MySQL root/admin
Application user
Test user
```

when practical.

Do not give the application unnecessary administrative privileges.

---

# 122. PRODUCTION DATABASE RULE

Do not configure production credentials in repository files.

Production secret management belongs to deployment/production phases.

---

# 123. DATABASE CONNECTION RETRY

Do not add unlimited connection retries.

If retry behavior exists:

```text
bounded
observable
configurable
```

is preferred.

Do not hide a permanently broken database configuration behind infinite retries.

---

# 124. DATABASE STARTUP

Docker startup may occur before MySQL is ready.

The application should handle this predictably.

Use infrastructure readiness and application startup behavior rather than arbitrary sleep commands.

---

# 125. DATABASE SEED RULE

Do not seed real production-like customer or sales data.

Development seed data should be:

```text
small
deterministic
safe
```

if needed.

---

# 126. SCHEMA REVIEW

Before applying migrations, review:

```text
table names
column names
data types
nullability
defaults
foreign keys
unique constraints
indexes
delete rules
```

Do not blindly generate and execute migrations without reviewing them.

---

# 127. MIGRATION REVIEW CHECKLIST

For each migration ask:

### Does it preserve existing data?

### Does it create unintended destructive changes?

### Are indexes appropriate?

### Are foreign keys correct?

### Are delete rules safe?

### Are data types correct?

### Are nullable fields intentional?

### Is rollback understood?

### Does it work on a clean database?

---

# 128. DATABASE PERFORMANCE BASELINE

Do not prematurely optimize.

However, avoid obvious problems such as:

```text
missing primary keys
missing foreign keys
unbounded text fields
FLOAT for money
indexes on every column
```

Performance optimization belongs primarily to Phase 26.

---

# 129. LARGE TABLE PREPARATION

Future tables may become large:

```text
sales_orders
sales_order_items
inventory_ledger
payments
journal_entries
audit_logs
```

Do not implement partitioning in Phase 03 unless there is a demonstrated requirement.

Document that large-table strategy will be evaluated later.

---

# 130. REPORTING PREPARATION

Reports will require efficient queries.

Do not create duplicated reporting tables prematurely.

Phase 22 will evaluate:

```text
aggregations
materialized/reporting data
indexes
read models
caching
```

based on actual requirements.

---

# 131. DATABASE ARCHITECTURE PRINCIPLE

Prefer:

```text
Strong relational integrity
+
Explicit relationships
+
Controlled migrations
+
Exact monetary types
+
Safe transactions
+
Clear ownership
```

over:

```text
Flexible but ambiguous schema
+
Implicit relationships
+
Automatic synchronization
+
Floating-point money
+
Hard deletes
```

---

# 132. QUALITY GATE

Before declaring Phase 03 complete, verify:

```text
TypeORM configuration             ✓
MySQL connection                  ✓
Migration configuration            ✓
Synchronize disabled              ✓
Naming conventions                ✓
UUID strategy                     ✓
Timestamp strategy                ✓
Soft delete strategy              ✓
Money strategy                    ✓
Decimal strategy                  ✓
Foreign key strategy              ✓
Index strategy                    ✓
Transaction strategy              ✓
Environment configuration         ✓
Test database isolation           ✓
Migration up                      ✓
Migration rollback where possible ✓
Clean database migration         ✓
Docker database connectivity     ✓
Documentation                    ✓
```

Only mark an item as passed if it was actually verified.

---

# 133. REQUIRED VERIFICATION

Run the appropriate project commands to verify:

```text
Application build
TypeScript compilation
Lint
Unit tests
E2E tests
TypeORM/DataSource initialization
Migration generation/validation
Migration execution
Clean database migration
```

Use the project's actual package manager.

Do not invent commands.

---

# 134. CLEAN DATABASE TEST

Perform a clean database test.

Conceptually:

```text
Empty MySQL database
        ↓
Run migrations
        ↓
All migrations succeed
        ↓
Expected schema exists
```

Do not rely only on an already initialized local database.

---

# 135. MIGRATION REPEATABILITY

Verify that migrations do not accidentally run twice.

The migration system must correctly track executed migrations.

Do not manually modify migration history tables.

---

# 136. DATABASE CONNECTION TEST

Verify the NestJS application can connect to MySQL using the Docker service.

Expected conceptual flow:

```text
NestJS
   ↓
TypeORM
   ↓
Docker network
   ↓
mysql:3306
   ↓
MySQL
```

Do not test using host `localhost` from inside the container.

---

# 137. SCHEMA INSPECTION

After migration, inspect the actual MySQL schema.

Verify:

```text
tables
columns
types
indexes
foreign keys
constraints
```

Do not assume generated SQL matches your intention.

---

# 138. NO UNRELATED BUSINESS LOGIC

Do not implement:

```text
Authentication
RBAC
Roles
Permissions
Company management
Branch management
Warehouse management
Products
Customers
Suppliers
Sales
Purchase
Inventory
Payment
Accounting
Redis caching
BullMQ workers
Reports
```

in this phase.

Only establish the database architecture needed for future phases.

---

# 139. PHASE 04 PREPARATION

The database foundation must be ready for:

```text
Phase 04 — Core / Shared Infrastructure
```

Phase 04 should be able to build:

```text
Common database utilities
Transaction helpers
Base entity utilities
Audit infrastructure
Error mapping
Shared decorators/utilities
```

without redesigning the database foundation.

---

# 140. PHASE 05 / 06 PREPARATION

The database must be ready for:

```text
Authentication
+
Dynamic RBAC
+
Data Visibility
```

without assuming a fixed set of roles.

The schema must allow future relationships between:

```text
users
roles
permissions
companies
branches
warehouses
employees
sales accounts
```

as those phases introduce them.

---

# 141. PHASE 07 / 08 PREPARATION

The database must support:

```text
Company
Branch
Warehouse
User
Employee
Account
```

with appropriate ownership relationships.

Do not create incomplete versions now merely to anticipate the next phase.

---

# 142. PHASE 12 / 14 / 15 PREPARATION

The architecture must support future:

```text
Sales
Purchase
Inventory
Inventory Ledger
```

with:

```text
transaction safety
warehouse scope
user/account ownership
historical integrity
auditability
```

Do not implement those tables yet unless required by existing repository functionality.

---

# 143. PHASE 16 / 17 PREPARATION

The architecture must support future:

```text
Payments
Accounting
Double-entry bookkeeping
```

with exact monetary types and transactional integrity.

Do not use floating point money.

Do not design financial data as ordinary CRUD.

---

# 144. FINAL DATABASE PRINCIPLES

The implementation must follow these principles:

```text
1. UUID-based business/application identifiers
2. Migration-first schema management
3. synchronize=false
4. InnoDB
5. utf8mb4
6. Exact DECIMAL monetary values
7. Consistent UTC-oriented timestamps
8. Controlled soft deletion
9. Explicit foreign keys
10. Deliberate delete behavior
11. Query-driven indexes
12. Transaction-aware design
13. No hard-coded credentials
14. No fixed RBAC roles
15. Data scope separated from action permission
16. Historical ERP data must be protected
17. No premature full ERP schema
18. No floating-point financial values
19. No uncontrolled cascade deletes
20. Database schema must support future multi-company/data visibility
```

---

# 145. REQUIRED FINAL RESPONSE

After implementation, return exactly this type of report:

```text
## Phase 03 — Database Architecture

### Status
[Completed / Partially Completed / Blocked]

### 1. Repository Analysis
- Existing TypeORM setup
- Existing database configuration
- Existing migrations/entities
- Important findings

### 2. Database Architecture
- Database:
- ORM:
- Storage engine:
- Character set:
- Collation:
- Primary key:
- UUID strategy:
- Timestamp strategy:
- Soft delete strategy:
- Money strategy:

### 3. Files Created
- ...

### 4. Files Modified
- ...

### 5. TypeORM Configuration
- ...

### 6. Migration Strategy
- ...

### 7. Entities Implemented
- ...

### 8. Relationships
- ...

### 9. Foreign Keys
- ...

### 10. Indexes
- ...

### 11. Constraints
- ...

### 12. Transaction Strategy
- ...

### 13. Multi-Company / Data Visibility Preparation
- ...

### 14. RBAC Preparation
- ...

### 15. User / Account / Sales Visibility Preparation
- ...

### 16. Tests Executed
- ...

### 17. Migration Verification
- Clean database:
- Migration up:
- Migration down:
- Schema verification:

### 18. Build / Test Results
- Build:
- Lint:
- Unit:
- E2E:

### 19. Known Issues
- ...

### 20. Risks
- ...

### 21. Phase 04 Readiness
- Ready / Not Ready
- Explanation
```

Never claim a migration succeeded unless it was actually executed.

Never claim schema correctness without inspecting the resulting database where possible.

Never claim production readiness.

Never implement future business modules merely to make this phase appear larger.

The goal of Phase 03 is to create a **strong relational database foundation for a real ERP system**, not simply a collection of TypeORM entities.
