# Fashion ERP Backend — Phase 10: Product / Variant / Pricing

## ROLE

You are implementing **Phase 10 — Product / Variant / Pricing** of the Fashion ERP backend.

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
Phase 09 — Master Data
```

Current phase:

```text
Phase 10 — Product / Variant / Pricing
```

Future consumers:

```text
Phase 11 — Customer / Supplier
Phase 12 — Sales
Phase 13 — Purchase
Phase 14 — Inventory
Phase 15 — Inventory Ledger
Phase 16 — Payment
Phase 17 — Accounting / Double Entry
Phase 19 — Redis
Phase 20 — BullMQ Workers
Phase 22 — Reports / Dashboard
Phase 24 — Automated Testing
Phase 25 — Bruno API Testing
Phase 26 — Performance
```

---

# 1. PRIMARY OBJECTIVE

Build a production-ready Product domain supporting:

```text
Product
Product Variant
SKU
Barcode
Product Attributes
Product Images
Product Category
Brand
Unit of Measure
Color
Size
Season
Collection
Cost Price
Selling Price
Price Lists
Pricing Rules
Product Status
Variant Status
Product Visibility
Organization Scope
```

The architecture must support a Fashion ERP/POS environment.

The Product model must be reusable by:

```text
Sales
Purchase
POS
Inventory
Inventory Ledger
Pricing
Reports
Accounting
Customer-facing workflows
```

---

# 2. ABSOLUTE RULES

Before coding:

1. Read Phase 00–09 implementation.
2. Inspect the existing frontend.
3. Inspect existing Product UI.
4. Inspect existing mock data.
5. Inspect existing TypeScript interfaces/types.
6. Inspect existing product forms.
7. Inspect existing product tables.
8. Inspect product detail pages.
9. Inspect variant UI.
10. Inspect pricing UI.
11. Inspect SKU/barcode UI.
12. Inspect category/brand/color/size references.
13. Reuse Phase 09 Master Data.
14. Reuse Phase 07 Organization/Company/Branch/Warehouse.
15. Reuse Phase 06 Dynamic RBAC + Data Visibility.
16. Do not recreate Brand.
17. Do not recreate Category.
18. Do not recreate Color.
19. Do not recreate Size.
20. Do not recreate Unit.
21. Do not recreate Season.
22. Do not recreate Collection.
23. Do not create Sales transactions.
24. Do not create Purchase transactions.
25. Do not create Inventory transactions.
26. Do not create Accounting transactions.
27. Do not hard-code role names.
28. Do not bypass data visibility.
29. Do not trust organization IDs from the client.
30. Do not expose TypeORM entities directly.
31. Do not introduce a second architecture.
32. Do not refactor unrelated phases.
33. Follow existing naming conventions.
34. Follow existing API conventions.
35. Follow existing error handling.
36. Follow existing pagination.
37. Follow existing ID strategy.
38. Follow existing audit architecture.
39. Follow existing migration strategy.
40. Do not claim completion without tests.

---

# 3. FRONTEND SOURCE OF TRUTH

Repository:

```text
https://github.com/Khant20Lin06/Fashion-ERP
```

Demo:

```text
https://fashion-erp.vercel.app/
```

Inspect the frontend and identify:

```text
Product list
Product create
Product edit
Product detail
Product search
Product filters
Product categories
Product brands
Product variants
SKU
Barcode
Product images
Product status
Pricing
Price lists
Discounts
Product attributes
```

Create a mapping:

```text
Frontend
    ↓
Product Domain
    ↓
Database
    ↓
API
    ↓
Future Sales/Purchase/Inventory/POS
```

Do not invent frontend functionality without architectural justification.

---

# 4. PRODUCT DOMAIN PRINCIPLE

Separate:

```text
Product
```

from:

```text
Product Variant
```

and:

```text
Price
```

and:

```text
Inventory
```

and:

```text
Sales Transaction
```

Do not create one giant Product table.

---

# 5. CORE DOMAIN MODEL

Recommended conceptual structure:

```text
Product
│
├── Product Variant
│     ├── SKU
│     ├── Barcode
│     ├── Color
│     ├── Size
│     └── Variant Attributes
│
├── Brand
├── Category
├── Unit
├── Season
├── Collection
│
├── Images
│
└── Pricing
      ├── Cost Price
      ├── Selling Price
      ├── Price List
      └── Price Rules
```

---

# 6. PRODUCT VS VARIANT

Example:

```text
Product:
Nike Basic T-Shirt
```

Variants:

```text
Nike Basic T-Shirt
├── Black / S
├── Black / M
├── Black / L
├── White / S
├── White / M
└── White / L
```

The Product represents the commercial product.

The Variant represents the actual stockable/sellable SKU.

---

# 7. STOCKABLE UNIT PRINCIPLE

Inventory should normally track:

```text
ProductVariant
```

rather than generic Product.

Example:

```text
SKU: TS-BLK-M-001
```

is inventory-tracked.

Do not create inventory quantities inside Product.

Phase 14 owns inventory balances.

---

# 8. PRODUCT ENTITY

Design according to actual frontend requirements.

Potential:

```text
Product
├── id
├── code
├── name
├── description
├── brandId
├── categoryId
├── unitId
├── seasonId
├── collectionId
├── status
├── productType
├── isActive
├── createdAt
├── updatedAt
└── deletedAt
```

Do not blindly include every field.

Use the frontend and business requirements to determine the final schema.

---

# 9. PRODUCT CODE

Product code must be different from SKU.

Example:

```text
Product Code:
TSHIRT-001

Variant SKU:
TSHIRT-001-BLK-M
```

Do not use SKU as Product identity if multiple variants exist.

---

# 10. PRODUCT CODE RULE

Product code should be:

```text
stable
unique within scope
searchable
human-readable
```

Use database uniqueness.

Do not rely only on service-level duplicate checks.

---

# 11. SKU

SKU belongs to:

```text
ProductVariant
```

not Product when variants exist.

Example:

```text
TSHIRT-001-BLK-S
TSHIRT-001-BLK-M
TSHIRT-001-WHT-M
```

Each SKU must be unique within the appropriate organization scope.

---

# 12. SKU GENERATION

Do not automatically generate complicated SKUs unless the frontend/business requirement supports it.

If automatic SKU generation is required:

```text
Product Code
+
Variant Attributes
```

can be used.

Example:

```text
TSHIRT-001
+
BLK
+
M
=
TSHIRT-001-BLK-M
```

But the final generated SKU must still be validated against database uniqueness.

---

# 13. SKU MUST NOT CHANGE CASUALLY

SKU may be referenced by:

```text
Inventory
Sales
Purchase
Barcode
Reports
Accounting references
```

Therefore changing SKU should be restricted.

If editing SKU is allowed:

```text
permission
audit
validation
```

must apply.

Consider immutable SKU after transactional usage.

---

# 14. BARCODE

Barcode belongs to a Variant or Barcode entity depending on requirements.

If a variant can have multiple barcodes:

prefer:

```text
ProductVariant
    ↓
ProductVariantBarcode
```

Example:

```text
Variant
├── Barcode A
├── Barcode B
└── Barcode C
```

This supports:

```text
EAN
UPC
Internal Barcode
Supplier Barcode
```

if required.

---

# 15. BARCODE ENTITY

If multiple barcodes are supported:

```text
ProductVariantBarcode
├── id
├── variantId
├── barcode
├── type
├── isPrimary
├── status
├── createdAt
└── updatedAt
```

Do not store multiple barcode columns like:

```text
barcode1
barcode2
barcode3
```

---

# 16. BARCODE UNIQUE

Barcode must have appropriate uniqueness.

Potential:

```text
UNIQUE(companyId, barcode)
```

or global uniqueness depending on actual business requirements.

Do not assume barcode uniqueness without checking existing architecture.

---

# 17. BARCODE SEARCH

POS must eventually support:

```text
barcode scan
 ↓
find Variant
 ↓
load Product
 ↓
load Price
 ↓
load Inventory
```

Phase 12/14 will consume this.

Phase 10 must provide a reliable lookup path.

---

# 18. PRODUCT VARIANT

Recommended conceptual model:

```text
ProductVariant
├── id
├── productId
├── sku
├── name/label if required
├── unitId if variant-specific
├── status
├── isActive
├── createdAt
├── updatedAt
└── deletedAt
```

Add fields only when required.

---

# 19. VARIANT ATTRIBUTES

Fashion products often use:

```text
Color
Size
Material
Style
Pattern
```

Phase 09 provides:

```text
Color
Size
```

Reuse them.

Do not duplicate:

```text
variant_color
variant_size
```

as text fields if normalized references are required.

---

# 20. SIMPLE VARIANT MODEL

If frontend only requires Color + Size:

```text
ProductVariant
├── productId
├── colorId
└── sizeId
```

Example:

```text
Product:
T-Shirt

Variants:
Black + S
Black + M
Black + L
White + S
White + M
White + L
```

---

# 21. MULTI-ATTRIBUTE VARIANT MODEL

If frontend requires dynamic attributes:

consider:

```text
ProductAttribute
ProductAttributeValue
ProductVariantAttribute
```

Conceptually:

```text
Product
 ↓
Attribute
 ↓
Value
 ↓
Variant
```

But do NOT build a fully dynamic attribute engine unless frontend/business requirements actually require it.

Prefer explicit Color/Size first if sufficient.

---

# 22. VARIANT DUPLICATE PROTECTION

Do not allow:

```text
Product A
Color = Black
Size = M
```

twice.

Enforce an appropriate unique constraint.

For example:

```text
UNIQUE(productId, colorId, sizeId)
```

if only Color + Size define uniqueness.

If dynamic attributes exist, design a canonical combination strategy.

---

# 23. VARIANT ATTRIBUTE ORDER

If dynamic attributes are used, ensure:

```text
Color=Black, Size=M
```

and:

```text
Size=M, Color=Black
```

cannot create two logically identical variants.

Do not compare raw JSON ordering.

---

# 24. VARIANT STATUS

Variant should support lifecycle:

```text
ACTIVE
INACTIVE
```

or existing project status convention.

Inactive variants:

```text
cannot be newly sold
cannot be newly purchased
cannot be newly stocked
```

according to business rules.

Historical transactions remain valid.

---

# 25. PRODUCT STATUS

Product and Variant status are separate.

Example:

```text
Product = ACTIVE
Variant A = ACTIVE
Variant B = INACTIVE
```

A Product can remain active even when some variants are inactive.

---

# 26. PRODUCT TYPE

If frontend supports:

```text
Stock Item
Service
Non-stock
Bundle
```

inspect actual requirements before adding.

Do not assume all ERP product types are required.

If Product Type is system-defined, enum may be appropriate.

If configurable by admin, Master Data may be appropriate.

---

# 27. PRODUCT IMAGE

If frontend has product images:

prefer:

```text
ProductImage
```

rather than storing multiple image URLs directly in Product.

Potential:

```text
ProductImage
├── id
├── productId
├── url/path
├── sortOrder
├── isPrimary
├── altText
├── createdAt
└── updatedAt
```

Follow the project's existing media architecture.

---

# 28. PRODUCT IMAGE STORAGE

Do not permanently hard-code:

```text
/local/uploads
```

if production storage architecture is not decided.

Follow existing infrastructure.

Phase 28 may later provide production object storage.

---

# 29. PRODUCT IMAGE DELETE

If an image is referenced by frontend:

support:

```text
primary image
sort order
soft delete if appropriate
```

Do not delete a file blindly before database state is safely updated.

---

# 30. BRAND RELATIONSHIP

Product references Phase 09:

```text
Brand
```

Do not copy:

```text
brandName
```

as the canonical database relationship.

A denormalized display name may be returned by DTO/query when useful.

---

# 31. CATEGORY RELATIONSHIP

Product references:

```text
Category
```

from Phase 09.

If multiple categories per product are required by frontend:

use:

```text
ProductCategory
```

rather than:

```text
categoryId1
categoryId2
categoryId3
```

Only implement many-to-many if the product actually requires it.

---

# 32. SEASON / COLLECTION

Product may reference:

```text
Season
Collection
```

from Phase 09.

If Collection already references Season:

avoid redundant relationships unless the business explicitly needs both.

---

# 33. UNIT

Product should reference:

```text
Unit
```

from Phase 09.

If variants can use different units, decide whether Unit belongs to:

```text
Product
```

or:

```text
ProductVariant
```

based on actual business rules.

Do not duplicate unit definitions.

---

# 34. PRODUCT COST

Cost is not the same as selling price.

Potential cost sources:

```text
Purchase Cost
Average Cost
Last Purchase Cost
Standard Cost
```

Do not create all of them automatically.

Inventory valuation will later determine actual costing strategy.

---

# 35. COST OWNERSHIP

Phase 10 may store:

```text
base/standard product cost
```

only if required.

Actual inventory cost belongs to:

```text
Phase 14 — Inventory
Phase 15 — Inventory Ledger
Phase 17 — Accounting
```

Do not mix inventory valuation logic into ProductService.

---

# 36. PRICE DOMAIN

Pricing must be separated from Product.

Conceptual:

```text
Product
   ↓
Variant
   ↓
Price
```

Do not put:

```text
retailPrice
wholesalePrice
vipPrice
salePrice
```

directly into Product if multiple price types/lists are supported.

---

# 37. PRICE LIST

If frontend supports multiple price lists:

```text
PriceList
├── id
├── code
├── name
├── currencyId
├── status
├── companyId
├── validFrom
├── validTo
├── createdAt
├── updatedAt
└── deletedAt
```

Examples:

```text
RETAIL
WHOLESALE
VIP
ONLINE
PROMOTIONAL
```

Use Phase 09 Currency.

---

# 38. PRICE LIST ITEM

Price list entries should reference Variant:

```text
PriceListItem
├── id
├── priceListId
├── variantId
├── price
├── minQuantity if required
├── validFrom
├── validTo
├── status
└── ...
```

Do not store price as a string.

---

# 39. MONEY TYPE

Never use JavaScript floating-point arithmetic for money.

Do not use:

```text
number
```

for calculations such as:

```text
10.10 + 0.20
```

without the project's decimal strategy.

Use the existing database/TypeScript decimal strategy.

For MySQL, monetary columns should use appropriate:

```text
DECIMAL(precision, scale)
```

and TypeScript should handle decimal values safely.

---

# 40. CURRENCY

Every Price List must have a clear currency.

Example:

```text
Retail Price List
Currency = THB
```

Do not assume all companies use the same currency.

---

# 41. PRICE LIST SCOPE

Price List may be:

```text
GLOBAL
COMPANY
BRANCH
```

depending on business requirements.

Use existing organization architecture.

Example:

```text
Company A
 ├── Retail THB
 └── Wholesale THB

Company B
 └── Retail MMK
```

Company A users must not automatically see Company B private price lists.

---

# 42. PRICE LIST ITEM UNIQUENESS

Avoid duplicate active pricing entries for the same:

```text
priceList
variant
effective period
```

Design a constraint/rule preventing ambiguous pricing.

---

# 43. PRICE VALIDITY

Support:

```text
validFrom
validTo
```

if frontend requires scheduled pricing.

Example:

```text
Regular Price
2026-01-01 → 2026-12-31

Promotion Price
2026-08-10 → 2026-08-20
```

---

# 44. OVERLAPPING PRICES

Do not allow ambiguous overlapping price records when the same Price List + Variant has multiple valid prices.

Example bad:

```text
Retail
Variant A
2026-01-01 → 2026-12-31 = 100

Retail
Variant A
2026-06-01 → 2026-08-31 = 90
```

This is only valid if the architecture explicitly defines priority.

Otherwise prevent overlap.

---

# 45. PRICE PRIORITY

If promotional/priority pricing is required:

explicitly model:

```text
priority
```

or a dedicated pricing rule.

Do not rely on:

```text
ORDER BY createdAt DESC
```

to decide business pricing.

---

# 46. BASE PRICE VS PROMOTIONAL PRICE

Separate:

```text
Base Price
```

from:

```text
Promotion / Discount
```

Do not overwrite base price whenever a promotion occurs.

Example:

```text
Retail Base Price = 100
Promotion Discount = 20%
Final = 80
```

---

# 47. DISCOUNT

Phase 09 may define:

```text
DiscountType
```

Phase 10 should implement pricing structures only if required.

Sales owns transaction-level discount application.

Do not let ProductService calculate the final invoice amount.

---

# 48. PRICING RULE

If dynamic pricing is required:

conceptually:

```text
PricingRule
├── id
├── name
├── priority
├── status
├── validFrom
├── validTo
├── conditions
├── action
└── ...
```

But do not create a generic rule engine unless frontend/business requirements demand it.

---

# 49. AVOID GENERIC RULE ENGINE

Do not build:

```text
if
then
else
```

JSON rule execution system in Phase 10 unless explicitly required.

That creates unnecessary complexity.

Start with explicit:

```text
PriceList
PriceListItem
```

and add PricingRule only if necessary.

---

# 50. PRICE RESOLUTION

Future Sales/POS should be able to ask:

```text
Find price for:
Variant
Price List
Quantity
Date
Currency
```

and receive:

```text
resolved price
```

Phase 10 should own price-definition logic.

Sales owns transaction application.

---

# 51. PRICE RESOLUTION ORDER

Define deterministic priority.

For example:

```text
Specific Variant Price
    ↓
Applicable Price List
    ↓
Effective Date
    ↓
Quantity Tier
    ↓
Priority
```

Do not implement arbitrary ordering.

Document the actual rule.

---

# 52. QUANTITY-BASED PRICING

If required:

```text
minQuantity
```

may support:

```text
1+     = 100
10+    = 95
50+    = 90
```

Ensure ranges do not overlap ambiguously.

---

# 53. PRICE AUDIT

Price changes are business-sensitive.

Every price change should be compatible with:

```text
Audit Log
```

including:

```text
who
when
what
old value
new value
organization
```

Do not create another audit system.

---

# 54. PRICE HISTORY

Do not simply overwrite historical price records if historical reporting requires old values.

Use:

```text
validFrom
validTo
```

or existing versioning strategy.

---

# 55. PRODUCT VISIBILITY

Product data must obey Phase 06.

Example:

```text
Company A Product
```

must not appear in:

```text
Company B Product List
```

unless intentionally shared.

---

# 56. PRODUCT SCOPE

Determine whether Product is:

```text
Company-scoped
Branch-scoped
Global
```

based on frontend/business requirements.

Recommended starting point:

```text
Product → Company
```

while stock belongs to:

```text
Warehouse
```

This avoids creating duplicate Products per warehouse.

---

# 57. IMPORTANT ORGANIZATION MODEL

Prefer:

```text
Company
  │
  ├── Products
  │
  ├── Price Lists
  │
  ├── Customers
  │
  ├── Suppliers
  │
  └── Branches
        │
        └── Warehouses
```

rather than:

```text
Warehouse
 └── Product
```

as the primary Product ownership model.

Inventory quantities belong to warehouses.

Product definition belongs to the company/catalog.

---

# 58. PRODUCT BRANCH VISIBILITY

If branch-specific product availability is required:

do not duplicate Product.

Use a mapping:

```text
ProductBranch
```

only if necessary.

Example:

```text
Product
 ↓
Branch Availability
```

This allows:

```text
Product exists globally in Company
Branch A sells it
Branch B does not
```

---

# 59. PRODUCT ACTIVATION

Separate:

```text
Product Active
```

from:

```text
Branch Available
```

and:

```text
Variant Active
```

and:

```text
Inventory Available
```

These are different concepts.

---

# 60. PRODUCT STATUS ≠ STOCK

Do not put:

```text
stockQuantity
```

inside Product.

Inventory owns stock.

---

# 61. PRODUCT STATUS ≠ SALES STATUS

A product can be:

```text
ACTIVE
```

but temporarily unavailable because:

```text
stock = 0
```

Do not deactivate the Product simply because inventory is zero.

---

# 62. PRODUCT SEARCH

Product APIs should support:

```text
search
code
SKU
barcode
brand
category
status
variant
```

where appropriate.

Barcode lookup should be optimized.

---

# 63. PRODUCT LIST

Product list should support:

```text
pagination
search
filter
sorting
```

Do not return all products.

---

# 64. PRODUCT DETAIL

Product detail should be able to return:

```text
Product
Brand
Category
Variants
Images
Pricing summary
Status
```

without exposing internal database entities.

---

# 65. VARIANT DETAIL

Variant detail should support:

```text
Product
SKU
Barcode
Color
Size
Status
Price
```

where appropriate.

Inventory quantities should come from Inventory module later.

---

# 66. PRODUCT DTO

Do not return:

```text
TypeORM Entity
```

directly.

Create response DTOs.

Potential:

```text
ProductResponseDto
ProductVariantResponseDto
ProductImageResponseDto
PriceListResponseDto
PriceListItemResponseDto
```

Follow project naming conventions.

---

# 67. CREATE PRODUCT

Conceptual:

```text
POST /products
```

must:

```text
authenticate
 ↓
authorize products.create
 ↓
resolve organization
 ↓
validate Master Data references
 ↓
validate product code
 ↓
create product
 ↓
create variants if supported
 ↓
commit transaction
 ↓
return DTO
```

---

# 68. CREATE PRODUCT + VARIANTS

If frontend creates Product and Variants in one form:

use a transaction.

Conceptually:

```text
BEGIN

create Product

create Variant 1
create Variant 2
create Variant 3

create Barcodes
create Images

COMMIT
```

If any critical operation fails:

```text
ROLLBACK
```

---

# 69. UPDATE PRODUCT

Do not silently modify identity-critical fields.

Validate:

```text
code
brand
category
unit
status
```

according to business rules.

---

# 70. DELETE PRODUCT

Do not hard delete Product if it has:

```text
Variants
Sales history
Purchase history
Inventory history
Price history
```

Use:

```text
INACTIVE
```

or soft delete.

---

# 71. DELETE VARIANT

Do not hard delete a Variant after it has been used in:

```text
Inventory
Sales
Purchase
```

Use inactive/soft-delete behavior.

---

# 72. PRODUCT DUPLICATE

Prevent duplicate:

```text
company + productCode
```

and define whether duplicate names are allowed.

Names may be non-unique depending on business requirements.

---

# 73. VARIANT DUPLICATE

Prevent duplicate SKU.

Prevent duplicate attribute combinations.

Prevent duplicate primary barcode.

---

# 74. BARCODE LOOKUP API

Provide a clean endpoint according to project API conventions.

Conceptual:

```text
GET /products/lookup/barcode/:barcode
```

or:

```text
GET /product-variants/by-barcode/:barcode
```

Prefer the resource that actually owns the barcode.

---

# 75. SKU LOOKUP API

Conceptual:

```text
GET /product-variants/by-sku/:sku
```

Use indexed lookup.

---

# 76. PRODUCT CODE LOOKUP

Conceptual:

```text
GET /products/by-code/:code
```

only if required by frontend.

Avoid unnecessary endpoint duplication if search already covers it.

---

# 77. PRICING API

Potential:

```text
GET /price-lists
POST /price-lists
GET /price-lists/:id
PATCH /price-lists/:id
POST /price-lists/:id/deactivate
```

and:

```text
GET /price-lists/:id/items
POST /price-lists/:id/items
PATCH /price-list-items/:id
```

Follow existing REST conventions.

---

# 78. PRICE RESOLUTION API

Future POS/Sales may need:

```text
GET /pricing/resolve
```

with:

```text
variantId
priceListId
quantity
date
```

Do not allow the client to submit an arbitrary final price and call it resolved pricing.

---

# 79. PRICE SECURITY

Never trust:

```json
{
  "unitPrice": 1
}
```

from a normal Sales/POS client as the authoritative price.

The backend must resolve/validate pricing according to:

```text
Price List
Pricing Rules
Permissions
Customer/Account
Date
Quantity
```

when those modules are implemented.

---

# 80. PRICE OVERRIDE

If managers can override price:

this must be permission-controlled.

Example conceptual permission:

```text
sales.price_override
```

Do not use role names.

The final implementation belongs partly to Phase 12.

Phase 10 should expose the pricing foundation.

---

# 81. CUSTOMER-SPECIFIC PRICE

Do not implement Customer-specific pricing deeply in Phase 10 if Customer domain belongs to Phase 11.

Prepare the pricing model so Phase 11/12 can extend it.

---

# 82. ACCOUNT-SPECIFIC PRICE

The ERP has account/sales-staff concepts.

Do not hard-code:

```text
salesStaffPrice
```

into Product.

Future pricing should be able to reference:

```text
Customer
Customer Group
Account
Price List
```

through explicit relationships.

---

# 83. PRODUCT + SALES ACCOUNT

Do not couple Product directly to Sales Staff.

Example:

```text
Product
X
SalesStaff
```

is not a valid pricing architecture.

Instead:

```text
User / Employee
 ↓
Sales Account / Customer Account
 ↓
Price List / Pricing Policy
 ↓
Product Variant
```

when the relevant modules are implemented.

---

# 84. PURCHASE PRICE

Purchase price may differ from selling price.

Do not reuse:

```text
sellingPrice
```

as purchase cost.

Future Purchase module can use:

```text
Supplier
Supplier Price
Purchase Cost
```

and Inventory/Accounting can determine actual cost.

---

# 85. PRODUCT COSTING PREPARATION

Product domain may have:

```text
standardCost
```

only if required.

Do not implement:

```text
weighted average
FIFO
LIFO
moving average
```

in Phase 10.

Phase 14/15/17 own costing/valuation.

---

# 86. TAX RELATIONSHIP

Product may optionally have:

```text
defaultTaxId
```

if frontend requires a default tax.

But transaction-level tax must still be resolved in Sales/Purchase.

Do not assume Product's default tax is always the final tax.

---

# 87. DEFAULT PRICE LIST

If Company has a default price list:

use explicit configuration.

Do not hard-code:

```text
RETAIL
```

as default.

---

# 88. PRODUCT IMPORT

Do not implement bulk import unless frontend/business scope requires it.

If import is required:

support:

```text
Product Code
Name
Brand
Category
Unit
Variant
SKU
Barcode
Price
```

with validation and transaction safety.

Do not partially import corrupted data.

---

# 89. PRODUCT IMAGE IMPORT

Do not combine large file processing into Product CRUD unless existing media architecture supports it.

Use separate upload workflow if necessary.

---

# 90. PRODUCT SEARCH INDEX

Do not add Elasticsearch/OpenSearch in Phase 10.

MySQL indexed search is sufficient initially unless requirements prove otherwise.

---

# 91. MYSQL INDEXES

Consider indexes for:

```text
Product(companyId, code)
Product(companyId, name)
Product(companyId, status)

Variant(productId)
Variant(companyId, sku)
Variant(companyId, status)

Barcode(companyId, barcode)

PriceList(companyId, code)
PriceListItem(priceListId, variantId)
```

Use actual query patterns.

Do not blindly index every column.

---

# 92. FOREIGN KEY RULES

Use proper foreign keys:

```text
Product → Brand
Product → Category
Product → Unit
Product → Season
Product → Collection

Variant → Product
Variant → Color
Variant → Size

Barcode → Variant

PriceList → Currency
PriceListItem → PriceList
PriceListItem → Variant
```

depending on final schema.

---

# 93. CASCADE RULES

Be careful with cascade delete.

Do not configure:

```text
Product
  ↓ CASCADE
Sales
Inventory
Accounting
```

Never allow deleting a Product to delete historical transactions.

---

# 94. DATABASE TRANSACTION

Use transactions for:

```text
Product + Variants
Product + Variant + Barcode
PriceList + Items
Bulk price updates
```

when atomicity is required.

---

# 95. CONCURRENT SKU CREATION

Two users may create the same SKU simultaneously.

Database uniqueness is the final protection.

Catch unique constraint errors and return clean API errors.

---

# 96. CONCURRENT PRICE UPDATE

Two admins may update the same price.

Use the existing optimistic locking/versioning strategy if Phase 04/03 provides one.

If no locking strategy exists, document the risk rather than inventing a second system.

---

# 97. PRICE UPDATE AUDIT

Record through existing audit system:

```text
oldPrice
newPrice
priceList
variant
user
timestamp
organization
```

if the audit architecture supports field-level changes.

---

# 98. RBAC PERMISSIONS

Follow Phase 06 permission conventions.

Conceptually:

```text
products.read
products.create
products.update
products.delete

variants.read
variants.create
variants.update
variants.delete

barcodes.read
barcodes.create
barcodes.update
barcodes.delete

price_lists.read
price_lists.create
price_lists.update
price_lists.delete

pricing.read
pricing.create
pricing.update
pricing.delete
pricing.override
```

Do not create duplicate permission namespaces if Phase 06 already established a standard.

---

# 99. DATA VISIBILITY

Every Product request must apply:

```text
Authentication
+
Permission
+
Company Scope
+
Branch Scope if applicable
+
Product State
```

according to Phase 06.

---

# 100. CROSS-COMPANY TEST

Create:

```text
Company A
Product A
Variant A
Price List A
```

and:

```text
Company B
Product B
Variant B
Price List B
```

Company A user must not access Company B records unless explicitly authorized by global scope.

---

# 101. PRODUCT SECURITY

Test IDOR:

```text
GET /products/{companyBProductId}
PATCH /products/{companyBProductId}
DELETE /products/{companyBProductId}
```

must not bypass scope.

---

# 102. PRICE SECURITY

Test:

```text
Company A user
```

attempting to update:

```text
Company B Price List
```

must be rejected.

---

# 103. INACTIVE MASTER DATA

Product creation must reject references to inactive Master Data when business rules require active references:

```text
inactive Brand
inactive Category
inactive Unit
inactive Color
inactive Size
inactive Season
inactive Collection
```

---

# 104. PRODUCT VALIDATION

Validate:

```text
name
code
brandId
categoryId
unitId
status
```

and all required frontend fields.

Do not allow invalid foreign keys.

---

# 105. VARIANT VALIDATION

Validate:

```text
productId
sku
colorId
sizeId
```

according to actual model.

---

# 106. BARCODE VALIDATION

Validate:

```text
barcode not empty
barcode format if required
barcode unique
variant exists
```

Do not assume all barcode formats are numeric.

Keep the barcode as a string.

---

# 107. SKU VALIDATION

SKU should be treated as a string.

Do not assume:

```text
SKU = integer
```

---

# 108. PRODUCT NAME SEARCH

Use existing search abstraction.

Avoid SQL:

```text
LIKE '%query%'
```

everywhere if the project already has a search abstraction.

---

# 109. FILTERS

Potential Product filters:

```text
brand
category
status
season
collection
color
size
priceList
```

Only expose filters supported by frontend/business needs.

---

# 110. SORTING

Whitelist:

```text
name
code
createdAt
updatedAt
```

and other approved fields.

Never accept raw SQL column names from the client.

---

# 111. PAGINATION

Use Phase 04 pagination.

Do not implement another pagination DTO.

---

# 112. RESPONSE SHAPE

Follow existing API response format.

Potential:

```json
{
  "id": "...",
  "code": "...",
  "name": "...",
  "brand": {},
  "category": {},
  "variants": []
}
```

Do not expose internal foreign-key implementation unnecessarily.

---

# 113. N+1 PREVENTION

Product list must not execute:

```text
1 query for products
+
1 query per product for brand
+
1 query per product for category
+
1 query per product for variants
```

Use appropriate joins/batching/query strategies.

---

# 114. PRODUCT LIST PERFORMANCE

Do not load:

```text
all images
all variants
all prices
all history
```

into a lightweight Product list unless frontend requires it.

Use summary/list DTOs.

---

# 115. PRODUCT DETAIL PERFORMANCE

Product detail can load richer information.

Still avoid:

```text
unbounded relations
```

---

# 116. PRICE LOOKUP PERFORMANCE

Price lookup must use indexes:

```text
priceListId
variantId
validFrom
validTo
status
```

according to actual query patterns.

---

# 117. BARCODE LOOKUP PERFORMANCE

Barcode lookup should be indexed and return only the necessary variant/product information.

This endpoint will eventually be called frequently by POS.

---

# 118. REDIS

Do not introduce Redis caching unless Phase 19 is currently being implemented.

However, design APIs so future caching is possible.

Potential cache targets:

```text
Product lookup
Barcode lookup
Price lookup
Active categories
Active brands
```

---

# 119. BULLMQ

Do not introduce BullMQ jobs for ordinary Product CRUD.

Future jobs may handle:

```text
image processing
bulk import
price updates
search indexing
```

if required.

Phase 20 owns worker infrastructure.

---

# 120. OUTBOX

Do not create a second event system.

Phase 18 owns Outbox.

If Product events are needed later:

```text
PRODUCT_CREATED
PRODUCT_UPDATED
PRODUCT_DEACTIVATED
VARIANT_CREATED
VARIANT_UPDATED
PRICE_CHANGED
```

must integrate with the existing Outbox architecture.

---

# 121. AUDIT LOG

Product changes should be compatible with Audit Log:

```text
CREATE
UPDATE
DEACTIVATE
DELETE
PRICE_CHANGE
SKU_CHANGE
BARCODE_CHANGE
```

Use the existing audit architecture.

---

# 122. PRODUCT HISTORY

Do not build a full Product History table unless the existing architecture requires it.

Audit Log + price validity/history may be sufficient.

---

# 123. PRODUCT API MODULE STRUCTURE

Follow existing project structure.

Potential:

```text
src/modules/catalog/
```

or:

```text
src/modules/products/
```

Use the existing architecture rather than creating an arbitrary folder.

Potential domain structure:

```text
products/
├── controllers
├── services
├── repositories
├── entities
├── dto
└── mappers

variants/
pricing/
price-lists/
barcodes/
```

Avoid unnecessary fragmentation.

---

# 124. DOMAIN BOUNDARY

Product domain owns:

```text
Product definition
Variant definition
SKU
Barcode
Product images
Price definitions
Price lists
```

Product domain does NOT own:

```text
Stock
Sales
Purchase
Payments
Accounting
Customer
Supplier
```

---

# 125. PRICE VS SALES TRANSACTION

Phase 10:

```text
What price should be available?
```

Phase 12:

```text
What price was actually charged?
```

This distinction is critical.

Sales transaction must preserve the actual applied unit price even if the Product price changes later.

---

# 126. PRICE VS PURCHASE

Phase 10:

```text
catalog/reference pricing
```

Phase 13:

```text
actual purchase price
```

Do not overwrite Product prices based on one Purchase transaction.

---

# 127. PRICE VS ACCOUNTING

Phase 10 defines prices.

Phase 17 determines accounting impact.

Do not post GL entries from ProductService.

---

# 128. INVENTORY BOUNDARY

Product Variant:

```text
What item is this?
```

Inventory:

```text
How many do we have?
Where is it?
What is its valuation?
```

Do not store:

```text
stockQty
availableQty
reservedQty
```

as authoritative Product fields.

---

# 129. POS BOUNDARY

POS will eventually need:

```text
barcode
SKU
product
variant
price
tax
availability
```

Phase 10 provides:

```text
Product
Variant
Barcode
Price
```

Inventory/POS modules provide real-time stock.

---

# 130. ACCOUNT / CUSTOMER PRICING PREPARATION

The system may later support:

```text
Customer Group
Customer-specific Price
Sales Account
Sales Staff
Branch Price
```

Do not hard-code these into Product.

Design PriceList so future ownership/targeting can be extended cleanly.

---

# 131. PRICE LIST TARGETING

If future requirements include:

```text
Customer Group → Price List
Branch → Price List
Sales Account → Price List
```

do not create multiple price columns.

Prefer explicit mapping entities later.

Do not implement them prematurely.

---

# 132. MULTI-CURRENCY

If Company supports:

```text
THB
MMK
USD
```

do not silently convert currencies inside Product.

Price List has explicit Currency.

Exchange rates belong to a future accounting/financial configuration domain.

---

# 133. TAX + PRICE

Clarify whether stored prices are:

```text
tax-inclusive
```

or:

```text
tax-exclusive
```

according to frontend/business requirements.

Do not assume.

Document the chosen behavior.

---

# 134. ROUNDING

Price calculations must define rounding according to currency and business rules.

Do not use JavaScript floating-point rounding blindly.

---

# 135. PRICE DECIMAL

Use a consistent monetary precision.

Example:

```text
DECIMAL(19,4)
```

only if this matches the project's database standard.

Do not arbitrarily use different precision in different tables.

---

# 136. PRICE LIST ITEM STATUS

A PriceListItem may be:

```text
ACTIVE
INACTIVE
```

or governed by validity dates.

Do not leave stale price entries ambiguous.

---

# 137. PRICE LIST DEACTIVATION

Deactivating a PriceList must not delete historical PriceListItems.

Historical Sales must remain understandable.

---

# 138. PRODUCT ARCHIVE

If Product is archived:

```text
Product = INACTIVE
```

should not delete:

```text
Variants
Barcodes
Price history
Audit history
```

---

# 139. REST API EXAMPLES

Use actual project conventions, but conceptually:

```text
GET    /products
GET    /products/:id
POST   /products
PATCH  /products/:id
POST   /products/:id/deactivate

GET    /product-variants/:id
POST   /products/:id/variants
PATCH  /product-variants/:id
POST   /product-variants/:id/deactivate

GET    /product-variants/by-sku/:sku
GET    /product-variants/by-barcode/:barcode

GET    /price-lists
GET    /price-lists/:id
POST   /price-lists
PATCH  /price-lists/:id
POST   /price-lists/:id/deactivate

GET    /price-lists/:id/items
POST   /price-lists/:id/items
PATCH  /price-list-items/:id

GET    /pricing/resolve
```

Do not blindly copy this list; reconcile with existing API architecture.

---

# 140. CREATE PRODUCT DTO

Potential:

```text
CreateProductDto
├── code
├── name
├── description
├── brandId
├── categoryId
├── unitId
├── seasonId
├── collectionId
├── status
└── variants[]
```

Only include fields supported by frontend/business requirements.

---

# 141. CREATE VARIANT DTO

Potential:

```text
CreateProductVariantDto
├── sku
├── colorId
├── sizeId
├── barcode
└── status
```

If multiple barcodes:

```text
barcodes[]
```

---

# 142. CREATE PRICE DTO

Potential:

```text
CreatePriceListItemDto
├── variantId
├── price
├── minQuantity
├── validFrom
├── validTo
└── status
```

---

# 143. VALIDATION

Use existing validation pipe/DTO validation.

Validate:

```text
required
type
length
decimal
UUID
dates
enum
```

according to actual project architecture.

---

# 144. ERROR CODES

Use existing error architecture.

Potential domain errors:

```text
PRODUCT_NOT_FOUND
PRODUCT_CODE_ALREADY_EXISTS
VARIANT_NOT_FOUND
SKU_ALREADY_EXISTS
BARCODE_ALREADY_EXISTS
VARIANT_ALREADY_EXISTS
PRODUCT_IN_USE
VARIANT_IN_USE
PRICE_LIST_NOT_FOUND
PRICE_ALREADY_EXISTS
PRICE_OVERLAP
INVALID_PRICE
INVALID_PRICE_RANGE
INACTIVE_MASTER_DATA
```

Only add errors that are actually needed.

---

# 145. TESTING MATRIX

For Product:

```text
Create
Read
List
Update
Deactivate
Delete/Archive
Duplicate code
Invalid Master Data
Inactive Master Data
Wrong company
Unauthorized
IDOR
Pagination
Search
Filter
Sorting
```

---

# 146. VARIANT TESTING

Test:

```text
Create variant
Duplicate SKU
Duplicate Color/Size combination
Invalid product
Inactive product
Wrong company
Unauthorized
Deactivate
Barcode assignment
Multiple barcodes
Duplicate barcode
```

---

# 147. PRICING TESTING

Test:

```text
Create Price List
Create Price
Duplicate Price
Invalid Currency
Wrong company
Inactive Price List
Valid date
Invalid date
Overlapping date
Quantity tiers
Price resolution
Price history
Unauthorized price update
```

---

# 148. SECURITY TESTING

Test:

```text
Company A user
    ↓
Company B Product
```

for:

```text
GET
PATCH
DELETE
PRICE UPDATE
BARCODE LOOKUP
SKU LOOKUP
```

All must respect visibility rules.

---

# 149. RBAC TESTING

User with:

```text
products.read
```

must not automatically:

```text
products.create
products.update
products.delete
```

unless permission inheritance explicitly exists.

---

# 150. PRICE OVERRIDE SECURITY

User without:

```text
pricing.override
```

must not be able to bypass backend price resolution in future Sales APIs.

Prepare the domain for this rule.

---

# 151. DATABASE MIGRATION

Create migrations for only the required tables.

Potential:

```text
products
product_variants
product_variant_barcodes
product_images
price_lists
price_list_items
```

and any explicitly required supporting tables.

Do not create unnecessary tables.

---

# 152. INDEXES

Required indexes should be based on actual access patterns.

At minimum consider:

```text
products(companyId, code)
products(companyId, status)

product_variants(productId)
product_variants(companyId, sku)
product_variants(companyId, status)

product_variant_barcodes(companyId, barcode)

price_lists(companyId, code)
price_list_items(priceListId, variantId)
```

Add effective-date indexes if pricing queries require them.

---

# 153. SEED DATA

Only create deterministic seed data if required.

Possible:

```text
Sample Product
Sample Variants
Sample Price List
```

but do not insert fake production business data automatically.

Prefer Master Data seeds from Phase 09.

---

# 154. SEED IDEMPOTENCY

Running seed repeatedly must not create duplicate:

```text
Product
SKU
Barcode
Price List
Price
```

Use stable business codes.

---

# 155. DOCUMENTATION

Create/update:

```text
docs/product-domain.md
docs/pricing-domain.md
docs/product-frontend-backend-mapping.md
```

according to existing documentation structure.

Document:

```text
Product
Variant
SKU
Barcode
Pricing
Price List
Price Resolution
Scope
Permissions
```

---

# 156. PRODUCT ERD

Document:

```text
Product
   │
   ├── ProductVariant
   │      ├── Barcode
   │      └── Variant Attributes
   │
   ├── ProductImage
   │
   ├── Brand
   ├── Category
   ├── Unit
   ├── Season
   └── Collection

PriceList
   │
   └── PriceListItem
          │
          └── ProductVariant
```

---

# 157. FRONTEND-BACKEND CONTRACT

Create a mapping table:

```text
Frontend Screen
→ API
→ DTO
→ Entity
→ Permission
→ Data Scope
```

Example:

```text
Product List
→ GET /products
→ ProductListResponseDto
→ Product
→ products.read
→ Company

Product Form
→ POST /products
→ CreateProductDto
→ Product + Variant
→ products.create
→ Company

Variant Manager
→ POST /products/:id/variants
→ CreateProductVariantDto
→ ProductVariant
→ variants.create
→ Company

Price Management
→ POST /price-lists/:id/items
→ CreatePriceListItemDto
→ PriceListItem
→ pricing.create
→ Company
```

---

# 158. PHASE 10 → PHASE 11 CONTRACT

Customer/Supplier must be able to reference:

```text
Product
ProductVariant
PriceList
```

if required.

Do not duplicate Product definitions in Customer/Supplier.

---

# 159. PHASE 10 → PHASE 12 CONTRACT

Sales must be able to:

```text
find Product
find Variant
scan Barcode
resolve Price
apply Tax
record actual unit price
```

Sales owns the transaction.

---

# 160. PHASE 10 → PHASE 13 CONTRACT

Purchase must be able to:

```text
select Product
select Variant
use Unit
record Supplier-specific cost
```

Purchase owns actual Purchase transactions.

---

# 161. PHASE 10 → PHASE 14 CONTRACT

Inventory must be able to:

```text
identify Variant
identify SKU
identify Barcode
identify Unit
```

Inventory owns:

```text
quantity
warehouse
stock movement
reservation
availability
```

---

# 162. PHASE 10 → PHASE 15 CONTRACT

Inventory Ledger must be able to reference:

```text
ProductVariant
```

and record historical movements.

Do not delete variants that have ledger history.

---

# 163. PHASE 10 → PHASE 17 CONTRACT

Accounting may reference:

```text
Product
ProductVariant
Tax
Currency
```

but Product must never directly post accounting entries.

---

# 164. PHASE 10 → PHASE 19 CONTRACT

Redis may later cache:

```text
barcode → variant
sku → variant
variant + priceList → price
```

Design lookup services cleanly enough for caching later.

---

# 165. PHASE 10 → PHASE 20 CONTRACT

BullMQ may later process:

```text
bulk product import
bulk price update
image processing
catalog synchronization
```

Do not put queue processing into normal CRUD.

---

# 166. PHASE 10 → PHASE 22 CONTRACT

Reports must be able to aggregate:

```text
Product
Variant
Category
Brand
Price
Sales
Purchase
Inventory
```

Do not design Product in a way that makes historical joins impossible.

---

# 167. IMPORTANT HISTORICAL RULE

Never rely on current Product data to reconstruct historical Sales.

Example:

```text
Today:
Product name = "Premium Shirt"
Price = 100
```

Later:

```text
Product name = "Premium Cotton Shirt"
Price = 120
```

Historical Sale must still show:

```text
the actual sold product/variant
actual unit price
actual tax
```

Sales module will store transaction snapshots.

---

# 168. PRODUCT NAME CHANGE

Changing Product name must not rewrite historical transaction snapshots.

Product identity remains stable.

---

# 169. PRICE CHANGE

Changing Product/PriceList price must not change old Sales.

Future Sales use the new resolved price.

---

# 170. SKU CHANGE

If SKU changes after historical usage:

consider preserving historical reference/audit.

Prefer restricting SKU changes once used transactionally.

---

# 171. BARCODE CHANGE

Barcode changes should not invalidate historical transaction references.

Sales should reference Variant ID, not rely only on barcode.

---

# 172. PRODUCT IDENTITY

The stable identity is:

```text
Product.id
Variant.id
```

not:

```text
name
SKU
barcode
```

SKU/barcode are business identifiers.

---

# 173. PRODUCT + VARIANT RELATIONSHIP

Do not allow a Variant to exist without Product.

Foreign key:

```text
ProductVariant.productId → Product.id
```

must be enforced.

---

# 174. PRODUCT DEACTIVATION CASCADE

Deactivating Product may make its Variants unavailable for new transactions.

But do not physically delete Variants.

---

# 175. VARIANT DEACTIVATION

A Product may have:

```text
10 variants
```

and only:

```text
2 active
```

This is valid.

---

# 176. PRODUCT IMAGE RELATIONSHIP

Images belong to Product unless frontend explicitly requires variant-specific images.

If variant-specific images are needed:

consider:

```text
ProductImage
productId nullable
variantId nullable
```

with clear constraints.

Do not create ambiguous ownership.

---

# 177. FASHION-SPECIFIC CONSIDERATION

Fashion ERP often requires:

```text
Style
Color
Size
Season
Collection
Brand
Category
SKU
Barcode
```

The architecture should support these without hard-coding a specific fashion brand's catalog.

---

# 178. COLOR + SIZE MATRIX

If frontend has matrix-style variant creation:

Example:

```text
Colors:
Black
White

Sizes:
S
M
L

Generate:

Black-S
Black-M
Black-L
White-S
White-M
White-L
```

implement generation server-side safely if the frontend requires it.

Do not trust client-generated combinations without validation.

---

# 179. MATRIX DUPLICATE PROTECTION

Generated variants must still pass:

```text
SKU uniqueness
attribute combination uniqueness
barcode uniqueness
```

inside a database transaction.

---

# 180. BULK VARIANT CREATION

If matrix creation is supported:

prefer one transactional API:

```text
POST /products/:id/variants/bulk
```

rather than 100 independent requests.

Only implement if frontend actually needs it.

---

# 181. PRODUCT CLONING

Do not implement Product cloning unless frontend requires it.

If implemented later:

must decide whether to clone:

```text
variants
images
prices
```

and must generate new identity/SKU safely.

---

# 182. PRODUCT ARCHIVE

Archive behavior must preserve:

```text
history
references
audit
pricing history
```

---

# 183. PRICE LIST ARCHIVE

Same principle:

```text
archive
≠
delete history
```

---

# 184. API IDEMPOTENCY

If bulk create/update endpoints are introduced later, use the project's idempotency mechanism if available.

Do not invent custom idempotency headers.

---

# 185. OBSERVABILITY

Log important events through existing logging:

```text
ProductCreated
VariantCreated
SKUChanged
BarcodeAdded
PriceChanged
PriceListUpdated
```

Do not log sensitive data unnecessarily.

---

# 186. NO PASSWORD / SECRET DATA

Product domain must never contain:

```text
password
access token
refresh token
API secret
```

---

# 187. NO ROLE LOGIC

Never implement:

```text
if user.role === "ADMIN"
```

Use permissions and scope from Phase 06.

---

# 188. FINAL VALIDATION

Run:

```text
lint
typecheck
unit tests
integration tests
migration tests
authorization tests
security tests
```

and existing project validation commands.

---

# 189. REQUIRED PRE-CODING REPORT

Before implementation, report:

```text
1. Existing frontend Product features
2. Existing Product backend entities
3. Phase 09 Master Data dependencies
4. Product entity proposal
5. Variant entity proposal
6. SKU strategy
7. Barcode strategy
8. Product image strategy
9. Pricing architecture
10. Price List architecture
11. Price resolution strategy
12. Product scope
13. Price List scope
14. Permission matrix
15. Data visibility matrix
16. API design
17. ERD
18. Database indexes
19. Historical data strategy
20. Phase 11/12/13/14 dependencies
21. Risks
22. Implementation order
```

Only after this analysis should coding begin.

---

# 190. ACCEPTANCE CRITERIA

Phase 10 is complete only when:

```text
[ ] Frontend Product scope inspected
[ ] Existing backend architecture inspected
[ ] Phase 09 Master Data reused
[ ] Product entity implemented
[ ] Product Variant implemented
[ ] SKU implemented
[ ] Barcode implemented
[ ] Product image support implemented if required
[ ] Product/Variant lifecycle implemented
[ ] Product scope implemented
[ ] Variant uniqueness implemented
[ ] SKU uniqueness implemented
[ ] Barcode uniqueness implemented
[ ] Product → Brand relationship works
[ ] Product → Category relationship works
[ ] Product → Unit relationship works
[ ] Product → Season relationship works
[ ] Product → Collection relationship works
[ ] Product → Color/Size relationship works where required
[ ] Inactive Master Data validation works
[ ] Price List implemented if required
[ ] Price List Item implemented
[ ] Currency relationship works
[ ] Price validity works
[ ] Price overlap protection works
[ ] Quantity pricing works if required
[ ] Price resolution is deterministic
[ ] Money uses safe decimal strategy
[ ] Historical price behavior is preserved
[ ] Product does not own inventory quantity
[ ] Product does not own Sales transactions
[ ] Product does not own Purchase transactions
[ ] Product does not post Accounting entries
[ ] RBAC permissions enforced
[ ] Data visibility enforced
[ ] Cross-company access blocked
[ ] IDOR protection tested
[ ] Pagination implemented
[ ] Search implemented
[ ] Filtering implemented
[ ] Sorting whitelisted
[ ] DTOs implemented
[ ] TypeORM entities not exposed directly
[ ] Database constraints implemented
[ ] Appropriate indexes implemented
[ ] Transactions used where required
[ ] Concurrency handled
[ ] Audit compatibility implemented
[ ] Outbox compatibility preserved
[ ] Redis not prematurely duplicated
[ ] BullMQ not prematurely duplicated
[ ] Docker works
[ ] Migrations work
[ ] Unit tests pass
[ ] Integration tests pass
[ ] Security tests pass
[ ] Documentation updated
[ ] Phase 11 can consume Product cleanly
[ ] Phase 12 can resolve Product/Variant/Pricing cleanly
[ ] Phase 13 can consume Product/Variant cleanly
[ ] Phase 14 can track inventory by Variant
```

---

# 191. FINAL ARCHITECTURE

The expected conceptual architecture:

```text
                         PRODUCT CATALOG
                               │
                ┌──────────────┴──────────────┐
                │                             │
             Product                     Master Data
                │                             │
       ┌────────┼────────┐          ┌─────────┼─────────┐
       │        │        │          │         │         │
     Brand   Category   Unit      Color      Size     Season
       │        │        │          │         │         │
       └────────┴────────┴──────────┴─────────┴─────────┘
                               │
                               ▼
                         Product Variant
                               │
                    ┌──────────┼──────────┐
                    │          │          │
                   SKU      Barcode     Images
                    │
                    ▼
                 Pricing
                    │
             ┌──────┴──────┐
             │             │
         Price List     Price Item
             │             │
             └──────┬──────┘
                    │
                    ▼
              Sales / POS
                    │
                    ▼
                Inventory
                    │
                    ▼
              Accounting
```

---

# 192. MOST IMPORTANT BOUNDARIES

Keep these boundaries strict:

```text
Product
= What is the item?

Variant
= Which exact sellable/stockable version?

SKU
= Business identifier for the Variant

Barcode
= Scannable identifier for the Variant

Price List
= Which pricing catalog?

Price
= What price is currently defined?

Sales
= What did the customer actually buy and pay?

Purchase
= What did we actually buy and at what cost?

Inventory
= How many do we have and where?

Inventory Ledger
= How did the quantity change?

Accounting
= What financial entries resulted?
```

---

# 193. FINAL PRINCIPLE

Do NOT build Phase 10 as:

```text
Product
├── stockQty
├── retailPrice
├── wholesalePrice
├── purchasePrice
├── barcode
├── color
├── size
└── sales
```

Instead build:

```text
Product
   │
   └── ProductVariant
          │
          ├── SKU
          ├── Barcode
          ├── Color
          └── Size

Product
   │
   └── PriceList
          │
          └── PriceListItem
                 │
                 └── ProductVariant
```

Then:

```text
Product Variant
      │
      ├──────────────→ Sales
      │
      ├──────────────→ Purchase
      │
      ├──────────────→ Inventory
      │
      └──────────────→ Inventory Ledger
```

And:

```text
Pricing
   ↓
Sales
   ↓
Actual Transaction Price
   ↓
Accounting
```

The key rule is:

```text
CATALOG DATA
≠
TRANSACTION DATA
≠
INVENTORY DATA
≠
ACCOUNTING DATA
```

Keep these boundaries clean so the Fashion ERP can scale without turning ProductService into a giant monolith.

---

# 194. FINAL IMPLEMENTATION REPORT

After implementation, output:

```text
Phase 10 Implementation Report

1. Frontend Product features discovered
2. Product entities created
3. Variant architecture
4. SKU strategy
5. Barcode strategy
6. Image strategy
7. Pricing architecture
8. Price resolution logic
9. Master Data dependencies
10. Organization/Data Scope
11. RBAC permissions
12. API endpoints
13. Database migrations
14. Indexes
15. Constraints
16. Audit integration
17. Outbox integration readiness
18. Redis/BullMQ readiness
19. Tests
20. Security tests
21. Performance findings
22. Documentation
23. Phase 11 readiness
24. Phase 12 readiness
25. Phase 13 readiness
26. Phase 14 readiness
27. Remaining risks
28. Known limitations
```

Do not claim Phase 10 is complete unless the acceptance criteria have been verified.

# END OF PHASE 10
