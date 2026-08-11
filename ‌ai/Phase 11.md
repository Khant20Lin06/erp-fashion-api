# Phase 11 — Customer / Supplier

## NestJS + TypeScript + MySQL + TypeORM + Redis + BullMQ + Docker

## Implementation Prompt

You are implementing **Phase 11 — Customer / Supplier** of the Fashion ERP Backend.

The backend stack is:

* NestJS
* TypeScript
* MySQL
* TypeORM
* Redis
* BullMQ
* Docker
* REST API
* Bruno for API testing

The project already has completed:

* Phase 00 — AI Rules / Source of Truth
* Phase 01 — Project Foundation
* Phase 02 — Docker / Infrastructure
* Phase 03 — Database Architecture
* Phase 04 — Core / Shared Infrastructure
* Phase 05 — Authentication
* Phase 06 — Dynamic RBAC + Data Visibility
* Phase 07 — Organization / Company / Branch / Warehouse
* Phase 08 — User / Employee / Account Management
* Phase 09 — Master Data
* Phase 10 — Product / Variant / Pricing

You MUST inspect the existing codebase before implementing anything.

Do NOT redesign or replace existing architecture unnecessarily.

Follow the existing project conventions, naming conventions, module structure, database conventions, error handling, authentication, authorization, tenant/company/branch scope, audit system, response format, pagination, validation, logging, and testing patterns already established in previous phases.

---

# 1. Phase Objective

Implement a production-ready **Customer / Supplier Management module** that integrates cleanly with:

* Organization
* Company
* Branch
* Warehouse
* User
* Employee
* Account
* Dynamic RBAC
* Data Visibility
* Master Data
* Product / Pricing
* Future Sales
* Future Purchase
* Future Payment
* Future Accounting
* Audit Log
* Future Reports / Dashboard

Do not implement Sales, Purchase, Payment, or full Accounting transaction logic in this phase.

Only create the required integration points so future phases can connect to Customer and Supplier cleanly.

---

# 2. Required Scope

Implement ALL of the following:

```text
Phase 11 — Customer / Supplier
│
├── 11.1 Customer Management
├── 11.2 Supplier Management
├── 11.3 Customer / Supplier Address
├── 11.4 Contact Information
├── 11.5 Customer Group
├── 11.6 Supplier Group
├── 11.7 Credit Limit / Credit Terms
├── 11.8 Payment Terms
├── 11.9 Opening Balance
├── 11.10 Customer / Supplier Status
├── 11.11 Account / Ledger Mapping
├── 11.12 Branch / Company Scope
├── 11.13 Data Visibility
├── 11.14 Audit Log
└── 11.15 API + Validation + Tests
```

Every item above must be implemented or explicitly documented if the existing architecture already provides it.

---

# 3. First Step — Inspect Existing Codebase

Before writing code:

1. Inspect the complete backend structure.
2. Inspect Phase 00–10 implementations.
3. Identify:

   * existing BaseEntity
   * UUID/ID strategy
   * soft-delete strategy
   * timestamp strategy
   * Company entity
   * Branch entity
   * Warehouse entity
   * User entity
   * Employee entity
   * Account entity
   * RBAC entities
   * Permission system
   * Data Visibility / Scope system
   * Audit Log system
   * pagination implementation
   * API response format
   * exception handling
   * validation system
   * authentication guards
   * authorization guards
   * decorators
   * repository pattern
   * transaction utilities
   * test setup
   * existing master-data patterns

Do NOT create duplicate infrastructure if it already exists.

If an existing abstraction can be reused, reuse it.

---

# 4. Architecture Principle

Customer and Supplier should be treated as business parties/entities that can later participate in:

```text
Customer
   ↓
Sales
   ↓
Payment
   ↓
Accounts Receivable
   ↓
Accounting

Supplier
   ↓
Purchase
   ↓
Payment
   ↓
Accounts Payable
   ↓
Accounting
```

However, this phase must NOT implement those future transaction flows.

Only prepare clean integration points.

---

# 5. Customer Management

Implement Customer Management.

Customer should support at minimum:

```text
Customer
├── id
├── customerCode
├── name
├── displayName
├── phone
├── email
├── customerGroup
├── company
├── branch
├── creditLimit
├── creditDays
├── paymentTerm
├── openingBalance
├── status
├── notes
├── createdAt
├── updatedAt
└── deletedAt
```

Do not blindly copy this structure.

Adapt it to the existing database/entity conventions.

Customer code must be unique within the appropriate business scope.

Determine whether uniqueness should be:

* globally unique
* company unique
* branch unique

based on the existing architecture.

Document the decision.

---

# 6. Supplier Management

Implement Supplier Management.

Supplier should support:

```text
Supplier
├── id
├── supplierCode
├── name
├── displayName
├── phone
├── email
├── supplierGroup
├── company
├── branch
├── creditDays
├── paymentTerm
├── openingBalance
├── status
├── notes
├── createdAt
├── updatedAt
└── deletedAt
```

Again, adapt the exact implementation to existing conventions.

Supplier code must have proper uniqueness constraints.

---

# 7. Customer Group

Implement Customer Group management.

Examples:

```text
Retail
Wholesale
VIP
Corporate
Online
```

Customer Group should support:

* create
* read
* update
* delete/deactivate
* list
* search
* pagination
* status

Do not hard-code business groups.

Groups must be configurable by authorized users.

Support company/organization scope according to the existing architecture.

---

# 8. Supplier Group

Implement Supplier Group management.

Examples:

```text
Local Supplier
Import Supplier
Fabric Supplier
Accessory Supplier
Manufacturer
```

Support:

* create
* read
* update
* delete/deactivate
* list
* search
* pagination
* status

Groups must be configurable.

Do not hard-code them.

---

# 9. Address Management

Customer and Supplier may have multiple addresses.

Do NOT store only one address directly inside Customer/Supplier unless the existing architecture specifically requires that approach.

Prefer a reusable address model/structure.

Support address types such as:

```text
BILLING
SHIPPING
OFFICE
HOME
WAREHOUSE
OTHER
```

The exact enum/value strategy must follow existing project conventions.

Address should support appropriate fields such as:

```text
addressLine1
addressLine2
city
state
country
postalCode
```

Also support:

```text
isDefault
```

where appropriate.

Business rules:

* A party can have multiple addresses.
* Only one default address per relevant address type where appropriate.
* Address must belong to the correct Customer or Supplier.
* Address access must respect company/branch/data visibility rules.

---

# 10. Contact Information

Do not limit the design to one phone number if the existing ERP architecture can support multiple contacts.

Support appropriate contact information such as:

```text
primaryPhone
secondaryPhone
email
website
contactPerson
contactPersonPhone
contactPersonEmail
```

If a separate Contact entity is more consistent with the existing architecture, use a separate entity.

Do not create unnecessary complexity.

The final design must support future business requirements without forcing a database redesign later.

---

# 11. Credit Limit / Credit Terms

Customer credit control must support:

```text
creditLimit
creditDays
```

Supplier credit terms should support appropriate payment/credit information.

Implement validation such as:

```text
creditLimit >= 0
creditDays >= 0
```

Do not allow invalid negative values unless the existing accounting/business rules explicitly require them.

Prepare the model for future Sales/Purchase credit checking.

Do NOT implement the actual Sales credit blocking logic in this phase.

---

# 12. Payment Terms

Implement configurable Payment Terms.

Examples:

```text
Cash
Due Immediately
Net 7
Net 15
Net 30
Net 60
```

Do NOT hard-code these values.

Payment Terms should be configurable.

Support:

* create
* read
* update
* deactivate/delete according to existing conventions
* list
* search
* pagination
* validation

Potential fields:

```text
id
name
description
dueDays
status
companyId
createdAt
updatedAt
```

Adapt to the existing schema.

---

# 13. Opening Balance

Customer and Supplier must have an opening balance integration point.

Customer:

```text
openingBalance
```

Supplier:

```text
openingBalance
```

However:

IMPORTANT:

Do NOT implement full accounting journal creation in Phase 11.

The actual accounting treatment belongs to:

```text
Phase 17 — Accounting / Double Entry
```

For Phase 11:

* store the required opening balance information
* validate it
* define ownership/scope
* prepare integration fields
* document how Phase 17 will consume it

If the existing architecture already has an Opening Balance or Ledger abstraction, reuse it.

Do not duplicate it.

---

# 14. Customer / Supplier Status

Implement status management.

Possible states:

```text
ACTIVE
INACTIVE
BLOCKED
```

Use the project's existing status conventions if available.

Business rules must prevent inappropriate operations against inactive/blocked records where necessary.

Do not allow deletion of records that future Sales/Purchase transactions may depend on if the architecture requires historical integrity.

Prefer soft delete/deactivation according to existing conventions.

---

# 15. Account / Ledger Mapping

Prepare future accounting integration.

Customer should be able to map to an appropriate:

```text
Accounts Receivable
```

Supplier should be able to map to an appropriate:

```text
Accounts Payable
```

Potential integration:

```text
Customer
   └── receivableAccountId

Supplier
   └── payableAccountId
```

BUT:

Do not create duplicate Account/Ledger entities.

If Phase 04/08 or another existing module already provides Account entities, reuse them.

Do not implement full double-entry logic here.

Phase 17 owns accounting transaction logic.

---

# 16. Company / Branch Scope

Customer and Supplier must integrate with the existing organization architecture.

Possible hierarchy:

```text
Organization
   ↓
Company
   ↓
Branch
   ↓
Customer / Supplier
```

Follow the actual Phase 07 implementation.

Determine whether Customer/Supplier should be:

* organization scoped
* company scoped
* branch scoped
* company + branch scoped

based on existing architecture.

Do not invent a second tenancy system.

---

# 17. Dynamic RBAC Integration

Integrate with the existing Dynamic RBAC system from Phase 06.

Do NOT create fixed hard-coded roles such as:

```text
Customer Admin
Customer Manager
Supplier Manager
```

unless the existing architecture explicitly requires system roles.

Permissions must remain dynamic.

Recommended permissions:

```text
customer.read
customer.create
customer.update
customer.delete

supplier.read
supplier.create
supplier.update
supplier.delete

customer_group.read
customer_group.create
customer_group.update
customer_group.delete

supplier_group.read
supplier_group.create
supplier_group.update
supplier_group.delete

payment_term.read
payment_term.create
payment_term.update
payment_term.delete

customer_address.read
customer_address.create
customer_address.update
customer_address.delete

supplier_address.read
supplier_address.create
supplier_address.update
supplier_address.delete
```

Adapt permission naming to the existing Phase 06 convention.

---

# 18. Data Visibility

This is CRITICAL.

Customer/Supplier access must respect the existing Phase 06 Data Visibility system.

Example:

```text
Sales Staff
    ↓
OWN ACCOUNT / OWN DATA
```

may only see customers assigned to that user's account.

Example:

```text
Sales Manager
    ↓
BRANCH
```

may see all customers within the user's branch.

Example:

```text
Super Admin
    ↓
ALL
```

may see all authorized company/organization data.

Do NOT implement visibility by simply checking user roles.

Visibility must be based on:

```text
Permission
+
Data Scope
+
Company
+
Branch
+
User Account
+
Existing Visibility Rules
```

Reuse the existing Phase 06 implementation.

Do not duplicate visibility logic inside every controller.

Prefer centralized reusable query filtering / scope guards / policy services.

---

# 19. User Account Relationship

Phase 08 contains User / Employee / Account Management.

If the existing architecture provides an Account/User ownership relationship, integrate Customer with it.

For example:

```text
Customer
   ↓
assignedAccount
   ↓
User
```

This will support future behavior such as:

```text
Sales Staff A
   ↓
Only assigned customers

Sales Staff B
   ↓
Only assigned customers

Sales Manager
   ↓
All branch customers
```

Do not invent another user-account model.

Reuse Phase 08.

---

# 20. Audit Log

Integrate Customer/Supplier operations with the existing Audit Log system.

Audit important actions such as:

```text
CREATE
UPDATE
DELETE
RESTORE
STATUS_CHANGE
CREDIT_LIMIT_CHANGE
PAYMENT_TERM_CHANGE
GROUP_CHANGE
ACCOUNT_MAPPING_CHANGE
ASSIGNMENT_CHANGE
```

Audit information should include whatever the existing audit architecture supports, such as:

```text
actor
action
entity
entityId
timestamp
oldValue
newValue
requestId
ipAddress
```

Do not create a second audit log system.

Reuse Phase 04/Core infrastructure if already implemented.

---

# 21. REST API

Implement REST APIs following existing API conventions.

Customer:

```http
GET    /customers
POST   /customers
GET    /customers/:id
PATCH  /customers/:id
DELETE /customers/:id
```

Supplier:

```http
GET    /suppliers
POST   /suppliers
GET    /suppliers/:id
PATCH  /suppliers/:id
DELETE /suppliers/:id
```

Customer Groups:

```http
GET    /customer-groups
POST   /customer-groups
GET    /customer-groups/:id
PATCH  /customer-groups/:id
DELETE /customer-groups/:id
```

Supplier Groups:

```http
GET    /supplier-groups
POST   /supplier-groups
GET    /supplier-groups/:id
PATCH  /supplier-groups/:id
DELETE /supplier-groups/:id
```

Payment Terms:

```http
GET    /payment-terms
POST   /payment-terms
GET    /payment-terms/:id
PATCH  /payment-terms/:id
DELETE /payment-terms/:id
```

Address APIs should follow the existing nested-resource or resource convention.

Do not blindly use the exact URLs above if the project already has a different established convention.

---

# 22. Query Features

List APIs should support the existing pagination/filtering/sorting conventions.

Customer/Supplier search should support appropriate fields such as:

```text
code
name
displayName
phone
email
status
group
company
branch
assignedAccount
```

Support:

```text
pagination
search
filter
sort
status filtering
scope filtering
```

Do NOT allow users to bypass Data Visibility by manipulating query parameters.

---

# 23. DTO Validation

Create appropriate DTOs:

```text
CreateCustomerDto
UpdateCustomerDto

CreateSupplierDto
UpdateSupplierDto

CreateCustomerGroupDto
UpdateCustomerGroupDto

CreateSupplierGroupDto
UpdateSupplierGroupDto

CreatePaymentTermDto
UpdatePaymentTermDto

CreateAddressDto
UpdateAddressDto
```

Use the project's existing validation library and conventions.

Validate:

* required fields
* string lengths
* email
* phone format where appropriate
* numeric values
* UUID/ID format
* enum/status
* relationships
* duplicate codes
* company/branch ownership
* credit values
* payment term values

Never trust client-provided companyId/branchId if the existing authorization architecture derives scope from the authenticated user.

---

# 24. Database Design

Use TypeORM entities and migrations according to existing conventions.

Create appropriate indexes for frequently queried fields.

Consider indexes for:

```text
customerCode
supplierCode
name
phone
email
status
companyId
branchId
customerGroupId
supplierGroupId
assignedAccountId
```

Do not blindly create every index.

Only create indexes justified by query patterns.

Ensure foreign keys and unique constraints are correct.

Avoid unnecessary nullable fields.

Use soft-delete if that is the project's existing convention.

---

# 25. Transaction Safety

Use database transactions where multiple records must change atomically.

Examples:

```text
Create Customer
+
Create Address
+
Create Assignment
```

or:

```text
Update Customer
+
Update related mapping
+
Audit
```

Follow the existing transaction abstraction.

Do not manually create transaction logic if the project already has a shared transaction service.

---

# 26. Error Handling

Use the existing global exception/error architecture.

Handle cases such as:

```text
Customer not found
Supplier not found
Duplicate customer code
Duplicate supplier code
Invalid company
Invalid branch
Unauthorized access
Forbidden access
Invalid group
Invalid payment term
Invalid account mapping
Inactive customer
Inactive supplier
```

Return the project's standardized API error format.

Do not create inconsistent error responses.

---

# 27. Security Requirements

Never trust:

```text
companyId
branchId
assignedAccountId
createdBy
updatedBy
```

from the client without authorization validation.

Prevent:

* cross-company access
* cross-branch access
* unauthorized customer access
* unauthorized supplier access
* visibility bypass
* ID enumeration where existing security standards require protection

All protected endpoints must use existing authentication and authorization mechanisms.

---

# 28. Testing

Implement automated tests following the project's existing testing architecture.

Minimum coverage should include:

### Customer

```text
create customer
get customer
list customers
update customer
delete/deactivate customer
duplicate customer code
invalid customer data
unauthorized access
forbidden access
company scope
branch scope
data visibility
assigned account visibility
```

### Supplier

```text
create supplier
get supplier
list suppliers
update supplier
delete/deactivate supplier
duplicate supplier code
invalid supplier data
authorization
company scope
branch scope
data visibility
```

### Groups

```text
customer group CRUD
supplier group CRUD
duplicate group handling
scope validation
authorization
```

### Payment Terms

```text
payment term CRUD
validation
scope
authorization
```

### Address

```text
create address
update address
delete/deactivate address
default address rules
ownership validation
visibility
```

### Audit

Verify important mutations generate audit events according to the existing Audit Log architecture.

---

# 29. Bruno API Tests

Prepare Bruno collections for Phase 11.

Organize:

```text
bruno/
└── phase-11-customer-supplier/
    ├── customers/
    ├── suppliers/
    ├── customer-groups/
    ├── supplier-groups/
    ├── payment-terms/
    └── addresses/
```

Include:

```text
happy path
validation failure
401
403
404
duplicate data
scope restriction
visibility restriction
pagination
filtering
search
```

Follow the existing Bruno environment and authentication setup.

Do not duplicate environment configuration unnecessarily.

---

# 30. API Documentation

Document the Phase 11 APIs using the project's existing API documentation system.

For every endpoint document:

```text
method
path
authentication
permission
request body
query parameters
response
validation errors
authorization behavior
visibility behavior
```

If Swagger/OpenAPI already exists, integrate into it.

---

# 31. Redis / BullMQ

Do NOT introduce Redis/BullMQ unnecessarily for synchronous Customer/Supplier CRUD.

Only use Redis/BullMQ where the existing architecture requires asynchronous work.

Possible future jobs include:

```text
customer import
supplier import
bulk synchronization
large data export
notification
report generation
```

Do not implement unnecessary background jobs in Phase 11.

---

# 32. Module Structure

Follow the existing project module architecture.

A possible structure is:

```text
src/modules/
└── customer-supplier/
    ├── customers/
    │   ├── controllers/
    │   ├── services/
    │   ├── dto/
    │   ├── entities/
    │   └── ...
    │
    ├── suppliers/
    │   ├── controllers/
    │   ├── services/
    │   ├── dto/
    │   ├── entities/
    │   └── ...
    │
    ├── customer-groups/
    ├── supplier-groups/
    ├── payment-terms/
    ├── addresses/
    └── customer-supplier.module.ts
```

But this is only a guideline.

Use the actual existing architecture if it differs.

---

# 33. TypeORM Rules

Use TypeORM correctly.

Do NOT:

* use `synchronize: true` in production
* put business logic inside entities unnecessarily
* create circular entity dependencies unnecessarily
* expose entities directly as API responses
* allow uncontrolled mass assignment
* bypass repositories/services
* use raw SQL when TypeORM/query builder is sufficient

Use migrations for schema changes.

Use explicit relations.

Use appropriate cascade behavior carefully.

Do not use cascade delete if it can destroy ERP historical data.

---

# 34. Historical Data Integrity

ERP systems require historical integrity.

Do not physically delete Customer/Supplier records if they are referenced by future transactional data unless the existing architecture explicitly supports it.

Prefer:

```text
ACTIVE
INACTIVE
BLOCKED
```

or soft delete.

Future Sales/Purchase records must be able to retain references to the original Customer/Supplier.

---

# 35. Implementation Order

Implement in this order:

```text
Step 1
Inspect existing architecture

Step 2
Identify reusable infrastructure

Step 3
Design database entities

Step 4
Create migrations

Step 5
Implement Customer Group

Step 6
Implement Supplier Group

Step 7
Implement Payment Terms

Step 8
Implement Customer

Step 9
Implement Supplier

Step 10
Implement Address / Contact

Step 11
Integrate Company / Branch

Step 12
Integrate Dynamic RBAC

Step 13
Integrate Data Visibility

Step 14
Integrate User / Account assignment

Step 15
Integrate Audit Log

Step 16
Implement REST APIs

Step 17
Implement validation

Step 18
Implement automated tests

Step 19
Implement Bruno tests

Step 20
Run lint/typecheck/test/build

Step 21
Review architecture

Step 22
Generate Phase 11 implementation report
```

---

# 36. Important AI Rules

You MUST follow these rules:

1. Do not rewrite existing modules unnecessarily.
2. Do not create duplicate entities.
3. Do not create duplicate RBAC systems.
4. Do not create duplicate Data Visibility systems.
5. Do not create duplicate Audit Log systems.
6. Do not create duplicate Company/Branch systems.
7. Do not create duplicate User/Account systems.
8. Reuse existing infrastructure whenever possible.
9. Do not silently change previous phase behavior.
10. Do not break existing APIs.
11. Do not bypass authorization.
12. Do not trust client-provided scope identifiers.
13. Do not implement future-phase business logic prematurely.
14. Do not introduce microservices unless explicitly required.
15. Keep the architecture modular and production-ready.
16. Prefer maintainability over unnecessary abstraction.
17. Do not add libraries unless there is a clear reason.
18. Do not change package versions unnecessarily.
19. Do not use `synchronize: true` for production.
20. Use migrations for database changes.
21. Preserve historical ERP data.
22. Run tests after implementation.
23. Fix regressions before declaring the phase complete.
24. If an architectural conflict is discovered, STOP and explain it before making a destructive architectural change.
25. Never claim something is implemented unless it actually exists in the codebase.

---

# 37. Definition of Done

Phase 11 is complete only when ALL of the following are true:

```text
[ ] Customer Management implemented
[ ] Supplier Management implemented
[ ] Customer Group implemented
[ ] Supplier Group implemented
[ ] Address Management implemented
[ ] Contact Information implemented
[ ] Credit Limit implemented
[ ] Credit Terms implemented
[ ] Payment Terms implemented
[ ] Opening Balance integration prepared
[ ] Account/Ledger mapping integration prepared
[ ] Company scope implemented
[ ] Branch scope implemented
[ ] Dynamic RBAC integrated
[ ] Data Visibility integrated
[ ] User/Account assignment integrated
[ ] Audit Log integrated
[ ] REST APIs implemented
[ ] DTO validation implemented
[ ] TypeORM migrations created
[ ] Database indexes reviewed
[ ] Automated tests implemented
[ ] Bruno API tests implemented
[ ] API documentation updated
[ ] Existing tests still pass
[ ] TypeScript typecheck passes
[ ] ESLint passes
[ ] Build passes
[ ] No duplicated infrastructure
[ ] No unauthorized data visibility bypass
[ ] No historical data integrity violation
```

---

# 38. Final Verification

After implementation, run the appropriate project commands for:

```text
lint
typecheck
unit tests
integration tests
build
```

Then verify:

```text
Customer CRUD
Supplier CRUD
Group CRUD
Payment Terms CRUD
Address CRUD
RBAC
Data Visibility
Company Scope
Branch Scope
Account Assignment
Audit Log
Pagination
Search
Filtering
Validation
Error Handling
```

Finally provide a concise implementation report containing:

```text
1. Files created
2. Files modified
3. Database entities created/modified
4. Migrations created
5. APIs added
6. Permissions added
7. Data visibility rules added
8. Audit events added
9. Tests added
10. Bruno collections added
11. Commands executed
12. Test results
13. Build/typecheck/lint results
14. Architectural decisions
15. Known limitations
16. Recommended next steps for Phase 12
```

IMPORTANT:

Do not proceed based only on this prompt.

First inspect the existing Fashion ERP backend and the completed Phase 00–10 implementation.

The existing codebase is the primary source of truth.

Implement Phase 11 consistently with the existing architecture and preserve compatibility with all previous phases.
