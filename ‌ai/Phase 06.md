# Fashion ERP Backend — Phase 06: Dynamic RBAC + Data Visibility

## ROLE

You are implementing **Phase 06 — Dynamic RBAC + Data Visibility** of the Fashion ERP backend.

The backend stack is:

* NestJS
* TypeScript
* MySQL
* TypeORM
* Redis
* BullMQ
* Docker

Phase 05 Authentication has already been implemented.

This phase is responsible for building the **server-side authorization architecture** for the entire Fashion ERP.

The architecture must support:

```text
User
  ↓
Role
  ↓
Permissions
  ↓
Data Scope
  ↓
Organization Scope
  ↓
Future Sales Account / Employee relationships
```

The system must NOT depend on hard-coded roles such as:

```text
if role === "admin"
if role === "manager"
if role === "sales_staff"
```

The RBAC system must be **dynamic and database-driven**.

---

# 1. ABSOLUTE RULES

Before writing code:

1. Inspect Phase 00–05.
2. Inspect the existing frontend audit findings.
3. Inspect the actual frontend permission/role implementation.
4. Inspect the existing database architecture.
5. Inspect existing shared infrastructure.
6. Do not duplicate Phase 05 authentication.
7. Do not modify the frontend.
8. Do not hard-code business roles.
9. Do not hard-code individual user's permissions.
10. Do not put the complete permission matrix into JWT.
11. Do not trust frontend permission checks.
12. Do not implement organization logic prematurely if it belongs to Phase 07.
13. Do not implement Employee/SalesAccount domain logic from Phase 08.
14. Build reusable authorization infrastructure that future modules can consume.

---

# 2. CORE ARCHITECTURAL PRINCIPLE

Authentication answers:

```text
WHO ARE YOU?
```

RBAC answers:

```text
WHAT ARE YOU ALLOWED TO DO?
```

Data Visibility answers:

```text
WHICH RECORDS ARE YOU ALLOWED TO SEE?
```

These are separate layers.

Architecture:

```text
HTTP Request
     ↓
Authentication
     ↓
Authenticated User
     ↓
RBAC Permission Check
     ↓
Data Visibility / Scope Check
     ↓
Business Logic
     ↓
Database
```

Never merge these responsibilities into one guard or service.

---

# 3. BUSINESS REQUIREMENT

The system must support:

```text
Super Admin
    ↓
Create custom Role
    ↓
Select Permissions
    ↓
Assign Role to User
    ↓
User receives permissions
```

Example:

```text
Role: Sales Staff

Sales
    read       ✓
    create     ✓
    update     ✓
    delete     ✗
    approve    ✗
    export     ✗

Customers
    read       ✓
    create     ✓
    update     ✗
    delete     ✗
```

Another role:

```text
Role: Sales Manager

Sales
    read       ✓
    create     ✓
    update     ✓
    delete     ✓
    approve    ✓
    export     ✓
```

These roles are examples only.

DO NOT hard-code them into the application.

The actual role names must come from the database.

---

# 4. DYNAMIC ROLE SYSTEM

Roles must be database entities.

A role should conceptually contain:

```text
Role
├── id
├── name
├── code
├── description
├── status
├── isSystemRole
├── createdAt
├── updatedAt
└── deletedAt
```

Follow Phase 03 conventions.

---

# 5. SYSTEM ROLE VS CUSTOM ROLE

Support two categories:

```text
SYSTEM ROLE
CUSTOM ROLE
```

System roles are predefined by the platform.

Custom roles are created by administrators.

Example system role:

```text
SUPER_ADMIN
```

Do not assume every organization needs the same system roles.

The architecture must allow future organization-specific roles.

---

# 6. SYSTEM ROLE PROTECTION

System roles must be protected from accidental destructive changes.

For example:

```text
isSystemRole = true
```

may prevent:

```text
delete
rename
code modification
```

depending on the security policy.

Do NOT make `SUPER_ADMIN` impossible to revoke from a user unless that is explicitly required.

Protect the role definition, not necessarily the assignment.

---

# 7. ROLE ENTITY

Use TypeORM entity.

Recommended conceptual fields:

```text
id
name
code
description
status
isSystemRole
createdAt
updatedAt
deletedAt
```

Constraints:

```text
code UNIQUE
```

Follow project naming conventions.

---

# 8. PERMISSION MODEL

Permissions must be separate from Roles.

Architecture:

```text
Role
  ↓
RolePermission
  ↓
Permission
```

Do NOT store permissions as:

```json
{
  "permissions": [...]
}
```

inside a Role JSON column unless Phase 03 explicitly established that architecture.

Prefer normalized relational data.

---

# 9. PERMISSION ENTITY

A permission should represent an action against a resource.

Conceptually:

```text
Permission
├── id
├── resource
├── action
├── code
├── description
├── createdAt
└── updatedAt
```

Example:

```text
resource = "sales"
action   = "read"
code     = "sales.read"
```

---

# 10. PERMISSION ACTIONS

The base permission actions should support at least:

```text
read
create
update
delete
```

The architecture must also allow additional business actions:

```text
approve
reject
cancel
return
export
import
pay
post
adjust
transfer
close
reopen
```

Do NOT assume every module supports every action.

Permission definitions must be explicit.

---

# 11. RESOURCE NAMING

Resources must use a consistent naming convention.

Examples:

```text
users
roles
permissions
products
product_variants
customers
suppliers
sales
sales_items
purchases
inventory
payments
journal_entries
employees
reports
```

Use the project's established naming conventions.

Do not mix:

```text
sales
Sale
SALES
sale-module
```

as permission resource identifiers.

---

# 12. PERMISSION CODE

Permission code should be deterministic.

Preferred:

```text
resource.action
```

Examples:

```text
sales.read
sales.create
sales.update
sales.delete
sales.approve
sales.return

products.read
products.create
products.update
products.delete

inventory.read
inventory.adjust
inventory.transfer
```

The code should be unique.

---

# 13. ROLE-PERMISSION RELATIONSHIP

Implement:

```text
Role
  ↓
RolePermission
  ↓
Permission
```

Recommended:

```text
role_permissions
├── id
├── roleId
├── permissionId
├── createdAt
└── unique(roleId, permissionId)
```

A role can have many permissions.

A permission can belong to many roles.

---

# 14. USER-ROLE RELATIONSHIP

Implement a proper user-role relationship.

Preferred:

```text
User
  ↓
UserRole
  ↓
Role
```

Do not place:

```text
role: "admin"
```

directly on User.

This would prevent dynamic multi-role assignment.

---

# 15. MULTIPLE ROLES PER USER

The architecture should support multiple roles per user.

Example:

```text
User: Aung

Roles:
- Sales Staff
- Inventory Viewer
```

Effective permissions should be the union of permissions granted by assigned roles, unless an explicit deny architecture is later introduced.

Do not implement explicit deny unless there is a concrete requirement.

---

# 16. USER ROLE ASSIGNMENT

A user can have:

```text
0..N roles
```

A role can be assigned to:

```text
0..N users
```

Relationship:

```text
users
  ↕
user_roles
  ↕
roles
```

Enforce uniqueness:

```text
unique(userId, roleId)
```

---

# 17. DIRECT USER PERMISSIONS

Do NOT implement direct User → Permission assignment in the first version unless the existing product requirements explicitly require it.

Preferred architecture:

```text
User
 ↓
Role
 ↓
Permission
```

If direct permissions become necessary later, introduce a separate layer:

```text
UserPermission
```

Do not mix it into `User`.

Document this as an architectural extension point.

---

# 18. EFFECTIVE PERMISSIONS

For a user:

```text
User
 ↓
Roles
 ↓
Role Permissions
 ↓
Effective Permissions
```

Example:

```text
User
├── Sales Staff
│   ├── sales.read
│   └── sales.create
│
└── Inventory Viewer
    └── inventory.read
```

Effective permissions:

```text
sales.read
sales.create
inventory.read
```

Duplicate permissions must be deduplicated.

---

# 19. PERMISSION CHECK SERVICE

Create a reusable authorization service.

Concept:

```text
PermissionService
```

Responsibilities:

```text
hasPermission(userId, permission)
hasAnyPermission(userId, permissions)
hasAllPermissions(userId, permissions)
getEffectivePermissions(userId)
```

Do not perform database permission queries independently inside every controller.

Centralize authorization logic.

---

# 20. NESTJS PERMISSION GUARD

Create a reusable guard.

Concept:

```text
PermissionGuard
```

Flow:

```text
Request
 ↓
JwtAuthGuard
 ↓
PermissionGuard
 ↓
Required Permission
 ↓
Effective Permissions
 ↓
Allow / Deny
```

Unauthenticated:

```text
401
```

Authenticated but insufficient permission:

```text
403
```

---

# 21. PERMISSION DECORATOR

Create a reusable decorator.

Example:

```typescript
@RequirePermission('sales.read')
```

or equivalent according to project conventions.

Controller:

```typescript
@Get()
@RequirePermission('sales.read')
findAll() {
  ...
}
```

The decorator should only declare the requirement.

The guard should perform the actual check.

---

# 22. MULTIPLE PERMISSION REQUIREMENTS

Support:

```text
ANY
ALL
```

Example:

```text
@RequireAnyPermission(
  'sales.read',
  'sales.manage'
)
```

and:

```text
@RequireAllPermissions(
  'sales.read',
  'sales.export'
)
```

Do not over-engineer if the current project only needs one mode, but design the metadata abstraction so it can be extended cleanly.

---

# 23. DATA VISIBILITY

This is the most important part of Phase 06 after permissions.

Permission answers:

```text
Can the user read Sales?
```

Data visibility answers:

```text
Which Sales records can the user read?
```

These must never be treated as the same thing.

Example:

```text
sales.read = true
```

does NOT mean:

```text
user can see every sale
```

---

# 24. DATA SCOPE MODEL

Design a reusable data-scope system.

Potential scopes:

```text
OWN
ACCOUNT
TEAM
BRANCH
WAREHOUSE
COMPANY
ALL
```

These are architectural concepts.

Do not activate scopes on entities before the required relationships exist.

---

# 25. SCOPE DEFINITIONS

Create a central scope enum or equivalent abstraction.

Conceptually:

```text
OWN
ACCOUNT
TEAM
BRANCH
WAREHOUSE
COMPANY
ALL
```

Avoid hard-coded string checks scattered throughout the application.

---

# 26. ROLE DATA SCOPE

A role may define the default data visibility scope.

Conceptually:

```text
Role
├── permissions
└── dataScopes
```

Example:

```text
Sales Staff
    sales.read
    sales.create
    scope = ACCOUNT
```

Sales Manager:

```text
Sales Manager
    sales.read
    sales.create
    sales.update
    sales.approve
    scope = BRANCH
```

Super Admin:

```text
Super Admin
    scope = ALL
```

These are examples only.

Do not hard-code them.

---

# 27. IMPORTANT — SCOPE IS RESOURCE-SPECIFIC

Do NOT assume one global scope applies to every module.

A user could have:

```text
Sales:
    ACCOUNT

Inventory:
    WAREHOUSE

Customers:
    BRANCH
```

Therefore the architecture should support:

```text
Role
 ↓
RolePermission
 ↓
Permission
 ↓
Resource-specific Scope
```

or an equivalent normalized design.

Do not create a single:

```text
user.dataScope
```

field.

---

# 28. RECOMMENDED ROLE ACCESS MODEL

A robust conceptual model:

```text
Role
  │
  ├── RolePermission
  │       ↓
  │    Permission
  │
  └── RoleResourceScope
          ↓
       Resource
          ↓
        Scope
```

Example:

```text
Sales Staff
│
├── sales.read
├── sales.create
├── sales.update
│
└── sales → ACCOUNT
```

---

# 29. SCOPE OVERRIDE

Do NOT implement complicated scope override rules in the first version unless required.

Default behavior:

```text
Role defines scope
```

Future extension:

```text
UserScopeOverride
```

may be introduced later.

Do not add this complexity without a concrete business requirement.

---

# 30. SUPER ADMIN

Super Admin must be able to manage:

```text
Roles
Permissions
User role assignments
Role permissions
Data scope configuration
```

However:

IMPORTANT:

Do not create a magical code path:

```typescript
if (user.email === ...)
```

or:

```typescript
if (user.id === ...)
```

Super Admin behavior must come from a protected system role / permission architecture.

---

# 31. SUPER ADMIN BYPASS

Avoid implementing:

```typescript
if (isSuperAdmin) return true;
```

everywhere.

Instead create a clean authorization policy abstraction.

If the project intentionally defines:

```text
super_admin = unrestricted
```

then the bypass should exist in ONE centralized authorization layer.

Never duplicate it across modules.

---

# 32. ROLE MANAGEMENT API

Implement role-management endpoints only if Phase 06 scope includes administration of RBAC.

Candidate APIs:

```text
GET    /roles
GET    /roles/:id
POST   /roles
PATCH  /roles/:id
DELETE /roles/:id
```

Permission requirements should be:

```text
roles.read
roles.create
roles.update
roles.delete
```

Do not use hard-coded `super_admin` checks in controllers.

---

# 33. ROLE PERMISSION API

Support assigning permissions to a role.

Possible API:

```text
GET    /roles/:id/permissions
PUT    /roles/:id/permissions
```

or:

```text
POST   /roles/:id/permissions
DELETE /roles/:id/permissions/:permissionId
```

Choose one consistent REST design.

Do not implement multiple competing APIs.

---

# 34. USER ROLE API

Support assigning roles to users.

Possible:

```text
GET /users/:id/roles
PUT /users/:id/roles
```

The exact User Administration API may be completed in Phase 08.

Phase 06 should expose the authorization infrastructure needed by Phase 08.

---

# 35. PERMISSION CATALOG

Permissions should be centrally registered.

Example seed/catalog:

```text
users.read
users.create
users.update
users.delete

roles.read
roles.create
roles.update
roles.delete

products.read
products.create
products.update
products.delete

sales.read
sales.create
sales.update
sales.delete
sales.approve
sales.cancel
sales.return
sales.export
```

Do not invent all ERP permissions now.

Only seed permissions for modules that actually exist or are explicitly planned.

The permission catalog must be extendable.

---

# 36. PERMISSION SEEDING

Create an idempotent permission seeding mechanism.

Running:

```text
npm run seed
```

multiple times must NOT create duplicates.

Use unique constraints.

Do not delete custom permissions automatically during seeding.

---

# 37. ROLE SEEDING

Seed only the minimum protected system roles required by the architecture.

Do not create a fixed list of 12 ERP roles.

The product requirement is:

```text
Dynamic roles
```

not:

```text
12 hard-coded roles
```

Custom roles must be created through the database/API.

---

# 38. ROLE CODE VS ROLE NAME

Use:

```text
name
code
```

separately.

Example:

```text
name = "Sales Staff"
code = "SALES_STAFF"
```

The UI may change the name.

The internal code should be stable.

Do not use display names as authorization identifiers.

---

# 39. ROLE DELETION

Before deleting a role:

```text
check active assignments
```

Do not silently delete a role that users depend on.

Preferred behavior:

```text
409 Conflict
```

or soft delete according to the project's data lifecycle rules.

System roles should not be normally deletable.

---

# 40. PERMISSION DELETION

Permissions should generally be treated as system definitions.

Do not allow normal administrators to casually delete a permission that is referenced by roles.

Prefer:

```text
deactivate
```

or controlled migration.

---

# 41. ROLE PERMISSION UPDATE ATOMICITY

When replacing a role's permission set:

```text
BEGIN TRANSACTION
    remove old assignments
    insert new assignments
COMMIT
```

Do not leave partially updated permission sets.

Use the transaction infrastructure from Phase 04.

---

# 42. CACHE STRATEGY

RBAC checks can become expensive.

The architecture should support caching effective permissions.

Potential key:

```text
rbac:user:{userId}:permissions
```

However:

Do not make Redis mandatory if Phase 19 is not yet implemented.

If Redis is already available through Phase 02/04 infrastructure, use the project's abstraction.

Do not directly couple every guard to Redis.

---

# 43. CACHE INVALIDATION

If permission data is cached, invalidate when:

```text
role permissions change
user roles change
role deleted/deactivated
permission deactivated
```

Example:

```text
Role updated
 ↓
invalidate affected users
```

Do not leave stale authorization indefinitely.

---

# 44. REQUEST-LEVEL CACHING

Avoid performing the same permission query multiple times during one request.

Use a request-scoped authorization context if appropriate.

Example:

```text
AuthorizationContext
├── userId
├── roles
├── permissions
└── scopes
```

Do not expose this context as a client-controlled object.

---

# 45. DATA VISIBILITY ENGINE

Create a reusable service/policy abstraction.

Concept:

```text
DataScopeService
```

Responsibilities:

```text
resolveScope(user, resource)
buildVisibilityFilter(user, resource)
canAccessRecord(user, resource, record)
```

Do not implement raw SQL conditions directly in controllers.

---

# 46. VISIBILITY FILTERS

For list endpoints, the visibility layer should eventually transform:

```text
GET /sales
```

into a scoped query.

Conceptually:

```text
User scope = ACCOUNT
 ↓
WHERE sales.salesAccountId = currentUser.salesAccountId
```

Branch:

```text
WHERE sales.branchId IN allowedBranches
```

Company:

```text
WHERE sales.companyId = currentUser.companyId
```

ALL:

```text
No additional visibility restriction
```

These are architectural examples.

Do not implement SalesAccount relationship until Phase 08.

---

# 47. RECORD-LEVEL AUTHORIZATION

List filtering is not enough.

A user must not be able to bypass visibility by calling:

```text
GET /sales/:id
```

directly.

Therefore both:

```text
collection access
record access
```

must be enforced.

Example:

```text
GET /sales
→ scoped query

GET /sales/:id
→ permission + scope check
```

---

# 48. CREATE VISIBILITY

Data visibility applies not only to READ.

For create operations, validate that the user can create records in the target scope.

Example:

```text
Sales Staff
scope = ACCOUNT
```

must not create a sale for another sales account by simply sending:

```json
{
  "salesAccountId": "another-account"
}
```

The backend must validate ownership/scope.

---

# 49. UPDATE VISIBILITY

Update requires:

```text
permission
+
record visibility
```

Example:

```text
sales.update
```

does not automatically allow updating every sale.

The target record must also be inside the user's allowed scope.

---

# 50. DELETE VISIBILITY

Delete requires:

```text
sales.delete
+
record visibility
```

Do not rely on frontend buttons being hidden.

---

# 51. APPROVAL VISIBILITY

Approval is a sensitive action.

It must have its own permission:

```text
sales.approve
```

and record-level visibility.

Do not treat:

```text
sales.update
```

as automatically meaning:

```text
sales.approve
```

---

# 52. EXPORT VISIBILITY

Exports must use the SAME visibility policy as normal queries.

Very important:

A user must not be able to access all records by using:

```text
GET /sales/export
```

when:

```text
GET /sales
```

is scoped.

Export endpoints must reuse the same data visibility engine.

---

# 53. SEARCH VISIBILITY

Search must also be scoped.

Do not implement:

```text
GET /customers/search?q=...
```

without applying visibility.

Search is still data access.

---

# 54. AGGREGATION VISIBILITY

Dashboard/report aggregation must respect visibility.

Example:

Sales Staff:

```text
Total Sales
```

must calculate only the records visible to that user.

Sales Manager:

```text
Total Sales
```

may calculate branch-level data.

Super Admin:

```text
Total Sales
```

may calculate global data.

Do not let reports bypass the authorization layer.

---

# 55. FRONTEND SECURITY GAP

The frontend currently uses UI-level permission checks.

Examples conceptually:

```text
hasPermission(...)
hidden button
hidden menu
```

These are NOT security boundaries.

Backend must enforce:

```text
authentication
permission
scope
record access
```

for every protected operation.

---

# 56. ZERO TRUST PRINCIPLE

Assume the client is malicious.

The backend must assume the user can manually send:

```text
POST
PATCH
DELETE
GET
```

requests outside the UI.

Never trust:

```text
frontend hidden buttons
frontend filters
frontend route protection
frontend role state
frontend local storage
frontend submitted ownership fields
```

---

# 57. REQUESTED SCOPE VS ALLOWED SCOPE

Never trust client-provided scope identifiers.

Example:

```json
{
  "branchId": "branch-123"
}
```

The server must verify:

```text
Is this branch allowed for the current user?
```

Do not simply accept the submitted branchId.

---

# 58. PREVENT IDOR

The architecture must protect against:

```text
Insecure Direct Object Reference
```

Example attack:

```text
GET /sales/sale-owned-by-someone-else
```

The backend must return:

```text
404
```

or:

```text
403
```

according to the project's security/error policy.

Do not leak the existence of protected records unnecessarily.

---

# 59. 404 VS 403 FOR HIDDEN RECORDS

For record-level access denial, prefer the project's security policy.

A common secure pattern:

```text
record exists but user cannot see it
→ 404
```

because this avoids revealing record existence.

Document the final decision.

Do not mix behavior across modules.

---

# 60. ORGANIZATION COMPATIBILITY

Phase 07 will introduce:

```text
Company
Branch
Warehouse
```

Phase 06 must be designed so authorization can later resolve:

```text
User
 ↓
Company memberships
 ↓
Branch memberships
 ↓
Warehouse memberships
```

Do not create fake Company/Branch tables in Phase 06 if they belong to Phase 07.

Create interfaces/abstractions only where necessary.

---

# 61. SALES ACCOUNT COMPATIBILITY

The frontend audit found that:

```text
Sales Account
```

is NOT currently a proper frontend entity.

The frontend currently has concepts such as:

```text
salesPerson
```

but not a complete SalesAccount domain model.

Therefore:

DO NOT invent a full SalesAccount implementation in Phase 06.

Prepare the scope engine to later support:

```text
ACCOUNT
```

once Phase 08 creates:

```text
Employee
SalesAccount
SalesAccountAssignment
```

---

# 62. FUTURE SALES VISIBILITY

The intended future behavior is:

```text
Sales Staff
    ↓
sales.read
    ↓
ACCOUNT scope
    ↓
only own assigned Sales Account records
```

Sales Manager:

```text
sales.read
    ↓
BRANCH / broader scope
    ↓
sales records within managed scope
```

Super Admin:

```text
sales.read
    ↓
ALL
    ↓
all permitted sales
```

These are target architecture requirements.

Do not hard-code these roles now.

---

# 63. ROLE HIERARCHY

Do NOT implement role hierarchy in Phase 06 unless explicitly required.

Avoid:

```text
Super Admin > Manager > Staff
```

as a hard-coded hierarchy.

Permission composition should be the primary authorization mechanism.

If future requirements need hierarchy, design it as a separate explicit feature.

---

# 64. DENY RULES

Do not implement explicit deny permissions initially.

Use:

```text
ALLOW
```

based on assigned permissions.

If a user has:

```text
sales.read
```

they can read sales subject to scope.

If they do not have it:

```text
403
```

This keeps the system deterministic.

---

# 65. PERMISSION INHERITANCE

Do not implement permission inheritance between roles.

If a role needs permissions:

```text
assign permissions directly
```

Avoid:

```text
Sales Manager inherits Sales Staff
```

until there is an explicit business requirement.

---

# 66. AUDITABILITY

RBAC changes are security-sensitive.

Prepare events for:

```text
ROLE_CREATED
ROLE_UPDATED
ROLE_DELETED
ROLE_PERMISSION_CHANGED
USER_ROLE_ASSIGNED
USER_ROLE_REMOVED
```

Full Audit Log implementation belongs to the project's later audit phase, but the RBAC layer must expose clean event hooks.

---

# 67. ADMIN SELF-PROTECTION

Prevent administrators from accidentally removing the last usable administrative access.

Example:

```text
There must always be at least one active Super Admin
```

if that is the project's security policy.

If implementing this rule, enforce it transactionally.

Do not rely on frontend confirmation dialogs.

---

# 68. ROLE ASSIGNMENT SECURITY

Only users with appropriate permission may assign roles.

Example:

```text
users.roles.update
```

or:

```text
roles.assign
```

Use the project's chosen permission naming strategy consistently.

Do not allow any authenticated user to assign themselves a privileged role.

---

# 69. PRIVILEGE ESCALATION PROTECTION

Test scenarios:

```text
Sales Staff
 ↓
attempts to assign itself Super Admin
 ↓
DENY
```

```text
Sales Staff
 ↓
attempts to modify role permissions
 ↓
DENY
```

```text
Sales Staff
 ↓
attempts to access another user's records
 ↓
DENY
```

---

# 70. ROLE MANAGEMENT PERMISSIONS

Use permissions for RBAC administration itself.

Example:

```text
roles.read
roles.create
roles.update
roles.delete

permissions.read
permissions.manage

user_roles.read
user_roles.assign
user_roles.remove
```

Exact naming may be adjusted to project conventions.

Do not use hard-coded role names in controllers.

---

# 71. PERMISSION CATALOG API

Provide a read endpoint for administration UI if required:

```text
GET /permissions
```

It should expose the permission catalog.

The frontend can use this to build a dynamic Permission Matrix.

Do not expose security-sensitive internal metadata.

---

# 72. ROLE DETAIL RESPONSE

A role detail response may contain:

```json
{
  "id": "...",
  "name": "Sales Staff",
  "code": "SALES_STAFF",
  "permissions": [
    "sales.read",
    "sales.create"
  ],
  "scopes": [
    {
      "resource": "sales",
      "scope": "ACCOUNT"
    }
  ]
}
```

The exact response shape must follow the API architecture established by Phase 04.

---

# 73. FRONTEND COMPATIBILITY

The frontend currently has permission UI concepts.

The backend should expose APIs that can eventually power:

```text
Administration
  ↓
Roles
  ↓
Permission Matrix
  ↓
Save
```

The frontend must NOT need to know internal database join tables.

Return domain-oriented DTOs.

---

# 74. DATABASE TRANSACTIONS

Use transactions for:

```text
create role + permissions
update role + permissions
assign roles to user
remove roles from user
```

especially when multiple relationship records are changed.

---

# 75. CONCURRENCY

Consider concurrent RBAC updates.

Example:

```text
Admin A updates Sales Staff permissions
Admin B updates Sales Staff permissions
```

Do not silently overwrite changes without considering consistency.

Follow the locking/concurrency strategy established in Phase 04.

---

# 76. SOFT DELETE

Follow Phase 03 soft-delete conventions.

If a Role is soft-deleted:

```text
it must no longer grant permissions
```

If a Permission is deactivated:

```text
it must no longer be considered effective
```

Do not allow deleted roles to continue authorizing requests.

---

# 77. TYPEORM RELATIONSHIPS

Implement explicit relationships:

```text
User
 ↕
UserRole
 ↕
Role
 ↕
RolePermission
 ↕
Permission
```

And, if using resource scopes:

```text
Role
 ↕
RoleResourceScope
 ↕
Resource / Scope
```

Avoid uncontrolled eager loading.

Use explicit query strategies.

---

# 78. QUERY PERFORMANCE

Avoid N+1 authorization queries.

Bad:

```text
for each request:
  query roles
  query permissions
  query roles
  query permissions
```

Use efficient joins/caching.

Permission lookup should be predictable and measurable.

---

# 79. AUTHORIZATION CONTEXT

Create a central abstraction:

```text
AuthorizationContext
```

Conceptually:

```text
AuthorizationContext
├── userId
├── roles
├── permissions
└── scopes
```

This should be generated from trusted server-side data.

The client must not be able to submit this context.

---

# 80. AUTHORIZATION POLICY

Create a reusable policy service.

Concept:

```text
AuthorizationService
```

Responsibilities:

```text
can(user, permission)
canAny(user, permissions)
canAll(user, permissions)
getScope(user, resource)
canAccessRecord(user, resource, record)
```

Keep business-domain-specific logic out of this generic service.

---

# 81. DOMAIN-SPECIFIC VISIBILITY

Generic scope engine:

```text
DataScopeService
```

Domain-specific policy:

```text
SalesVisibilityPolicy
InventoryVisibilityPolicy
CustomerVisibilityPolicy
```

should be possible later.

Do not create all of them now.

Design the interface so future modules can plug into the authorization system.

---

# 82. LIST QUERY PATTERN

Future modules should be able to do something like:

```text
repository
 ↓
applyVisibilityScope()
 ↓
applyFilters()
 ↓
applySorting()
 ↓
execute()
```

Visibility should happen BEFORE pagination.

This is critical.

Do not:

```text
fetch 100 records
then filter 20 records in memory
```

for protected datasets.

Filtering must happen at database/query level.

---

# 83. PAGINATION SECURITY

Apply scope before:

```text
LIMIT
OFFSET
cursor
```

Otherwise users may receive incorrect counts/pages or accidentally infer inaccessible data.

---

# 84. COUNT SECURITY

Count queries must use the same visibility filter.

Example:

```text
GET /sales/count
```

must not return global count to an account-scoped user.

---

# 85. SORT SECURITY

Sorting must not allow users to access fields they are not authorized to use if the project later introduces sensitive fields.

Use whitelisted sortable fields.

Do not dynamically concatenate arbitrary column names into SQL.

---

# 86. FILTER SECURITY

Filters must be validated.

Never trust:

```text
companyId
branchId
warehouseId
salesAccountId
ownerId
```

from client input.

Each must be validated against the user's allowed scope.

---

# 87. EXPORT SECURITY

Any future:

```text
CSV
Excel
PDF
```

export must use exactly the same authorization/data-scope policy as the underlying list query.

---

# 88. DASHBOARD SECURITY

Dashboard APIs must not bypass RBAC.

For example:

```text
GET /dashboard/sales-summary
```

must calculate only data visible to the requesting user.

Do not build dashboard queries separately without the visibility layer.

---

# 89. TEST MATRIX

Create comprehensive authorization tests.

## Authentication

```text
Unauthenticated
Authenticated
```

## Permission

```text
has permission
missing permission
multiple roles
duplicate permissions
```

## Roles

```text
role assignment
role removal
multiple roles
deleted role
inactive role
```

## Scope

```text
OWN
ACCOUNT
TEAM
BRANCH
WAREHOUSE
COMPANY
ALL
```

## Record Access

```text
own record
another user's record
same account
different account
same branch
different branch
same company
different company
```

---

# 90. SECURITY TESTS

Must test:

```text
IDOR
privilege escalation
self-role escalation
permission manipulation
scope manipulation
companyId spoofing
branchId spoofing
warehouseId spoofing
salesAccountId spoofing
export bypass
search bypass
count bypass
pagination bypass
```

---

# 91. RBAC TEST EXAMPLE

Example:

```text
User A
Role = Sales Staff
Permission = sales.read
Scope = ACCOUNT
Account = A
```

Sales:

```text
Sale 1 → Account A
Sale 2 → Account B
```

Expected:

```text
GET /sales
→ Sale 1 only
```

And:

```text
GET /sales/2
→ inaccessible
```

---

# 92. MANAGER TEST EXAMPLE

Example:

```text
User B
Role = Sales Manager
Permission = sales.read
Scope = BRANCH
Branch = B1
```

Sales:

```text
Sale 1 → Branch B1
Sale 2 → Branch B1
Sale 3 → Branch B2
```

Expected:

```text
GET /sales
→ Sale 1
→ Sale 2
```

Not:

```text
Sale 3
```

---

# 93. SUPER ADMIN TEST

Super Admin:

```text
sales.read
scope = ALL
```

Expected:

```text
GET /sales
→ all authorized company data
```

Do not bypass permission checks by email/user ID.

---

# 94. MULTI-ROLE TEST

User:

```text
Role A:
sales.read
scope = ACCOUNT

Role B:
inventory.read
scope = WAREHOUSE
```

Expected:

```text
sales.read = true
inventory.read = true
sales.create = false
inventory.update = false
```

Scopes remain resource-specific.

---

# 95. CONFLICTING SCOPES

If a user has multiple roles:

```text
Role A:
sales.read
ACCOUNT

Role B:
sales.read
BRANCH
```

Do NOT invent arbitrary precedence.

Define a deterministic policy.

Recommended initial behavior:

```text
effective access = union of granted access
effective scope = broadest explicitly granted scope
```

BUT:

Only implement this if it matches the business requirement.

Otherwise document the ambiguity and require an explicit decision.

Do not silently choose a dangerous interpretation.

---

# 96. SCOPE PRECEDENCE

If scope hierarchy is needed, document:

```text
OWN
<
ACCOUNT
<
TEAM
<
WAREHOUSE / BRANCH
<
COMPANY
<
ALL
```

Do not assume this hierarchy is universally valid.

For each resource, the scope semantics must be documented.

---

# 97. DATA SCOPE STORAGE

Avoid storing:

```text
scope = "ACCOUNT"
```

only on User.

Preferred:

```text
RoleResourceScope
```

or equivalent resource-specific relationship.

This allows:

```text
Sales → ACCOUNT
Inventory → WAREHOUSE
Customers → BRANCH
```

for the same user.

---

# 98. FUTURE PHASE INTEGRATION

Phase 06 must integrate cleanly with:

```text
Phase 07
Company / Branch / Warehouse

Phase 08
User / Employee / Sales Account

Phase 09
Master Data

Phase 10
Product

Phase 11
Customer / Supplier

Phase 12
Sales

Phase 13
Purchase

Phase 14
Inventory

Phase 15
Inventory Ledger

Phase 16
Payment

Phase 17
Accounting

Phase 22
Reports / Dashboard

Phase 23
API Security

Phase 24
Testing

Phase 25
Bruno
```

Do not implement those modules now.

---

# 99. PHASE 07 INTEGRATION

Phase 07 will create organization entities.

Phase 06 should provide extension points for:

```text
company scope
branch scope
warehouse scope
```

Do not duplicate Company/Branch/Warehouse ownership tables inside RBAC.

---

# 100. PHASE 08 INTEGRATION

Phase 08 will create:

```text
Employee
SalesAccount
SalesAccountAssignment
```

Phase 06 should allow:

```text
ACCOUNT
```

to resolve through those relationships.

Do not hard-code:

```text
salesAccountId = user.id
```

because User and Sales Account are different concepts.

---

# 101. PHASE 12 INTEGRATION

Sales module must eventually call:

```text
AuthorizationService
DataScopeService
```

before:

```text
read
create
update
delete
approve
cancel
return
export
```

Do not create Sales-specific authorization hacks inside Phase 06.

---

# 102. ACCOUNTING INTEGRATION

Accounting may require sensitive permissions:

```text
accounting.read
journal.create
journal.post
payment.create
payment.approve
```

Do not grant accounting access merely because a user can access Sales.

Permissions must be explicit.

---

# 103. HR INTEGRATION

HR may require:

```text
employees.read
employees.create
employees.update
employees.delete
payroll.read
payroll.process
attendance.read
```

Do not implement these business modules now.

The permission catalog should be extendable.

---

# 104. ADMINISTRATION INTEGRATION

Administration UI will eventually need:

```text
Users
Roles
Permissions
Company
Branch
Workflow
Audit
Settings
```

Phase 06 should provide dynamic APIs for:

```text
roles
permissions
user-role assignments
```

without hard-coded role screens.

---

# 105. NO 12-ROLE MODEL

IMPORTANT:

Do NOT create:

```text
1 Admin
2 Manager
3 Sales Manager
4 Sales Staff
5 Accountant
...
12 roles
```

as the architecture.

The requirement is:

```text
Dynamic Role
+
Dynamic Permission
+
Resource-specific Data Scope
```

Example roles are merely seeded defaults if needed.

---

# 106. DEFAULT ROLE RECOMMENDATION

If the application requires initial roles, seed only the minimum:

```text
SUPER_ADMIN
```

Potentially:

```text
USER
```

if the system requires a baseline role.

Do not create 12 business roles automatically.

Administrators can create:

```text
Sales Staff
Sales Manager
Accountant
HR Manager
Warehouse Manager
Custom Role A
Custom Role B
```

through the RBAC system.

---

# 107. PERMISSION MATRIX UI COMPATIBILITY

The backend should make it possible for the frontend to display:

```text
Resource
 ├── read
 ├── create
 ├── update
 ├── delete
 ├── approve
 ├── export
 └── ...
```

and allow:

```text
Role
 ↓
select permissions
 ↓
select resource scope
 ↓
save
```

Do not force the frontend to understand database join-table implementation.

---

# 108. API SECURITY

Every protected endpoint must have:

```text
JwtAuthGuard
+
PermissionGuard
```

where appropriate.

For record-level operations:

```text
JwtAuthGuard
+
PermissionGuard
+
DataVisibilityPolicy
```

Do not rely on controller naming conventions.

---

# 109. PUBLIC ENDPOINTS

Explicitly define public endpoints.

Authentication endpoints such as:

```text
POST /auth/login
POST /auth/forgot-password
POST /auth/reset-password
```

may be public according to Phase 05.

RBAC endpoints must not be public.

---

# 110. ERROR HANDLING

Authorization failure:

```text
403 Forbidden
```

Authentication failure:

```text
401 Unauthorized
```

Hidden record:

```text
follow documented 404/403 policy
```

Do not leak:

```text
which permission is missing
which role the user lacks
which hidden record exists
```

unless the API contract explicitly requires it.

---

# 111. LOGGING

Do not log sensitive data.

Never log:

```text
password
JWT
refresh token
reset token
full permission secrets
```

RBAC security events may be logged through the project's observability layer.

---

# 112. PERFORMANCE TARGET

Authorization should not become a database bottleneck.

Target:

```text
1 request
→ 1 predictable permission-resolution path
```

Prefer:

```text
cache
joins
request context
```

over repeated queries.

Measure before optimizing.

---

# 113. DOCUMENTATION

Create/update documentation for:

```text
RBAC architecture
Role model
Permission model
User-role model
Resource scope model
Authorization flow
Data visibility
Super Admin policy
Multi-role behavior
Scope precedence
Security decisions
Future Phase 07 integration
Future Phase 08 integration
```

---

# 114. IMPLEMENTATION ORDER

Follow this order:

```text
1. Inspect Phase 00–05
2. Inspect frontend RBAC implementation
3. Inspect Phase 03 database conventions
4. Design Role
5. Design Permission
6. Design RolePermission
7. Design UserRole
8. Design ResourceScope
9. Design RoleResourceScope
10. Implement entities
11. Add database constraints
12. Create permission catalog
13. Create protected system role(s)
14. Implement PermissionService
15. Implement AuthorizationService
16. Implement PermissionGuard
17. Implement decorators
18. Implement Role APIs
19. Implement Permission APIs
20. Implement UserRole APIs
21. Implement DataScopeService
22. Implement visibility policy abstraction
23. Add caching abstraction if infrastructure is ready
24. Add cache invalidation
25. Add audit/event hooks
26. Write unit tests
27. Write integration tests
28. Write security tests
29. Run lint
30. Run typecheck
31. Run migrations
32. Verify Docker
33. Update documentation
```

---

# 115. ACCEPTANCE CRITERIA

Phase 06 is complete only when:

```text
[ ] Roles are database-driven
[ ] Custom roles can be created
[ ] Role names are not hard-coded
[ ] Role codes are stable
[ ] Permissions are database-driven
[ ] Permissions are resource + action based
[ ] Role ↔ Permission is many-to-many
[ ] User ↔ Role is many-to-many
[ ] Multiple roles per user supported
[ ] Effective permissions are calculated correctly
[ ] Duplicate permissions are deduplicated
[ ] PermissionGuard exists
[ ] Permission decorator exists
[ ] Missing permission returns 403
[ ] Missing authentication returns 401
[ ] Super Admin is implemented through RBAC architecture
[ ] No email/user-ID hard-coded bypass exists
[ ] Data scope is separate from permission
[ ] Resource-specific scope is supported
[ ] OWN scope architecture exists
[ ] ACCOUNT scope architecture exists
[ ] TEAM scope architecture exists
[ ] BRANCH scope architecture exists
[ ] WAREHOUSE scope architecture exists
[ ] COMPANY scope architecture exists
[ ] ALL scope architecture exists
[ ] Record-level access is enforceable
[ ] List-level filtering is enforceable
[ ] Search respects visibility
[ ] Count respects visibility
[ ] Export can reuse visibility
[ ] Dashboard/report queries can reuse visibility
[ ] Client-provided scope IDs are validated
[ ] IDOR is prevented
[ ] Privilege escalation is prevented
[ ] Role changes are transactional
[ ] Permission changes are transactional
[ ] RBAC changes have audit/event hooks
[ ] Cache invalidation is designed correctly
[ ] No permission data is trusted from JWT
[ ] Phase 07 can add Company/Branch/Warehouse
[ ] Phase 08 can add Employee/SalesAccount
[ ] Phase 12 can consume Sales visibility
[ ] Tests pass
[ ] Lint passes
[ ] Typecheck passes
[ ] Docker works
[ ] Documentation is complete
```

---

# 116. FINAL SECURITY CHECK

Before declaring completion, manually verify these attack scenarios.

### Attack 1

```text
Sales Staff
→ POST /roles
```

Expected:

```text
403
```

unless explicitly granted.

### Attack 2

```text
Sales Staff
→ PATCH /roles/SUPER_ADMIN
```

Expected:

```text
403
```

### Attack 3

```text
Sales Staff
→ GET /sales/another-account-sale-id
```

Expected:

```text
inaccessible
```

### Attack 4

```text
Sales Staff
→ GET /sales?accountId=another-account
```

Expected:

```text
cannot bypass scope
```

### Attack 5

```text
Sales Staff
→ POST /sales
→ salesAccountId=another-account
```

Expected:

```text
rejected
```

### Attack 6

```text
Sales Staff
→ GET /sales/export
```

Expected:

```text
only records allowed by visibility scope
```

### Attack 7

```text
Sales Staff
→ GET /dashboard/sales-summary
```

Expected:

```text
only visible sales data
```

---

# 117. FINAL ARCHITECTURE

The final Phase 06 architecture should conceptually look like:

```text
                    ┌───────────────┐
                    │     User      │
                    └───────┬───────┘
                            │
                     UserRole
                            │
                            ▼
                    ┌───────────────┐
                    │     Role      │
                    └───────┬───────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
       RolePermission              RoleResourceScope
              │                           │
              ▼                           ▼
        Permission                    Scope
              │                           │
              └─────────────┬─────────────┘
                            ▼
                  AuthorizationContext
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
      PermissionGuard             DataScopeService
              │                           │
              └─────────────┬─────────────┘
                            ▼
                    Business Module
                            │
                            ▼
                         Database
```

---

# 118. FINAL PRINCIPLE

The Fashion ERP authorization system must be:

```text
Dynamic
Database-driven
Resource-based
Action-based
Scope-aware
Record-aware
Server-enforced
Multi-role capable
Future-proof
```

The core rule is:

```text
Authentication
    ≠
Authorization
    ≠
Data Visibility
```

And:

```text
Permission
    answers:
    "Can I perform this action?"

Scope
    answers:
    "Which records can I access?"
```

Never combine those two concepts.

Do not implement hard-coded ERP roles.

Build the authorization engine so that administrators can create their own roles and permissions without changing backend source code.

Finish Phase 06 cleanly before moving to:

```text
Phase 07 — Organization / Company / Branch / Warehouse
```
