# Fashion ERP Backend — Phase 07: Organization / Company / Branch / Warehouse

## ROLE

You are implementing **Phase 07 — Organization / Company / Branch / Warehouse** of the Fashion ERP backend.

The backend stack is:

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
```

The purpose of this phase is to establish the **organizational hierarchy and organizational data boundaries** that future ERP modules will depend on.

---

# 1. ABSOLUTE RULES

Before writing code:

1. Read Phase 00–06 implementation and documentation.
2. Inspect existing entities and database conventions.
3. Inspect existing migrations.
4. Inspect Phase 06 RBAC and Data Visibility implementation.
5. Inspect the frontend organization/company/branch/warehouse related screens and concepts.
6. Do not duplicate existing entities.
7. Do not redesign Phase 06 unnecessarily.
8. Do not implement Employee/SalesAccount from Phase 08.
9. Do not implement Sales from Phase 12.
10. Do not implement Inventory from Phase 14.
11. Do not implement Accounting from Phase 17.
12. Do not implement Redis/BullMQ business jobs unless genuinely required.
13. Do not hard-code organization IDs.
14. Do not hard-code company IDs, branch IDs, or warehouse IDs.
15. Do not trust organization identifiers sent by the frontend.
16. All organization access must be server-side validated.
17. Follow existing Phase 03 database conventions.
18. Follow existing Phase 04 transaction/error/response conventions.
19. Preserve backward compatibility with Phase 05–06.
20. Do not move to Phase 08 until Phase 07 acceptance criteria pass.

---

# 2. BUSINESS OBJECTIVE

The ERP needs a hierarchical organization model.

Primary hierarchy:

```text
Company
   │
   ├── Branch
   │      │
   │      ├── Warehouse
   │      ├── Warehouse
   │      └── ...
   │
   ├── Branch
   │      └── Warehouse
   │
   └── ...
```

This hierarchy will later support:

```text
Organization
   ↓
Data Ownership
   ↓
Data Visibility
   ↓
User Assignment
   ↓
Sales
   ↓
Purchase
   ↓
Inventory
   ↓
Accounting
   ↓
Reports
```

---

# 3. CORE ARCHITECTURE

The conceptual hierarchy is:

```text
Company
  ↓
Branch
  ↓
Warehouse
```

However, do not assume every future entity must belong to all three.

For example:

```text
Customer
→ Company-level

Sale
→ Company + Branch

Inventory
→ Warehouse

Journal Entry
→ Company
```

Future modules will decide their exact ownership.

---

# 4. COMPANY

Create a Company entity.

Conceptual model:

```text
Company
├── id
├── code
├── name
├── legalName
├── status
├── baseCurrency
├── timezone
├── country
├── phone
├── email
├── address
├── createdAt
├── updatedAt
└── deletedAt
```

Do not blindly implement every field.

Use the actual frontend requirements and project architecture to determine which fields are required.

---

# 5. COMPANY CODE

Company should have a stable unique code.

Example:

```text
FASHION-MM
FASHION-TH
COMPANY-001
```

Do not use the company name as the unique identifier.

Example:

```text
name = "Fashion Myanmar"
code = "FASHION-MM"
```

The name can change.

The code should remain stable.

---

# 6. COMPANY STATUS

Support lifecycle state.

At minimum:

```text
ACTIVE
INACTIVE
```

If the project already has a standard status abstraction from Phase 03/04, reuse it.

Do not create multiple incompatible status systems.

---

# 7. COMPANY SOFT DELETE

Follow Phase 03 soft-delete conventions.

A deleted/inactive Company must not:

```text
grant organization access
receive new transactional data
appear in normal active organization lists
```

Do not physically delete a company if it has historical ERP transactions unless the existing data lifecycle explicitly permits it.

---

# 8. BRANCH

Create a Branch entity.

Conceptual:

```text
Branch
├── id
├── companyId
├── code
├── name
├── status
├── phone
├── email
├── address
├── timezone
├── createdAt
├── updatedAt
└── deletedAt
```

Relationship:

```text
Company 1 ─── N Branch
```

---

# 9. BRANCH CODE

Branch code must be unique within its Company.

Preferred constraint:

```text
UNIQUE(companyId, code)
```

This allows:

```text
Company A
  BR-001

Company B
  BR-001
```

without conflict.

Do NOT require global uniqueness if the business model does not need it.

---

# 10. BRANCH STATUS

At minimum:

```text
ACTIVE
INACTIVE
```

An inactive Branch should not receive new operational transactions.

Historical data must remain queryable according to permissions.

---

# 11. WAREHOUSE

Create Warehouse entity.

Conceptual:

```text
Warehouse
├── id
├── companyId
├── branchId
├── code
├── name
├── type
├── status
├── address
├── createdAt
├── updatedAt
└── deletedAt
```

Primary relationship:

```text
Company
   ↓
Branch
   ↓
Warehouse
```

---

# 12. WAREHOUSE OWNERSHIP

A Warehouse belongs to:

```text
Company
+
Branch
```

Do not allow:

```text
Warehouse.companyId = Company A
Warehouse.branchId = Branch belonging to Company B
```

The backend must validate this relationship.

This is a critical integrity rule.

---

# 13. WAREHOUSE CODE

Warehouse code should be unique within its Company or Branch according to the project's business requirements.

Preferred starting point:

```text
UNIQUE(companyId, code)
```

If the frontend/business requirements clearly require branch-local codes:

```text
UNIQUE(branchId, code)
```

Choose ONE strategy and document it.

Do not create contradictory constraints.

---

# 14. WAREHOUSE TYPES

Warehouse may support types such as:

```text
MAIN
STORE
DISTRIBUTION
TRANSIT
RETURN
VIRTUAL
OTHER
```

Do not automatically implement every type.

Create an extensible enum/reference strategy according to the existing project conventions.

Inventory behavior should NOT be implemented in this phase.

---

# 15. DEFAULT / PRIMARY BRANCH

Consider whether a Company can have a primary/default branch.

If required:

```text
Company
   ↓
defaultBranchId
```

or an equivalent relationship.

Do not introduce redundant state if it can be derived.

If a default branch is implemented:

* It must belong to the same company.
* It must be active.
* It must be validated server-side.

---

# 16. DEFAULT / PRIMARY WAREHOUSE

Do not assume every branch needs a default warehouse.

If the frontend/business requirements require one, implement it explicitly.

Example:

```text
Branch
   ↓
defaultWarehouseId
```

Validation:

```text
Warehouse.branchId === Branch.id
```

Do not allow cross-branch default warehouses.

---

# 17. ORGANIZATION MEMBERSHIP

Phase 06 introduced authorization.

Phase 07 must provide organization membership infrastructure.

Conceptually:

```text
User
  ↓
Organization Membership
  ↓
Company
```

and potentially:

```text
User
  ↓
Branch Membership
  ↓
Branch
```

and:

```text
User
  ↓
Warehouse Membership
  ↓
Warehouse
```

Do not simply add:

```text
user.companyId
user.branchId
user.warehouseId
```

if the system needs users to belong to multiple organizational units.

---

# 18. USER-COMPANY MEMBERSHIP

Preferred architecture:

```text
UserCompany
├── userId
├── companyId
├── status
├── isPrimary
├── createdAt
└── updatedAt
```

Relationship:

```text
User N ─── N Company
```

This allows:

```text
User A
 ├── Company A
 └── Company B
```

if the business eventually requires multi-company access.

If the actual product requirement is strictly one-company-per-user, do not over-engineer.

Document the decision.

---

# 19. USER-BRANCH MEMBERSHIP

If users can work across branches:

```text
UserBranch
├── userId
├── branchId
├── status
├── isPrimary
├── createdAt
└── updatedAt
```

Relationship:

```text
User N ─── N Branch
```

A Branch membership must imply valid Company membership.

Example:

```text
User
  ↓
Company A
  ↓
Branch A1
```

must be valid.

Do not allow:

```text
User
  ↓
Company A
  ↓
Branch B1 belonging to Company B
```

---

# 20. USER-WAREHOUSE MEMBERSHIP

If users can be assigned to warehouses:

```text
UserWarehouse
├── userId
├── warehouseId
├── status
├── isPrimary
├── createdAt
└── updatedAt
```

A Warehouse membership must imply valid access to:

```text
Company
+
Branch
```

according to organization policy.

---

# 21. DO NOT MIX ROLE AND ORGANIZATION

This is critical.

Role:

```text
WHAT CAN YOU DO?
```

Organization membership:

```text
WHERE CAN YOU DO IT?
```

Data scope:

```text
WHICH DATA CAN YOU ACCESS?
```

Example:

```text
User
 ├── Role: Sales Staff
 │       └── sales.read
 │
 ├── Company: Fashion Thailand
 │
 └── Branch: Bangkok
```

Role does NOT automatically determine branch.

Branch membership does NOT automatically grant permissions.

---

# 22. ORGANIZATION + RBAC

Phase 06:

```text
Role
 ↓
Permission
 ↓
Scope
```

Phase 07 adds:

```text
Company
 ↓
Branch
 ↓
Warehouse
```

Therefore future authorization becomes:

```text
User
 ↓
Roles
 ↓
Permissions
 ↓
Scope
 ↓
Organization Membership
 ↓
Data
```

---

# 23. SCOPE RESOLUTION

The DataScopeService from Phase 06 must eventually be able to resolve:

```text
COMPANY
BRANCH
WAREHOUSE
```

using actual Phase 07 entities.

Example:

```text
scope = COMPANY
→ allowed company IDs

scope = BRANCH
→ allowed branch IDs

scope = WAREHOUSE
→ allowed warehouse IDs
```

Do not hard-code these IDs.

---

# 24. ORGANIZATION FILTERING

A user with:

```text
Company scope
```

must not access another company's records.

A user with:

```text
Branch scope
```

must not access another branch.

A user with:

```text
Warehouse scope
```

must not access another warehouse.

All organization filtering must happen server-side.

---

# 25. ORGANIZATION ID SPOOFING

Never trust:

```json
{
  "companyId": "..."
}
```

from the client.

The server must validate:

```text
Does this user have access to this company?
```

Similarly:

```text
branchId
warehouseId
```

must be validated.

---

# 26. CROSS-COMPANY PROTECTION

Test:

```text
Company A
Branch A1
Warehouse A1

Company B
Branch B1
Warehouse B1
```

User assigned to Company A must not:

```text
read Company B
create Branch B1 data
update Warehouse B1
```

unless explicitly granted.

---

# 27. CROSS-BRANCH PROTECTION

User assigned to:

```text
Branch A1
```

must not access:

```text
Branch A2
```

unless the role/scope permits it.

---

# 28. CROSS-WAREHOUSE PROTECTION

User assigned to:

```text
Warehouse A1
```

must not access:

```text
Warehouse A2
```

unless authorized.

This will become critical for Phase 14 Inventory.

---

# 29. ORGANIZATION HIERARCHY VALIDATION

Every child entity must validate its parent.

Creating Branch:

```text
companyId must exist
company must be active
```

Creating Warehouse:

```text
companyId must exist
branchId must exist
branch.companyId === companyId
branch must be active
```

Never rely only on frontend dropdowns.

---

# 30. DATABASE FOREIGN KEYS

Use proper foreign keys.

Conceptually:

```text
branches.companyId
    → companies.id

warehouses.companyId
    → companies.id

warehouses.branchId
    → branches.id
```

Follow existing migration conventions.

Choose appropriate ON DELETE behavior.

Do not cascade-delete ERP historical data blindly.

---

# 31. ON DELETE POLICY

Recommended:

```text
Company
  ↓
Branch
  ↓
Warehouse
```

should not automatically destroy historical ERP data.

Prefer:

```text
soft delete
+
restrict destructive deletes
```

unless the existing architecture specifies otherwise.

Document the final behavior.

---

# 32. COMPANY API

Implement administration APIs according to existing API conventions.

Candidate:

```text
GET    /companies
GET    /companies/:id
POST   /companies
PATCH  /companies/:id
DELETE /companies/:id
```

Protect them with Phase 06 authorization.

Example permissions:

```text
companies.read
companies.create
companies.update
companies.delete
```

Do not hard-code `SUPER_ADMIN` in controllers.

---

# 33. BRANCH API

Candidate:

```text
GET    /branches
GET    /branches/:id
POST   /branches
PATCH  /branches/:id
DELETE /branches/:id
```

All requests must be organization-scoped.

For example:

```text
GET /branches?companyId=...
```

must verify the requesting user's access to that company.

---

# 34. WAREHOUSE API

Candidate:

```text
GET    /warehouses
GET    /warehouses/:id
POST   /warehouses
PATCH  /warehouses/:id
DELETE /warehouses/:id
```

Filtering:

```text
companyId
branchId
status
```

must be server-side validated.

---

# 35. ORGANIZATION CONTEXT

Create a reusable abstraction if useful:

```text
OrganizationContext
```

Conceptually:

```text
OrganizationContext
├── companyIds
├── branchIds
└── warehouseIds
```

This must be generated from trusted server-side membership and authorization data.

Never accept it from the client.

---

# 36. ORGANIZATION CONTEXT + AUTHORIZATION CONTEXT

Do not duplicate authorization state.

Conceptually:

```text
AuthorizationContext
├── userId
├── roles
├── permissions
└── scopes

OrganizationContext
├── companies
├── branches
└── warehouses
```

The authorization layer may consume both.

---

# 37. PRIMARY MEMBERSHIP

If membership tables contain:

```text
isPrimary
```

enforce:

```text
one primary Company per user
one primary Branch per user
one primary Warehouse per user
```

if the business requires it.

Use database/service-level protection.

Do not allow multiple contradictory primary memberships.

---

# 38. ACTIVE MEMBERSHIP

Inactive memberships must not grant access.

Example:

```text
UserCompany.status = INACTIVE
```

must mean:

```text
user cannot access that company through this membership
```

Likewise:

```text
UserBranch.status = INACTIVE
UserWarehouse.status = INACTIVE
```

---

# 39. MEMBERSHIP REMOVAL

When removing membership:

```text
User → Company
```

ensure dependent memberships are handled.

Example:

```text
User
 ↓
Company A
 ↓
Branch A1
```

If Company A membership is removed:

```text
Branch A1 membership
```

must not remain capable of granting access independently.

Choose one:

```text
cascade membership removal
```

or:

```text
invalidate dependent memberships
```

Document and test it.

---

# 40. BRANCH → WAREHOUSE CONSISTENCY

A Warehouse must always belong to exactly one Branch unless the business explicitly supports shared warehouses.

Do NOT implement shared warehouses now unless required.

This simplifies inventory ownership.

---

# 41. MULTI-COMPANY USERS

Support multi-company users only if the architecture requires it.

If enabled:

```text
User
 ├── Company A
 └── Company B
```

then every request must resolve the active/allowed organization context safely.

Do not let the client switch company simply by changing:

```text
companyId
```

without authorization.

---

# 42. ACTIVE COMPANY CONTEXT

If the frontend supports organization switching:

```text
Company A
Company B
```

the backend should validate the requested active company.

Example:

```text
X-Company-Id
```

or:

```text
companyId
```

may be accepted as a request context only AFTER validating membership.

Never treat it as an authorization grant.

---

# 43. ACTIVE BRANCH CONTEXT

Similarly:

```text
X-Branch-Id
```

can identify the current operational context, but the backend must verify:

```text
user → company membership
user → branch membership
branch → company
```

---

# 44. ACTIVE WAREHOUSE CONTEXT

Warehouse context must verify:

```text
user → warehouse membership
warehouse → branch
branch → company
```

Do not allow:

```text
Company A
Branch A
Warehouse B
```

as a mixed context.

---

# 45. FRONTEND COMPATIBILITY

The frontend should eventually be able to support:

```text
Company Selector
Branch Selector
Warehouse Selector
```

But backend security must remain independent.

The frontend selector is a UX feature.

It is NOT an authorization mechanism.

---

# 46. ORGANIZATION SETTINGS

Company-level configuration may later include:

```text
currency
timezone
tax configuration
invoice numbering
fiscal year
business settings
```

Do not implement Accounting configuration in Phase 07.

Only create organization fields that belong to organization identity/configuration.

---

# 47. CURRENCY

If Company has:

```text
baseCurrency
```

store a stable currency code.

Example:

```text
THB
MMK
USD
```

Do not store:

```text
Thai Baht
Myanmar Kyat
```

as the canonical identifier.

Follow the project's master-data strategy if currencies will be implemented in Phase 09.

---

# 48. TIMEZONE

Company/Branch may have timezone.

Use standard IANA timezone identifiers where supported.

Example:

```text
Asia/Bangkok
Asia/Yangon
```

Do not store arbitrary display names as the canonical timezone.

---

# 49. ADDRESS

Do not over-normalize address in this phase unless the existing database architecture requires it.

A structured address may later include:

```text
country
province/state
city
district
postalCode
addressLine1
addressLine2
```

Use the project's established common address strategy.

Do not duplicate an address implementation if Phase 04 already provides one.

---

# 50. COMPANY SETTINGS VS GLOBAL SETTINGS

Do not mix:

```text
global application settings
```

with:

```text
company settings
```

Company settings belong to the organization.

Global system configuration belongs to Administration/Core infrastructure.

---

# 51. UNIQUE CONSTRAINTS

At minimum consider:

```text
Company.code
Branch(companyId, code)
Warehouse(companyId, code)
```

Memberships:

```text
UserCompany(userId, companyId)
UserBranch(userId, branchId)
UserWarehouse(userId, warehouseId)
```

must not contain duplicates.

---

# 52. INDEXES

Create indexes for common authorization queries.

Examples:

```text
branches.companyId
warehouses.companyId
warehouses.branchId

user_companies.userId
user_companies.companyId

user_branches.userId
user_branches.branchId

user_warehouses.userId
user_warehouses.warehouseId
```

Use actual query patterns from the implementation.

Do not blindly create indexes on every column.

---

# 53. QUERY PATTERNS

Future modules will frequently query:

```text
all branches for company
all warehouses for branch
all warehouses for company
all companies for user
all branches for user
all warehouses for user
```

Optimize these query paths.

---

# 54. PAGINATION

List endpoints must follow the pagination architecture from Phase 04.

Example:

```text
GET /companies?page=1&limit=20
GET /branches?page=1&limit=20
GET /warehouses?page=1&limit=20
```

Do not return unlimited records.

---

# 55. SEARCH

Support safe search where appropriate:

```text
GET /companies?search=fashion
GET /branches?search=bangkok
GET /warehouses?search=main
```

Search must respect organization visibility.

Never allow search to bypass authorization.

---

# 56. SORTING

Use whitelisted sortable fields.

Do not concatenate arbitrary request parameters into SQL.

Example allowed:

```text
name
code
createdAt
status
```

---

# 57. ORGANIZATION VISIBILITY

A normal list query should effectively behave like:

```text
User
 ↓
Authorization
 ↓
Allowed Company IDs
 ↓
Allowed Branch IDs
 ↓
Allowed Warehouse IDs
 ↓
Database Query
```

Filtering must occur at database/query level.

Do not:

```text
fetch everything
filter in memory
```

---

# 58. COMPANY VISIBILITY

For a user with:

```text
COMPANY scope
```

company list should only include authorized companies.

For:

```text
ALL
```

all companies permitted by the role should be visible.

---

# 59. BRANCH VISIBILITY

Branch visibility must consider:

```text
company authorization
+
branch membership
+
role scope
```

A user must not access a branch merely because the branch ID is known.

---

# 60. WAREHOUSE VISIBILITY

Warehouse visibility must consider:

```text
company
+
branch
+
warehouse membership
+
role scope
```

This becomes critical for inventory operations.

---

# 61. CREATE COMPANY

Only users with:

```text
companies.create
```

may create companies.

Do not automatically grant this permission to all authenticated users.

---

# 62. CREATE BRANCH

Creating a branch requires:

```text
branches.create
```

AND:

```text
access to target company
```

A user cannot create a branch inside an unauthorized company.

---

# 63. CREATE WAREHOUSE

Creating a warehouse requires:

```text
warehouses.create
```

AND:

```text
access to target company
access to target branch
```

And:

```text
warehouse.companyId === branch.companyId
```

must be enforced.

---

# 64. UPDATE COMPANY

Update requires:

```text
companies.update
```

AND access to the target company.

Do not allow a user to change:

```text
companyId
```

because Company is the root entity.

---

# 65. UPDATE BRANCH

Update requires:

```text
branches.update
```

AND access to the existing branch.

If changing Company:

Do NOT allow arbitrary reassignment.

Preferred initial policy:

```text
branch.companyId is immutable
```

This avoids historical ownership corruption.

---

# 66. UPDATE WAREHOUSE

Warehouse's:

```text
companyId
branchId
```

should preferably be immutable after creation.

If transfer between branches is needed later, implement a dedicated:

```text
warehouse transfer
```

business operation with audit/history.

Do not allow:

```text
PATCH /warehouses/:id
{
  "branchId": "..."
}
```

to silently move a warehouse.

---

# 67. DELETE COMPANY

Company deletion must be heavily restricted.

Before deletion:

```text
check branches
check warehouses
check future transactional dependencies
```

Prefer:

```text
deactivate
```

instead of physical deletion.

---

# 68. DELETE BRANCH

Branch deletion should not destroy:

```text
Warehouse
Sales
Inventory
Accounting
```

historical relationships.

Prefer:

```text
inactive / soft delete
```

according to project conventions.

---

# 69. DELETE WAREHOUSE

Warehouse deletion should not destroy inventory history.

Prefer:

```text
inactive
```

and prevent new inventory transactions.

Historical ledger remains intact.

---

# 70. ORGANIZATION STATUS CASCADE

When Company becomes inactive:

```text
Company = INACTIVE
```

future behavior should be defined.

Recommended:

```text
new Branch creation → blocked
new Warehouse creation → blocked
new transactions → blocked
existing historical data → retained
```

Do not silently delete children.

---

# 71. BRANCH STATUS CASCADE

If Branch becomes inactive:

```text
new Warehouse creation → blocked
new branch-level transactions → blocked
historical data → retained
```

Warehouse records may remain for history.

---

# 72. WAREHOUSE STATUS

If Warehouse becomes inactive:

```text
new inventory operations → blocked
historical inventory → retained
```

Actual inventory transaction enforcement belongs to Phase 14.

Phase 07 only provides lifecycle state.

---

# 73. ORGANIZATION EVENTS

Prepare event hooks for:

```text
COMPANY_CREATED
COMPANY_UPDATED
COMPANY_DEACTIVATED

BRANCH_CREATED
BRANCH_UPDATED
BRANCH_DEACTIVATED

WAREHOUSE_CREATED
WAREHOUSE_UPDATED
WAREHOUSE_DEACTIVATED

USER_COMPANY_ASSIGNED
USER_COMPANY_REMOVED

USER_BRANCH_ASSIGNED
USER_BRANCH_REMOVED

USER_WAREHOUSE_ASSIGNED
USER_WAREHOUSE_REMOVED
```

Full Outbox Pattern belongs to Phase 18.

Do not build a complete Outbox implementation here unless already required by Phase 04.

---

# 74. AUDIT COMPATIBILITY

Organization changes are security/business-sensitive.

Prepare clean service methods so Phase 18 / future Audit Log can record:

```text
who
what
when
company
branch
warehouse
before
after
```

Do not implement a second incompatible audit system.

---

# 75. PHASE 06 INTEGRATION

Phase 06 should consume Phase 07 organization information.

Expected conceptual flow:

```text
JWT
 ↓
User
 ↓
Roles
 ↓
Permissions
 ↓
Scope
 ↓
Organization Membership
 ↓
Allowed Organization IDs
 ↓
Query
```

---

# 76. RESOURCE-SPECIFIC SCOPE EXAMPLES

Future:

```text
Sales
scope = BRANCH
```

means:

```text
sales.branchId IN allowedBranchIds
```

Inventory:

```text
scope = WAREHOUSE
```

means:

```text
inventory.warehouseId IN allowedWarehouseIds
```

Customer:

```text
scope = COMPANY
```

means:

```text
customer.companyId IN allowedCompanyIds
```

Do not implement these domain queries in Phase 07.

Expose the organization context needed by those modules.

---

# 77. USER ORGANIZATION CONTEXT

A user may have:

```text
Company A
 ├── Branch A1
 │     ├── Warehouse A1
 │     └── Warehouse A2
 │
 └── Branch A2
       └── Warehouse A3
```

The backend should be able to resolve:

```text
allowedCompanyIds
allowedBranchIds
allowedWarehouseIds
```

efficiently.

---

# 78. HIERARCHICAL VALIDATION

When assigning:

```text
User → Warehouse
```

verify:

```text
Warehouse
 ↓
Branch
 ↓
Company
```

and ensure the user has valid organization membership.

---

# 79. MEMBERSHIP ASSIGNMENT API

Potential endpoints:

```text
GET /users/:id/companies
PUT /users/:id/companies

GET /users/:id/branches
PUT /users/:id/branches

GET /users/:id/warehouses
PUT /users/:id/warehouses
```

Phase 08 will eventually own the full User Administration experience.

Phase 07 should expose the organization membership service/API required for that integration.

Do not duplicate User CRUD.

---

# 80. ORGANIZATION ADMINISTRATION PERMISSIONS

Recommended permission catalog additions:

```text
companies.read
companies.create
companies.update
companies.delete

branches.read
branches.create
branches.update
branches.delete

warehouses.read
warehouses.create
warehouses.update
warehouses.delete

organization.members.read
organization.members.assign
organization.members.remove
```

Use the project's naming conventions if already established.

---

# 81. NO HARDCODED ORGANIZATION ROLES

Do not create:

```text
Company Admin
Branch Manager
Warehouse Manager
```

as mandatory hard-coded roles.

They are possible custom roles created using Phase 06.

Example:

```text
Role:
Branch Manager

Permissions:
branches.read
warehouses.read
sales.read

Scope:
BRANCH
```

The role system remains dynamic.

---

# 82. ORGANIZATION ROLE EXAMPLE

Example custom role:

```text
Branch Manager
```

might have:

```text
branches.read
branches.update
warehouses.read
warehouses.create
sales.read
sales.approve
```

with:

```text
scope = BRANCH
```

This is a configuration example.

Do not seed it unless the product explicitly requires default roles.

---

# 83. SUPER ADMIN

Super Admin should be able to manage organization structure through permissions.

Do not use:

```typescript
if (user.role === 'SUPER_ADMIN')
```

inside every service.

Use Phase 06 authorization.

---

# 84. ORGANIZATION SWITCHING

If the frontend supports switching:

```text
Company
Branch
Warehouse
```

the backend should validate each switch.

Example:

```text
User has:
Company A
Company B

Request:
companyId = Company B
```

Allow only if:

```text
UserCompany exists
AND active
AND role/scope permits it
```

---

# 85. ACTIVE CONTEXT VS MEMBERSHIP

Important distinction:

```text
Membership
=
where the user is allowed to operate
```

```text
Active Context
=
which allowed organization the current request is operating against
```

Do not store active context as a security decision.

The server must revalidate it.

---

# 86. API RESPONSE

Company response should be domain-oriented.

Example:

```json
{
  "id": "...",
  "code": "FASHION-TH",
  "name": "Fashion Thailand",
  "status": "ACTIVE"
}
```

Branch:

```json
{
  "id": "...",
  "companyId": "...",
  "code": "BKK-01",
  "name": "Bangkok Branch",
  "status": "ACTIVE"
}
```

Warehouse:

```json
{
  "id": "...",
  "companyId": "...",
  "branchId": "...",
  "code": "WH-BKK-01",
  "name": "Bangkok Main Warehouse",
  "status": "ACTIVE"
}
```

Follow existing DTO/serialization conventions.

---

# 87. DO NOT EXPOSE INTERNAL RELATION TABLES

The API should not expose:

```text
user_companies
user_branches
user_warehouses
```

as raw database tables.

Expose domain-oriented relationships.

---

# 88. DATABASE MIGRATIONS

Create migrations for:

```text
companies
branches
warehouses

user_companies
user_branches
user_warehouses
```

only if those membership tables are required by the final architecture.

Every migration must be:

```text
reversible where practical
idempotency-safe in deployment workflow
compatible with existing schema
```

---

# 89. SEED DATA

Seed minimal development data only if the project has an established seed strategy.

Example:

```text
Company:
FASHION-TH

Branch:
BKK-01

Warehouse:
WH-BKK-01
```

Do not seed fake business data into production.

Do not overwrite existing data.

---

# 90. SEED RELATIONSHIP

If seed data includes organization membership:

```text
User
 ↓
Company
 ↓
Branch
 ↓
Warehouse
```

every relationship must be valid.

Do not assign users to non-existing organizations.

---

# 91. TEST DATA ISOLATION

Tests must create isolated organization structures.

Example:

```text
Company A
 ├── Branch A1
 │   └── Warehouse A1

Company B
 ├── Branch B1
 │   └── Warehouse B1
```

This makes cross-organization security tests possible.

---

# 92. UNIT TESTS

Test:

```text
CompanyService
BranchService
WarehouseService

OrganizationMembershipService
OrganizationContextService
```

where applicable.

---

# 93. INTEGRATION TESTS

Test:

```text
create company
create branch
create warehouse

assign user to company
assign user to branch
assign user to warehouse

remove membership
deactivate organization
```

---

# 94. SECURITY TESTS

Must test:

```text
Company A user → Company B
Company A branch → Company B branch
Branch A user → Branch B
Warehouse A user → Warehouse B
```

All must be denied unless explicitly authorized.

---

# 95. IDOR TESTS

Test:

```text
GET /companies/:otherCompanyId
GET /branches/:otherBranchId
GET /warehouses/:otherWarehouseId
```

Expected:

```text
denied
```

according to the project's 403/404 policy.

---

# 96. SPOOFING TESTS

Test request payload manipulation:

```json
{
  "companyId": "unauthorized-company"
}
```

```json
{
  "branchId": "unauthorized-branch"
}
```

```json
{
  "warehouseId": "unauthorized-warehouse"
}
```

Backend must reject unauthorized relationships.

---

# 97. CROSS-PARENT TEST

Attempt:

```text
POST /warehouses
{
  "companyId": "company-A",
  "branchId": "branch-from-company-B"
}
```

Expected:

```text
400 / 403
```

according to validation policy.

Never create the invalid relationship.

---

# 98. INACTIVE ORGANIZATION TESTS

If:

```text
Company = INACTIVE
```

test:

```text
create Branch → rejected
create Warehouse → rejected
new organization-scoped operation → rejected
```

Historical read behavior must follow authorization policy.

---

# 99. MEMBERSHIP TESTS

Test:

```text
User A
Company A
Branch A1
Warehouse A1
```

Then remove:

```text
User → Branch A1
```

Expected:

```text
Branch A1 access → denied
Warehouse A1 access → denied
```

unless another valid membership grants access.

---

# 100. MULTI-MEMBERSHIP TEST

User:

```text
Company A
Company B
```

must be able to access both only if:

```text
membership active
+
role/scope permits
```

Do not assume membership alone grants all ERP permissions.

---

# 101. MULTI-BRANCH TEST

User:

```text
Branch A1
Branch A2
```

with:

```text
BRANCH scope
```

must receive:

```text
allowedBranchIds = [A1, A2]
```

not every branch in the company.

---

# 102. WAREHOUSE TEST

User:

```text
Warehouse A1
Warehouse A2
```

must receive:

```text
allowedWarehouseIds = [A1, A2]
```

and not:

```text
[A1, A2, A3, B1]
```

---

# 103. PERFORMANCE

Organization resolution must not create N+1 queries.

Bad:

```text
for every branch:
    query company
for every warehouse:
    query branch
```

Prefer optimized joins/batched queries.

---

# 104. CACHING

Do not aggressively cache organization membership before measuring.

If caching is used:

```text
org:user:{userId}
```

must be invalidated when:

```text
membership added
membership removed
membership status changed
branch changed
warehouse changed
```

Follow the Redis abstraction from the project.

---

# 105. TRANSACTIONS

Use transactions for:

```text
create company with dependent defaults
create branch with defaults
create warehouse
assign organization memberships
remove organization memberships
```

where multiple records must remain consistent.

---

# 106. CONCURRENCY

Protect against:

```text
two admins assigning/removing membership simultaneously
two admins changing organization status
```

Follow Phase 04 concurrency strategy.

---

# 107. AUDIT HOOKS

Every organization mutation should be capable of producing an event:

```text
COMPANY_CREATED
COMPANY_UPDATED
COMPANY_DEACTIVATED

BRANCH_CREATED
BRANCH_UPDATED
BRANCH_DEACTIVATED

WAREHOUSE_CREATED
WAREHOUSE_UPDATED
WAREHOUSE_DEACTIVATED

USER_COMPANY_ASSIGNED
USER_COMPANY_REMOVED

USER_BRANCH_ASSIGNED
USER_BRANCH_REMOVED

USER_WAREHOUSE_ASSIGNED
USER_WAREHOUSE_REMOVED
```

Do not build a parallel audit framework.

---

# 108. OUTBOX COMPATIBILITY

Phase 18 will implement Outbox Pattern.

Phase 07 should keep mutation services structured so later they can emit domain events safely.

Do not directly publish critical events to Redis/BullMQ before transaction completion.

---

# 109. ACCOUNTING COMPATIBILITY

Accounting later needs:

```text
Company
Branch
```

as organizational dimensions.

Do not create journal-entry logic here.

Only ensure organization IDs can be referenced safely by future Accounting entities.

---

# 110. INVENTORY COMPATIBILITY

Inventory later needs:

```text
Warehouse
```

as a core ownership dimension.

Do not create inventory stock/ledger logic now.

Ensure Warehouse lifecycle and authorization are correct.

---

# 111. SALES COMPATIBILITY

Sales later needs:

```text
Company
Branch
SalesAccount
```

Sales Account belongs to Phase 08.

Do not create Sales Account here.

Prepare the organization context so Phase 12 can combine:

```text
Company
+
Branch
+
SalesAccount
+
Role
+
Permission
+
Data Scope
```

---

# 112. HR COMPATIBILITY

Employee later needs organization assignment.

Phase 08 may connect:

```text
Employee
 ↓
Company
 ↓
Branch
```

Do not duplicate Employee in Phase 07.

---

# 113. FRONTEND SCOPE

The frontend organization concepts should be mapped before implementation.

Inspect:

```text
Company
Branch
Warehouse
Organization
Administration
Settings
User assignment
```

If the frontend does NOT contain a concept, do not invent UI-specific requirements.

Backend architecture may still provide required foundations, but document what is inferred.

---

# 114. SOURCE OF TRUTH

For organization fields:

Priority:

```text
1. Existing backend architecture
2. Phase 00 decisions
3. Actual frontend implementation
4. Existing database conventions
5. Explicit business requirements
6. General ERP best practices
```

Do not silently replace product requirements with generic ERP assumptions.

---

# 115. API AUTHORIZATION MATRIX

Document:

| Resource   | Read                      | Create                      | Update                      | Delete                      |
| ---------- | ------------------------- | --------------------------- | --------------------------- | --------------------------- |
| Company    | companies.read            | companies.create            | companies.update            | companies.delete            |
| Branch     | branches.read             | branches.create             | branches.update             | branches.delete             |
| Warehouse  | warehouses.read           | warehouses.create           | warehouses.update           | warehouses.delete           |
| Membership | organization.members.read | organization.members.assign | organization.members.assign | organization.members.remove |

Actual permission codes must follow Phase 06 naming conventions.

---

# 116. ORGANIZATION ACCESS MATRIX

Document:

| Scope     | Company           | Branch                            | Warehouse                           |
| --------- | ----------------- | --------------------------------- | ----------------------------------- |
| COMPANY   | allowed companies | branches inside allowed companies | warehouses inside allowed companies |
| BRANCH    | parent company    | allowed branches                  | warehouses inside allowed branches  |
| WAREHOUSE | parent company    | parent branch                     | allowed warehouses                  |
| ALL       | all authorized    | all authorized                    | all authorized                      |

This is an authorization model, not a replacement for role permissions.

---

# 117. CRITICAL DISTINCTION

Do NOT interpret:

```text
User belongs to Company A
```

as:

```text
User can do everything in Company A
```

Membership answers:

```text
WHERE
```

RBAC answers:

```text
WHAT
```

Both are required.

---

# 118. FINAL ARCHITECTURE

The target architecture after Phase 07:

```text
                         USER
                           │
             ┌─────────────┴─────────────┐
             │                           │
           RBAC                   Organization
             │                           │
      ┌──────┴──────┐             ┌──────┴──────┐
      │             │             │             │
     Role      Permission      Company       Membership
      │             │             │
      └──────┬──────┘             │
             │                     ▼
          Scope                  Branch
             │                     │
             │                     ▼
             │                  Warehouse
             │
             └─────────────┬─────────────┘
                           │
                           ▼
                  Authorization Context
                           │
                           ▼
                     ERP Modules
```

---

# 119. FINAL DATA MODEL

Conceptually:

```text
Company
  │
  ├──────────────< Branch
  │                   │
  │                   └──────────────< Warehouse
  │
  └──────────────< UserCompany

User
  ├──────────────< UserCompany >──────────── Company
  │
  ├──────────────< UserBranch >──────────── Branch
  │
  └──────────────< UserWarehouse >───────── Warehouse
```

RBAC remains separate:

```text
User
  │
  └── UserRole
        │
        └── Role
             │
             ├── RolePermission
             │       ↓
             │    Permission
             │
             └── RoleResourceScope
```

---

# 120. ACCEPTANCE CRITERIA

Phase 07 is complete only when:

```text
[ ] Company entity exists
[ ] Branch entity exists
[ ] Warehouse entity exists
[ ] Company → Branch relationship works
[ ] Branch → Warehouse relationship works
[ ] Warehouse company/branch consistency is enforced
[ ] Company codes are unique
[ ] Branch codes are unique within company
[ ] Warehouse codes follow documented uniqueness strategy
[ ] Status lifecycle exists
[ ] Soft-delete conventions are respected
[ ] Foreign keys exist
[ ] Appropriate indexes exist
[ ] Company CRUD exists
[ ] Branch CRUD exists
[ ] Warehouse CRUD exists
[ ] APIs use Phase 06 authorization
[ ] No hard-coded SUPER_ADMIN checks exist
[ ] Organization membership architecture exists
[ ] User → Company membership works
[ ] User → Branch membership works if required
[ ] User → Warehouse membership works if required
[ ] Duplicate memberships are prevented
[ ] Inactive memberships grant no access
[ ] Cross-company access is blocked
[ ] Cross-branch access is blocked
[ ] Cross-warehouse access is blocked
[ ] Organization ID spoofing is blocked
[ ] Cross-parent warehouse assignment is blocked
[ ] Organization context can be resolved
[ ] Phase 06 DataScopeService can consume organization IDs
[ ] Company scope can resolve company IDs
[ ] Branch scope can resolve branch IDs
[ ] Warehouse scope can resolve warehouse IDs
[ ] Organization switching is server-validated
[ ] Pagination is implemented
[ ] Search is authorization-aware
[ ] Sorting is whitelisted
[ ] IDOR tests pass
[ ] Membership tests pass
[ ] Inactive organization tests pass
[ ] Cross-organization security tests pass
[ ] Transaction handling works
[ ] Audit/event hooks are prepared
[ ] Phase 18 Outbox integration is possible
[ ] Phase 08 Employee integration is possible
[ ] Phase 08 SalesAccount integration is possible
[ ] Phase 12 Sales integration is possible
[ ] Phase 14 Inventory integration is possible
[ ] Phase 17 Accounting integration is possible
[ ] Docker works
[ ] Migration works
[ ] Tests pass
[ ] Lint passes
[ ] Typecheck passes
[ ] Documentation is updated
```

---

# 121. DO NOT IMPLEMENT THESE IN PHASE 07

Do NOT implement:

```text
Employee
SalesAccount
SalesAccountAssignment

Customer
Supplier

Product
ProductVariant

Sales
Purchase

Inventory
Stock
InventoryLedger

Payment

Accounting
JournalEntry
Ledger

Notifications
Reports
Dashboard

BullMQ business jobs
```

Those belong to later phases.

Only provide the organization foundation required by them.

---

# 122. PHASE 07 → PHASE 08 CONTRACT

Before finishing Phase 07, document exactly what Phase 08 can consume.

Phase 08 should be able to do:

```text
Employee
 ↓
Company
 ↓
Branch
 ↓
Warehouse (if applicable)
```

and:

```text
User
 ↓
Employee
 ↓
SalesAccount
```

without redesigning Company/Branch/Warehouse.

---

# 123. PHASE 07 → PHASE 12 CONTRACT

Phase 12 Sales should eventually be able to determine:

```text
Sale.companyId
Sale.branchId
Sale.salesAccountId
```

and authorization should be able to combine:

```text
permission
+
scope
+
organization membership
+
sales account assignment
```

Do not implement Sales Account here.

---

# 124. PHASE 07 → PHASE 14 CONTRACT

Phase 14 Inventory should be able to determine:

```text
Inventory
 ↓
Warehouse
 ↓
Branch
 ↓
Company
```

and authorization should support:

```text
WAREHOUSE scope
```

without redesigning the organization hierarchy.

---

# 125. PHASE 07 → PHASE 17 CONTRACT

Accounting should eventually support:

```text
Company
Branch
```

as organizational dimensions.

Do not implement accounting logic here.

---

# 126. FINAL SECURITY REVIEW

Before saying "Phase 07 complete", manually test:

```text
1. User in Company A cannot read Company B.

2. User in Branch A cannot read Branch B.

3. User in Warehouse A cannot read Warehouse B.

4. User cannot create Branch under unauthorized Company.

5. User cannot create Warehouse under unauthorized Branch.

6. User cannot spoof companyId.

7. User cannot spoof branchId.

8. User cannot spoof warehouseId.

9. Removing Company membership removes effective organization access.

10. Inactive membership does not grant access.

11. Inactive Company cannot receive new organizational children.

12. Inactive Branch cannot receive new warehouses.

13. Inactive Warehouse cannot receive new operational activity.

14. Role permissions remain independent from organization membership.

15. Organization membership remains independent from role permissions.

16. Data Scope remains independent from both.
```

---

# 127. FINAL PRINCIPLE

The Fashion ERP organization architecture must preserve this rule:

```text
ROLE
    =
WHAT CAN I DO?

ORGANIZATION MEMBERSHIP
    =
WHERE AM I ALLOWED?

DATA SCOPE
    =
WHICH RECORDS CAN I SEE?

BUSINESS RULE
    =
WHAT CONDITIONS MUST BE TRUE?
```

Therefore the final authorization chain is:

```text
Authentication
      ↓
User
      ↓
Role
      ↓
Permission
      ↓
Data Scope
      ↓
Organization Membership
      ↓
Record Ownership / Business Rules
      ↓
Database Query
```

Never collapse these concepts into one `role`, `companyId`, or `isAdmin` field.

The Phase 07 implementation must remain a clean foundation for:

```text
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
Phase 25 — Bruno API Testing
Phase 26 — Performance
Phase 27 — Observability
Phase 28 — Docker Production
Phase 29 — Production Readiness
```

Do not proceed to Phase 08 until the architecture, migrations, authorization integration, organization visibility, and security tests are all passing.
