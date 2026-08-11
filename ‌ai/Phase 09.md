# Fashion ERP Backend — Phase 09: Master Data

## ROLE

You are implementing **Phase 09 — Master Data** of the Fashion ERP backend.

Technology stack:

* NestJS
* TypeScript
* MySQL
* TypeORM
* Redis
* BullMQ
* Docker

Completed phases:

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
```

The purpose of Phase 09 is to create the reusable **Master Data foundation** consumed by:

```text
Phase 10 — Product / Variant / Pricing
Phase 11 — Customer / Supplier
Phase 12 — Sales
Phase 13 — Purchase
Phase 14 — Inventory
Phase 15 — Inventory Ledger
Phase 16 — Payment
Phase 17 — Accounting / Double Entry
Phase 21 — Notifications
Phase 22 — Reports / Dashboard
```

---

# 1. ABSOLUTE RULES

Before coding:

1. Read Phase 00–08 implementation.
2. Inspect the existing frontend.
3. Identify all existing Master Data screens/forms/tables.
4. Reuse existing Company/Branch/Warehouse entities from Phase 07.
5. Reuse User/Employee entities from Phase 08.
6. Reuse RBAC and Data Visibility from Phase 06.
7. Do not duplicate existing entities.
8. Do not create Product entities here.
9. Do not create Customer/Supplier entities here.
10. Do not create Sales entities here.
11. Do not create Purchase entities here.
12. Do not create Inventory transaction entities here.
13. Do not create Accounting ledger entities here.
14. Do not create HR transactional entities here.
15. Do not hard-code role names.
16. Do not bypass authorization.
17. Do not trust IDs from the client.
18. Do not expose TypeORM entities directly from controllers.
19. Follow existing project naming conventions.
20. Follow existing database conventions.
21. Follow existing API conventions.
22. Follow existing error/response/pagination patterns.
23. Do not introduce a second architecture.
24. Do not refactor unrelated phases unless absolutely required.
25. Preserve backward compatibility.

---

# 2. WHAT IS MASTER DATA?

Master Data represents relatively stable business reference data used by many modules.

Examples:

```text
Brand
Category
Subcategory
Unit of Measure
Tax
Currency
Payment Method
Payment Term
Price Type
Discount Type
Color
Size
Season
Collection
Country
State/Region
City
Reason
Status/Type reference data
```

But do NOT automatically create every possible master entity.

Only implement entities supported by:

1. existing frontend,
2. existing database design,
3. ERP business requirements,
4. future module dependencies.

---

# 3. MASTER DATA PRINCIPLE

Master Data should be:

```text
Centralized
Reusable
Validated
Auditable
Organization-aware
Permission-controlled
Soft-deletable where appropriate
```

Avoid creating duplicate reference tables inside each module.

Bad:

```text
SalesTax
PurchaseTax
InventoryTax
ProductTax
```

Prefer:

```text
Tax
```

and reference it where appropriate.

---

# 4. MASTER DATA CATEGORIES

Organize Master Data conceptually:

```text
Master Data
│
├── Product-related
│   ├── Brand
│   ├── Category
│   ├── Subcategory
│   ├── Unit
│   ├── Color
│   ├── Size
│   ├── Season
│   └── Collection
│
├── Commercial
│   ├── Tax
│   ├── Currency
│   ├── Price Type
│   ├── Discount Type
│   ├── Payment Method
│   └── Payment Term
│
├── Geographic
│   ├── Country
│   ├── State/Region
│   └── City
│
└── Operational
    ├── Reason
    ├── Customer Type
    ├── Supplier Type
    └── Other approved references
```

The exact list must be confirmed from the frontend and existing code.

---

# 5. FIRST TASK — FRONTEND SOURCE OF TRUTH

Before implementing entities, inspect the frontend.

Repository:

```text
https://github.com/Khant20Lin06/Fashion-ERP
```

Demo:

```text
https://fashion-erp.vercel.app/
```

Identify:

```text
Master Data pages
Master Data navigation
Dropdowns
Forms
Filters
Tables
CRUD actions
Existing constants
Existing enums
Existing mock data
Existing TypeScript types
Existing API contracts
```

Create a mapping:

```text
Frontend screen
        ↓
Master Data entity
        ↓
Database table
        ↓
API
        ↓
Used by future modules
```

Do not invent frontend functionality that does not exist unless required by backend architecture.

---

# 6. MASTER DATA VS ORGANIZATION DATA

Do not duplicate:

```text
Company
Branch
Warehouse
```

These belong to Phase 07.

Master Data may reference them where business rules require it.

---

# 7. MASTER DATA VS USER DATA

Do not duplicate:

```text
User
Employee
Role
Permission
```

These belong to Phase 05/06/08.

---

# 8. MASTER DATA VS PRODUCT

Do not implement the full Product model here.

Phase 10 owns:

```text
Product
Product Variant
SKU
Barcode
Pricing
```

Phase 09 may create reference entities such as:

```text
Brand
Category
Color
Size
Unit
Season
Collection
```

which Product will reference.

---

# 9. MASTER DATA VS CUSTOMER/SUPPLIER

Do not create:

```text
Customer
Supplier
Customer Group
Supplier Group
```

unless the frontend architecture explicitly requires them as pure master references.

Phase 11 owns Customer/Supplier.

---

# 10. MASTER DATA VS ACCOUNTING

Do not create:

```text
Chart of Accounts
GL Account
Journal
Ledger
```

in Phase 09.

Phase 17 owns them.

Tax and Currency may be Master Data because Sales/Purchase/Accounting can reference them.

---

# 11. COMMON MASTER DATA ENTITY DESIGN

For each master entity, prefer:

```text
id
code
name
description
status
sortOrder
createdAt
updatedAt
deletedAt
```

But only include fields that make sense for that entity.

Do not blindly add every field to every table.

---

# 12. ID

Use the project's existing ID strategy.

If Phase 03 established UUID:

```text
id: UUID
```

reuse it.

Do not introduce integer IDs.

---

# 13. CODE

Where an entity needs a human-readable business code:

```text
code
```

should be:

```text
stable
unique
searchable
```

Example:

```text
BRAND-001
CAT-MEN
UNIT-PC
TAX-STD
```

Do not use database IDs as business codes.

---

# 14. NAME

Names should be validated according to project standards.

If organization-scoped:

```text
UNIQUE(companyId, name)
```

may be appropriate.

If globally shared:

```text
UNIQUE(name)
```

may be appropriate.

Do not assume global uniqueness.

---

# 15. STATUS

Use the existing project status pattern.

Typical:

```text
ACTIVE
INACTIVE
```

Do not create different status systems unnecessarily.

---

# 16. SOFT DELETE

For Master Data referenced by historical transactions:

prefer:

```text
deletedAt
```

or the existing soft-delete implementation.

Do not physically delete records referenced by:

```text
Product
Sales
Purchase
Inventory
Payment
Accounting
Reports
```

---

# 17. MASTER DATA OWNERSHIP

Determine whether each master entity is:

```text
GLOBAL
COMPANY
BRANCH
```

scoped.

Examples:

```text
Currency
→ potentially GLOBAL

Country
→ GLOBAL

Brand
→ potentially COMPANY

Category
→ potentially COMPANY

Tax
→ potentially COMPANY

Payment Method
→ potentially COMPANY

Warehouse
→ ORGANIZATION
```

Use actual business requirements.

Do not blindly make everything global.

---

# 18. MASTER DATA SCOPE

For organization-scoped master data:

```text
MasterData
 ↓
Company
```

or appropriate Phase 07 relationship.

Example:

```text
Brand
Company A
```

must not automatically be visible to:

```text
Company B
```

unless the master data is explicitly global/shared.

---

# 19. GLOBAL MASTER DATA

For global master data:

```text
companyId = null
```

may be used if the architecture supports global records.

But do not use nullable `companyId` everywhere.

Prefer a clear model:

```text
scopeType
```

only if the existing architecture requires it.

---

# 20. BRAND

If frontend requires Brand:

```text
Brand
├── id
├── code
├── name
├── description
├── status
├── companyId (if company-scoped)
├── createdAt
├── updatedAt
└── deletedAt
```

Future Product will reference:

```text
Product.brandId
```

---

# 21. BRAND RULES

Brand:

```text
code unique within scope
name unique within scope
inactive brand cannot be assigned to new products
```

Historical Products remain linked.

---

# 22. CATEGORY

If frontend requires Category:

```text
Category
├── id
├── code
├── name
├── description
├── parentId
├── status
├── companyId if required
├── sortOrder
├── createdAt
├── updatedAt
└── deletedAt
```

---

# 23. CATEGORY HIERARCHY

Support:

```text
Category
 └── Subcategory
```

through:

```text
parentId
```

if the frontend/business model supports hierarchical categories.

Do not create both:

```text
Category
Subcategory
```

tables if a self-referencing Category hierarchy is cleaner and matches the product.

---

# 24. CATEGORY CYCLE PROTECTION

If using:

```text
parentId
```

prevent:

```text
A → B
B → C
C → A
```

The service must validate hierarchy changes.

---

# 25. CATEGORY DELETE

Do not delete a category if:

```text
Product references it
Child categories exist
Historical records depend on it
```

Prefer:

```text
INACTIVE
```

or soft delete according to project conventions.

---

# 26. UNIT OF MEASURE

If required:

```text
Unit
├── id
├── code
├── name
├── symbol
├── decimalPlaces
├── status
├── createdAt
├── updatedAt
└── deletedAt
```

Examples:

```text
PCS
KG
BOX
DOZEN
METER
```

---

# 27. UNIT RULE

A Unit may be referenced by:

```text
Product
Purchase
Sales
Inventory
```

Therefore:

```text
inactive unit
```

must not be assigned to new records.

Historical transactions remain valid.

---

# 28. COLOR

If Fashion ERP frontend uses color:

```text
Color
├── id
├── code
├── name
├── hexCode if required
├── status
└── ...
```

Do not add visual fields that the frontend does not use.

---

# 29. SIZE

If frontend uses size:

```text
Size
├── id
├── code
├── name
├── sizeGroupId if required
├── sortOrder
├── status
└── ...
```

Examples:

```text
XS
S
M
L
XL
XXL
```

Do not hard-code these values in Product.

---

# 30. SIZE GROUP

If the frontend requires:

```text
Men
Women
Kids
Shoes
```

or other size systems, consider:

```text
SizeGroup
```

with:

```text
Size
 ↓
SizeGroup
```

Only implement if needed.

---

# 31. SEASON

If required:

```text
Season
├── id
├── code
├── name
├── startDate
├── endDate
├── status
└── ...
```

Examples:

```text
SS26
AW26
Summer 2026
Winter 2026
```

Do not hard-code seasons.

---

# 32. COLLECTION

If frontend requires fashion collections:

```text
Collection
├── id
├── code
├── name
├── description
├── seasonId
├── status
└── ...
```

Collection may reference Season.

---

# 33. TAX

If frontend requires Tax:

```text
Tax
├── id
├── code
├── name
├── rate
├── type
├── status
├── companyId
├── effectiveFrom
├── effectiveTo
└── ...
```

Do not implement tax calculation logic here.

Phase 12/13/17 will consume Tax definitions.

---

# 34. TAX VERSIONING

If tax rates can change:

Do not overwrite historical meaning.

Support:

```text
effectiveFrom
effectiveTo
```

if required.

Historical transactions must preserve the applied tax information in their transaction-level snapshot/reference later.

---

# 35. TAX VALIDATION

Validate:

```text
rate >= 0
```

and according to the supported tax model:

```text
percentage
fixed
inclusive/exclusive
```

Only implement fields actually required.

---

# 36. CURRENCY

If required:

```text
Currency
├── id
├── code
├── name
├── symbol
├── decimalPlaces
├── status
└── ...
```

Examples:

```text
MMK
THB
USD
SGD
```

Prefer ISO-style codes.

---

# 37. CURRENCY RULE

Do not use floating point for financial amounts.

Currency metadata may contain:

```text
decimalPlaces
```

but actual monetary values in future modules must use the project's decimal strategy.

---

# 38. PAYMENT METHOD

If frontend requires:

```text
PaymentMethod
```

examples:

```text
CASH
BANK
CARD
MOBILE
CREDIT
```

Do not hard-code these in Sales/POS.

Create configurable Master Data if the frontend requires customization.

---

# 39. PAYMENT METHOD ≠ PAYMENT TRANSACTION

Payment Method:

```text
HOW?
```

Payment transaction:

```text
WHAT PAYMENT HAPPENED?
```

Phase 16 owns actual Payment transactions.

---

# 40. PAYMENT TERM

If required:

```text
PaymentTerm
├── id
├── code
├── name
├── dueDays
├── description
├── status
└── ...
```

Examples:

```text
CASH
NET-7
NET-30
NET-60
```

---

# 41. PRICE TYPE

If frontend has configurable price types:

```text
PriceType
```

Examples:

```text
RETAIL
WHOLESALE
VIP
PROMOTIONAL
```

Do not implement actual pricing rules here.

Phase 10 owns Pricing.

---

# 42. DISCOUNT TYPE

If frontend has configurable discount types:

```text
DiscountType
```

Examples:

```text
PERCENTAGE
FIXED
```

Do not implement discount calculation here.

Sales/Pricing modules will consume it.

---

# 43. REASON MASTER

If multiple modules use reasons:

```text
Reason
```

may support:

```text
SALE_RETURN
PURCHASE_RETURN
STOCK_ADJUSTMENT
CANCELLATION
VOID
```

But avoid one giant unstructured Reason table if domain-specific reasons have different rules.

Prefer:

```text
reasonType
```

if one shared table is justified.

---

# 44. ENUM VS MASTER DATA

This is a critical design decision.

Use TypeScript/DB enum when:

```text
values are system-defined
values rarely change
business users should not customize them
```

Use Master Data table when:

```text
admin can create/edit values
business users need configuration
values vary by company
values need active/inactive lifecycle
values need metadata
```

Example:

```text
OrderStatus
→ enum/system state

PaymentMethod
→ Master Data if configurable

ProductCategory
→ Master Data
```

Do not create database tables for every enum.

---

# 45. MASTER DATA CONFIGURABILITY

The goal is:

```text
Super Admin/Admin
 ↓
Master Data Management
 ↓
Create/Edit/Deactivate
```

without code deployment for every new business value.

---

# 46. MASTER DATA CRUD

Each configurable master entity should support:

```text
GET
GET /:id
POST
PATCH
DELETE/DEACTIVATE
```

according to project conventions.

---

# 47. MASTER DATA BULK IMPORT

Do NOT implement bulk import unless frontend/product requirements explicitly require it.

If needed later, use a dedicated import workflow.

---

# 48. MASTER DATA SEARCH

List APIs should support:

```text
search
status
company
```

where applicable.

All results must be visibility-filtered.

---

# 49. MASTER DATA PAGINATION

All list APIs must use the common pagination system from Phase 04.

Never return unlimited records.

---

# 50. MASTER DATA SORTING

Allow only whitelisted fields:

```text
name
code
createdAt
updatedAt
sortOrder
status
```

depending on entity.

Never inject arbitrary SQL sorting.

---

# 51. MASTER DATA AUTHORIZATION

Use Phase 06:

```text
Permission
+
Data Scope
+
Organization
```

Do not use:

```text
role === SUPER_ADMIN
```

---

# 52. RECOMMENDED PERMISSIONS

Use existing permission conventions.

Conceptually:

```text
master_data.read
master_data.create
master_data.update
master_data.delete
```

OR preferably resource-specific:

```text
brands.read
brands.create
brands.update
brands.delete

categories.read
categories.create
categories.update
categories.delete

units.read
units.create
units.update
units.delete

taxes.read
taxes.create
taxes.update
taxes.delete
```

Choose one consistent convention based on Phase 06.

Do not create duplicate permission namespaces.

---

# 53. DATA VISIBILITY

Example:

```text
Company A
 ├── Brand A
 ├── Category A
 └── Tax A

Company B
 ├── Brand B
 ├── Category B
 └── Tax B
```

Company A user:

```text
CAN SEE A
CANNOT SEE B
```

unless the entity is global/shared.

---

# 54. MASTER DATA OWNERSHIP

For organization-scoped records:

```text
companyId
```

must be assigned server-side from authorized organization context where possible.

Do not allow:

```json
{
  "companyId": "some-other-company"
}
```

to bypass authorization.

---

# 55. GLOBAL DATA CREATION

If global master data can only be created by platform administrators:

enforce that through:

```text
Permission
+
Scope
```

not role name.

---

# 56. MASTER DATA UPDATE

Before update:

```text
load entity
 ↓
verify exists
 ↓
verify not deleted
 ↓
verify authorization
 ↓
validate business rules
 ↓
update
```

---

# 57. MASTER DATA DELETE

Before deletion:

```text
check references
```

If referenced:

```text
do not hard delete
```

Use:

```text
INACTIVE
```

or soft delete.

---

# 58. MASTER DATA UNIQUE RULES

Unique constraints must consider scope.

Example:

```text
Brand:
UNIQUE(companyId, code)

Category:
UNIQUE(companyId, code)

Tax:
UNIQUE(companyId, code)
```

If global:

```text
UNIQUE(code)
```

Do not blindly use global uniqueness.

---

# 59. CASE SENSITIVITY

Decide consistent behavior for:

```text
ABC
abc
Abc
```

for codes/names.

Prefer normalization or database collation according to project conventions.

Document the decision.

---

# 60. CODE NORMALIZATION

For business codes:

```text
trim
uppercase if appropriate
```

Example:

```text
" brand-001 "
→
"BRAND-001"
```

only if project conventions support it.

Do not unexpectedly modify user-facing names.

---

# 61. NAME NORMALIZATION

At minimum:

```text
trim whitespace
```

Do not force uppercase names.

---

# 62. DUPLICATE PROTECTION

Service-level checks are useful:

```text
existing code?
existing name?
```

but database unique constraints are mandatory where uniqueness is required.

---

# 63. CONCURRENCY

Two admins may create:

```text
BRAND-001
```

simultaneously.

The database unique constraint must be the final protection.

Catch duplicate constraint errors and return a clean domain/API error.

---

# 64. CATEGORY PARENT VALIDATION

When creating/updating:

```text
parentId
```

verify:

```text
parent exists
parent is active
parent is same scope
parent is not itself
parent does not create a cycle
```

---

# 65. TAX DATE VALIDATION

If effective dates are supported:

```text
effectiveFrom <= effectiveTo
```

and overlapping active tax definitions should be prevented if the business model requires one active rate.

---

# 66. CURRENCY VALIDATION

Validate:

```text
code length
decimalPlaces >= 0
```

and follow ISO currency conventions where applicable.

---

# 67. UNIT VALIDATION

Validate:

```text
code
symbol
decimalPlaces
```

according to actual product requirements.

---

# 68. MASTER DATA RELATIONSHIPS

Potential relationship graph:

```text
Season
   │
   ▼
Collection

Category
   │
   ▼
Subcategory

SizeGroup
   │
   ▼
Size
```

Future:

```text
Brand ───────────┐
Category ────────┤
Color ───────────┤
Size ────────────┤
Season ──────────┤
Collection ──────┤
Unit ────────────┤
                 ▼
              Product
```

Do not create Product here.

---

# 69. MASTER DATA DEPENDENCY ORDER

If implementing all applicable entities:

```text
Country
 ↓
Region
 ↓
City

Category
 ↓
Subcategory

SizeGroup
 ↓
Size

Season
 ↓
Collection
```

Independent:

```text
Brand
Unit
Currency
Tax
PaymentMethod
PaymentTerm
PriceType
DiscountType
```

Implement based on actual frontend dependencies.

---

# 70. API MODULE STRUCTURE

Follow existing NestJS modular structure.

Potential:

```text
src/modules/master-data/
```

or project-standard equivalent.

Inside:

```text
brands/
categories/
units/
colors/
sizes/
seasons/
collections/
taxes/
currencies/
payment-methods/
payment-terms/
price-types/
discount-types/
```

Do not create modules that are not required.

---

# 71. DO NOT CREATE GIANT MASTER-DATA SERVICE

Avoid:

```text
MasterDataService
```

containing all business logic for every entity.

Prefer domain-specific services:

```text
BrandService
CategoryService
TaxService
CurrencyService
```

etc.

A shared base/helper may exist for genuinely common behavior.

---

# 72. GENERIC CRUD ABSTRACTION

Do not over-engineer a generic:

```text
GenericMasterDataService<T>
```

just to reduce lines of code.

If the entities have different rules, explicit services are safer.

---

# 73. ENTITY VS DTO

Use:

```text
Entity
DTO
Mapper/Presenter
```

according to existing project architecture.

Never return password/security data through entity serialization.

---

# 74. DATABASE MIGRATION

Create migrations for only the required Master Data entities.

Migration must:

```text
create tables
create indexes
create foreign keys
create unique constraints
```

where appropriate.

Do not modify unrelated Phase 03/07 tables unnecessarily.

---

# 75. SEED DATA

If the project requires initial Master Data:

create deterministic seed data.

Example:

```text
MMK
THB
USD

PCS
KG
```

But do not seed fake business data merely to make the database look populated.

---

# 76. SEED IDEMPOTENCY

Running seed twice must not create duplicates.

Use stable:

```text
code
```

or another deterministic identifier.

---

# 77. PRODUCTION SAFETY

Do not automatically insert demo/test Master Data into production.

Use environment-aware seeding.

---

# 78. MASTER DATA EVENTS

Potential future events:

```text
BRAND_CREATED
BRAND_UPDATED
BRAND_DEACTIVATED

CATEGORY_CREATED
CATEGORY_UPDATED
CATEGORY_DEACTIVATED

TAX_CREATED
TAX_UPDATED
TAX_DEACTIVATED
```

Do not implement event infrastructure here if Phase 18 owns Outbox.

Prepare service boundaries only.

---

# 79. AUDIT COMPATIBILITY

Master Data changes should be auditable in future.

Potential actions:

```text
CREATE
UPDATE
DEACTIVATE
DELETE
RESTORE
```

Do not create a second audit system.

---

# 80. CACHE COMPATIBILITY

Frequently-read Master Data may later be cached:

```text
brands
categories
units
currencies
taxes
payment-methods
```

Do not introduce Redis caching prematurely unless the existing architecture requires it.

Phase 19 owns Redis strategy.

---

# 81. CACHE INVALIDATION PREPARATION

If a cache abstraction already exists, update/invalidate through that abstraction.

Do not directly scatter:

```text
redis.del(...)
```

through every service.

---

# 82. MASTER DATA AND POS

POS may need fast access to:

```text
Product
Category
Brand
Unit
Tax
PaymentMethod
PriceType
DiscountType
```

Master Data APIs should therefore be:

```text
consistent
predictable
paginated
filterable
cache-friendly
```

but do not prematurely optimize.

---

# 83. MASTER DATA AND OFFLINE POS

If frontend/POS later supports offline operation:

Master Data may need synchronization.

Do not implement offline synchronization in Phase 09 unless required.

Prepare stable:

```text
id
code
updatedAt
deletedAt
```

so future sync can detect changes.

---

# 84. UPDATED_AT

All synchronizable Master Data should have:

```text
updatedAt
```

and preferably:

```text
deletedAt
```

for change detection.

---

# 85. SOFT DELETE + SYNC

If offline sync is planned:

deleted records cannot simply disappear.

Use:

```text
deletedAt
```

so clients can detect deletions.

---

# 86. MASTER DATA API VERSIONING

Follow existing API versioning.

Do not create a new versioning system.

Example:

```text
/api/v1/master-data/brands
```

only if that matches existing project conventions.

---

# 87. ERROR HANDLING

Use existing domain/API errors.

Examples:

```text
MASTER_DATA_NOT_FOUND
MASTER_DATA_ALREADY_EXISTS
MASTER_DATA_IN_USE
INVALID_PARENT_CATEGORY
INVALID_SCOPE
INVALID_ORGANIZATION
MASTER_DATA_INACTIVE
```

Use the project's existing error architecture.

---

# 88. NOT FOUND VS FORBIDDEN

For sensitive organization-scoped Master Data:

follow existing security policy.

Do not leak the existence of another company's records unnecessarily.

---

# 89. AUTHORIZATION FLOW

Every Master Data request should conceptually follow:

```text
Request
 ↓
Authentication
 ↓
Permission
 ↓
Data Scope
 ↓
Organization Access
 ↓
Entity Lookup
 ↓
Business Validation
 ↓
Response
```

---

# 90. MASTER DATA READ

Example:

```text
GET /brands
```

must:

```text
authenticate
authorize brands.read
apply organization scope
apply status/filter
paginate
return DTO
```

---

# 91. MASTER DATA CREATE

Example:

```text
POST /brands
```

must:

```text
authenticate
authorize brands.create
resolve organization
validate code/name
validate uniqueness
create
return DTO
```

Do not trust `companyId` from client without validation.

---

# 92. MASTER DATA UPDATE

Example:

```text
PATCH /brands/:id
```

must:

```text
authenticate
authorize brands.update
load scoped entity
validate changes
update
return DTO
```

---

# 93. MASTER DATA DEACTIVATE

Prefer an explicit lifecycle operation where appropriate:

```text
POST /brands/:id/deactivate
```

or existing project convention.

Do not overload DELETE if the business needs clear state transitions.

---

# 94. REST API CONSISTENCY

Do not mix:

```text
/brand
/brands
/master-brand
/masterDataBrand
```

Choose the project's existing plural resource convention.

---

# 95. TESTING MATRIX

For each configurable Master Data resource:

```text
Create
Read
List
Update
Deactivate
Unauthorized
Wrong company
Wrong branch if applicable
Duplicate code
Duplicate name
Invalid input
Deleted/inactive behavior
Pagination
Search
Filter
Sorting
```

---

# 96. CATEGORY TESTING

Additional:

```text
parent exists
parent same scope
parent inactive
self-parent
cycle
child category
delete parent with children
```

---

# 97. TAX TESTING

Additional:

```text
negative rate
invalid date range
duplicate active tax
wrong company
inactive tax assignment
```

according to implemented tax rules.

---

# 98. CURRENCY TESTING

Additional:

```text
duplicate code
invalid decimalPlaces
inactive currency
```

---

# 99. UNIT TESTING

Additional:

```text
duplicate code
invalid decimalPlaces
inactive unit
```

---

# 100. MASTER DATA SECURITY TEST

Create:

```text
Company A
Company B
```

Company A admin:

```text
brands.read
brands.update
```

must not access:

```text
Company B Brand
```

unless global/shared.

---

# 101. GLOBAL DATA TEST

If global Master Data exists:

```text
Global Currency THB
```

should be visible to authorized users across companies.

But:

```text
Company A Tax
```

must not be visible to Company B.

---

# 102. RBAC TEST

User with:

```text
brands.read
```

must not:

```text
POST /brands
PATCH /brands/:id
```

unless they also have the required permissions.

---

# 103. SCOPE TEST

User:

```text
brands.read
scope = COMPANY
Company A
```

must not see:

```text
Company B
```

---

# 104. IDOR TEST

User from Company A attempts:

```text
GET /brands/{companyBBrandId}
```

must be rejected according to security policy.

---

# 105. MASTER DATA REFERENCE TEST

When future Product references:

```text
Brand
Category
Unit
Color
Size
```

inactive records must not be accepted for new Product creation.

Phase 10 will implement the final rule, but Phase 09 must expose clear active/inactive state.

---

# 106. HISTORICAL DATA RULE

Never destroy Master Data required to understand historical transactions.

Example:

```text
Tax rate changed
```

must not make old Sales/Purchase records meaningless.

Transaction modules must snapshot or preserve applied values.

Phase 12/13/17 own transaction-level implementation.

---

# 107. FRONTEND CONTRACT

Before finalizing API design, compare:

```text
Frontend form fields
Frontend table columns
Frontend filters
Frontend dropdown values
Frontend edit behavior
Frontend status behavior
```

against backend DTOs.

Do not make backend fields that frontend does not need unless required for future architecture.

---

# 108. FRONTEND-BACKEND MAPPING DOCUMENT

Create:

```text
docs/master-data-mapping.md
```

containing:

```text
Frontend
→ Backend Entity
→ Table
→ API
→ Permission
→ Scope
→ Future Consumer
```

Example:

```text
Brand Management
→ Brand
→ brands
→ /brands
→ brands.*
→ Company
→ Product
```

---

# 109. MASTER DATA REGISTRY

If useful, create documentation only:

```text
Master Data Registry
```

Example:

```text
| Entity | Scope | Editable | Used By |
| Brand | Company | Yes | Product |
| Currency | Global | Admin | Sales/Purchase/Accounting |
| Tax | Company | Yes | Sales/Purchase/Accounting |
| Unit | Global/Company | Yes | Product/Inventory |
```

Do not create an overly generic database registry unless required.

---

# 110. DO NOT OVER-ENGINEER

Do not create:

```text
dynamic custom field engine
dynamic entity engine
generic metadata engine
generic master-data table
```

unless the existing product explicitly requires it.

Strong relational modeling is preferred.

---

# 111. MASTER DATA RELATIONAL MODEL

Prefer:

```text
brands
categories
units
colors
sizes
size_groups
seasons
collections
taxes
currencies
payment_methods
payment_terms
price_types
discount_types
```

rather than:

```text
master_data
(
  id,
  type,
  key,
  value
)
```

for all business entities.

---

# 112. WHY NOT ONE MASTER_DATA TABLE?

Avoid a universal table because:

```text
Tax has rate
Category has parent
Currency has decimalPlaces
Size has sizeGroup
Collection has season
```

Different entities have different domain rules.

A single key/value table becomes difficult to validate and query.

---

# 113. BASE MASTER DATA ABSTRACTION

A reusable base class/interface may provide:

```text
id
code
name
status
createdAt
updatedAt
deletedAt
```

but domain-specific entities should remain explicit.

Use inheritance only if it matches existing TypeORM architecture.

---

# 114. TRANSLATIONS

If frontend supports multilingual Master Data:

inspect existing localization design.

Do not immediately create:

```text
brand_translations
category_translations
```

unless the product actually requires database-level translations.

---

# 115. ICON / COLOR / UI METADATA

Do not store frontend-only presentation metadata in Master Data unless required.

Example:

```text
icon
buttonColor
menuColor
```

should generally remain frontend concerns.

---

# 116. SORT ORDER

Use `sortOrder` only where business users need configurable ordering.

Examples:

```text
Category
Size
PaymentMethod
```

Do not add it to every entity automatically.

---

# 117. STATUS ORDER

Do not use `sortOrder` as status logic.

Status is business state.

---

# 118. MASTER DATA IMPORT SAFETY

If import is later added:

```text
code
```

should be the stable upsert key where appropriate.

Do not use names as primary identity.

---

# 119. DATABASE TRANSACTIONS

Use transaction when creating related records.

Example:

```text
Season
 ↓
Collection
```

if created in one operation.

Otherwise simple CRUD can remain transactional at repository/service level according to existing architecture.

---

# 120. OBSERVABILITY COMPATIBILITY

Use existing logging:

```text
requestId
userId
organizationId
resource
resourceId
```

where available.

Do not introduce a second logger.

---

# 121. PERFORMANCE

Master Data is read-heavy.

Avoid:

```text
N+1
unbounded queries
unnecessary joins
```

Use indexes based on actual queries.

Do not add Redis caching until Phase 19 unless the architecture already requires it.

---

# 122. DOCKER

Run migrations/seeds through the existing Docker setup.

Verify:

```text
docker compose up
database migration
application startup
```

Do not modify Docker architecture unnecessarily.

---

# 123. DOCUMENTATION

Update:

```text
ERD
API docs
Master Data mapping
Database documentation
Authorization documentation
```

according to existing project structure.

---

# 124. IMPLEMENTATION ORDER

Implement in this order:

```text
1. Read Phase 00–08
2. Inspect frontend
3. Inventory existing master/reference data
4. Categorize Global vs Company vs Branch
5. Identify Enum vs Master Data
6. Confirm entities required
7. Design relationships
8. Create migrations
9. Create entities
10. Create repositories/services
11. Create DTOs
12. Create controllers
13. Add RBAC
14. Add organization/data-scope filtering
15. Add validation
16. Add indexes/constraints
17. Add seed data if required
18. Add tests
19. Update documentation
20. Run full validation
```

---

# 125. REQUIRED PRE-CODING REPORT

Before writing code, produce:

```text
1. Frontend Master Data inventory
2. Existing backend Master Data/reference entities
3. Required Phase 09 entities
4. Entities that must NOT be created
5. Global vs Company vs Branch scope
6. Enum vs Master Data decisions
7. ER relationship diagram
8. Table/column proposal
9. API proposal
10. Permission proposal
11. Data visibility rules
12. Phase 10 dependencies
13. Potential conflicts
```

Then implement.

---

# 126. ACCEPTANCE CRITERIA

Phase 09 is complete only when:

```text
[ ] Frontend Master Data inventory completed
[ ] Existing backend entities inspected
[ ] Duplicate entities avoided
[ ] Global vs organization scope defined
[ ] Enum vs Master Data decisions documented
[ ] Required Master Data entities implemented
[ ] IDs follow Phase 03 strategy
[ ] Codes are unique where required
[ ] Names are validated where required
[ ] Status lifecycle exists
[ ] Soft delete follows project convention
[ ] Organization visibility enforced
[ ] RBAC permissions enforced
[ ] IDOR protection works
[ ] Cross-company access blocked
[ ] Global data works if supported
[ ] Pagination works
[ ] Search works
[ ] Filtering works
[ ] Sorting is whitelisted
[ ] DTOs exist
[ ] TypeORM entities are not exposed directly
[ ] Foreign keys are correct
[ ] Indexes are appropriate
[ ] Unique constraints are enforced
[ ] Category hierarchy works if required
[ ] Category cycle protection works if required
[ ] Tax validation works if required
[ ] Currency validation works if required
[ ] Unit validation works if required
[ ] Seed data is deterministic if used
[ ] No production demo data is inserted accidentally
[ ] Audit compatibility prepared
[ ] Outbox compatibility preserved
[ ] Redis architecture not duplicated
[ ] Docker works
[ ] Migration works
[ ] Unit tests pass
[ ] Integration tests pass
[ ] Authorization tests pass
[ ] Security tests pass
[ ] Documentation updated
[ ] Phase 10 can consume the Master Data cleanly
```

---

# 127. FINAL ARCHITECTURE PRINCIPLE

The final Master Data architecture should look conceptually like:

```text
                    MASTER DATA
                         │
       ┌─────────────────┼──────────────────┐
       │                 │                  │
   Product-related   Commercial         Geographic
       │                 │                  │
       ├ Brand           ├ Tax              ├ Country
       ├ Category        ├ Currency         ├ Region
       ├ Color           ├ PaymentMethod    └ City
       ├ Size            ├ PaymentTerm
       ├ Season          ├ PriceType
       ├ Collection      └ DiscountType
       └ Unit
                         │
                         ▼
              Future Business Modules
                         │
        ┌────────────────┼────────────────┐
        │                │                │
     Product           Sales          Purchase
        │                │                │
     Inventory       Accounting       Reports
```

The key principle is:

```text
Master Data
=
Reusable business definitions

Transaction Data
=
What actually happened
```

Do not mix the two.

---

# 128. PHASE 09 → PHASE 10 CONTRACT

Phase 10 should be able to reference:

```text
Brand
Category
Unit
Color
Size
Season
Collection
```

without recreating them.

Expected conceptual relationship:

```text
Product
 ├── Brand
 ├── Category
 ├── Unit
 ├── Color
 ├── Size
 ├── Season
 └── Collection
```

---

# 129. PHASE 09 → PHASE 12 CONTRACT

Sales should be able to reference:

```text
Tax
Currency
PaymentMethod
PaymentTerm
DiscountType
```

without duplicating these definitions.

---

# 130. PHASE 09 → PHASE 13 CONTRACT

Purchase should reuse:

```text
Tax
Currency
PaymentMethod
PaymentTerm
Unit
```

where applicable.

---

# 131. PHASE 09 → PHASE 14 CONTRACT

Inventory should reuse:

```text
Unit
Product-related Master Data
Reason
```

where applicable.

---

# 132. PHASE 09 → PHASE 17 CONTRACT

Accounting may consume:

```text
Currency
Tax
PaymentMethod
```

but Phase 17 remains the owner of:

```text
Chart of Accounts
Journal
Ledger
Double Entry
```

---

# 133. FINAL SECURITY PRINCIPLE

Never allow:

```text
GET /brands
```

to mean:

```text
SELECT * FROM brands
```

The actual query must be:

```text
Authenticated User
+
Permission
+
Scope
+
Organization
+
Master Data State
```

Conceptually:

```text
Visible Master Data
=
Permission
AND
Organization Scope
AND
Global/Company/Branch Rules
AND
Active/Deleted Rules
```

---

# 134. FINAL COMMAND

After implementation, report:

```text
Phase 09 Implementation Report

1. Frontend Master Data discovered
2. Entities created
3. Entities reused
4. Entities intentionally not created
5. Scope decisions
6. Enum vs Master Data decisions
7. Database migrations
8. API endpoints
9. Permissions
10. Data visibility
11. Validation rules
12. Indexes
13. Seed data
14. Tests
15. Security tests
16. Documentation
17. Phase 10 integration readiness
18. Remaining risks
```

Do not claim completion until all critical acceptance criteria pass.

# END OF PHASE 09
