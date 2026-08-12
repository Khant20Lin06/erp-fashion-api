# MASTER_DATA_ARCHITECTURE.md

Category, Brand, Collection, and AttributeOption implemented in Phase 09.
Exactly these four concepts — no Currency, PaymentTerm, PaymentMethod,
PriceType, DiscountType, Country, Unit, SizeGroup, or standalone Tax/Season
entity. Phase 10 (Product/ProductVariant/Pricing) does not exist yet — this
document describes the master-data foundation only.

## Why exactly these four

The approved Phase 09 analysis inventoried the existing frontend and found
real, dedicated admin pages/types/APIs for Category, Brand, Collection, and
AttributeOption (`kind: "size"|"color"|"style"|"material"`). Every other
candidate ERP master-data concept was either free-text, hardcoded, or
entirely absent from the frontend, so it was explicitly deferred rather than
built speculatively:

```text
Implemented:  Category, Brand, Collection, AttributeOption
Deferred:     Currency, PaymentTerm, PaymentMethod, PriceType, DiscountType,
              Country, Unit, SizeGroup, standalone Tax, standalone Season
```

## Entity Model

```text
Company ──1..N── Category ──0..1 self──parentId (self-referencing tree)
Company ──1..N── Brand
Company ──1..N── Collection            (season: embedded enum column, not a table)
Company ──1..N── AttributeOption       (kind: COLOR|SIZE|STYLE|MATERIAL discriminator)
```

All four entities are company-scoped (`companyId → companies`, `ON DELETE
RESTRICT`) and extend the same `BaseEntity` (UUID PK, `created_at`/
`updated_at`/`deleted_at`, soft delete) used by every prior phase.

- **Category** (`categories`) — the only self-referencing entity in this
  phase. `parentId` nullable, `ManyToOne` to itself, `ON DELETE RESTRICT`.
  Has a backend-only `code` field (stable, unique, immutable — never exposed
  by the current frontend, added anyway per the locked architecture
  decision rather than blindly copying the frontend's current shape).
  `UNIQUE(company_id, code)`.
- **Brand** (`brands`) — flat entity, no hierarchy. `UNIQUE(company_id,
  code)`. Deliberately omits `logoUrl` — presentation metadata, not a
  backend/data-integrity concern.
- **Collection** (`collections`) — flat entity with an embedded `season`
  enum column (`SPRING_SUMMER | AUTUMN_WINTER | ALL_SEASON`) and nullable
  `year`. `UNIQUE(company_id, code)`.
- **AttributeOption** (`attribute_options`) — one unified table for
  color/size/style/material, discriminated by a `kind` enum column rather
  than four near-identical tables. `swatch` (nullable, hex-validated at the
  DTO layer) is only meaningful when `kind = COLOR`; the service rejects a
  swatch on any other kind. `UNIQUE(company_id, kind, code)` — the same
  code is independent across kinds (`SIZE + "M"` and `COLOR + "M"` never
  collide).

## Season — deliberately not a standalone entity (LOCKED)

No `seasons` table, `Season` entity, or `SeasonRepository` exists. `Season`
is a TypeScript enum embedded directly as a MySQL `enum` column on
`collections.season`. Rationale: no Season admin page, API, or
standalone-entity evidence exists anywhere in the frontend — Collection is
the only place season classification is used. Proven by a dedicated e2e
assertion that `GET /api/v1/seasons` returns 404.

## AttributeOption — unified kind discriminator (LOCKED)

```text
NOT built: colors table, sizes table, styles table, materials table
Built:     one attribute_options table, kind ∈ {COLOR, SIZE, STYLE, MATERIAL}
```

Proven by dedicated e2e assertions that `GET /api/v1/colors` and `GET
/api/v1/sizes` both return 404 (no separate per-kind endpoints), and that
the same `code` can be created under two different `kind` values
successfully while a duplicate `code` within the *same* kind is rejected
with 409.

## Category Hierarchy Integrity (LOCKED)

`CategoriesService` enforces, entirely server-side:

- A `parentId` must reference an existing, ACTIVE category in the **same
  company** — never trusted from the client without re-validation
  (`assertValidParent`).
- Self-parenting (`dto.parentId === id`) is rejected before any query runs.
- Circular hierarchies are rejected by walking the ancestor chain of the
  *proposed* new parent looking for the category being updated
  (`assertNoCycle`) — bounded by the total category count in the company so
  a hypothetically-corrupted chain can never loop forever:

```text
update(A, { parentId: C })  where the existing chain is A → B → C
  assertNoCycle walks: C.parentId → B.parentId → A  ⇒ matches A ⇒ REJECTED
```

- Deleting a category with existing children is rejected (409) — no
  orphaning, no cascading delete of the subtree.
- A self-referencing FK (`FK_cat_parent`, `ON DELETE RESTRICT`) backs all of
  the above at the database level as a second line of defense.

An iterative ancestor walk was chosen over a recursive SQL CTE to stay
consistent with this codebase's existing convention of explicit
application-layer logic rather than exotic SQL, matching how every other
phase implements integrity checks.

## Scope, Visibility, and `resolveRequestCompanyId` — the Phase 09 integration point

Phase 09 is the **first phase whose controllers actually call**
`DataScopeService.resolveScope()` / `resolveAllowedOrganizationIds()` on a
real request path. Prior phases (07/08) authorize purely through
`PermissionGuard` action-permissions and never resolved a per-resource data
scope at runtime.

No new visibility service was created (explicitly prohibited — no
`CategoryScopeService`, no `OrganizationScopeService`, no second DataScope
system). Instead, a single stateless helper function wraps the existing
Phase 06/08 mechanism:

```text
resolveRequestCompanyId(dataScopeService, userId, resource, requestedCompanyId)
  → resolveScope(userId, resource)                        [Phase 06]
      null            ⇒ 403 Forbidden ("no scope configured for this resource")
  → resolveAllowedOrganizationIds(userId, resolved)        [Phase 08]
      null (ALL scope)     ⇒ requestedCompanyId is REQUIRED, returned as-is
      []  (no access)      ⇒ 403 Forbidden
      [oneId]               ⇒ auto-selected if requestedCompanyId is omitted
      [many]                 ⇒ requestedCompanyId REQUIRED and must be ∈ the list,
                                otherwise 403 Forbidden
```

Client-supplied `companyId` is **never** trusted directly — it is only ever
used as a candidate that must appear in the server-resolved allowed-company
list. `src/modules/master-data/utils/resolve-request-company-id.ts` is a
plain function (not an injectable service/provider), used identically by
all four controllers for every route (list/detail/create/update/activate/
deactivate/delete).

### Seed gap this phase closed

Because no prior phase's controllers ever called `resolveScope()` on a real
path, no seed had ever populated `role_resource_scopes` — the table backing
per-resource `DataScope` grants. Left alone, this would have locked
**every** user, including SUPER_ADMIN, out of all four new resources (a
`null` result from `resolveScope()` is correctly treated as "no access,"
never "unrestricted"). The RBAC seed (`src/database/seeds/rbac.seed.ts`)
now also grants SUPER_ADMIN an `ALL`-scope `RoleResourceScope` row for each
of `categories`/`brands`/`collections`/`attribute_options` — the minimum
needed for the seeded system role to operate. No other role receives one
from this seed; idempotent on re-run (verified).

## Master Data Status

`ACTIVE` / `INACTIVE` only, on all four entities — consistent with the
two-value status pattern already used elsewhere in the codebase. Inactive
records are never silently treated as active: `findAll`/`findByIdInCompany`
return records regardless of status (callers filter explicitly via the
`status` query param), and no future-facing "active only" default was
invented here since no consuming module exists yet to define what "active
only" should mean for it.

## RBAC Integration (reused, not duplicated)

Sixteen permissions added to the existing idempotent seed — four actions
(`read`/`create`/`update`/`delete`) per resource:

```text
categories.read   categories.create   categories.update   categories.delete
brands.read       brands.create       brands.update       brands.delete
collections.read  collections.create  collections.update  collections.delete
attribute_options.read  attribute_options.create  attribute_options.update  attribute_options.delete
```

Granted to SUPER_ADMIN only, via the existing seed mechanism. No new
permission model, no hard-coded role-name checks anywhere in the new module
files (grep-verified) — every route is gated by `RequirePermission(...)` +
`PermissionGuard`, exactly like every prior phase.

## API Surface

| Method | Route | Permission |
|---|---|---|
| GET | `/categories` | `categories.read` |
| GET | `/categories/:id` | `categories.read` |
| POST | `/categories` | `categories.create` |
| PATCH | `/categories/:id` | `categories.update` |
| POST | `/categories/:id/activate` \| `/deactivate` | `categories.update` |
| DELETE | `/categories/:id` | `categories.delete` |
| GET/GET/POST/PATCH/DELETE | `/brands[...]` | `brands.read`/`create`/`update`/`delete` (same shape) |
| GET/GET/POST/PATCH/DELETE | `/collections[...]` | `collections.read`/`create`/`update`/`delete` (same shape) |
| GET/GET/POST/PATCH/DELETE | `/attribute-options[...]` | `attribute_options.read`/`create`/`update`/`delete` (same shape) |

All routes require `JwtAuthGuard` + `PermissionGuard`. List endpoints
support pagination, `status` filter, `search` (name/code), and
entity-specific filters (`parentId` for categories, `season` for
collections). No `/seasons`, `/colors`, or `/sizes` routes exist — proven by
dedicated e2e 404 assertions.

## Validation

- Required fields, string lengths, and enum values enforced by
  `class-validator` DTOs with the global `ValidationPipe`
  (`whitelist: true`, `forbidNonWhitelisted: true`) — unknown/extra fields
  (e.g. a `logoUrl` on Brand) are rejected with 400.
- `code` fields are immutable after creation — `update-*.dto.ts` files never
  include a `code` field.
- Duplicate `code` (or `kind` + `code` for AttributeOption) within the same
  company returns 409, never a raw DB constraint error.
- Category parent validation (existence, active status, same company,
  self-parent, circular hierarchy) — see "Category Hierarchy Integrity"
  above.
- `swatch` is validated as a `#RRGGBB` hex string at the DTO layer and
  additionally rejected server-side in the service when `kind !== COLOR`.
- Every mutating operation re-validates the target `companyId` resolves to
  an active `Company` row — never assumed from a prior request.

## Security

- **401**: every route requires `JwtAuthGuard`; unauthenticated requests to
  all four resources verified via a dedicated e2e suite.
- **403**: `PermissionGuard` rejects users lacking the relevant
  `resource.action` permission; `resolveRequestCompanyId` independently
  rejects company IDs outside the caller's resolved scope.
- **IDOR/BOLA**: `findByIdInCompany(id, companyId)` scopes every lookup by
  company; a record belonging to a different company returns 404 (never
  403 or a raw row), so existence is never leaked across company
  boundaries. Verified by a dedicated cross-company e2e test.
- **Spoofed parent/company IDs**: a `parentId` from a different company is
  rejected (400); a `companyId` outside the caller's resolved allowed list
  is rejected (403) regardless of what the client sends — see the
  `resolveRequestCompanyId` section above.
- **Privilege escalation**: no client input can widen a user's own scope —
  `resolveRequestCompanyId` only ever narrows to the server-resolved
  allowed set, never trusts or merges client-supplied scope claims.

## Database

New tables (UUID CHAR(36) PKs, snake_case, InnoDB, utf8mb4/
utf8mb4_unicode_ci, soft-delete `deleted_at`, inherited from `BaseEntity`):

| Table | Unique constraint | Key FKs (ON DELETE) |
|---|---|---|
| `categories` | `(company_id, code)` | `company_id → companies` (RESTRICT), `parent_id → categories` (RESTRICT, self) |
| `brands` | `(company_id, code)` | `company_id → companies` (RESTRICT) |
| `collections` | `(company_id, code)` | `company_id → companies` (RESTRICT) |
| `attribute_options` | `(company_id, kind, code)` | `company_id → companies` (RESTRICT) |

Migration: `1786503728069-CreateMasterDataTables.ts`. Verified UP → DOWN →
UP against live Docker MySQL, including a full re-verification after the
RBAC seed's `RoleResourceScope` fix (see below) — all three steps succeeded
cleanly with no manual schema intervention.

No JSON blobs for relational data — `season`/`status`/`kind` are native
MySQL `enum` columns, `parentId` is a real FK, not a denormalized path or
adjacency list encoded as text.

## Testing

- **Unit tests** (30): `CategoriesService` (11, including the A→B→C→A cycle
  rejection with precise mock sequencing matching the real algorithm),
  `BrandsService`, `CollectionsService`, `AttributeOptionsService` — CRUD,
  duplicate/uniqueness rules, cross-company IDOR (`NotFound`, never
  `Forbidden`), lifecycle (activate/deactivate/soft-delete).
- **E2E tests** (26, `test/master-data.e2e-spec.ts`): authentication
  boundary (401), permission boundary (403), full Brand CRUD incl.
  cross-company IDOR, Category hierarchy/cycle protection (real API-driven
  A→B→C chain, reparenting to create a cycle, valid non-circular
  reparenting, delete-with-children rejection), Collection embedded-season
  behavior plus the `/seasons` 404 proof, AttributeOption unified-kind
  behavior plus the `/colors`/`/sizes` 404 proofs, and unknown-field
  rejection. Isolated by an `MD-E2E-%` code prefix and `md-e2e-%` email
  prefix; cleanup nulls `categories.parent_id` before the bulk `DELETE` so
  a self-referencing leftover pair from an interrupted run can never trip
  `FK_cat_parent`.
- **Full regression**: all 7 e2e suites (app/auth/rbac/organization/
  user-employee-account/master-data/validation, 126 tests) and the full
  unit suite (194 tests, 7 pre-existing skips unrelated to this phase) pass
  together via `--runInBand`, matching the serial-execution convention
  established in Phase 07.
- Database verified clean of all `MD-E2E-%`/`md-e2e-%` rows after every
  run.

## Frontend Compatibility

No frontend files were modified. The backend `Category.code` field has no
frontend equivalent today and is additive — it does not break the existing
Category admin page, which simply doesn't send or display it yet.
AttributeOption's `kind` values (`COLOR`/`SIZE`/`STYLE`/`MATERIAL`) match
the frontend's existing lowercase union (`"color"`/`"size"`/`"style"`/
`"material"`) in spelling, differing only in casing per this backend's
existing enum convention — the frontend is expected to map casing when it
eventually integrates, not the reverse.

## Known Limitations (by design, not oversight)

- No cross-entity referential validation yet (e.g. nothing prevents
  deleting a Brand that a future Product might reference) — there is no
  Product entity yet for such a reference to exist. This is the intended
  Phase 10 integration seam, not a gap.
- `AttributeOption.swatch` is stored as a plain validated string, not a
  structured color type — sufficient for Phase 09's scope; no color-space
  conversion or palette logic was requested or built.
- No Bruno API collection — consistent with every prior phase's precedent
  (deferred to Phase 25).
- `RoleResourceScope` grants are seeded only for SUPER_ADMIN. Any
  additional role that should see master data needs its own
  `RoleResourceScope` row created through the existing RBAC administration
  surface (Phase 06) — no new provisioning mechanism was added here.

## Future Phase Integration

- **Phase 10** (Product/ProductVariant/Pricing) is the primary consumer:
  `Product.categoryId → categories`, `Product.brandId → brands`,
  `Product.collectionId → collections` (nullable), and variant-level
  `ProductVariant.attributeOptionIds` referencing `attribute_options` rows
  by `kind` — all four entities are ready to be referenced with zero
  redesign. No Product/Variant/Pricing entity, placeholder, or coupling was
  introduced in this phase.
- Any future phase introducing a new role that needs to manage master data
  only needs a `RoleResourceScope` row (via Phase 06 RBAC administration)
  plus the relevant `categories.*`/`brands.*`/`collections.*`/
  `attribute_options.*` permission grants — no code changes to this
  module.
