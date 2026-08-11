# Phase 31 — Administration / System Settings

## Fashion ERP Backend

You are implementing **Phase 31 — Administration / System Settings** for the Fashion ERP Backend.

The project is a production-oriented ERP backend built with:

```text
NestJS
TypeScript
MySQL
TypeORM
Redis
BullMQ
Docker
REST API
JWT Authentication
Dynamic RBAC
Data Visibility
Audit Log
Outbox Pattern
Notifications
Reports / Dashboard
Accounting / Double Entry
HR Management
```

The previous phases have already implemented the core ERP architecture.

This phase introduces the centralized:

```text
Administration
System Settings
Configuration Management
Numbering / Naming
Localization
Feature Flags
Security Settings
Maintenance Controls
Integration Configuration
System Audit
```

---

# 1. PRIMARY OBJECTIVE

Build a secure and scalable Administration module that allows authorized administrators to manage system-wide and organization-level configuration.

The module should cover:

```text
31.1 System Settings
31.2 Company Settings
31.3 Branch Settings
31.4 User Preferences
31.5 Localization
31.6 Currency / Exchange Settings
31.7 Date / Time / Timezone
31.8 Numbering / Naming Series
31.9 Document Configuration
31.10 Feature Flags
31.11 Security Settings
31.12 Session Settings
31.13 Password Policy
31.14 Login / Access Policy
31.15 Email / Notification Settings
31.16 File / Storage Settings
31.17 Integration Settings
31.18 API Settings
31.19 Maintenance Mode
31.20 System Health / Information
31.21 Audit Log
31.22 Configuration History
31.23 Data Visibility
31.24 Admin API
31.25 Validation / Tests
```

Do not implement unnecessary configuration simply because it is listed.

Inspect the existing repository first.

---

# 2. FIRST RULE — INSPECT BEFORE IMPLEMENTING

Before changing code:

```text
Inspect existing modules
Inspect existing entities
Inspect existing configuration
Inspect environment handling
Inspect RBAC
Inspect Data Visibility
Inspect Audit Log
Inspect Redis
Inspect BullMQ
Inspect Notification
Inspect Outbox
Inspect Docker configuration
Inspect existing settings
Inspect existing migrations
Inspect existing API conventions
```

Do not create duplicate infrastructure.

Reuse existing services wherever possible.

---

# 3. ADMINISTRATION ARCHITECTURE

Recommended structure:

```text
src/modules/administration/
│
├── system-settings/
├── company-settings/
├── branch-settings/
├── user-preferences/
├── localization/
├── currency/
├── numbering/
├── document-settings/
├── feature-flags/
├── security-settings/
├── session-settings/
├── password-policy/
├── access-policy/
├── notification-settings/
├── storage-settings/
├── integration-settings/
├── api-settings/
├── maintenance/
├── system-info/
├── configuration-history/
└── administration-dashboard/
```

Adapt this structure to the project's existing conventions.

Do not force this exact folder structure.

---

# 4. IMPORTANT DOMAIN SEPARATION

Maintain these distinctions:

```text
System Settings
    ≠
Company Settings

Company Settings
    ≠
Branch Settings

User Preferences
    ≠
Security Policy

Feature Flag
    ≠
Permission

Permission
    ≠
Configuration

Environment Variable
    ≠
Database Setting
```

---

# 5. CONFIGURATION HIERARCHY

The system should support appropriate configuration levels:

```text
GLOBAL
   ↓
COMPANY
   ↓
BRANCH
   ↓
USER
```

Example:

```text
Timezone
Global default
    ↓
Company timezone
    ↓
Branch timezone
    ↓
User preference
```

Do not automatically allow every setting to exist at every level.

Each setting must explicitly define its supported scope.

---

# 6. SYSTEM SETTINGS

Implement centralized system settings.

Examples:

```text
system.name
system.description
system.logo
system.default_language
system.default_timezone
system.default_currency
system.date_format
system.time_format
system.decimal_precision
system.maintenance_mode
```

Use a safe typed configuration model.

Avoid storing everything as arbitrary strings if the value has a known type.

---

# 7. SETTINGS VALUE TYPES

Support appropriate types such as:

```text
STRING
INTEGER
DECIMAL
BOOLEAN
JSON
ENUM
```

If using a generic settings table, include a clear type definition.

Example conceptual structure:

```text
Setting
├── key
├── value
├── valueType
├── scope
├── companyId
├── branchId
├── description
├── isEditable
└── updatedBy
```

Do not blindly copy this schema if an existing settings architecture is already present.

---

# 8. SENSITIVE SETTINGS

Some settings contain secrets.

Examples:

```text
SMTP password
API secret
Webhook secret
OAuth client secret
Payment gateway secret
Storage credentials
```

Rules:

```text
Never return secrets in normal GET responses.
Never expose secrets in logs.
Never expose secrets in error messages.
Never include secrets in audit log payloads.
Never return secrets to frontend after save.
```

Use environment variables / secret management where appropriate.

---

# 9. ENVIRONMENT VARIABLES VS DATABASE SETTINGS

Clearly separate:

### Environment-level configuration

```text
DATABASE_URL
REDIS_URL
JWT_SECRET
SMTP credentials
Storage credentials
External API secrets
```

### Database-managed configuration

```text
Company name
Timezone
Date format
Invoice prefix
Feature flags
Business preferences
```

Do not move security secrets into database settings unnecessarily.

---

# 10. COMPANY SETTINGS

Integrate with the existing Company module.

Possible settings:

```text
company.name
company.legal_name
company.tax_number
company.address
company.phone
company.email
company.website
company.logo
company.default_currency
company.default_timezone
company.default_language
company.fiscal_year_start
```

Only implement fields supported by the actual project.

---

# 11. BRANCH SETTINGS

Integrate with the existing Branch module.

Support branch-level configuration where required:

```text
branch.name
branch.code
branch.address
branch.phone
branch.email
branch.timezone
branch.currency
branch.invoice_prefix
branch.receipt_prefix
```

Respect Company → Branch hierarchy.

---

# 12. USER PREFERENCES

User preferences are different from system settings.

Possible preferences:

```text
language
timezone
dateFormat
timeFormat
currencyDisplay
numberFormat
theme
dashboardLayout
defaultBranch
defaultWarehouse
defaultPageSize
```

Do not store user preferences in the global settings table if a dedicated User Preference model already exists.

---

# 13. LOCALIZATION

Support configurable:

```text
language
locale
date format
time format
number format
currency display
timezone
```

The backend must handle dates consistently.

Avoid server-local timezone assumptions.

---

# 14. TIMEZONE

Store timestamps consistently according to the existing architecture.

Recommended conceptual rule:

```text
Database
    → consistent canonical timestamp

Application
    → timezone-aware conversion

API
    → documented timestamp format

User
    → display timezone
```

Do not introduce inconsistent timezone handling.

---

# 15. CURRENCY

Integrate with the existing currency/accounting architecture.

Support configuration such as:

```text
defaultCurrency
allowedCurrencies
currencyDisplay
decimalPrecision
```

Do not duplicate Currency entities if Phase 09/17 already provides them.

---

# 16. EXCHANGE RATE SETTINGS

If exchange-rate configuration already exists, reuse it.

Administration may control:

```text
exchange rate source
manual/automatic mode
rate update frequency
default rate behavior
```

Do not implement an external exchange-rate provider unless explicitly required.

---

# 17. NUMBERING / NAMING SERIES

Implement configurable document numbering.

ERP documents may require sequences such as:

```text
SO-000001
PO-000001
INV-000001
PAY-000001
GRN-000001
RET-000001
```

Support where appropriate:

```text
documentType
prefix
startingNumber
padding
currentNumber
company
branch
fiscalYear
```

---

# 18. NUMBERING CONCURRENCY

Number generation must be concurrency-safe.

Two simultaneous requests must never generate:

```text
INV-000101
INV-000101
```

Use:

```text
database transaction
row locking
atomic increment
```

or an equivalent safe mechanism.

Do NOT rely on:

```text
SELECT MAX(number)
```

for sequence generation.

---

# 19. NUMBERING SCOPE

Allow appropriate scopes:

```text
GLOBAL
COMPANY
BRANCH
```

Example:

```text
Branch A
INV-000001

Branch B
INV-000001
```

only if the business configuration explicitly permits independent numbering.

---

# 20. DOCUMENT SETTINGS

Create document-level configuration where needed.

Examples:

```text
invoice
sales order
purchase order
payment
receipt
credit note
debit note
stock movement
```

Possible configuration:

```text
numbering series
prefix
default status
approval requirement
print template
email template
```

Do not put business transaction logic inside Administration.

Administration should configure behavior, not replace domain services.

---

# 21. FEATURE FLAGS

Implement feature flags where useful.

Example:

```text
feature.sales_returns
feature.purchase_returns
feature.multi_currency
feature.hr
feature.accounting
feature.notifications
feature.ai
```

Feature flags should support:

```text
enabled
disabled
```

and potentially:

```text
GLOBAL
COMPANY
BRANCH
```

scope where appropriate.

---

# 22. FEATURE FLAG VS PERMISSION

Important:

```text
Feature Flag
    =
Is the feature available?

Permission
    =
Can this user perform this action?
```

Example:

```text
feature.accounting = enabled

User permission:
accounting.journal.create = false
```

The user still cannot create journals.

Both checks may be required.

---

# 23. FEATURE FLAG SAFETY

Do not use feature flags as the only security mechanism.

Never implement:

```text
if featureEnabled:
    allow everything
```

Authorization must still pass through:

```text
Authentication
Permission
Data Visibility
Business Rules
```

---

# 24. SECURITY SETTINGS

Implement configurable security policies where appropriate.

Examples:

```text
login attempt limit
account lock duration
session timeout
password expiry
password minimum length
password complexity
refresh token lifetime
```

Do not store security secrets as normal editable settings.

---

# 25. PASSWORD POLICY

Support configurable policies such as:

```text
minimum length
require uppercase
require lowercase
require number
require special character
password history
password expiry
```

Do not force complex policies unless required.

---

# 26. LOGIN / ACCESS POLICY

Possible settings:

```text
max login attempts
lockout duration
session timeout
refresh token expiry
concurrent session limit
```

Integrate with existing Authentication architecture.

Do not duplicate authentication logic.

---

# 27. SESSION MANAGEMENT

If the current authentication architecture supports sessions/tokens:

Implement administrative capabilities where appropriate:

```text
view active sessions
revoke session
revoke all user sessions
force logout
```

All actions must be permission-protected and audited.

Do not expose token secrets.

---

# 28. ADMIN USER MANAGEMENT

Do not create a second User Management system.

Administration should reuse:

```text
Phase 08 — User / Employee / Account Management
Phase 06 — Dynamic RBAC + Data Visibility
```

Administration may provide administrative operations such as:

```text
activate user
deactivate user
force logout
reset security state
assign authorized settings
```

only through existing services.

---

# 29. NOTIFICATION SETTINGS

Integrate with Phase 21.

Support configuration such as:

```text
email enabled
push enabled
in-app enabled
notification categories
```

Do not store provider secrets in plain database settings.

---

# 30. EMAIL SETTINGS

If email provider configuration is database-managed:

```text
provider
host
port
username
fromAddress
fromName
```

Secret values must be protected.

Prefer environment/secret manager for:

```text
SMTP password
API keys
```

---

# 31. STORAGE SETTINGS

Support configuration for storage behavior where required:

```text
provider
max file size
allowed file types
image size limits
```

Do not expose storage credentials.

Integrate with the existing file/storage architecture.

---

# 32. INTEGRATION SETTINGS

Provide administrative configuration for external integrations.

Examples:

```text
payment gateway
email provider
SMS provider
shipping provider
webhook endpoint
third-party ERP
```

Each integration should have:

```text
enabled
configuration
status
last tested
```

Secrets must be protected.

---

# 33. INTEGRATION TEST CONNECTION

If integrations support connection testing:

```text
POST /administration/integrations/:id/test
```

The endpoint must:

```text
authenticate
authorize
validate
execute safely
avoid exposing secrets
audit result
```

Do not allow arbitrary URL fetching from user input.

Prevent SSRF vulnerabilities.

---

# 34. WEBHOOK SETTINGS

If webhook configuration exists:

Support:

```text
endpoint
event types
enabled
retry policy
```

Secrets/signing keys must be protected.

Use Outbox/BullMQ architecture for reliable delivery where appropriate.

---

# 35. API SETTINGS

Administration may expose safe API configuration such as:

```text
API version
request limits
pagination max size
default page size
```

Do not allow administrators to dynamically modify dangerous infrastructure settings without strong safeguards.

---

# 36. RATE LIMIT SETTINGS

Integrate with the existing API Security phase.

Potential settings:

```text
login rate limit
API rate limit
burst limit
window duration
```

Do not implement a second rate limiter if one already exists.

---

# 37. MAINTENANCE MODE

Implement controlled maintenance mode.

Concept:

```text
Normal
   ↓
Maintenance Mode
```

When enabled:

```text
Normal users
    → blocked or limited

Administrators
    → optionally allowed
```

Do not lock administrators out accidentally.

---

# 38. MAINTENANCE MODE SAFETY

Maintenance mode must support:

```text
enabled
message
startAt
endAt
allowAdmin
```

where appropriate.

The enforcement should happen through a centralized guard/middleware/interceptor.

Do not add maintenance checks manually to every controller.

---

# 39. SYSTEM INFORMATION

Provide safe system information for authorized administrators.

Examples:

```text
application version
API version
environment
database status
Redis status
BullMQ status
uptime
server time
timezone
```

Do NOT expose:

```text
database password
JWT secret
Redis password
API secrets
environment variables
filesystem secrets
```

---

# 40. HEALTH CHECK

Reuse existing health-check infrastructure if available.

Administration may provide a summarized status:

```text
Database
Redis
Queue
Storage
External services
```

Do not duplicate health logic.

---

# 41. CONFIGURATION CACHE

If settings are frequently accessed:

```text
Database
    ↓
Configuration Service
    ↓
Redis Cache
```

Use Redis where appropriate.

Do not cache everything blindly.

---

# 42. CACHE INVALIDATION

When an administrator changes a setting:

```text
Update DB
    ↓
Commit transaction
    ↓
Invalidate/update cache
    ↓
Publish event if required
```

Never allow stale security-critical settings to remain cached indefinitely.

---

# 43. CONFIGURATION HISTORY

Track important configuration changes.

Example:

```text
Setting
Old Value
New Value
Changed By
Changed At
Scope
Reason
```

Sensitive values must be masked.

Example:

```text
SMTP_PASSWORD
old: ********
new: ********
```

Never store actual secrets in audit history.

---

# 44. AUDIT LOG

Reuse existing Audit Log.

Audit:

```text
system setting changed
company setting changed
branch setting changed
security policy changed
feature flag changed
numbering changed
maintenance mode changed
integration enabled/disabled
session revoked
admin action
```

Do not duplicate Audit Log infrastructure.

---

# 45. DATA VISIBILITY

Administration must integrate with Dynamic RBAC + Data Visibility.

Example:

```text
Super Admin
    → Global configuration

Company Admin
    → Company configuration

Branch Admin
    → Branch configuration

Normal User
    → User preferences only
```

These are examples.

Do not hardcode role names.

Use:

```text
User
+
Role
+
Permission
+
Scope
```

---

# 46. CRITICAL SECURITY RULE

Never authorize Administration actions using:

```text
if user.role === 'admin'
```

Use the existing permission system.

Example permissions:

```text
admin.settings.read
admin.settings.create
admin.settings.update
admin.settings.delete

admin.security.read
admin.security.update

admin.feature_flag.read
admin.feature_flag.update

admin.numbering.read
admin.numbering.update

admin.maintenance.read
admin.maintenance.update

admin.integration.read
admin.integration.update
admin.integration.test

admin.sessions.read
admin.sessions.revoke
```

Use the project's actual permission naming convention.

---

# 47. PROTECTED SETTINGS

Some settings should be immutable or restricted.

Examples:

```text
database configuration
JWT secret
encryption keys
root infrastructure configuration
```

These should remain environment/secret-manager controlled.

Do not expose them through Administration APIs.

---

# 48. CONFIGURATION VALIDATION

Every setting must have validation.

Examples:

```text
integer → valid range
decimal → valid precision
enum → allowed values
timezone → valid timezone
currency → valid currency
email → valid email
URL → valid URL
duration → valid duration
```

Reject invalid configuration before saving.

---

# 49. API DESIGN

Follow existing API conventions.

Possible endpoints:

```text
GET    /admin/settings
GET    /admin/settings/:key
PATCH  /admin/settings/:key

GET    /admin/company-settings
PATCH  /admin/company-settings

GET    /admin/branch-settings
PATCH  /admin/branch-settings

GET    /admin/user-preferences
PATCH  /admin/user-preferences

GET    /admin/feature-flags
PATCH  /admin/feature-flags/:key

GET    /admin/numbering
POST   /admin/numbering
PATCH  /admin/numbering/:id

GET    /admin/security-settings
PATCH  /admin/security-settings

GET    /admin/integrations
PATCH  /admin/integrations/:id
POST   /admin/integrations/:id/test

GET    /admin/sessions
POST   /admin/sessions/:id/revoke

GET    /admin/system-info
GET    /admin/health

GET    /admin/configuration-history

GET    /admin/maintenance
PATCH  /admin/maintenance
```

Use the project's actual route naming convention.

---

# 50. API RESPONSE SECURITY

Never return:

```text
password
JWT secret
refresh token
API secret
SMTP password
database password
encryption key
storage secret
webhook signing secret
```

Mask sensitive fields.

---

# 51. TRANSACTIONS

Use transactions where configuration changes involve multiple records.

Examples:

```text
Numbering configuration
Feature flag + related configuration
Company settings + dependent records
Security policy updates
```

Do not use transactions unnecessarily.

---

# 52. CONCURRENCY

Test:

```text
Two admins update same setting
Two admins update numbering sequence
Two admins enable/disable feature
Two admins change maintenance mode
```

Use optimistic locking or appropriate concurrency controls where necessary.

---

# 53. OPTIMISTIC LOCKING

For high-value configuration, consider:

```text
version
updatedAt
optimistic locking
```

to prevent silent overwrites.

Example:

```text
Admin A reads version 5
Admin B reads version 5

Admin A updates → version 6

Admin B updates version 5
    ↓
Reject conflict
```

Do not silently overwrite Admin A's changes.

---

# 54. FEATURE FLAG CACHE

If feature flags are cached:

```text
Admin changes flag
    ↓
DB transaction
    ↓
Cache invalidation
    ↓
New requests use new value
```

Ensure consistency.

---

# 55. NUMBERING SERVICE

The numbering service must be reusable by:

```text
Sales
Purchase
Payment
Inventory
Accounting
HR
```

Do not create separate numbering logic inside each module.

If a shared numbering service already exists, extend it.

---

# 56. ADMIN DASHBOARD

Provide safe summary metrics:

```text
Active Users
Active Companies
Active Branches
Enabled Features
Pending Configuration Changes
Active Sessions
System Health
Queue Health
```

Respect Data Visibility.

Do not make dashboard queries unnecessarily expensive.

---

# 57. ADMIN SEARCH

Provide appropriate filtering/search for:

```text
settings
feature flags
numbering
integrations
configuration history
sessions
```

Use pagination.

---

# 58. TESTING

Create:

```text
Unit Tests
Integration Tests
E2E Tests
Authorization Tests
Data Visibility Tests
Security Tests
Concurrency Tests
```

Critical tests:

```text
Admin can update authorized setting
Unauthorized user cannot update setting
Company admin cannot update another company
Branch admin cannot update another branch
Secrets are never returned
Secrets are never logged
Feature flag authorization
Numbering concurrency
Maintenance mode
Session revoke
Configuration history
Audit Log
```

---

# 59. SECURITY TESTING

Test for:

```text
BOLA
IDOR
Privilege Escalation
Mass Assignment
Secret Exposure
SSRF
Injection
Unauthorized Configuration Access
Cross-company Access
Cross-branch Access
```

Especially test:

```text
PATCH /admin/settings/:key
PATCH /admin/company-settings
PATCH /admin/branch-settings
PATCH /admin/security-settings
POST /admin/integrations/:id/test
PATCH /admin/maintenance
```

---

# 60. MASS ASSIGNMENT PROTECTION

Do not allow clients to submit arbitrary protected fields.

For example, reject/ignore unauthorized attempts to modify:

```text
scope
companyId
branchId
createdBy
updatedBy
role
permission
security level
```

unless explicitly permitted.

---

# 61. BRUNO API TESTING

Update the Bruno collection.

Create folders:

```text
Administration
├── System Settings
├── Company Settings
├── Branch Settings
├── User Preferences
├── Feature Flags
├── Numbering
├── Security
├── Sessions
├── Integrations
├── Maintenance
├── System Info
└── Configuration History
```

Include:

```text
happy path
unauthorized
forbidden
wrong company
wrong branch
invalid values
secret exposure tests
concurrency scenarios
```

---

# 62. REDIS

Use Redis for:

```text
settings cache
feature flag cache
session state where applicable
short-lived locks
```

Do not use Redis as the source of truth for persistent configuration.

MySQL remains the persistent source of truth unless the architecture explicitly says otherwise.

---

# 63. BULLMQ

Use BullMQ where appropriate:

```text
configuration-related notifications
integration testing jobs if asynchronous
maintenance tasks
scheduled configuration checks
```

Do not move simple synchronous CRUD into BullMQ unnecessarily.

---

# 64. OUTBOX

Use the existing Outbox Pattern for important configuration events.

Examples:

```text
SettingChanged
FeatureFlagChanged
NumberingChanged
MaintenanceModeChanged
IntegrationStatusChanged
SecurityPolicyChanged
```

Only publish meaningful domain events.

---

# 65. API SECURITY

Administration endpoints must integrate with Phase 23.

Ensure:

```text
authentication
authorization
rate limiting
input validation
security headers
audit logging
```

are consistent with the existing system.

---

# 66. OBSERVABILITY

Integrate with Phase 27.

Important events:

```text
admin setting changes
security setting changes
feature flag changes
maintenance mode
integration test failures
session revocations
```

Logs must not contain secrets.

---

# 67. PERFORMANCE

Review:

```text
settings lookup
feature flag lookup
number generation
admin dashboard
configuration history
system health
```

Avoid:

```text
N+1 queries
full-table scans
unbounded history queries
repeated database configuration reads
```

---

# 68. DATABASE INDEXES

Add appropriate indexes for:

```text
setting key
scope
companyId
branchId
feature flag key
numbering documentType
numbering companyId
numbering branchId
configuration history settingId
configuration history changedAt
session userId
session status
```

Do not create indexes blindly.

---

# 69. MIGRATIONS

Create proper TypeORM migrations.

Do not use destructive schema changes without verifying existing data.

Before migration:

```text
inspect existing schema
inspect existing data
inspect existing migrations
```

---

# 70. DOCUMENTATION

Create/update:

```text
docs/administration/
```

Recommended:

```text
architecture.md
settings.md
numbering.md
feature-flags.md
security.md
maintenance.md
integrations.md
permissions.md
data-visibility.md
api.md
```

Document actual implemented behavior.

Do not document features that do not exist.

---

# 71. IMPLEMENTATION RULE

Do not blindly implement every item.

First determine:

```text
Already implemented?
Partially implemented?
Missing?
Required?
Optional?
Future?
```

Then integrate with the existing architecture.

---

# 72. FINAL VERIFICATION

Run the actual project commands for:

```text
lint
typecheck
unit tests
integration tests
e2e tests
Bruno tests
build
database migration verification
Docker build
```

Do not invent commands.

If something fails:

```text
identify root cause
fix it
rerun
report accurately
```

Never claim success without verification.

---

# 73. FINAL REPORT

After implementation provide:

## A. Implemented Features

Only list features actually implemented.

## B. Files Created

List actual files.

## C. Files Modified

List actual files.

## D. Database Changes

Report:

```text
entities
migrations
indexes
constraints
```

## E. API Endpoints

List actual endpoints.

## F. Permissions

List actual permissions.

## G. Configuration Scopes

Explain:

```text
Global
Company
Branch
User
```

and which settings support each scope.

## H. Security

Explain:

```text
secret protection
authorization
BOLA/IDOR protection
mass assignment protection
audit logging
```

## I. Tests

Report actual:

```text
Passed
Failed
Skipped
```

## J. Remaining Work

Clearly separate:

```text
Required
Optional
Future
```

---

# 74. COMPLETION CHECKLIST

Phase 31 is complete only when applicable items are verified:

```text
[ ] System Settings
[ ] Company Settings
[ ] Branch Settings
[ ] User Preferences
[ ] Localization
[ ] Timezone
[ ] Currency Integration
[ ] Numbering / Naming Series
[ ] Document Configuration
[ ] Feature Flags
[ ] Security Settings
[ ] Password Policy
[ ] Login / Access Policy
[ ] Session Management
[ ] Notification Settings
[ ] Storage Settings
[ ] Integration Settings
[ ] API Settings
[ ] Maintenance Mode
[ ] System Information
[ ] Health Integration
[ ] Configuration History
[ ] Dynamic RBAC Integration
[ ] Data Visibility Integration
[ ] Audit Log Integration
[ ] Redis Integration where required
[ ] BullMQ Integration where required
[ ] Outbox Integration where required
[ ] Bruno Collection
[ ] Unit Tests
[ ] Integration Tests
[ ] E2E Tests
[ ] Security Tests
[ ] Concurrency Tests
[ ] Documentation
[ ] Docker Build
[ ] Production Build
```

---

# 75. FINAL ARCHITECTURE PRINCIPLE

Administration must become the **control plane of the ERP**, not another business domain that duplicates existing modules.

Target architecture:

```text
                         ┌──────────────────────┐
                         │   Administration     │
                         │                      │
                         │ System Settings      │
                         │ Company Settings     │
                         │ Branch Settings      │
                         │ User Preferences     │
                         │ Feature Flags        │
                         │ Security Policy      │
                         │ Numbering            │
                         │ Integrations         │
                         │ Maintenance          │
                         └──────────┬───────────┘
                                    │
                     ┌──────────────┼──────────────┐
                     ▼              ▼              ▼
                 Dynamic RBAC   Data Visibility   Audit Log
                     │              │              │
                     └──────────────┼──────────────┘
                                    ▼
                         ┌──────────────────────┐
                         │      ERP Domains     │
                         │                      │
                         │ Sales                │
                         │ Purchase             │
                         │ Inventory            │
                         │ Accounting            │
                         │ Payment              │
                         │ HR                   │
                         │ POS                  │
                         └──────────────────────┘
```

The final design must preserve:

```text
Security
Scalability
Multi-company
Multi-branch
Dynamic RBAC
Data Visibility
Auditability
Configuration History
Concurrency Safety
Maintainability
Production Reliability
```

**Inspect first. Reuse existing infrastructure. Implement second. Test third. Verify everything.**

Do not create duplicate systems for Auth, User, RBAC, Data Visibility, Audit Log, Notification, Redis, BullMQ, Outbox, Company, Branch, Currency, or Accounting if they already exist.
