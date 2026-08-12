# PRODUCT_VARIANT_PRICING_ARCHITECTURE.md

Product, ProductVariant, ProductVariantAttribute, ProductVariantBarcode,
PriceList, and PriceListItem implemented in Phase 10. Unit/UOM, Currency
(as an entity), and any promotion/discount/coupon engine are explicitly
deferred — see "Unit/UOM Deferral" and "Currency Decision" below. Sales,
Purchase, Inventory, and Accounting do not exist yet; this document
describes the catalog/pricing foundation only.

## 1. Product Architecture

`Product` (`products`) is the commercial/catalog concept — never itself the
stockable/sellable unit. Company-scoped (`companyId → companies`, `ON
DELETE RESTRICT`), `UNIQUE(company_id, code)`. `code` is the stable,
immutable business identifier (distinct from any variant's SKU — see
"SKU Architecture" below). References `categoryId` (required) and
`brandId` (required) into the existing Phase 09 `Category`/`Brand` tables,
and an optional `collectionId` into `Collection` — all validated
server-side to be active and to belong to the same company before a
Product references them. `productType` (`SIMPLE` | `VARIANT`) is a
display/workflow hint only — see "ProductVariant Architecture" for why it
never changes the underlying data shape.

## 2. ProductVariant Architecture

`ProductVariant` (`product_variants`) is the stockable/sellable unit.
**Every Product — SIMPLE or VARIANT — owns at least one ProductVariant
row**, created transactionally in the same call as the Product itself
(`ProductsService.create()` wraps both inside `TransactionService.run()`).
This was a deliberate decision: it gives Phase 12 (Sales), Phase 13
(Purchase), and Phase 14 (Inventory) exactly one identity to reference
(`ProductVariant.id`) regardless of whether a merchandiser thinks of a
given product as "simple" or "has variants" — there is never a fork
between "Product is sellable" and "Variant is sellable" for those phases
to handle specially.

Company-scoped (`companyId → companies`, `ON DELETE RESTRICT`),
`productId → products` (`ON DELETE RESTRICT`). Carries `sku`, a
server-computed `combinationKey` (see "Variant Combination Integrity"
below), `costPrice`/`sellingPrice` (`DECIMAL(12,2)`, never floating
point), and `status`.

## 3. SKU Architecture

Four distinct concepts, never collapsed:

| Field | Lives on | Mutability | Uniqueness |
|---|---|---|---|
| `code` | `Product` | Immutable after creation | `UNIQUE(company_id, code)` |
| `sku` | `ProductVariant` only | Set at creation, not exposed for edit via `UpdateProductVariantDto` | `UNIQUE(company_id, sku)` |
| `combinationKey` | `ProductVariant` (internal) | Recomputed by the service whenever attributes change | `UNIQUE(product_id, combination_key)` |
| `barcode` | `ProductVariantBarcode` | Set at creation | `UNIQUE(company_id, barcode)` |

SKU never lives on `Product` — a Product's "SKU" as a user-facing concept
is `Product.code`; a request that needs the actual sellable identifier
uses the Variant's `sku`. This directly follows the Phase 10 specification
("SKU belongs to ProductVariant not Product when variants exist";
"Product code must be different from SKU") and the approved Phase 10
analysis's Decision D3. SKU is stored as a plain string (never assumed
numeric), validated for uniqueness at both the service layer (an explicit
409 via `AppException`) and the database layer (`UNIQUE` index as the
backstop against a concurrent-creation race — checked inside the same
transaction that inserts the row).

## 4. Barcode Architecture

`ProductVariantBarcode` (`product_variant_barcodes`) is a normalized,
separate table — **not** a column on `ProductVariant`, and never a
comma-separated string or JSON array. One `ProductVariant` may have
multiple `ProductVariantBarcode` rows (verified by a dedicated e2e test
creating two barcodes for the same variant). Company-scoped uniqueness:
`UNIQUE(company_id, barcode)` — the same barcode text may be reused across
two different companies (consistent with every other Phase 07/09
company-scoped uniqueness pattern in this codebase) but never twice within
one company. `barcode` is a plain string, never assumed numeric. Each
barcode has its own `ACTIVE`/`INACTIVE` lifecycle, independent of the
parent variant's status.

## 5. Dynamic Attribute Architecture

```text
Product
  └── ProductVariant
        └── ProductVariantAttribute (join table)
              └── AttributeOption (Phase 09, unchanged)
```

`ProductVariantAttribute` (`product_variant_attributes`) is the normalized
join between a Variant and the existing Phase 09 `AttributeOption` table —
dynamic, not a hard-coded `colorId`/`sizeId` pair, so it supports
`COLOR`/`SIZE`/`STYLE`/`MATERIAL` (and any future kind Phase 09 might add)
without a schema change. `kind` is denormalized onto the join row from the
referenced `AttributeOption` at write time, purely so MySQL can enforce
"at most one option per kind per variant" via `UNIQUE(variant_id, kind)` —
the canonical relationship is still `optionId → attribute_options.id`,
re-validated (active, correct kind, same company) by the service on every
write. `ProductVariantAttributesService` logic lives inside
`ProductsService`/`ProductVariantsService` (no separate service class was
needed — attribute resolution is a private helper shared by both, per
"do not create duplicate Product or ProductVariant concepts").

Attributes belong to the **Variant**, not the Product — a Product does not
pre-declare an "allowed colors" list; each Variant simply references the
concrete `AttributeOption` rows that describe it. This matches the
frontend's own `ProductVariant.attributes: Partial<Record<AttributeKind,
string>>` shape (confirmed during the Phase 10 analysis) and keeps Phase
09 completely unmodified.

## 6. Variant Combination Integrity

Duplicate variants (same Product, same set of attribute options) are
rejected. Enforced via a server-computed **canonical combination key**:
the variant's `AttributeOption` IDs, sorted and joined with `|`
(`computeCombinationKey()` in `src/modules/products/utils/
combination-key.ts`). `UNIQUE(product_id, combination_key)` backs this at
the database level; the service also performs an explicit pre-check so a
duplicate combination returns a clear 409 rather than a raw constraint
error. A SIMPLE product's single default variant (zero attributes) has an
empty-string key — safe, since only one such row is ever created for that
product. This is fully relational — no JSON blob is used for variant
attributes anywhere in this design.

## 7. PriceList Architecture

`PriceList` (`price_lists`) is included in Phase 10 as a deliberate,
explicit architecture decision (per this implementation's locked
instructions — "PriceList infrastructure must be implemented now rather
than deferred to Sales"). Company-scoped, `UNIQUE(company_id, code)`.
Fields: `id`, `companyId`, `code`, `name`, `description` (nullable),
`currency` (plain `CHAR(3)` ISO-4217 string — see "Currency Decision"
below), `status`, timestamps, soft delete. No promotion/coupon/campaign/
tier-pricing/customer-group logic exists anywhere in this entity or its
service — `PriceListsService` only manages the catalog record itself.

## 8. PriceListItem Architecture

`PriceListItem` (`price_list_items`) is the effective-dated price for one
`ProductVariant` within one `PriceList`. Fields: `id`, `priceListId`,
`productVariantId`, `companyId` (denormalized from the parent PriceList
for direct company-scoped queries, consistent with every other
company-scoped table in this codebase), `price` (`DECIMAL(12,2)`),
`validFrom`, `validTo` (nullable — open-ended), `status`, timestamps, soft
delete. No `minQuantity` or customer-group field was added — neither is
justified by the Phase 10 specification's minimum requirement or by any
concrete frontend evidence, per "do not add fields simply because they
might be useful someday."

## 9. Pricing Scope

Both `PriceList` and `PriceListItem` are company-scoped, matching
`Product`/`ProductVariant`'s own scope and Phase 07's `Company → Branch →
Warehouse` hierarchy. No Branch-level pricing was built — the locked
instructions make it explicitly conditional ("if Branch-level pricing is
explicitly required by the specification, implement it using the existing
Branch entity"), and no such requirement surfaced in the spec, the
approved analysis, or the frontend. `resolveRequestCompanyId()` (the same
Phase 09 helper, unmodified) is reused for every Product/Variant/Barcode/
PriceList/PriceListItem controller — no second visibility mechanism was
created.

## 10. Currency Decision

**No `Currency` entity was created in Phase 10** — this was locked in
advance and confirmed by the approved Phase 10 analysis. `PriceList.currency`
is a plain `CHAR(3)` ISO-4217 string, validated by regex
(`/^[A-Z]{3}$/`) at the DTO layer — mirroring `Company.baseCurrency`'s own
existing `varchar(3)` pattern from Phase 07 exactly, rather than inventing
a new currency representation. No exchange-rate or currency-conversion
logic exists anywhere in this phase. A dedicated Currency domain (with
real ISO-4217 validation against a maintained list, exchange rates, and
multi-currency conversion) can be introduced later as a clean addition —
`PriceList.currency` would simply gain a proper FK at that point — once a
concrete multi-currency requirement exists; none does today on either the
backend or frontend side.

## 11. Unit/UOM Decision

**Unit/UOM is explicitly deferred, per locked instruction.** No `Unit`,
`UOM`, `UnitConversion`, `ProductUnit`, `StockUnit`, or `PurchaseUnit`
entity, column, or FK was created anywhere in this phase — not even a
placeholder or "for future compatibility" FK. Proven by a dedicated e2e
assertion that `GET /api/v1/units` returns 404. Unit/UOM will be
introduced later, primarily driven by Inventory (Phase 14) and Purchase
(Phase 13) requirements, once a concrete need (e.g. "this variant is sold
in boxes of 12 but stocked individually") actually surfaces.

## 12. Scope / Data Visibility (DataScope Integration)

Reused exactly as-is from Phase 06/08/09 — no second visibility service,
no second organization hierarchy. Every controller resolves its operating
company via `resolveRequestCompanyId(dataScopeService, user.id, RESOURCE,
requestedCompanyId)`, which validates any client-supplied `companyId`
against the server-resolved allowed-company list (never trusts it
directly), auto-selecting when unambiguous and requiring explicit input
when a caller has ALL scope or access to multiple companies. Cross-company
references are rejected at the service layer before any write (e.g. a
`categoryId` from a different company on Product create returns 404 via
the underlying `CategoriesService.findByIdInCompany()` — the exact same
IDOR-safe pattern Phase 09 established).

## 13. RBAC

Twenty new permissions added to the existing idempotent seed
(`src/database/seeds/rbac.seed.ts`), matching the established
`resource.action` pattern:

```text
products.read          products.create          products.update          products.delete
product_variants.read  product_variants.create  product_variants.update  product_variants.delete
barcodes.read           barcodes.create           barcodes.update           barcodes.delete
price_lists.read        price_lists.create        price_lists.update        price_lists.delete
price_list_items.read   price_list_items.create   price_list_items.update   price_list_items.delete
```

No `barcodes.*` split further by variant — barcode is treated as a single
securable resource, matching the locked permission-naming guidance ("only
recommend permissions actually required"). All granted to SUPER_ADMIN
only, plus a `RoleResourceScope` `ALL`-scope row per new resource (the
same gap-closing step Phase 09 discovered was necessary — without it,
`DataScopeService.resolveScope()` returns `null` for any role with no
explicit scope row, which would lock SUPER_ADMIN out of every new
resource). No hard-coded role-name checks exist anywhere in
`src/modules/products` (grep-verified).

## 14. API Contracts

| Method | Route | Permission |
|---|---|---|
| GET / POST | `/products` | `products.read` / `products.create` |
| GET / PATCH | `/products/:id` | `products.read` / `products.update` |
| POST | `/products/:id/activate` \| `/deactivate` | `products.update` |
| DELETE | `/products/:id` | `products.delete` |
| GET / POST | `/products/:productId/variants` | `product_variants.read` / `create` |
| GET / PATCH | `/product-variants/:id` | `product_variants.read` / `update` |
| POST | `/product-variants/:id/activate` \| `/deactivate` | `product_variants.update` |
| DELETE | `/product-variants/:id` | `product_variants.delete` |
| GET / POST | `/product-variants/:variantId/barcodes` | `barcodes.read` / `create` |
| POST | `/barcodes/:id/activate` \| `/deactivate` | `barcodes.update` |
| DELETE | `/barcodes/:id` | `barcodes.delete` |
| GET / POST | `/price-lists` | `price_lists.read` / `create` |
| GET / PATCH | `/price-lists/:id` | `price_lists.read` / `update` |
| POST | `/price-lists/:id/activate` \| `/deactivate` | `price_lists.update` |
| DELETE | `/price-lists/:id` | `price_lists.delete` |
| GET / POST | `/price-lists/:priceListId/items` | `price_list_items.read` / `create` |
| PATCH | `/price-lists/:priceListId/items/:id` | `price_list_items.update` |
| POST | `/price-lists/:priceListId/items/:id/deactivate` | `price_list_items.update` |
| DELETE | `/price-lists/:priceListId/items/:id` | `price_list_items.delete` |

All routes: `JwtAuthGuard` + `PermissionGuard`, `PATCH` (not `PUT`) for
partial updates, `/api/v1/...` versioning — the existing conventions,
unchanged. No dedicated SKU/barcode *lookup* endpoints (e.g.
`/variants/lookup?sku=`) were added in this phase — Phase 10's job is the
data model; Phase 12's barcode-scan flow can query the standard list
endpoints with a `search` filter, or a lookup endpoint can be added later
as a clean, additive change once Phase 12 defines its exact needs.

## 15. Database Constraints

Six tables (`products`, `product_variants`, `product_variant_attributes`,
`product_variant_barcodes`, `price_lists`, `price_list_items`). UUID
CHAR(36) PKs, snake_case, InnoDB, utf8mb4/utf8mb4_unicode_ci, soft-delete
`deleted_at` inherited from `BaseEntity`. Money columns are
`DECIMAL(12,2)` — never `FLOAT`/`DOUBLE` — the first real precedent this
codebase sets for monetary storage (`docs/DATABASE_ARCHITECTURE.md`
previously noted "not yet applicable").

| Table | Unique constraint(s) | Key FKs (ON DELETE) |
|---|---|---|
| `products` | `(company_id, code)` | company_id→companies (RESTRICT), category_id→categories (RESTRICT), brand_id→brands (RESTRICT), collection_id→collections (RESTRICT, nullable) |
| `product_variants` | `(company_id, sku)`, `(product_id, combination_key)` | product_id→products (RESTRICT), company_id→companies (RESTRICT) |
| `product_variant_attributes` | `(variant_id, kind)` | variant_id→product_variants (CASCADE), option_id→attribute_options (RESTRICT) |
| `product_variant_barcodes` | `(company_id, barcode)` | variant_id→product_variants (CASCADE), company_id→companies (RESTRICT) |
| `price_lists` | `(company_id, code)` | company_id→companies (RESTRICT) |
| `price_list_items` | `(price_list_id, product_variant_id, valid_from)` | price_list_id→price_lists (RESTRICT), product_variant_id→product_variants (RESTRICT), company_id→companies (RESTRICT) |

`combination_key` is sized `VARCHAR(300)` — sized for up to 8 attributes
(DTO-enforced cap) × 37 chars (UUID + separator) = 296 chars, keeping the
composite unique index with `product_id` safely under MySQL's 3072-byte
max key length for utf8mb4 (a `VARCHAR(767)` first attempt hit this limit
during migration verification and was corrected — see "Known Issues").

Attribute join rows (`product_variant_attributes`) and barcode rows
(`product_variant_barcodes`) cascade-delete with their parent Variant
(`ON DELETE CASCADE`) — deleting a Variant's own denormalized detail rows
is safe and expected. Every other FK in this phase is `RESTRICT`,
consistent with the "never silently destroy organizational/catalog
structure" convention from every prior phase.

## 16. Security Model

- **401**: every route requires `JwtAuthGuard`.
- **403**: `PermissionGuard` + `resolveRequestCompanyId()` — a caller
  without the relevant `resource.action` permission, or without scope
  access to the target company, is rejected before any service call.
- **IDOR/BOLA**: every lookup is company-scoped
  (`findByIdInCompany(id, companyId)`); a record in a different company
  returns 404, never 403 or a raw row — no existence is ever leaked
  across a company boundary.
- **Spoofed parent IDs**: `categoryId`/`brandId`/`collectionId`/
  `productVariantId`/`priceListId` from a different company are rejected
  server-side (404 via the underlying entity's own `findByIdInCompany`),
  regardless of what the client claims.
- **Spoofed companyId**: never trusted directly — always validated
  against the caller's server-resolved allowed-company list.
- **Unauthorized PriceList/Product modification**: gated by the same
  `resource.action` permission checks as every other mutation; no
  privilege-escalation path exists since scope/permission resolution is
  entirely server-side and never accepts client-supplied overrides.

## 17. Transaction Boundaries

`TransactionService.run()` (Phase 04, unchanged) wraps exactly two
operations in this phase:

1. **Product + initial Variant + attribute rows** (`ProductsService.create()`)
   — a Product is never left without its required first Variant, and a
   Variant is never left without its attribute assignments, even under a
   mid-write failure.
2. **Additional Variant creation with attribute rows**
   (`ProductVariantsService.create()`) and **Variant attribute
   replacement on update** (`ProductVariantsService.update()`) — the same
   atomicity guarantee applies whenever a Variant's attribute set changes.

No other operation in this phase needed a transaction — single-row
mutations (Barcode, PriceList, PriceListItem create/update) are already
atomic at the database level and don't span multiple tables, consistent
with "do not introduce transactions unnecessarily."

## 18. Testing Strategy

- **Unit tests** (45, across 5 spec files): `ProductsService` (12,
  including the transactional Product+Variant creation path and every
  cross-entity validation branch), `ProductVariantsService` (8, including
  combination-uniqueness and SKU-uniqueness rejection), `BarcodesService`
  (7, including multi-barcode-per-variant and cross-company scoped
  uniqueness), `PriceListsService` (7), `PriceListItemsService` (11,
  including the overlap-detection algorithm's positive and negative
  cases). All follow the established mocked-repository pattern from
  Phase 09's specs.
- **E2E tests** (22, `test/products.e2e-spec.ts`): authentication and
  permission boundaries, transactional Product+Variant creation, duplicate
  code/SKU/combination rejection, cross-company category rejection,
  unknown-field rejection, delete-blocked-while-variants-active,
  cross-company IDOR, multi-barcode support and duplicate-barcode
  rejection, full PriceList/PriceListItem CRUD including negative-price
  rejection, invalid date-range rejection, overlap rejection,
  cross-company variant rejection on PriceListItem create, invalid ISO
  currency rejection, and the `/units` 404 proof for the Unit/UOM
  deferral.
- **Full regression**: all 8 e2e suites (148 tests) and the full unit
  suite (246 tests, 239 passing + 7 pre-existing unrelated skips) pass
  together via `--runInBand`, with zero weakening of any prior phase's
  tests.
- Database verified clean of all `PROD-E2E-%` / `prod-e2e-%` rows after
  every run.

## 19. Phase 12 Sales Integration Point

Sales will select by `ProductVariant` (never bare `Product` once a
Variant exists), look up by SKU/barcode, and resolve price by querying
`PriceListItem` for the row where `validFrom <= now() AND (validTo IS
NULL OR validTo > now())` for the relevant `(priceListId,
productVariantId)` pair — a plain point-in-time query, not a special
endpoint exposed by Phase 10. Sales must **snapshot** — variant id, SKU,
name, unit price, discount, tax, quantity — at transaction time; a later
Product/Price edit must never retroactively alter a historical Sale. No
Sales logic, DTO, or entity exists in this phase.

## 20. Phase 13 Purchase Integration Point

Purchase will reference `ProductVariant.id` for its own line items and
capture its own transactional cost snapshot — `ProductVariant.costPrice`
is a reference/default value only, never the authoritative purchase cost
for a specific transaction. Purchase pricing must remain conceptually
separate from `PriceListItem` (which models selling-side pricing); no
supplier-specific pricing structure was built in this phase.

## 21. Phase 14 Inventory Integration Point

Inventory will track stock by `ProductVariant`, not `Product` and not a
bare SKU string — Phase 10 exposes a stable `ProductVariant.id` and an
`isActive`/status field Inventory can gate stock operations on, and
nothing else. No quantity, stock, or warehouse-balance field exists on
`Product` or `ProductVariant` — inventory ownership belongs entirely to
Phase 14.

## 22. Frontend Compatibility

No frontend files were modified. The backend's `Product.code` /
`ProductVariant.sku` split does not match the frontend's current dual-SKU
field (`Product.sku` **and** `ProductVariant.sku` both present) — per the
approved Phase 10 analysis's Decision D3, the frontend's "Product SKU"
field is expected to map onto `Product.code` at integration time; this is
a DTO-mapping concern for a future frontend-integration pass, not
something this backend phase resolves by copying the frontend's shape.
`ProductVariantAttribute`'s dynamic `kind`/`optionId` shape matches the
frontend's `ProductVariant.attributes: Partial<Record<AttributeKind,
string>>` directly. The frontend's flat `costPrice`/`sellingPrice`/
`discountPrice`/`wholesalePrice`/`taxRate` pricing object is only
partially represented here — `costPrice`/`sellingPrice` live directly on
`ProductVariant`; `discountPrice`/`wholesalePrice`/`taxRate` are Sales/
pricing-policy concerns not modeled in Phase 10's `PriceListItem` (which
only carries a single `price` per effective window) and remain open for
whichever future phase needs them.

## 23. Known Issues / Deferred Items (by design, not oversight)

- **Migration correction found during UP verification**: the first
  migration attempt sized `product_variants.combination_key` as
  `VARCHAR(767)`, which combined with `product_id` in the composite
  unique index exceeded MySQL's 3072-byte max key length for utf8mb4
  (`ER_TOO_LONG_KEY`). Corrected to `VARCHAR(300)` (ample for the
  DTO-enforced 8-attribute cap) in both the entity and the migration
  before re-running; the failed first attempt left an orphaned, empty,
  untracked `products` table (MySQL DDL auto-commits per statement,
  independent of the migration's transaction) which was manually dropped
  — with explicit confirmation — before the corrected migration was
  re-run and fully verified UP→DOWN→UP.
- No dedicated SKU/barcode lookup endpoint yet — deferred to whenever
  Phase 12's exact POS/lookup contract is defined, per §14 above.
- No `Currency` entity, no exchange rates, no multi-currency conversion —
  see §10.
- No `Unit`/`UOM` — see §11.
- No promotion/coupon/campaign/tier-pricing/customer-group pricing engine
  — Phase 10 establishes only the base `PriceList`/`PriceListItem` data
  model, per the locked instruction.
- No Bruno API collection — consistent with every prior phase's
  precedent.

## 24. Phase 11+ Compatibility

Product, ProductVariant, and PriceListItem all expose stable UUID
identities ready for Phase 11 (Customer/Supplier), Phase 12 (Sales), 13
(Purchase), 14 (Inventory), and 17 (Accounting) to reference without any
redesign. No Customer, Supplier, Sales, Purchase, Inventory, Inventory
Ledger, Payment, Accounting, Promotion Engine, Coupon Engine, Unit/UOM,
Unit Conversion, Currency entity, Exchange Rate, HR, or Administration
logic was implemented in this phase — grep-verified zero references to
any of those terms anywhere in `src/modules/products`.
