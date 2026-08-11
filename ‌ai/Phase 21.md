# Phase 21 — Notifications

## Fashion ERP Backend

## Production-Ready Implementation Prompt

You are implementing **Phase 21 — Notifications** of the Fashion ERP Backend.

The project is a production-oriented Fashion ERP/POS backend.

---

# 1. TECH STACK

Use the existing project stack:

* NestJS
* TypeScript
* MySQL
* TypeORM
* Redis
* BullMQ
* Docker
* REST API
* Bruno
* JWT Authentication
* Dynamic RBAC
* Data Visibility
* Audit Log
* Outbox Pattern

Do not introduce a different backend framework, ORM, database, or queue system.

---

# 2. COMPLETED PHASES

The following phases are already completed:

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
```

Do not unnecessarily rewrite completed phases.

The existing repository is the primary source of truth.

---

# 3. PHASE 21 OBJECTIVE

Build a production-ready ERP Notification System.

The system must support:

```text
In-App Notifications
Email Notifications
Push Notifications
Notification Templates
Notification Preferences
Read / Unread
Notification Categories
Notification Priority
Notification Delivery Status
Notification Retry
Notification Idempotency
Notification Data Visibility
Company / Branch Scope
User Preferences
Auditability
BullMQ Integration
Outbox Integration
```

The architecture must support future notification channels without rewriting the core notification domain.

---

# 4. CORE ARCHITECTURE

The target architecture is:

```text
Business Event
      │
      ▼
MySQL Transaction
      │
      ▼
Outbox Event
      │
    COMMIT
      │
      ▼
Outbox Publisher
      │
      ▼
BullMQ
      │
      ▼
Notification Worker
      │
      ├───────────────┐
      │               │
      ▼               ▼
In-App            Email / Push
Notification       Provider
      │
      ▼
MySQL
```

Important:

```text
MySQL = Source of Truth
Outbox = Durable Event Source
BullMQ = Async Processing
Redis = Queue / Temporary Infrastructure
Notification = Business Domain
```

Do not treat Redis or BullMQ as the permanent notification database.

---

# 5. FIRST STEP — INSPECT THE REPOSITORY

Before implementing anything, inspect the actual repository.

Search for:

```text
notification
notifications
Notification
email
mail
smtp
push
firebase
fcm
device
template
preference
preference
outbox
BullMQ
queue
worker
Redis
user
employee
company
branch
audit
```

Inspect:

```text
src/
modules/
common/
config/
database/
outbox/
redis/
queues/
workers/
users/
employees/
sales/
purchase/
inventory/
payment/
accounting/
docker/
tests/
bruno/
```

Determine:

1. Does a notification entity already exist?
2. Does a notification module already exist?
3. Does an email service already exist?
4. Does an SMTP provider already exist?
5. Does a push provider already exist?
6. Does Firebase/FCM already exist?
7. Does device token storage already exist?
8. Does BullMQ notification queue already exist?
9. Does Outbox already support notification events?
10. Does Audit Log already exist?
11. Does User Preference infrastructure already exist?
12. Does Data Visibility already exist?
13. Does Company / Branch scope already exist?

Reuse existing infrastructure where appropriate.

Do not create duplicate implementations.

---

# 6. NOTIFICATION DOMAIN

The notification domain should be independent from individual business modules.

Do not implement notification logic directly inside:

```text
SalesService
PurchaseService
InventoryService
PaymentService
AccountingService
```

Instead:

```text
Sales
  ↓
Domain Event / Outbox
  ↓
Notification Service
```

This prevents tight coupling.

---

# 7. NOTIFICATION ENTITY

Design a durable notification record.

Conceptually:

```text
Notification
├── id
├── userId
├── companyId
├── branchId
├── type
├── category
├── title
├── message
├── priority
├── status
├── isRead
├── readAt
├── entityType
├── entityId
├── eventId
├── metadata
├── createdAt
├── updatedAt
```

Adapt field names and types to the existing database architecture.

Do not blindly copy this schema.

---

# 8. IMPORTANT ENTITY PRINCIPLE

A notification should reference the business object when appropriate.

Example:

```text
entityType = Sale
entityId   = saleId
```

or:

```text
entityType = Payment
entityId   = paymentId
```

This allows the frontend to navigate to the relevant screen.

Example:

```text
Notification
    ↓
Sale #SO-000123
    ↓
Frontend opens Sale Detail
```

---

# 9. NOTIFICATION TYPES

Create a consistent notification type system.

Potential examples:

```text
SALE_CREATED
SALE_CONFIRMED
SALE_CANCELLED

PURCHASE_CREATED
PURCHASE_RECEIVED
PURCHASE_CANCELLED

PAYMENT_RECEIVED
PAYMENT_FAILED

INVENTORY_LOW_STOCK
INVENTORY_ADJUSTED
INVENTORY_TRANSFERRED

CUSTOMER_CREATED
SUPPLIER_CREATED

APPROVAL_REQUIRED
APPROVAL_APPROVED
APPROVAL_REJECTED

USER_CREATED
USER_DISABLED

SYSTEM_ALERT
SECURITY_ALERT
```

Only implement types supported by actual business functionality.

Do not create meaningless notification types.

---

# 10. NOTIFICATION CATEGORY

Separate notification category from notification type.

Example:

```text
SALES
PURCHASE
INVENTORY
PAYMENT
ACCOUNTING
HR
SECURITY
SYSTEM
APPROVAL
```

This allows users to configure preferences by category.

---

# 11. PRIORITY

Support:

```text
LOW
NORMAL
HIGH
CRITICAL
```

Example:

```text
Low:
routine information

Normal:
normal ERP activity

High:
approval required
important payment notification

Critical:
security/system failure
```

Do not abuse CRITICAL priority.

---

# 12. NOTIFICATION STATUS

Support a clear lifecycle.

Potential:

```text
PENDING
PROCESSING
SENT
DELIVERED
FAILED
READ
```

However, do not confuse:

```text
delivery status
```

with:

```text
read status
```

A notification can be:

```text
delivered = true
read = false
```

Therefore model these concepts separately when necessary.

---

# 13. READ / UNREAD

Support:

```text
isRead
readAt
```

Endpoints should include:

```text
GET    /notifications
GET    /notifications/unread-count
PATCH  /notifications/:id/read
PATCH  /notifications/read-all
```

Use actual project API naming conventions.

---

# 14. READ OWN NOTIFICATIONS ONLY

Normal users must only access notifications belonging to themselves.

Example:

```text
User A
 ↓
GET /notifications
```

must never return:

```text
User B notifications
```

Enforce this at the backend.

Do not trust frontend filtering.

---

# 15. DATA VISIBILITY

Integrate Phase 06 Data Visibility.

Notification visibility must respect:

```text
User
Company
Branch
Warehouse
Role
Permission
```

depending on the notification type.

Example:

```text
Sale Staff
    ↓
only notifications related to allowed sales/accounts
```

Manager:

```text
Sale Manager
    ↓
branch/company notifications
```

Super Admin:

```text
Super Admin
    ↓
system/company-wide notifications
```

Do not simply return every notification in the database.

---

# 16. SALES ACCOUNT VISIBILITY

The existing ERP requirement is:

```text
Sales Staff
```

should see only sales/accounts they are allowed to see.

Therefore notifications must respect the same visibility rules.

Example:

```text
Sale #SO-001
Sales Account = Account A
Sales Staff = User A
```

User A:

```text
can receive notification
```

User B:

```text
must not receive it
```

unless Data Visibility grants access.

Do not implement notification visibility independently from Phase 06.

Reuse the existing visibility service/policy.

---

# 17. COMPANY SCOPE

Notifications must support company scope.

Example:

```text
Company A
    ↓
Notification A

Company B
    ↓
Notification B
```

Company A users must not see Company B notifications.

---

# 18. BRANCH SCOPE

Where business logic requires branch-level visibility:

```text
Branch A
Branch B
```

must remain isolated.

A Branch A user should not receive Branch B operational notifications unless their visibility policy permits it.

---

# 19. WAREHOUSE SCOPE

For inventory notifications:

```text
Low Stock
Stock Transfer
Inventory Adjustment
Stock Receipt
```

consider:

```text
Warehouse Scope
```

Example:

```text
Warehouse A low stock
```

should not automatically notify every warehouse user.

---

# 20. NOTIFICATION RECIPIENT RESOLUTION

Do not hard-code:

```text
notifyUserId = currentUser
```

for every event.

Some notifications have multiple recipients.

Example:

```text
Approval Required
```

may notify:

```text
Manager
Supervisor
Authorized Approver
```

Recipient resolution should be handled by a dedicated service.

Conceptually:

```text
Event
 ↓
RecipientResolver
 ↓
User IDs
 ↓
Notification Service
```

---

# 21. RECIPIENT RESOLVER

Create a reusable abstraction.

Example:

```text
NotificationRecipientResolver
```

Responsibilities:

```text
Determine who should receive notification
Apply company scope
Apply branch scope
Apply role/permission rules
Apply data visibility
Remove inactive users
Remove duplicate recipients
```

---

# 22. INACTIVE USERS

Do not send notifications to:

```text
disabled users
deleted users
inactive accounts
```

unless there is an explicit business reason.

---

# 23. DUPLICATE RECIPIENTS

If a user qualifies through multiple rules:

```text
Manager
+
Branch Manager
+
Approver
```

the same user should receive one logical notification, not three duplicates.

Deduplicate recipients by:

```text
userId
```

---

# 24. NOTIFICATION PREFERENCES

Users should be able to configure notification preferences.

Potential:

```text
NotificationPreference
├── id
├── userId
├── category
├── notificationType
├── inAppEnabled
├── emailEnabled
├── pushEnabled
├── createdAt
├── updatedAt
```

Adapt to the actual project.

---

# 25. DEFAULT PREFERENCES

Do not require admins to manually create preference rows for every user.

Use defaults.

Example:

```text
No preference row
      ↓
Use system default
```

If user changes preference:

```text
Explicit preference
      ↓
Overrides default
```

---

# 26. PREFERENCE HIERARCHY

Define clear precedence.

Recommended:

```text
System Policy
      ↓
Company Policy
      ↓
User Preference
```

However, if security/critical notifications cannot be disabled, enforce that explicitly.

Example:

```text
SECURITY_ALERT
```

may always require in-app delivery.

---

# 27. CRITICAL NOTIFICATIONS

Some notifications must not be silently disabled.

Examples:

```text
Security Alert
Account Disabled
Critical System Alert
Payment Failure
```

Determine which are mandatory from actual business requirements.

Do not make every notification mandatory.

---

# 28. CHANNELS

Design notification channels:

```text
IN_APP
EMAIL
PUSH
```

Future-compatible:

```text
SMS
WHATSAPP
```

Do not implement future channels unless required.

The core domain should be extensible.

---

# 29. CHANNEL ADAPTER PATTERN

Use an abstraction such as:

```text
NotificationChannel
```

Conceptually:

```text
NotificationService
       │
       ├── InAppChannel
       ├── EmailChannel
       └── PushChannel
```

This prevents the notification service from becoming a huge conditional statement.

Avoid:

```typescript
if (channel === 'EMAIL') {}
else if (channel === 'PUSH') {}
else if (channel === 'IN_APP') {}
```

spread across the entire application.

Centralize channel strategy.

---

# 30. IN-APP CHANNEL

In-app notification must be stored in MySQL.

Example:

```text
Business Event
   ↓
Notification
   ↓
MySQL
   ↓
Frontend GET /notifications
```

MySQL remains the source of truth.

Redis can be used for real-time delivery, but must not replace durable storage.

---

# 31. REAL-TIME NOTIFICATION

If the project already supports WebSocket infrastructure, integrate with it.

Potential:

```text
MySQL Notification
       ↓
BullMQ
       ↓
Worker
       ↓
WebSocket Gateway
       ↓
Frontend
```

Frontend receives:

```text
new notification
```

without refreshing.

If WebSocket is not implemented yet, keep a clean integration point.

Do not introduce a completely separate realtime architecture unnecessarily.

---

# 32. WEBSOCKET RULE

Real-time delivery is an optimization.

If WebSocket delivery fails:

```text
Notification record
```

must still exist in MySQL.

The user can later retrieve it through:

```text
GET /notifications
```

Therefore:

```text
WebSocket = realtime transport
MySQL = durable notification
```

---

# 33. EMAIL CHANNEL

Email should be asynchronous.

Flow:

```text
Business Event
 ↓
Notification
 ↓
BullMQ
 ↓
Email Worker
 ↓
Email Provider
```

Never block a Sale/Purchase API request waiting for SMTP.

---

# 34. EMAIL PROVIDER

Inspect whether the project already has:

```text
SMTP
Resend
SendGrid
SES
Mailgun
```

or another provider.

Reuse existing configuration if available.

Do not hard-code credentials.

---

# 35. EMAIL TEMPLATE

Do not hard-code large email HTML inside business services.

Use a template system.

Conceptually:

```text
EmailTemplate
├── key
├── subject
├── body
├── variables
├── version
├── isActive
```

Only implement database-backed templates if the project requires runtime template management.

Otherwise a code/template-file strategy is acceptable.

---

# 36. TEMPLATE VARIABLES

Example:

```text
sale.confirmed
```

may support:

```text
{{customerName}}
{{saleNumber}}
{{totalAmount}}
{{branchName}}
```

Validate variables.

Do not allow arbitrary server-side code execution through templates.

---

# 37. TEMPLATE SECURITY

Do not evaluate arbitrary JavaScript from notification templates.

Templates must be data only.

Never allow:

```text
eval()
new Function()
```

for template rendering.

---

# 38. PUSH NOTIFICATIONS

If push notification support is required, support device tokens.

Conceptually:

```text
User
 ↓
DeviceToken
 ├── id
 ├── userId
 ├── token
 ├── platform
 ├── deviceId
 ├── isActive
 ├── lastUsedAt
 └── createdAt
```

Adapt to the project's actual architecture.

---

# 39. DEVICE TOKEN SECURITY

Treat device tokens as sensitive infrastructure data.

Do not expose all user device tokens through APIs.

Normal users should only manage their own devices.

Admins should not see raw tokens unless explicitly required.

---

# 40. DEVICE TOKEN LIFECYCLE

Support:

```text
register
refresh
deactivate
logout
invalid token cleanup
```

If the push provider reports an invalid token:

```text
mark inactive
```

Do not retry invalid tokens forever.

---

# 41. PUSH PROVIDER

Inspect the frontend/mobile architecture.

If Flutter/mobile push infrastructure exists, integrate with the project's chosen provider.

Do not invent a provider without checking existing implementation.

Potential:

```text
Firebase Cloud Messaging
```

if appropriate.

---

# 42. PUSH FAILURE HANDLING

Classify:

```text
temporary provider failure
rate limit
invalid token
permanent failure
```

Temporary:

```text
retry
```

Invalid token:

```text
deactivate token
```

Permanent:

```text
mark failed
```

---

# 43. NOTIFICATION DELIVERY RECORD

For multi-channel delivery, consider a durable delivery record.

Conceptually:

```text
NotificationDelivery
├── id
├── notificationId
├── channel
├── status
├── attempts
├── providerMessageId
├── lastError
├── sentAt
├── deliveredAt
└── createdAt
```

This is useful when:

```text
In-App = delivered
Email = failed
Push = delivered
```

must be represented independently.

Do not add excessive complexity if the current project only requires in-app notifications.

---

# 44. DELIVERY VS NOTIFICATION

Separate:

```text
Notification
```

from:

```text
Notification Delivery
```

Conceptually:

```text
Notification
     │
     ├── In-App Delivery
     ├── Email Delivery
     └── Push Delivery
```

This allows each channel to have independent retry/state.

---

# 45. IDEMPOTENCY

Notification processing must be idempotent.

Example:

```text
eventId = abc
userId = 123
notificationType = SALE_CONFIRMED
```

should not create duplicate logical notifications if the same event is processed twice.

Use a durable uniqueness strategy where appropriate.

Potential unique key:

```text
eventId + userId + notificationType
```

But only use this exact combination if business semantics support it.

---

# 46. BULLMQ RETRY

Notification jobs should support:

```text
attempts
backoff
timeout
failed jobs
```

Reuse Phase 20 infrastructure.

Do not create a second retry framework.

---

# 47. QUEUE STRUCTURE

Use the Phase 20 queue architecture.

Potential:

```text
erp.notification
erp.email
erp.push
```

Only create separate queues where workload isolation is useful.

---

# 48. QUEUE PRIORITY

Example:

```text
Critical notification
High priority

Normal notification
Normal priority

Bulk notification
Low priority
```

Do not allow bulk notifications to starve critical notifications.

---

# 49. BULK NOTIFICATIONS

Support bulk notification scenarios carefully.

Example:

```text
Company-wide announcement
```

Do not create:

```text
100,000 jobs
```

without considering queue/database load.

Use batching where appropriate.

---

# 50. BULK RECIPIENT PROCESSING

For large recipient sets:

```text
query users
 ↓
batch 500 / 1000
 ↓
enqueue jobs
```

Do not load hundreds of thousands of users into memory.

---

# 51. RATE LIMITING

Notification channels may have rate limits.

Consider:

```text
Email provider
Push provider
WebSocket
```

Use BullMQ concurrency/limiter according to provider requirements.

---

# 52. NOTIFICATION API

Implement appropriate endpoints.

Potential:

```text
GET    /notifications
GET    /notifications/:id
GET    /notifications/unread-count

PATCH  /notifications/:id/read
PATCH  /notifications/read-all

DELETE /notifications/:id
```

Only implement delete if business requirements permit it.

---

# 53. USER NOTIFICATION API

Normal users should only operate on their own notifications.

Example:

```text
PATCH /notifications/:id/read
```

must verify:

```text
notification.userId === currentUser.id
```

unless the user has an explicit admin permission.

---

# 54. ADMIN NOTIFICATION API

If admin functionality is required, separate it.

Potential:

```text
POST /admin/notifications/broadcast
GET  /admin/notifications
```

Protect with Dynamic RBAC.

Do not give all managers broadcast permission automatically.

---

# 55. BROADCAST NOTIFICATIONS

If broadcast exists:

```text
Super Admin
    ↓
Company
    ↓
Branch
    ↓
Target users
```

must respect:

```text
company scope
branch scope
role
permission
```

Do not allow a Branch Manager to broadcast to another company.

---

# 56. NOTIFICATION PERMISSIONS

Potential permissions:

```text
notification.read
notification.read_all
notification.mark_read
notification.delete
notification.manage_preferences
notification.broadcast
notification.manage_templates
notification.view_delivery
```

Use the existing Dynamic RBAC system.

Do not hard-code role names.

---

# 57. SUPER ADMIN

Super Admin may have broad notification administration.

But even Super Admin operations should be audited.

Example:

```text
broadcast notification
delete notification
change template
retry notification
```

---

# 58. AUDIT LOG

Audit important administrative actions.

Examples:

```text
notification.broadcast
notification.template.created
notification.template.updated
notification.template.deleted
notification.preference.updated
notification.delivery.retried
notification.deleted
```

Do not create audit entries for every read operation unless required.

---

# 59. NOTIFICATION RETENTION

Define a retention strategy.

Do not keep millions of notifications forever.

But do not automatically delete financial/audit records because they are notifications.

Potential:

```text
old notifications
→ archive/delete
```

while:

```text
audit logs
financial records
accounting records
inventory ledger
```

remain governed by their own retention rules.

---

# 60. NOTIFICATION CLEANUP

Use BullMQ scheduled jobs where appropriate.

Example:

```text
daily notification cleanup
```

Only delete notifications according to configured retention policy.

Do not hard-code a dangerous deletion period.

---

# 61. USER EXPERIENCE

Frontend should be able to retrieve:

```text
latest notifications
unread count
read state
notification type
category
priority
timestamp
target entity
```

Example response concept:

```json
{
  "id": "uuid",
  "type": "SALE_CONFIRMED",
  "category": "SALES",
  "title": "Sale Confirmed",
  "message": "Sale SO-001 has been confirmed.",
  "priority": "NORMAL",
  "isRead": false,
  "entityType": "SALE",
  "entityId": "uuid",
  "createdAt": "..."
}
```

Follow the project's response DTO conventions.

---

# 62. PAGINATION

Notification list must be paginated.

Do not return:

```text
all notifications
```

Use the project's standard pagination mechanism.

For large notification datasets, cursor pagination may be preferable.

---

# 63. SORTING

Default:

```text
createdAt DESC
```

Newest notifications first.

Do not allow arbitrary SQL order expressions from clients.

Whitelist allowed sort fields.

---

# 64. FILTERING

Potential filters:

```text
category
type
priority
isRead
date range
```

Validate filter values.

Do not allow raw SQL fragments.

---

# 65. SEARCH

If notification search is required:

```text
title
message
```

Use proper database querying.

Do not implement unsafe LIKE concatenation.

---

# 66. NOTIFICATION COUNT

Unread count should be efficient.

Example:

```text
GET /notifications/unread-count
```

should not load all notification rows into application memory.

Use database aggregation:

```text
COUNT(*)
```

with proper indexes.

---

# 67. DATABASE INDEXES

Consider indexes for:

```text
userId
companyId
branchId
isRead
createdAt
type
category
eventId
```

Use composite indexes based on actual query patterns.

Do not add every possible index.

---

# 68. DATABASE CONSTRAINTS

Use database constraints for important invariants.

Examples:

```text
unique event/user/type where appropriate
foreign keys
not null constraints
```

Do not rely only on application-level checks.

---

# 69. SOFT DELETE

If the project uses soft delete globally, follow the existing convention.

Do not introduce a separate deletion philosophy.

---

# 70. TRANSACTION RULE

Notification creation associated with a business event should follow the Outbox architecture.

Preferred:

```text
Business transaction
    ↓
Outbox event
    ↓
COMMIT
    ↓
BullMQ
    ↓
Notification creation
```

Do not make the core Sale transaction depend on email/push provider availability.

---

# 71. EVENT → NOTIFICATION MAPPING

Create a clean mapping layer.

Example:

```text
sale.confirmed
      ↓
Notification Definition
      ↓
Recipients
      ↓
Channels
      ↓
Template
```

Do not spread event handling across every business service.

---

# 72. NOTIFICATION DEFINITION

Conceptually:

```text
NotificationDefinition
├── eventType
├── category
├── defaultPriority
├── titleTemplate
├── messageTemplate
├── availableChannels
└── requiredPermissions
```

This may be code-based or database-backed depending on the project's requirements.

---

# 73. TEMPLATE VERSIONING

If templates are editable by administrators, support versions.

Example:

```text
SALE_CONFIRMED
v1
v2
```

Existing queued notifications should not unexpectedly change behavior because an admin edited a template.

Consider storing the rendered content or template version in the notification/delivery record.

---

# 74. LANGUAGE / LOCALIZATION

Design for future localization.

Potential:

```text
en
my
th
```

Do not hard-code language assumptions throughout the notification service.

If the project already has localization infrastructure, reuse it.

---

# 75. LOCALIZED NOTIFICATION

Conceptually:

```text
Notification Type
      ↓
User Language
      ↓
Localized Template
      ↓
Rendered Notification
```

Do not implement a full translation platform unless required.

---

# 76. TIMEZONE

Notification timestamps must be consistent.

Database should follow the project's established timezone strategy.

API should return timestamps in a consistent format.

Frontend may display local time.

Do not mix arbitrary timezone conversions inside notification workers.

---

# 77. NOTIFICATION PAYLOAD

Keep queue payload small.

Prefer:

```json
{
  "eventId": "uuid",
  "notificationId": "uuid",
  "userId": "uuid"
}
```

Avoid:

```json
{
  "entireUser": "...",
  "entireSale": "...",
  "entireCompany": "..."
}
```

---

# 78. SECURITY

Never include sensitive information in notification content unnecessarily.

Avoid exposing:

```text
passwords
tokens
payment secrets
private credentials
sensitive customer data
```

Even notifications should follow the principle of least information.

---

# 79. PAYMENT NOTIFICATIONS

Payment notifications must not expose:

```text
full card number
CVV
secret payment credentials
```

Use safe references:

```text
Payment #PAY-001
Amount: XXXX
Status: Completed
```

according to business requirements.

---

# 80. SECURITY NOTIFICATIONS

Security events may include:

```text
new login
password changed
account disabled
permission changed
suspicious activity
```

These should be treated as high-priority notifications where appropriate.

---

# 81. AUTHENTICATION INTEGRATION

Use the existing authenticated user model.

Do not create another user identity system.

Notification recipient:

```text
userId
```

must reference the existing User entity.

---

# 82. EMPLOYEE INTEGRATION

If employee accounts exist:

```text
Employee
   ↓
User
   ↓
Notifications
```

Do not duplicate employee identity inside Notification.

---

# 83. ACCOUNT INTEGRATION

If the ERP uses:

```text
Sales Account
```

or other account-level visibility, notification recipient resolution must respect the existing account visibility model.

Example:

```text
Sales Account A
   ↓
Assigned Sales Staff
   ↓
Notification
```

---

# 84. HR INTEGRATION

When HR functionality is implemented/available, notifications may support:

```text
Leave approval
Attendance alerts
Employee announcements
HR approvals
```

Do not implement HR-specific notifications before the underlying HR domain exists.

Prepare extension points only.

---

# 85. ADMINISTRATION INTEGRATION

Administrative notifications may include:

```text
User created
User disabled
Role changed
Permission changed
System alert
```

These must respect:

```text
Dynamic RBAC
Data Visibility
Audit Log
```

---

# 86. NOTIFICATION WORKER

Create/reuse:

```text
Notification Worker
```

Responsibilities:

```text
validate job
load notification
resolve channel
send/process
update status
handle retry
handle failure
write logs
```

Do not put all channel-specific implementation inside one huge worker.

---

# 87. EMAIL WORKER

If email is implemented:

```text
Email Worker
```

should:

```text
load delivery
render template
send provider request
record result
retry temporary failures
disable permanent failures
```

---

# 88. PUSH WORKER

If push is implemented:

```text
Push Worker
```

should:

```text
load device token
send notification
handle provider result
deactivate invalid tokens
retry temporary failures
```

---

# 89. IN-APP WORKER

For in-app notifications:

```text
Notification Worker
 ↓
Create durable notification
 ↓
Optional WebSocket event
```

The MySQL record must be created before relying on realtime delivery.

---

# 90. WEBSOCKET FAILURE

If:

```text
WebSocket send
```

fails:

do not mark the notification as permanently failed if the MySQL notification was successfully created.

The user can retrieve it later.

---

# 91. EMAIL FAILURE

If email fails:

```text
Notification
```

should still exist.

Only the email delivery should be marked failed.

---

# 92. PUSH FAILURE

If push fails:

```text
In-app notification
```

should still exist if enabled.

Channel failure must not destroy the logical notification.

---

# 93. MULTI-CHANNEL DELIVERY

Example:

```text
Notification
      │
      ├── IN_APP → SUCCESS
      ├── EMAIL  → FAILED
      └── PUSH   → SUCCESS
```

The logical notification remains valid.

Delivery statuses remain independent.

---

# 94. USER PREFERENCE EXAMPLE

Example:

```text
Sale Confirmed

User preference:
In-App = ON
Email = OFF
Push = ON
```

Expected:

```text
In-App → send
Email  → skip
Push   → send
```

---

# 95. PREFERENCE UPDATE API

Potential:

```text
GET   /notification-preferences
PATCH /notification-preferences
```

Only allow users to modify their own preferences unless an explicit admin permission exists.

---

# 96. ADMIN PREFERENCE MANAGEMENT

If administrators can configure company-wide defaults:

```text
Company Notification Policy
```

should be separate from:

```text
User Notification Preference
```

Do not overwrite user preferences accidentally.

---

# 97. NOTIFICATION SETTINGS

Frontend should be able to show:

```text
Sales
[✓] In-App
[✓] Email
[✓] Push

Purchase
[✓] In-App
[ ] Email
[✓] Push

Inventory
[✓] In-App
[ ] Email
[✓] Push
```

Backend should return structured preference data.

---

# 98. API VALIDATION

Validate:

```text
notificationId
category
type
priority
channel
preference values
pagination
filters
```

Use existing DTO validation conventions.

---

# 99. ERROR RESPONSES

Use the project's standard error response format.

Examples:

```text
notification not found
notification does not belong to user
invalid notification preference
unauthorized notification action
```

Do not leak internal database details.

---

# 100. TESTING

Implement automated tests for:

```text
Notification creation
Notification retrieval
Pagination
Unread count
Mark read
Mark all read
Authorization
Data visibility
Company scope
Branch scope
Warehouse scope
Recipient resolution
Duplicate recipient handling
Inactive users
Notification preferences
Default preferences
Channel selection
BullMQ enqueue
Worker processing
Retry
Idempotency
Duplicate event
Email failure
Push failure
WebSocket failure
Outbox integration
Audit logging
Cleanup
```

---

# 101. SECURITY TESTS

Verify:

```text
User A cannot read User B notifications
Company A cannot read Company B notifications
Branch A cannot read Branch B notifications
Unauthorized user cannot broadcast
Unauthorized user cannot modify templates
Unauthorized user cannot retry delivery
Disabled user does not receive notifications
```

---

# 102. IDEMPOTENCY TEST

Process the same event twice:

```text
sale.confirmed
eventId = ABC
```

Expected:

```text
one logical notification
```

not:

```text
two duplicate notifications
```

unless business requirements explicitly allow duplicates.

---

# 103. OUTBOX FAILURE TEST

Simulate:

```text
Business transaction succeeds
Redis unavailable
```

Expected:

```text
business data = committed
outbox event = durable
notification = eventually processed
```

when infrastructure recovers.

---

# 104. EMAIL RETRY TEST

Simulate:

```text
SMTP timeout
HTTP 500
HTTP 429
```

Expected:

```text
temporary error → retry
```

Simulate:

```text
invalid recipient
permanent 4xx
```

Expected:

```text
permanent failure → no infinite retry
```

---

# 105. PUSH TOKEN TEST

Simulate invalid device token.

Expected:

```text
provider says token invalid
      ↓
device token marked inactive
      ↓
no infinite retry
```

---

# 106. BULK TEST

Test a realistic batch.

Example:

```text
10,000 users
```

Do not necessarily send real emails/push notifications.

Use mocked providers.

Verify:

```text
memory usage
queue behavior
batching
duplicate prevention
failure handling
```

---

# 107. PERFORMANCE

Measure:

```text
notification list latency
unread count latency
mark-read latency
notification creation throughput
queue processing throughput
email throughput
push throughput
```

Use database indexes based on actual queries.

---

# 108. DATABASE INDEXES

Verify indexes for the actual query patterns.

Likely useful:

```text
(userId, createdAt)
(userId, isRead, createdAt)
(companyId, createdAt)
(eventId)
```

Only create indexes justified by query patterns.

---

# 109. DOCKER

Verify:

```text
API
Worker
Redis
MySQL
```

work together.

If email/push providers require environment variables, use environment configuration.

Never commit:

```text
SMTP password
Firebase private key
API secret
provider secret
```

---

# 110. ENVIRONMENT VARIABLES

Use the existing configuration system.

Potential:

```text
EMAIL_PROVIDER
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASSWORD

PUSH_PROVIDER
FCM_PROJECT_ID
FCM_CLIENT_EMAIL
FCM_PRIVATE_KEY
```

Only add variables required by the actual provider implementation.

Never hard-code secrets.

---

# 111. OBSERVABILITY PREPARATION

Prepare metrics for Phase 27:

```text
notification.created
notification.sent
notification.failed
notification.read
notification.delivery.failed
email.sent
email.failed
push.sent
push.failed
```

Do not build the entire observability system in Phase 21.

---

# 112. LOGGING

Structured logs should include:

```text
notificationId
eventId
userId
companyId
channel
attempt
status
duration
```

Never log:

```text
password
token
private key
full device token
payment secret
```

---

# 113. DOCUMENTATION

Create/update:

```text
docs/architecture/notifications.md
```

or the existing documentation location.

Document:

```text
Notification architecture
Notification entity
Notification lifecycle
Recipient resolution
Data visibility
Channels
Preferences
Templates
BullMQ integration
Outbox integration
Retry strategy
Idempotency
WebSocket integration
Email integration
Push integration
API endpoints
Security
Retention
```

---

# 114. BRUNO

Add Bruno collections for the notification APIs.

Potential:

```text
phase-21-notifications/
├── list-notifications
├── get-notification
├── unread-count
├── mark-read
├── mark-all-read
├── preferences
└── admin/
```

Only create requests for APIs that actually exist.

Do not expose internal worker/queue endpoints merely to test BullMQ.

---

# 115. FINAL ARCHITECTURE

The final architecture should conceptually be:

```text
                       BUSINESS DOMAIN
                              │
                              ▼
                     ┌─────────────────┐
                     │  Domain Event   │
                     └────────┬────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │     Outbox      │
                     │   MySQL         │
                     └────────┬────────┘
                              │
                            COMMIT
                              │
                              ▼
                     ┌─────────────────┐
                     │    BullMQ       │
                     │     Redis       │
                     └────────┬────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │ Notification Worker │
                   └──────────┬──────────┘
                              │
                    ┌─────────┼─────────┐
                    │         │         │
                    ▼         ▼         ▼
                 In-App     Email      Push
                    │         │         │
                    ▼         ▼         ▼
                  MySQL    Provider   Provider
                    │
                    ▼
                WebSocket
                    │
                    ▼
                 Frontend
```

---

# 116. DEFINITION OF DONE

Phase 21 is complete only when:

```text
[ ] Existing notification code inspected
[ ] Existing User architecture inspected
[ ] Existing RBAC inspected
[ ] Existing Data Visibility inspected
[ ] Existing Outbox inspected
[ ] Existing BullMQ inspected
[ ] Existing Redis inspected
[ ] Existing WebSocket inspected
[ ] Existing Email/Push infrastructure inspected

[ ] Notification domain implemented
[ ] Notification entity implemented
[ ] Notification types defined
[ ] Notification categories defined
[ ] Notification priority defined
[ ] Notification status defined

[ ] Recipient resolver implemented
[ ] Duplicate recipients prevented
[ ] Inactive users filtered
[ ] Company scope enforced
[ ] Branch scope enforced
[ ] Warehouse scope enforced
[ ] Data Visibility integrated

[ ] In-App notification implemented
[ ] Read/unread implemented
[ ] Unread count implemented
[ ] Pagination implemented
[ ] Filtering implemented

[ ] Notification preferences implemented
[ ] Default preferences implemented
[ ] User preferences implemented
[ ] Channel preferences implemented

[ ] Email channel implemented where required
[ ] Push channel implemented where required
[ ] WebSocket integration implemented where available

[ ] Notification Delivery tracking implemented where required
[ ] Channel-specific retry implemented
[ ] Channel-specific failure handling implemented

[ ] BullMQ integration implemented
[ ] Queue retry implemented
[ ] Backoff implemented
[ ] Timeout implemented
[ ] Idempotency implemented
[ ] Duplicate job handling implemented

[ ] Outbox → Notification flow verified
[ ] Business transaction remains independent from notification provider
[ ] Notification failure does not rollback core business transaction

[ ] Dynamic RBAC integrated
[ ] Notification permissions integrated
[ ] Admin actions audited
[ ] Broadcast permissions protected

[ ] Security tests implemented
[ ] Tenant isolation tests implemented
[ ] Data visibility tests implemented
[ ] Idempotency tests implemented
[ ] Retry tests implemented
[ ] Provider failure tests implemented

[ ] Bruno collection added
[ ] Documentation updated

[ ] ESLint passes
[ ] TypeScript typecheck passes
[ ] Unit tests pass
[ ] Integration tests pass
[ ] Build passes
[ ] Docker validation passes
```

---

# 117. FINAL AI RULES

Before implementing anything:

```text
INSPECT → UNDERSTAND → PLAN → IMPLEMENT → TEST → VERIFY
```

Do not blindly create new architecture.

Reuse:

```text
Phase 06 — Dynamic RBAC
Phase 18 — Outbox
Phase 19 — Redis
Phase 20 — BullMQ
```

The most important architectural rule is:

```text
BUSINESS EVENT
      ↓
MYSQL TRANSACTION
      ↓
OUTBOX
      ↓
COMMIT
      ↓
BULLMQ
      ↓
NOTIFICATION WORKER
      ↓
CHANNEL
```

Never make:

```text
Sale API
   ↓
Send Email
   ↓
Wait
   ↓
Return Sale
```

Instead:

```text
Sale API
   ↓
MySQL Transaction
   ↓
Outbox
   ↓
COMMIT
   ↓
Return Sale
```

Then:

```text
Outbox
   ↓
BullMQ
   ↓
Notification Worker
   ↓
Email / Push / In-App
```

Remember:

```text
MySQL
=
Notification Source of Truth

Redis
=
Queue / Temporary Infrastructure

BullMQ
=
Async Processing

Outbox
=
Durable Event Delivery

WebSocket
=
Realtime Transport

Email / Push
=
External Delivery Channels
```

Most importantly:

```text
NOTIFICATION FAILURE
       ≠
BUSINESS TRANSACTION FAILURE
```

A failed email must not undo:

```text
Sale
Purchase
Inventory
Payment
Accounting
```

And:

```text
BULLMQ
=
AT-LEAST-ONCE PROCESSING
```

Therefore:

```text
IDEMPOTENCY
+
DATABASE CONSTRAINTS
+
TRANSACTIONS
+
OUTBOX
```

must protect the ERP from duplicate notifications and duplicate side effects.

Do not claim Phase 21 is complete until the actual repository has been inspected, implemented, tested, typechecked, built, and verified.
