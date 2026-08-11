# Fashion ERP Backend — Phase 08: User / Employee / Account Management

## ROLE

You are implementing **Phase 08 — User / Employee / Account Management** of the Fashion ERP backend.

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
Phase 07 — Organization / Company / Branch / Warehouse
```

The goal of Phase 08 is to build the **User, Employee, Sales Account, and account-assignment foundation** that future Sales, HR, Accounting, Administration, and Reporting modules will consume.

---

# 1. ABSOLUTE RULES

Before writing code:

1. Read Phase 00–07 implementation.
2. Inspect existing User/Auth entities.
3. Inspect Phase 05 Authentication.
4. Inspect Phase 06 Dynamic RBAC + Data Visibility.
5. Inspect Phase 07 Company/Branch/Warehouse architecture.
6. Inspect existing frontend implementation for User, Employee, Sales Staff, Sales Account, Administration, HR, and account-related screens.
7. Do not duplicate the existing User entity.
8. Do not create a second authentication system.
9. Do not redesign Phase 06 RBAC.
10. Do not redesign Phase 07 organization hierarchy.
11. Do not implement Sales transactions.
12. Do not implement Customer/Supplier.
13. Do not implement Inventory.
14. Do not implement Accounting ledger logic.
15. Do not implement Payroll.
16. Do not implement BullMQ business workers unless required by existing architecture.
17. Do not hard-code roles such as `SUPER_ADMIN`, `SALES_MANAGER`, or `SALES_STAFF` into business logic.
18. Do not use `user.role` as the authorization model.
19. Do not use `employee.branchId` as a replacement for RBAC.
20. Do not use `salesAccountId` as a replacement for permissions.
21. Never trust `userId`, `employeeId`, `companyId`, `branchId`, or `salesAccountId` supplied by the client.
22. All relationships must be validated server-side.
23. Follow existing Phase 03 database conventions.
24. Follow existing Phase 04 shared infrastructure.
25. Preserve backward compatibility.
26. Do not proceed to Phase 09 until Phase 08 acceptance criteria pass.

---

# 2. CORE DESIGN PRINCIPLE

The architecture must preserve these separate concepts:

```text
Authentication
    =
WHO ARE YOU?

Role / Permission
    =
WHAT CAN YOU DO?

Organization
    =
WHERE CAN YOU OPERATE?

Employee
    =
WHICH BUSINESS PERSON ARE YOU?

Sales Account
    =
WHICH SALES PORTFOLIO / SALES OWNER ARE YOU RESPONSIBLE FOR?

Data Scope
    =
WHICH RECORDS CAN YOU SEE?

Business Rule
    =
WHAT CONDITIONS MUST BE TRUE?
```

Never collapse these concepts.

---

# 3. FINAL AUTHORIZATION MODEL

The target architecture is:

```text
User
 │
 ├── Authentication
 │
 ├── Roles
 │      └── Permissions
 │
 ├── Organization Membership
 │      ├── Company
 │      ├── Branch
 │      └── Warehouse
 │
 └── Employee
         │
         └── Sales Account
                 │
                 └── Sales Data
```

Authorization:

```text
JWT
 ↓
User
 ↓
Roles
 ↓
Permissions
 ↓
Data Scope
 ↓
Organization Membership
 ↓
Employee
 ↓
Sales Account
 ↓
Resource ownership/business rules
 ↓
Database query
```

---

# 4. USER VS EMPLOYEE

Do NOT treat User and Employee as the same entity.

## User

Represents:

```text
login identity
authentication identity
authorization identity
```

## Employee

Represents:

```text
business/personnel identity
```

Example:

```text
User
├── email
├── password/auth credentials
├── status
└── authentication data

Employee
├── employeeCode
├── name
├── company
├── branch
├── department
├── position
└── employment status
```

One employee may have one login user.

But the architecture must not assume every employee must have a login.

---

# 5. USER → EMPLOYEE RELATIONSHIP

Preferred:

```text
User 1 ─── 0..1 Employee
```

This allows:

```text
Employee
without login
```

and:

```text
Employee
with login
```

Do not force every employee to have a User account.

---

# 6. EMPLOYEE ENTITY

Create an Employee entity only if not already present.

Conceptual model:

```text
Employee
├── id
├── employeeCode
├── firstName
├── lastName
├── displayName
├── phone
├── email
├── userId
├── companyId
├── branchId
├── departmentId
├── positionId
├── status
├── joinedAt
├── terminatedAt
├── createdAt
├── updatedAt
└── deletedAt
```

Do not implement Department/Position entities here if they belong to the future Master Data/HR architecture.

Use nullable foreign keys or documented placeholders where appropriate.

---

# 7. EMPLOYEE CODE

Employee code must be stable and unique according to the organization strategy.

Preferred:

```text
UNIQUE(companyId, employeeCode)
```

Example:

```text
FASHION-TH / EMP-001
FASHION-TH / EMP-002
```

Do not use email as employee identity.

---

# 8. EMPLOYEE STATUS

At minimum:

```text
ACTIVE
INACTIVE
TERMINATED
```

Use the project's existing status abstraction if one already exists.

---

# 9. EMPLOYEE LIFECYCLE

Employee lifecycle:

```text
ACTIVE
   ↓
INACTIVE
   ↓
TERMINATED
```

A terminated employee:

* must not automatically authenticate
* must not automatically retain operational access
* historical transactions must remain
* sales ownership history must remain

Do not delete historical employee references.

---

# 10. USER ACCOUNT

The system must support administrator-created user accounts.

Example:

```text
Super Admin
   ↓
Create User
   ↓
Create/Login credentials
   ↓
Assign Role
   ↓
Assign Organization
   ↓
Optionally link Employee
```

Do not allow ordinary users to create arbitrary privileged users unless their permissions explicitly allow it.

---

# 11. USER ACCOUNT STATUS

At minimum:

```text
ACTIVE
INACTIVE
LOCKED
```

If Phase 05 already has authentication status/lifecycle, reuse it.

Do not create two conflicting account-status systems.

---

# 12. USER ACCOUNT ADMINISTRATION

Future Administration UI should be able to:

```text
create user
view user
update user
activate user
deactivate user
lock user
unlock user
assign role
remove role
assign company
assign branch
assign warehouse
link employee
unlink employee
```

All actions must be permission-controlled.

---

# 13. USER CREATION

Creating a user should NOT automatically grant maximum privileges.

Example flow:

```text
POST /users

Create:
User
 ↓
credentials
 ↓
status
```

Then:

```text
assign roles
assign organization
link employee
```

according to the business workflow.

---

# 14. ADMIN CREATED USER

When an admin creates a user:

```text
createdBy
```

should be available to future audit infrastructure if the project's audit architecture supports it.

Do not implement a second audit system.

---

# 15. PASSWORD HANDLING

Follow Phase 05 authentication implementation.

Never:

```text
store plaintext password
return password hash
log password
```

Do not create another password hashing implementation.

---

# 16. EMAIL / LOGIN ID

Follow Phase 05 login identifier rules.

If email is the login identifier:

```text
email = unique
```

according to existing authentication architecture.

Do not change authentication behavior in Phase 08.

---

# 17. USER ROLE ASSIGNMENT

Use Phase 06 dynamic RBAC.

Do NOT create:

```text
user.role = "SALES_STAFF"
```

Instead:

```text
User
 ↓
UserRole
 ↓
Role
 ↓
RolePermission
```

---

# 18. USER CAN HAVE MULTIPLE ROLES

Support multiple roles if Phase 06 architecture allows it.

Example:

```text
User
 ├── Sales Staff
 └── Report Viewer
```

Effective permissions are resolved from assigned roles.

Do not assume exactly one role per user.

---

# 19. CUSTOM ROLE COMPATIBILITY

Roles remain dynamic.

Example custom role:

```text
Bangkok Sales Supervisor
```

Permissions:

```text
sales.read
sales.create
sales.update
sales.approve
reports.sales.read
```

Scope:

```text
BRANCH
```

No hard-coded backend logic should depend on the role name.

---

# 20. USER ORGANIZATION ASSIGNMENT

Use Phase 07 organization membership.

Possible relationships:

```text
User
 ├── UserCompany
 ├── UserBranch
 └── UserWarehouse
```

Do not create duplicate organization columns on User if Phase 07 membership architecture already exists.

---

# 21. EMPLOYEE ORGANIZATION

Employee should have a business organization assignment.

Example:

```text
Employee
 ├── Company
 └── Branch
```

Warehouse assignment may be appropriate for certain employees, but do not force every employee to belong to one warehouse.

---

# 22. USER ORGANIZATION VS EMPLOYEE ORGANIZATION

These are different.

Example:

```text
User
 → can access Company A + Company B

Employee
 → employed by Company A / Branch A1
```

Do not assume:

```text
User.companyId === Employee.companyId
```

without validating the business rule.

The User's access may be broader than the employee's employment organization.

---

# 23. EMPLOYEE BRANCH

An employee may have:

```text
Company A
Branch A1
```

The backend must validate:

```text
Branch A1.companyId === Company A.id
```

Do not allow cross-company employee assignments.

---

# 24. EMPLOYEE USER LINK

If:

```text
Employee A
```

is linked to:

```text
User B
```

validate:

```text
User B exists
Employee A exists
relationship is unique
```

If the business rule is one-user-per-employee:

```text
UNIQUE(employee.userId)
```

or equivalent.

---

# 25. UNLINKING USER

Unlinking:

```text
Employee
 ↓
User
```

must NOT delete either record.

It only removes the relationship.

Historical transactions remain linked to Employee.

---

# 26. EMPLOYEE DEACTIVATION

When Employee becomes:

```text
TERMINATED
```

decide authentication behavior.

Recommended:

```text
Employee terminated
 ↓
User account disabled
```

ONLY if:

```text
User is exclusively associated with this employee
```

Do not automatically disable a system administrator account if the business model allows non-employee admin users.

Document this rule.

---

# 27. SALES ACCOUNT

Create a Sales Account concept.

Important:

This is NOT an Accounting General Ledger account.

It represents the sales ownership/portfolio identity used by Sales.

Example:

```text
Sales Account
├── id
├── code
├── name
├── companyId
├── branchId
├── employeeId
├── status
├── createdAt
├── updatedAt
└── deletedAt
```

---

# 28. SALES ACCOUNT PURPOSE

Sales Account answers:

```text
WHO OWNS / MANAGES THIS SALES PORTFOLIO?
```

Examples:

```text
SA-001
SA-002
SA-003
```

or:

```text
Bangkok Retail Sales
Yangon Wholesale Sales
North Branch Sales
```

The exact naming must follow the frontend/business model.

---

# 29. SALES ACCOUNT ≠ USER

Do NOT make:

```text
salesAccountId = userId
```

as the architecture.

Instead:

```text
User
 ↓
Employee
 ↓
Sales Account
```

This allows:

```text
one employee
→ one or multiple sales accounts
```

if the business later requires it.

---

# 30. SALES ACCOUNT ≠ ROLE

Role:

```text
Sales Staff
```

answers:

```text
WHAT CAN THE USER DO?
```

Sales Account:

```text
SA-001
```

answers:

```text
WHICH SALES PORTFOLIO DOES THE USER OWN?
```

These must remain separate.

---

# 31. SALES ACCOUNT ≠ ORGANIZATION

Company/Branch:

```text
WHERE?
```

Sales Account:

```text
WHICH SALES OWNER/PORTFOLIO?
```

Example:

```text
Company: Fashion Thailand
Branch: Bangkok
Sales Account: SA-BKK-001
Employee: John
User: john@example.com
Role: Sales Staff
```

---

# 32. SALES ACCOUNT OWNERSHIP

Preferred relationship:

```text
Employee 1 ─── N SalesAccount
```

if the business allows one employee to manage multiple sales accounts.

If frontend requirements clearly indicate one account per employee, use:

```text
Employee 1 ─── 0..1 SalesAccount
```

Do not assume without inspecting the actual product.

Document the decision.

---

# 33. SALES ACCOUNT USER ASSIGNMENT

If the business requires multiple users to work under one Sales Account:

```text
SalesAccount
   ↓
SalesAccountUser
   ↓
User
```

Use a join table.

Do NOT put:

```text
salesAccountId
```

directly on User unless the relationship is guaranteed one-to-one.

---

# 34. RECOMMENDED SALES ACCOUNT ASSIGNMENT MODEL

Prefer:

```text
User
 ↓
Employee
 ↓
SalesAccount
```

for employee-owned accounts.

If multiple users can share an account:

```text
User
 ↓
SalesAccountAssignment
 ↓
SalesAccount
```

Conceptual:

```text
SalesAccountAssignment
├── id
├── userId
├── employeeId
├── salesAccountId
├── status
├── isPrimary
├── assignedAt
├── unassignedAt
├── createdAt
└── updatedAt
```

Only implement fields required by the actual business model.

---

# 35. SALES ACCOUNT ASSIGNMENT STATUS

At minimum:

```text
ACTIVE
INACTIVE
```

If historical ownership is important:

```text
assignedAt
unassignedAt
```

should be supported.

This allows future Sales reporting to answer:

```text
Who owned this account at the time of sale?
```

---

# 36. SALES ACCOUNT HISTORY

Do not overwrite historical ownership blindly.

Bad:

```text
Sale
 ↓
salesAccountId = current account
```

and later changing the account causes historical reports to change unexpectedly.

Future Sales transactions should store their own ownership snapshot/reference.

Phase 12 will implement the transaction-level behavior.

Phase 08 must preserve account identity/history.

---

# 37. SALES ACCOUNT ORGANIZATION

A Sales Account should belong to:

```text
Company
Branch
```

if required by the business model.

Validate:

```text
SalesAccount.companyId === Branch.companyId
```

when branch is provided.

---

# 38. SALES ACCOUNT CODE

Use a stable unique code.

Example:

```text
SA-BKK-001
```

Recommended:

```text
UNIQUE(companyId, code)
```

unless frontend/business requirements require branch-level uniqueness.

---

# 39. SALES ACCOUNT STATUS

At minimum:

```text
ACTIVE
INACTIVE
```

Inactive Sales Accounts should not receive new Sales assignments.

Historical Sales data must remain.

---

# 40. SALES STAFF VISIBILITY REQUIREMENT

This is a critical requirement.

A Sales Staff user should NOT automatically see all sales.

Example:

```text
Company
 └── Branch Bangkok
       ├── Sales Account A
       │     └── Sales Staff A
       │
       ├── Sales Account B
       │     └── Sales Staff B
       │
       └── Sales Account C
             └── Sales Staff C
```

Sales Staff A:

```text
CAN SEE:
Sales Account A

CANNOT SEE:
Sales Account B
Sales Account C
```

unless their role/scope explicitly grants broader access.

---

# 41. SALES MANAGER VISIBILITY

A custom Sales Manager role may have:

```text
sales.read
```

with:

```text
scope = BRANCH
```

Therefore:

```text
Sales Manager
 ↓
Bangkok Branch
 ↓
all authorized Sales Accounts
 ↓
all authorized sales
```

The role name itself must NOT grant this.

Permissions + Scope + Organization determine it.

---

# 42. SUPER ADMIN VISIBILITY

Super Admin should be able to see overall sales ONLY because the permission/scope configuration allows it.

Conceptually:

```text
Permission:
sales.read

Scope:
ALL
```

or equivalent Phase 06 model.

Do not write:

```typescript
if (role === 'SUPER_ADMIN') return allSales;
```

---

# 43. SALES DATA VISIBILITY FORMULA

Future Sales authorization should be conceptually:

```text
Visible Sales
=
Permission
AND
Organization Scope
AND
Sales Account Assignment
AND
Business Rules
```

For example:

```text
Sales Staff:
sales.read
+
WAREHOUSE/BRANCH/ACCOUNT scope
+
assigned Sales Account
```

Result:

```text
own sales only
```

---

# 44. DATA VISIBILITY EXAMPLES

### Sales Staff

```text
User
 ├── Role: Sales Staff
 ├── Company: Fashion Thailand
 ├── Branch: Bangkok
 └── Sales Account: SA-BKK-001
```

Visible:

```text
SA-BKK-001 sales
```

Not visible:

```text
SA-BKK-002
SA-BKK-003
Chiang Mai sales
Other company sales
```

unless additional permissions/scope grant access.

---

# 45. SALES MANAGER

```text
User
 ├── Role: Sales Manager
 ├── Company: Fashion Thailand
 └── Branch: Bangkok
```

Visible:

```text
all authorized Bangkok sales
```

Potentially:

```text
all Bangkok Sales Accounts
```

depending on scope.

---

# 46. COMPANY MANAGER

A custom role could have:

```text
sales.read
```

with:

```text
scope = COMPANY
```

Then:

```text
all branches
all sales accounts
all sales
```

inside the authorized company.

---

# 47. SUPER ADMIN

If the configured scope is:

```text
ALL
```

then:

```text
all companies
all branches
all sales accounts
all sales
```

may be visible.

Again:

```text
permission + scope
```

not role-name checks.

---

# 48. USER ACCOUNT + SALES ACCOUNT

A normal Sales Staff user should have a chain like:

```text
User
 ↓
Employee
 ↓
Sales Account
 ↓
Sales Transactions
```

This should be queryable efficiently.

---

# 49. SALES ACCOUNT ASSIGNMENT API

Potential endpoints:

```text
GET    /sales-accounts
GET    /sales-accounts/:id
POST   /sales-accounts
PATCH  /sales-accounts/:id
DELETE /sales-accounts/:id
```

Assignment:

```text
POST /sales-accounts/:id/assignments
DELETE /sales-accounts/:id/assignments/:assignmentId
```

Use actual project REST conventions.

---

# 50. USER ADMIN API

Potential:

```text
GET    /users
GET    /users/:id
POST   /users
PATCH  /users/:id
DELETE /users/:id
```

Account state:

```text
POST /users/:id/activate
POST /users/:id/deactivate
POST /users/:id/lock
POST /users/:id/unlock
```

Follow existing API conventions.

---

# 51. EMPLOYEE API

Potential:

```text
GET    /employees
GET    /employees/:id
POST   /employees
PATCH  /employees/:id
DELETE /employees/:id
```

Employee-user linking:

```text
POST   /employees/:id/user
DELETE /employees/:id/user
```

Do not expose raw database relations.

---

# 52. USER ROLE ASSIGNMENT

Use Phase 06 APIs/services.

Potential:

```text
POST   /users/:id/roles
DELETE /users/:id/roles/:roleId
```

But do not duplicate Role management.

Role CRUD remains Phase 06's responsibility unless architecture says otherwise.

---

# 53. USER ORGANIZATION ASSIGNMENT

Use Phase 07 membership services.

Potential:

```text
POST /users/:id/companies
DELETE /users/:id/companies/:companyId

POST /users/:id/branches
DELETE /users/:id/branches/:branchId

POST /users/:id/warehouses
DELETE /users/:id/warehouses/:warehouseId
```

Do not duplicate organization membership tables.

---

# 54. EMPLOYEE COMPANY VALIDATION

Creating:

```text
Employee
companyId = A
branchId = B
```

must validate:

```text
Branch B.companyId === A
```

If not:

```text
reject
```

---

# 55. SALES ACCOUNT COMPANY VALIDATION

Creating:

```text
SalesAccount
companyId = A
branchId = B
```

must validate:

```text
Branch B.companyId === A
```

---

# 56. SALES ACCOUNT EMPLOYEE VALIDATION

If:

```text
SalesAccount.employeeId = Employee A
```

validate:

```text
Employee A.companyId === SalesAccount.companyId
```

and if branch-scoped:

```text
Employee A.branchId === SalesAccount.branchId
```

according to business rules.

---

# 57. USER SALES ACCOUNT ASSIGNMENT VALIDATION

If assigning:

```text
User A
SalesAccount B
```

verify:

```text
User A
 ↓
Employee
 ↓
Company/Branch
```

matches the Sales Account organization according to the business rule.

Never allow arbitrary cross-company assignment.

---

# 58. USER ACCOUNT DELETE

Do not physically delete users who have:

```text
sales history
audit history
approval history
authentication history
```

Prefer:

```text
INACTIVE
LOCKED
DEACTIVATED
```

according to lifecycle.

---

# 59. EMPLOYEE DELETE

Do not physically delete employees with historical transactions.

Prefer:

```text
INACTIVE
TERMINATED
```

and preserve references.

---

# 60. SALES ACCOUNT DELETE

Do not physically delete Sales Accounts that have historical Sales records.

Prefer:

```text
INACTIVE
```

---

# 61. USER REACTIVATION

When reactivating a user:

Do NOT automatically restore old permissions or organization assignments unless the business explicitly requires it.

Authorization should be resolved from current active assignments.

---

# 62. USER LOCKOUT

Phase 05 may already implement lockout.

Phase 08 administration should expose management operations but must reuse the Phase 05 security implementation.

Do not duplicate lockout logic.

---

# 63. PASSWORD RESET

If Phase 05 already provides password reset:

reuse it.

If it does not, do not silently create an unrelated reset mechanism.

Document the dependency for the appropriate authentication enhancement.

---

# 64. EMPLOYEE PERSONAL DATA

Only store fields required by the product.

Do not overbuild HR personal information in Phase 08.

Detailed HR data can belong to future HR modules.

---

# 65. EMPLOYEE DEPARTMENT / POSITION

If frontend already has:

```text
Department
Position
```

inspect the existing implementation.

If these are Master Data concepts, reference them rather than recreating them.

Do not build full HR organization structure here.

---

# 66. USER PROFILE

User profile should contain authentication/account-level information.

Employee profile contains business/personnel information.

Do not duplicate:

```text
name
phone
email
```

without a documented reason.

If duplication is required for historical snapshots, document it.

---

# 67. EMAIL CONSISTENCY

If both User and Employee have email:

Decide whether:

```text
Employee.email
```

is business/contact email and:

```text
User.email
```

is login email.

Do not assume they must always be identical.

---

# 68. PHONE CONSISTENCY

Same principle.

If both contain phone:

```text
Employee.phone
```

can be personnel contact.

```text
User.phone
```

can be authentication/security contact.

Document the distinction.

---

# 69. ACCOUNT MANAGEMENT PERMISSIONS

Recommended permission catalog:

```text
users.read
users.create
users.update
users.delete
users.activate
users.deactivate
users.lock
users.unlock

employees.read
employees.create
employees.update
employees.delete

sales_accounts.read
sales_accounts.create
sales_accounts.update
sales_accounts.delete
sales_accounts.assign
sales_accounts.unassign
```

Use existing naming conventions.

Do not duplicate permissions already defined in Phase 06.

---

# 70. EMPLOYEE PERMISSIONS

Employee management must be separate from User management.

Example:

```text
HR Admin
```

may have:

```text
employees.read
employees.create
employees.update
```

without having:

```text
users.create
users.update
```

unless explicitly granted.

---

# 71. USER ADMIN PERMISSIONS

A user administrator may have:

```text
users.read
users.create
users.update
users.activate
users.deactivate
```

without automatically having:

```text
employees.delete
sales_accounts.delete
```

Permissions remain granular.

---

# 72. SALES ACCOUNT PERMISSIONS

Sales Account management should be independently controlled.

Example:

```text
sales_accounts.read
sales_accounts.assign
```

does not automatically mean:

```text
sales.create
sales.delete
```

---

# 73. DATA SCOPE

Use Phase 06 Data Visibility.

Examples:

```text
users.read
scope = COMPANY
```

means:

```text
users inside allowed companies
```

Example:

```text
employees.read
scope = BRANCH
```

means:

```text
employees inside allowed branches
```

Example:

```text
sales_accounts.read
scope = BRANCH
```

means:

```text
sales accounts inside allowed branches
```

---

# 74. SALES ACCOUNT OWNERSHIP FILTER

For Sales Staff:

```text
sales_accounts.read
```

may still not be enough.

The query may need:

```text
salesAccount.id IN assignedSalesAccountIds
```

This is a domain-specific ownership rule.

Do not force this into generic RBAC if the architecture is better served by a SalesAccountOwnership/Assignment policy.

---

# 75. RBAC + OWNERSHIP

The final rule can be:

```text
CanReadSales =
    hasPermission("sales.read")
    AND
    organizationScopeAllows(record)
    AND
    salesAccountPolicyAllows(record)
```

This is much safer than:

```text
if role === SALES_STAFF
```

---

# 76. SALES ACCOUNT QUERY

Future Sales module should be able to ask:

```text
SalesAccountVisibilityService
```

or equivalent:

```text
getAllowedSalesAccountIds(user)
```

This can return:

```text
SA-001
SA-002
```

for a specific user.

Do not hard-code this into SalesController.

---

# 77. OWNERSHIP RESOLUTION

Provide a reusable service abstraction where appropriate:

```text
SalesAccountAccessService
```

Potential methods:

```text
canAccessSalesAccount()
getAllowedSalesAccountIds()
assertSalesAccountAccess()
```

Follow existing architecture patterns.

---

# 78. DO NOT OVERLOAD DATASCOPE

Do not make generic DataScope responsible for every business-specific rule.

Keep:

```text
DataScope
```

for:

```text
ALL
COMPANY
BRANCH
WAREHOUSE
```

and keep:

```text
SalesAccount ownership
```

as a Sales-domain business rule.

This keeps the architecture modular.

---

# 79. ADMIN USER

The system may have users who are not employees.

Example:

```text
System Administrator
```

can exist as:

```text
User
Employee = null
```

if the product supports it.

Do not force every system user into Employee.

---

# 80. SERVICE USER

If future integrations need service accounts:

```text
User
type = SERVICE
```

may be considered.

Do not implement unless current architecture requires it.

---

# 81. USER TYPES

Do not introduce user types unnecessarily.

If useful:

```text
HUMAN
SERVICE
```

must be documented.

Otherwise keep the User model simple.

---

# 82. USER CREATION WORKFLOW

Recommended administration flow:

```text
Admin
 ↓
Create Employee
 ↓
Create User Account
 ↓
Link User ↔ Employee
 ↓
Assign Role
 ↓
Assign Company
 ↓
Assign Branch
 ↓
Assign Warehouse if required
 ↓
Assign Sales Account if required
 ↓
Activate
```

Each operation must be authorized.

---

# 83. SALES STAFF CREATION WORKFLOW

Example:

```text
Create Employee
      ↓
Company = Fashion Thailand
Branch = Bangkok
      ↓
Create User
      ↓
Assign custom role:
Sales Staff
      ↓
Assign Branch
      ↓
Create/Assign Sales Account
      ↓
Activate
```

Result:

```text
User
 ↓
Employee
 ↓
Bangkok
 ↓
Sales Account SA-BKK-001
```

---

# 84. SALES MANAGER CREATION WORKFLOW

Example:

```text
User
 ↓
Employee
 ↓
Company = Fashion Thailand
Branch = Bangkok
 ↓
Role = custom Sales Manager
 ↓
Permission = sales.read
 ↓
Scope = BRANCH
```

This allows broader branch visibility without hard-coded role logic.

---

# 85. SUPER ADMIN WORKFLOW

Example:

```text
User
 ↓
Role = custom administrative role
 ↓
Permissions
 ↓
Scope = ALL
```

The backend must determine privileges from configuration.

Do not use role-name checks.

---

# 86. USER LIST VISIBILITY

A Sales Staff should NOT necessarily be able to list all users.

Example:

```text
users.read
scope = BRANCH
```

means only users inside allowed branches, depending on the resource policy.

A user without `users.read` cannot access User Administration even if they know a User ID.

---

# 87. EMPLOYEE LIST VISIBILITY

Similarly:

```text
employees.read
scope = BRANCH
```

means:

```text
employees where branchId IN allowedBranchIds
```

---

# 88. SALES ACCOUNT LIST VISIBILITY

For:

```text
Sales Staff
```

the list may need:

```text
organization scope
+
sales account assignment
```

For:

```text
Sales Manager
```

it may use:

```text
organization scope only
```

depending on permissions.

---

# 89. IDOR PROTECTION

Test:

```text
GET /users/:otherUserId
GET /employees/:otherEmployeeId
GET /sales-accounts/:otherAccountId
```

Expected:

```text
403 / 404
```

according to project security policy.

---

# 90. USER ID SPOOFING

Never trust:

```json
{
  "userId": "..."
}
```

for ownership operations.

For authenticated user operations:

```text
request.user.id
```

must be the trusted identity.

Administrative operations must verify permission to target the specified user.

---

# 91. EMPLOYEE ID SPOOFING

When creating:

```text
SalesAccount.employeeId
```

validate that the employee exists and belongs to the permitted organization.

---

# 92. SALES ACCOUNT ID SPOOFING

When assigning:

```text
User → SalesAccount
```

validate:

```text
SalesAccount exists
SalesAccount active
SalesAccount organization allowed
User organization compatible
```

---

# 93. CROSS-COMPANY USER ASSIGNMENT

Example:

```text
User belongs to Company A
SalesAccount belongs to Company B
```

must be rejected unless the architecture explicitly supports cross-company assignments.

Default:

```text
REJECT
```

---

# 94. CROSS-BRANCH USER ASSIGNMENT

If Sales Account is branch-specific:

```text
User → Branch A
SalesAccount → Branch B
```

must be rejected unless user has legitimate multi-branch membership.

---

# 95. MULTI-BRANCH EMPLOYEE

If employee can work across branches, do not force a single `branchId`.

Use a dedicated assignment model if required:

```text
EmployeeBranch
```

Only implement if frontend/business requirements actually require multi-branch employment.

---

# 96. PRIMARY EMPLOYEE BRANCH

If multiple branches are supported:

```text
EmployeeBranch.isPrimary
```

may identify the employee's primary branch.

Do not use it as the only authorization mechanism.

---

# 97. SALES ACCOUNT ASSIGNMENT HISTORY

If assignment history is required:

```text
assignedAt
unassignedAt
status
```

must be preserved.

Do not overwrite old assignment records.

---

# 98. TRANSACTIONAL CONSISTENCY

Creating Sales Account assignment should be transactional when multiple related records are changed.

Example:

```text
assign SalesAccount
+
update assignment status
+
deactivate previous primary assignment
```

must be atomic where necessary.

---

# 99. CONCURRENCY

Protect against:

```text
two admins assigning same Sales Account simultaneously
```

if the business requires exclusive ownership.

If multiple ownership is allowed, enforce the actual relationship instead.

Do not guess.

---

# 100. UNIQUE PRIMARY ASSIGNMENT

If only one primary Sales Account is allowed per employee/user:

enforce:

```text
one active primary assignment
```

at database/service level.

Do not rely only on frontend validation.

---

# 101. USER DEACTIVATION EFFECT

When User is inactive:

```text
authentication denied
```

but:

```text
historical sales
employee record
sales account ownership history
```

must remain.

---

# 102. EMPLOYEE TERMINATION EFFECT

When Employee terminates:

```text
new operational access → blocked
```

Historical:

```text
sales
orders
approvals
reports
```

must remain queryable according to permissions.

---

# 103. SALES ACCOUNT DEACTIVATION EFFECT

When Sales Account is inactive:

```text
new assignment → blocked
new sales ownership → blocked
```

Historical sales remain.

---

# 104. ACCOUNT NUMBERING

Do not confuse:

```text
User Account
Employee Code
Sales Account Code
Accounting GL Account
```

They are different concepts.

Example:

```text
User:
john@example.com

Employee:
EMP-BKK-001

Sales Account:
SA-BKK-001

GL Account:
4000-SALES
```

The last one belongs to Accounting.

---

# 105. ACCOUNTING COMPATIBILITY

Do NOT create GL accounts here.

Phase 17 will own:

```text
Chart of Accounts
Ledger Accounts
Journal Entries
Double Entry
```

Phase 08 only creates:

```text
Sales Account
```

as a sales ownership/business concept.

---

# 106. HR COMPATIBILITY

Phase 08 provides:

```text
Employee
User
```

foundation.

Future HR can add:

```text
Department
Position
Attendance
Leave
Payroll
Employment history
```

without replacing Employee.

---

# 107. ADMINISTRATION COMPATIBILITY

Administration UI can consume:

```text
Users
Employees
Roles
Permissions
Companies
Branches
Warehouses
Sales Accounts
Assignments
```

Phase 08 should expose clean APIs for these relationships.

---

# 108. AUDIT COMPATIBILITY

Sensitive operations include:

```text
user created
user deactivated
user activated
user locked
role assigned
role removed
employee created
employee updated
employee terminated
sales account created
sales account assigned
sales account unassigned
organization membership changed
```

Prepare service boundaries so Phase 18/future Audit Log can record them.

Do not build a separate audit system.

---

# 109. OUTBOX COMPATIBILITY

Potential future events:

```text
USER_CREATED
USER_ACTIVATED
USER_DEACTIVATED
USER_LOCKED

EMPLOYEE_CREATED
EMPLOYEE_UPDATED
EMPLOYEE_TERMINATED

SALES_ACCOUNT_CREATED
SALES_ACCOUNT_UPDATED
SALES_ACCOUNT_ASSIGNED
SALES_ACCOUNT_UNASSIGNED
```

Phase 18 will own reliable Outbox delivery.

Do not publish critical events directly to BullMQ before transaction commit.

---

# 110. API RESPONSE SECURITY

Never return:

```text
passwordHash
refreshTokenHash
security secrets
internal authentication secrets
```

in User API responses.

Use explicit DTOs.

---

# 111. DTO SEPARATION

Create separate DTOs where appropriate:

```text
CreateUserDto
UpdateUserDto
UserResponseDto

CreateEmployeeDto
UpdateEmployeeDto
EmployeeResponseDto

CreateSalesAccountDto
UpdateSalesAccountDto
SalesAccountResponseDto

AssignSalesAccountDto
```

Do not expose TypeORM entities directly as API contracts.

---

# 112. VALIDATION

Validate:

```text
email
employeeCode
salesAccountCode
UUID/ID format
status
companyId
branchId
warehouseId
employeeId
salesAccountId
```

Use the existing validation infrastructure.

---

# 113. MASS ASSIGNMENT

Do not implement bulk role/user/account assignment unless frontend requirements require it.

If bulk operations are required later, design them as explicit transactional operations.

---

# 114. USER SEARCH

Support safe search:

```text
/users?search=john
/employees?search=EMP-001
/sales-accounts?search=SA-BKK
```

Search must respect authorization/data visibility.

---

# 115. USER FILTERS

Potential filters:

```text
status
companyId
branchId
roleId
employeeId
```

Every filter must be authorization-aware.

---

# 116. EMPLOYEE FILTERS

Potential:

```text
status
companyId
branchId
departmentId
```

Do not expose filters the user is not allowed to use.

---

# 117. SALES ACCOUNT FILTERS

Potential:

```text
status
companyId
branchId
employeeId
userId
```

The `userId` filter must resolve through valid assignments.

---

# 118. PAGINATION

All list APIs must use Phase 04 pagination.

Never return unlimited users/employees/accounts.

---

# 119. SORTING

Whitelist fields.

Example:

```text
createdAt
updatedAt
name
code
status
```

Never concatenate arbitrary client-supplied SQL fields.

---

# 120. DATABASE INDEXES

Consider indexes for:

```text
users.email
employees.employeeCode
employees.companyId
employees.branchId

sales_accounts.code
sales_accounts.companyId
sales_accounts.branchId
sales_accounts.employeeId

sales_account_assignments.userId
sales_account_assignments.employeeId
sales_account_assignments.salesAccountId
```

Use actual query patterns.

Do not create indexes blindly.

---

# 121. FOREIGN KEY INTEGRITY

Enforce:

```text
Employee.companyId → Company.id
Employee.branchId → Branch.id

SalesAccount.companyId → Company.id
SalesAccount.branchId → Branch.id
SalesAccount.employeeId → Employee.id

SalesAccountAssignment.userId → User.id
SalesAccountAssignment.employeeId → Employee.id
SalesAccountAssignment.salesAccountId → SalesAccount.id
```

where those relationships exist.

---

# 122. DELETE POLICY

Do not cascade-delete historical business records.

Prefer:

```text
User → deactivate
Employee → terminate/inactivate
SalesAccount → deactivate
```

rather than destructive deletes.

---

# 123. TRANSACTION BOUNDARIES

Use transactions for:

```text
create Employee + link User
assign Sales Account
change primary Sales Account
deactivate Employee + related assignments
remove organization membership
```

when multiple records must stay consistent.

---

# 124. CACHING

Do not cache authorization/account assignment blindly.

If caching is used:

```text
user:{id}:roles
user:{id}:organizations
user:{id}:sales-accounts
```

must be invalidated when assignments change.

Follow the Redis abstraction already planned.

---

# 125. N+1 QUERY PREVENTION

Avoid:

```text
users
 ↓
for each user query employee
 ↓
for each employee query company
 ↓
for each employee query sales account
```

Use appropriate joins, relation loading, or batched queries.

---

# 126. UNIT TESTS

Test:

```text
UserService
EmployeeService
SalesAccountService
SalesAccountAssignmentService
```

where applicable.

---

# 127. AUTHORIZATION TESTS

Test:

```text
users.read
users.create
users.update
users.deactivate

employees.read
employees.create
employees.update

sales_accounts.read
sales_accounts.create
sales_accounts.update
sales_accounts.assign
sales_accounts.unassign
```

with different scopes.

---

# 128. SALES STAFF VISIBILITY TEST

Create:

```text
Company A
Branch A

Employee A
Sales Account A

Employee B
Sales Account B
```

Assign:

```text
User A → Sales Account A
User B → Sales Account B
```

User A must NOT see:

```text
Sales Account B
Sales B
```

unless explicitly authorized.

---

# 129. SALES MANAGER VISIBILITY TEST

Create:

```text
Branch A
 ├── Sales Account A
 ├── Sales Account B
 └── Sales Account C
```

Manager assigned to Branch A with:

```text
sales_accounts.read
scope = BRANCH
```

should see:

```text
A
B
C
```

---

# 130. COMPANY MANAGER TEST

Manager with:

```text
scope = COMPANY
```

should see:

```text
all branches
all sales accounts
```

inside authorized Company.

---

# 131. SUPER ADMIN TEST

User configured with:

```text
required permissions
scope = ALL
```

should see all authorized organizations/accounts.

This must work without:

```typescript
if (roleName === 'SUPER_ADMIN')
```

---

# 132. CROSS-COMPANY TEST

Create:

```text
Company A
Company B
```

User from Company A:

```text
GET Employee B
GET SalesAccount B
```

must be denied.

---

# 133. CROSS-BRANCH TEST

User:

```text
Branch A
```

must not see:

```text
Employee Branch B
SalesAccount Branch B
```

unless scope permits it.

---

# 134. CROSS-ACCOUNT TEST

Sales Staff assigned:

```text
SA-001
```

must not see:

```text
SA-002
```

even if both accounts belong to the same branch.

---

# 135. ASSIGNMENT SECURITY TEST

Attempt:

```text
User A
Company A

SalesAccount B
Company B
```

assignment must fail.

---

# 136. EMPLOYEE SECURITY TEST

Attempt:

```text
Employee A
Company A

Branch B
Company B
```

must fail.

---

# 137. ACCOUNT DEACTIVATION TEST

When:

```text
SalesAccount = INACTIVE
```

attempt:

```text
assign new user
```

must fail.

Historical assignments remain queryable where appropriate.

---

# 138. USER DEACTIVATION TEST

When:

```text
User = INACTIVE
```

authentication must fail according to Phase 05 behavior.

Historical:

```text
sales ownership
employee
audit
```

must remain.

---

# 139. EMPLOYEE TERMINATION TEST

When:

```text
Employee = TERMINATED
```

future operational access must be blocked according to business rules.

Historical data must remain.

---

# 140. IDOR TESTS

Test all:

```text
/users/:id
/employees/:id
/sales-accounts/:id
```

against unauthorized IDs.

---

# 141. API SECURITY

Every administrative endpoint must use:

```text
Authentication
+
Permission
+
Data Scope
+
Organization validation
+
Business ownership validation
```

as applicable.

---

# 142. FINAL ARCHITECTURE

The architecture after Phase 08 should conceptually look like:

```text
                           USER
                            │
              ┌─────────────┼──────────────┐
              │             │              │
          Authentication   RBAC      Organization
              │             │              │
              │       Role → Permission   Company
              │             │              │
              │           Scope           Branch
              │                            │
              │                         Warehouse
              │
              ▼
          EMPLOYEE
              │
              ├──────── Company
              ├──────── Branch
              │
              ▼
        SALES ACCOUNT
              │
              ▼
       SALES ACCOUNT
        ASSIGNMENT
              │
              ▼
       FUTURE SALES
```

---

# 143. AUTHORIZATION FORMULA

Future resource access should follow:

```text
Authenticated User
        AND
Required Permission
        AND
Allowed Data Scope
        AND
Organization Membership
        AND
Business Ownership Rule
```

For Sales Staff:

```text
sales.read
AND
branch/company scope
AND
assigned Sales Account
```

For Sales Manager:

```text
sales.read
AND
branch scope
```

For Company Manager:

```text
sales.read
AND
company scope
```

For Super Admin:

```text
required permissions
AND
ALL scope
```

The role names are examples only.

---

# 144. IMPORTANT: DO NOT HARD-CODE THESE

Never write:

```typescript
if (role === 'SALES_STAFF') {
   ...
}

if (role === 'SALES_MANAGER') {
   ...
}

if (role === 'SUPER_ADMIN') {
   ...
}
```

Instead use:

```text
Permission
+
Scope
+
Organization
+
Business Ownership
```

This keeps the ERP's RBAC fully dynamic.

---

# 145. USER → SALES ACCOUNT QUERY CONTRACT

Provide a reusable capability such as:

```text
getUserSalesAccountIds(userId)
```

or equivalent.

It should return only active and authorized assignments.

Example:

```text
User A
 ↓
Employee A
 ↓
SA-001
SA-003
```

Result:

```json
[
  "SA-001",
  "SA-003"
]
```

Do not return accounts the user is not authorized to operate.

---

# 146. FUTURE SALES QUERY CONTRACT

Phase 12 should be able to do something conceptually like:

```text
authorizationContext
+
salesAccountAccessService
+
salesRepository
```

Then:

```text
WHERE
sales.salesAccountId IN allowedSalesAccountIds
```

for account-restricted users.

Do not make Phase 12 inspect User roles directly.

---

# 147. FUTURE REPORTING CONTRACT

Phase 22 Reports should be able to reuse:

```text
OrganizationContext
DataScope
SalesAccountAccess
```

instead of implementing separate visibility logic.

---

# 148. FUTURE AUDIT CONTRACT

Phase 18 / Audit should be able to record:

```text
actorUserId
employeeId
companyId
branchId
salesAccountId
action
resource
resourceId
before
after
timestamp
```

where applicable.

Do not implement a second audit framework.

---

# 149. DOCUMENTATION

Create/update documentation for:

```text
User architecture
Employee architecture
Sales Account architecture
User ↔ Employee relationship
User ↔ Organization relationship
Employee ↔ Organization relationship
Employee ↔ Sales Account relationship
Sales Account assignment
RBAC + Scope + Ownership
```

Include ER diagrams if the project documentation convention supports them.

---

# 150. ACCEPTANCE CRITERIA

Phase 08 is complete only when:

```text
[ ] Existing Authentication architecture is reused
[ ] User CRUD exists
[ ] User activation/deactivation works
[ ] User lock/unlock works if supported by Phase 05
[ ] User never exposes password hashes/secrets
[ ] Employee entity exists
[ ] Employee CRUD exists
[ ] Employee code uniqueness is enforced
[ ] Employee status lifecycle exists
[ ] Employee → Company relationship works
[ ] Employee → Branch relationship works
[ ] Cross-company Employee assignment is blocked
[ ] User ↔ Employee linking works
[ ] Duplicate User ↔ Employee relationships are prevented
[ ] User can exist without Employee if architecture permits
[ ] Employee can exist without User
[ ] Dynamic RBAC from Phase 06 is reused
[ ] No hard-coded role-name authorization exists
[ ] Phase 07 organization membership is reused
[ ] Sales Account entity exists
[ ] Sales Account code uniqueness is enforced
[ ] Sales Account → Company works
[ ] Sales Account → Branch works
[ ] Sales Account → Employee works if required
[ ] Cross-company Sales Account assignment is blocked
[ ] Sales Account lifecycle exists
[ ] Sales Account assignment works
[ ] Assignment duplication is prevented
[ ] Assignment history is preserved if required
[ ] Inactive Sales Accounts cannot receive new assignments
[ ] Sales Staff account visibility works
[ ] Sales Manager branch visibility works
[ ] Company-level visibility works
[ ] ALL scope works
[ ] Sales Account ownership is separate from RBAC
[ ] Organization scope is separate from Sales Account ownership
[ ] User scope is enforced server-side
[ ] IDOR protection works
[ ] userId spoofing is blocked
[ ] employeeId spoofing is blocked
[ ] salesAccountId spoofing is blocked
[ ] cross-company access is blocked
[ ] cross-branch access is blocked
[ ] cross-account access is blocked
[ ] pagination works
[ ] search works
[ ] filters are authorization-aware
[ ] sorting is whitelisted
[ ] N+1 queries are avoided
[ ] transactions are used where required
[ ] indexes are appropriate
[ ] foreign keys are correct
[ ] soft-delete/lifecycle rules are respected
[ ] audit hooks are prepared
[ ] Outbox compatibility is preserved
[ ] Phase 12 Sales can consume SalesAccount access
[ ] Phase 17 Accounting is not polluted with Sales Account logic
[ ] Phase 22 Reporting can consume organization/account visibility
[ ] unit tests pass
[ ] integration tests pass
[ ] authorization tests pass
[ ] security tests pass
[ ] migration works
[ ] Docker works
[ ] lint passes
[ ] typecheck passes
[ ] documentation is updated
```

---

# 151. FINAL SECURITY REVIEW

Before declaring Phase 08 complete, manually verify:

```text
1. A User is not automatically an Employee.

2. An Employee is not automatically a User.

3. Role does not determine organization.

4. Organization membership does not grant permissions.

5. Sales Account does not grant permissions.

6. Sales Account ownership does not replace RBAC.

7. Sales Staff cannot see another Sales Staff's sales
   merely because they belong to the same branch.

8. Sales Manager can see branch-level sales only when
   permission + scope allow it.

9. Company-level users cannot access another company.

10. Super Admin behavior comes from permission/scope,
    not role-name checks.

11. User IDs from request bodies are never trusted.

12. Employee IDs are server-validated.

13. Sales Account IDs are server-validated.

14. Cross-company assignments are blocked.

15. Cross-branch assignments are blocked when prohibited.

16. Inactive users cannot authenticate.

17. Terminated employees do not retain unintended access.

18. Inactive Sales Accounts cannot receive new assignments.

19. Historical Sales ownership is not destroyed.

20. User, Employee, and Sales Account deletion does not
    destroy historical ERP records.
```

---

# 152. FINAL PRINCIPLE

The Fashion ERP must preserve this separation:

```text
                    USER
                      │
          ┌───────────┼────────────┐
          │           │            │
     AUTHENTICATION   RBAC    ORGANIZATION
          │           │            │
          │       ROLE/PERMISSION  │
          │           │         COMPANY
          │         SCOPE           │
          │                         ├── BRANCH
          │                         │     └── WAREHOUSE
          │
          ▼
       EMPLOYEE
          │
          ▼
    SALES ACCOUNT
          │
          ▼
    SALES OWNERSHIP
```

Therefore:

```text
WHO?
→ User

WHO IS THE BUSINESS PERSON?
→ Employee

WHAT CAN THEY DO?
→ Role + Permission

WHERE CAN THEY OPERATE?
→ Organization + Scope

WHICH SALES PORTFOLIO DO THEY OWN?
→ Sales Account Assignment

WHICH RECORDS CAN THEY SEE?
→ Permission + Scope + Organization + Ownership

WHAT BUSINESS CONDITIONS APPLY?
→ Domain Business Rules
```

This separation is mandatory.

Do not simplify everything into:

```text
User.role
User.companyId
User.branchId
User.salesAccountId
```

because that will become difficult to maintain once the ERP grows.

---

# 153. PHASE 08 → PHASE 09 CONTRACT

Phase 09 Master Data must be able to consume:

```text
Company
Branch
Warehouse
Employee
User
SalesAccount
```

without redesigning these core entities.

---

# 154. PHASE 08 → PHASE 12 CONTRACT

Phase 12 Sales must be able to consume:

```text
User
Employee
SalesAccount
SalesAccountAssignment
OrganizationContext
DataScope
Permission
```

and implement:

```text
Sales Staff
→ own Sales Account sales

Sales Manager
→ branch sales

Company Manager
→ company sales

ALL scope
→ overall sales
```

without hard-coded role names.

---

# 155. PHASE 08 → PHASE 14 CONTRACT

Inventory may later assign operational users/employees to:

```text
Warehouse
```

and use Phase 07 organization membership.

Do not redesign Warehouse.

---

# 156. PHASE 08 → PHASE 17 CONTRACT

Accounting must remain independent.

Do not confuse:

```text
Sales Account
```

with:

```text
General Ledger Account
```

Accounting will own:

```text
Chart of Accounts
Journal
Ledger
Debit
Credit
```

in Phase 17.

---

# 157. PHASE 08 → PHASE 22 CONTRACT

Reports/Dashboard must reuse:

```text
Organization Scope
Sales Account Ownership
RBAC Permissions
```

rather than creating another visibility system.

---

# 158. IMPLEMENTATION ORDER

Implement Phase 08 in this order:

```text
1. Inspect Phase 00–07
2. Inspect frontend
3. Confirm existing User/Auth architecture
4. Confirm organization membership architecture
5. Employee entity
6. Employee service/module
7. Employee APIs
8. User administration integration
9. Sales Account entity
10. Sales Account service/module
11. Sales Account APIs
12. Sales Account assignment
13. RBAC integration
14. Organization integration
15. Sales Account ownership/visibility service
16. Validation
17. Database constraints
18. Indexes
19. Unit tests
20. Integration tests
21. Security tests
22. Documentation
23. Final architecture review
```

Do not jump directly into controllers.

First understand the existing architecture and database.

---

# 159. FINAL COMMAND

Before coding, inspect the existing codebase and produce a short implementation plan containing:

```text
1. Existing User/Auth architecture
2. Existing RBAC architecture
3. Existing Organization architecture
4. Existing entities that can be reused
5. Entities that must be created
6. Relationship diagram
7. Migration changes
8. API changes
9. Authorization changes
10. Tests required
11. Potential conflicts with Phase 05–07
```

Then implement Phase 08.

After implementation, report:

```text
Files created
Files modified
Entities created
Migrations created
APIs created
Permissions used
Authorization flow
Sales Account visibility flow
Tests added
Tests passed
Remaining issues
```

Do not claim Phase 08 is complete if any critical security test fails.

# END OF PHASE 08
