# Phase 30 — HR Management

## Fashion ERP Backend

## Human Resources / Employee Management

You are implementing **Phase 30 — HR Management** for the Fashion ERP Backend.

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
```

The previous phases have already established the core ERP architecture.

This phase introduces the **HR Management domain**.

---

# 1. PRIMARY OBJECTIVE

Build a scalable HR Management module that supports:

```text
Employee
Department
Designation
Employment
Employee Documents
Employee Contact
Employee Address
Employee Status
Attendance
Leave
Leave Type
Leave Balance
Holiday
Shift
Work Schedule
Employee Assignment
Branch / Company Scope
HR Permissions
HR Data Visibility
HR Audit Log
HR Notifications
```

The HR module must integrate with the existing:

```text
Authentication
Dynamic RBAC
Data Visibility
Organization
Company
Branch
Warehouse
User
Account
Audit Log
Notifications
Reports
Accounting
```

Do not create a second independent authorization system.

Use the existing architecture.

---

# 2. IMPORTANT ARCHITECTURE RULE

Before implementing anything:

```text
INSPECT EXISTING CODE
        ↓
UNDERSTAND EXISTING ARCHITECTURE
        ↓
REUSE SHARED INFRASTRUCTURE
        ↓
DESIGN HR DOMAIN
        ↓
IMPLEMENT
        ↓
TEST
        ↓
VERIFY
```

Do NOT blindly create duplicate:

```text
Auth
User
Role
Permission
Company
Branch
Audit Log
Notification
```

modules if they already exist.

---

# 3. HR MODULE STRUCTURE

Recommended structure:

```text
src/modules/hr/
│
├── employee/
├── department/
├── designation/
├── employment/
├── employee-document/
├── employee-contact/
├── employee-address/
├── employee-assignment/
├── attendance/
├── leave/
├── leave-type/
├── leave-balance/
├── holiday/
├── shift/
├── work-schedule/
├── hr-dashboard/
└── hr-report/
```

Adapt this structure to the existing project conventions.

Do not force this exact structure if the repository already has a better modular pattern.

---

# 4. EMPLOYEE MANAGEMENT

Implement Employee Management.

Employee should support appropriate fields such as:

```text
employeeCode
firstName
lastName
displayName
email
phone
dateOfBirth
gender
photo
nationality
status
hireDate
terminationDate
companyId
branchId
departmentId
designationId
managerId
userId
```

Only include fields that are appropriate for the existing business requirements.

Do not collect unnecessary sensitive personal information.

---

# 5. EMPLOYEE CODE

Employee code should be:

```text
unique
stable
searchable
```

If the system supports company/branch-specific numbering, ensure concurrent creation cannot generate duplicate codes.

---

# 6. EMPLOYEE STATUS

Support appropriate lifecycle states such as:

```text
ACTIVE
INACTIVE
ON_LEAVE
SUSPENDED
TERMINATED
RESIGNED
```

Do not automatically assume every status is required.

Use a consistent enum/domain model.

---

# 7. EMPLOYEE LIFECYCLE

Support:

```text
Create Employee
View Employee
Update Employee
Deactivate Employee
Reactivate Employee
Terminate Employee
```

Do not physically delete employee records that are referenced by:

```text
attendance
leave
transactions
audit logs
reports
```

unless the existing system explicitly supports safe deletion.

---

# 8. USER ↔ EMPLOYEE RELATIONSHIP

Existing system has User Management.

Design:

```text
User
   ↕
Employee
```

appropriately.

An employee may optionally have a login account.

Example:

```text
Employee
   ↓
User Account
   ↓
Role
   ↓
Permissions
```

Do not duplicate authentication credentials inside Employee.

---

# 9. DEPARTMENT

Implement:

```text
Department
```

with support for:

```text
name
code
description
status
company scope
branch scope where applicable
manager
```

Department names/codes should have appropriate uniqueness constraints.

---

# 10. DESIGNATION

Implement:

```text
Designation
```

Examples:

```text
Developer
Sales Staff
Sales Manager
Accountant
HR Manager
Warehouse Staff
Cashier
```

Designation is an HR/business concept.

Do NOT automatically treat Designation as a security Role.

Important distinction:

```text
Designation ≠ Role
```

Example:

```text
Designation:
Sales Manager

Security Role:
Sales Manager Role
```

These may have the same name but represent different concepts.

---

# 11. EMPLOYMENT

Create an employment model/history where appropriate.

Track:

```text
employee
company
branch
department
designation
employmentType
startDate
endDate
status
```

Support employment history instead of overwriting historical information.

---

# 12. EMPLOYMENT TYPE

Support configurable or enumerated employment types such as:

```text
FULL_TIME
PART_TIME
CONTRACT
TEMPORARY
INTERN
PROBATION
```

Use the existing project's conventions.

---

# 13. EMPLOYEE HISTORY

Important changes should preserve history.

Examples:

```text
Department change
Designation change
Branch transfer
Manager change
Employment status change
```

Do not destroy historical records by simply overwriting current values.

---

# 14. EMPLOYEE ADDRESS

Implement employee address management.

Possible fields:

```text
addressLine1
addressLine2
city
state
postalCode
country
addressType
isPrimary
```

Avoid storing unnecessary sensitive information.

---

# 15. EMPLOYEE CONTACT

Support:

```text
phone
email
emergency contact
contact type
```

Emergency contact data must be protected with appropriate HR permissions.

---

# 16. EMPLOYEE DOCUMENTS

Support employee documents where required.

Examples:

```text
Employment Contract
Identification Document
Certificate
Qualification
Other HR Document
```

Store metadata such as:

```text
documentType
documentName
file reference
issueDate
expiryDate
status
```

Do not expose document files through unrestricted public URLs.

---

# 17. DOCUMENT ACCESS

Employee documents must respect:

```text
RBAC
Data Visibility
Company
Branch
HR permissions
```

A normal employee must not automatically access another employee's private documents.

---

# 18. DEPARTMENT VISIBILITY

HR data must integrate with existing Data Visibility.

Example:

```text
HR Staff
    ↓
Authorized HR scope

Branch Manager
    ↓
Branch employee scope

Company HR Manager
    ↓
Company employee scope

Super Admin
    ↓
Global scope
```

Do not hardcode these roles.

Use the existing dynamic RBAC and visibility architecture.

---

# 19. ATTENDANCE

Implement Attendance Management.

Possible fields:

```text
employeeId
date
checkIn
checkOut
status
source
remarks
```

Attendance status may include:

```text
PRESENT
ABSENT
LATE
HALF_DAY
ON_LEAVE
HOLIDAY
```

Use the project's business rules.

---

# 20. ATTENDANCE DUPLICATION

Prevent duplicate attendance records where the business rule requires one attendance record per employee/day.

Use database constraints where appropriate.

Do not rely only on application checks.

---

# 21. ATTENDANCE CORRECTION

Support controlled correction.

Example:

```text
Employee submits correction
        ↓
HR/Manager reviews
        ↓
Approved
        ↓
Attendance updated
        ↓
Audit Log
```

Do not allow unrestricted modification of historical attendance.

---

# 22. ATTENDANCE AUDIT

Track important changes:

```text
Created
Updated
Approved
Rejected
Corrected
Deleted/Archived
```

Use the existing Audit Log infrastructure.

---

# 23. LEAVE TYPE

Implement configurable Leave Types.

Examples:

```text
Annual Leave
Sick Leave
Casual Leave
Unpaid Leave
Maternity Leave
Paternity Leave
Emergency Leave
```

Do not hardcode business rules unnecessarily.

---

# 24. LEAVE TYPE CONFIGURATION

Support configuration such as:

```text
name
code
description
paid/unpaid
requiresApproval
requiresDocument
annualAllocation
carryForward
maxConsecutiveDays
status
```

Only implement fields that fit the existing HR requirements.

---

# 25. LEAVE REQUEST

Implement:

```text
Employee
    ↓
Leave Request
    ↓
Manager / HR Approval
    ↓
Approved / Rejected
```

Leave request should support:

```text
employeeId
leaveTypeId
startDate
endDate
reason
status
approvedBy
approvedAt
rejectedBy
rejectedAt
remarks
```

---

# 26. LEAVE STATUS

Recommended lifecycle:

```text
PENDING
APPROVED
REJECTED
CANCELLED
```

Do not allow invalid state transitions.

---

# 27. LEAVE BALANCE

Implement leave balance where required.

Example:

```text
Employee
Leave Type
Opening Balance
Allocated
Used
Pending
Remaining
```

Formula should be consistent and transaction-safe.

---

# 28. LEAVE BALANCE CONCURRENCY

Two leave requests must not incorrectly consume the same remaining balance.

Use:

```text
database transaction
locking
atomic update
```

as appropriate.

---

# 29. LEAVE APPROVAL

Approval must be permission-controlled.

Do not trust:

```text
approvedBy
```

from the client.

The server must determine the authenticated approver.

---

# 30. SELF-APPROVAL

Prevent unauthorized self-approval.

Example:

```text
Employee
    ↓
Creates own leave request
    ↓
Cannot approve own request
```

unless the business explicitly allows it.

---

# 31. HOLIDAY MANAGEMENT

Implement Holiday Management.

Support:

```text
holiday name
date
company
branch
description
status
```

Allow company/branch-specific holidays.

---

# 32. SHIFT MANAGEMENT

Implement configurable shifts.

Example:

```text
Morning
08:00 → 17:00

Evening
14:00 → 23:00
```

Support:

```text
startTime
endTime
break duration
grace period
status
```

Use timezone-aware handling.

---

# 33. WORK SCHEDULE

Implement employee work schedule/assignment.

Example:

```text
Employee
 ↓
Work Schedule
 ↓
Shift
 ↓
Effective Date
```

Support historical schedule changes.

---

# 34. EMPLOYEE ASSIGNMENT

Employees may be assigned to:

```text
Company
Branch
Department
Designation
Manager
Shift
```

The system should preserve appropriate history.

---

# 35. HR DATA VISIBILITY

Integrate HR with the existing Data Visibility engine.

Example:

```text
Super Admin
    → All employees

Company HR Manager
    → Company employees

Branch HR
    → Branch employees

Department Manager
    → Authorized department employees

Employee
    → Own HR data only
```

These are examples only.

Do not hardcode them.

The actual visibility must come from:

```text
User
+
Role
+
Permission
+
Organization Scope
+
Data Visibility Rules
```

---

# 36. HR PERMISSIONS

Use the existing Dynamic RBAC system.

Create permissions for relevant HR resources.

Examples:

```text
hr.employee.read
hr.employee.create
hr.employee.update
hr.employee.delete

hr.department.read
hr.department.create
hr.department.update
hr.department.delete

hr.attendance.read
hr.attendance.create
hr.attendance.update
hr.attendance.approve

hr.leave.read
hr.leave.create
hr.leave.update
hr.leave.approve
hr.leave.reject

hr.employee_document.read
hr.employee_document.create
hr.employee_document.delete

hr.report.read
hr.report.export
```

Adapt naming conventions to the existing permission system.

---

# 37. EMPLOYEE SELF-SERVICE

If supported by the frontend/business scope, allow employees to access only their own:

```text
Profile
Contact
Attendance
Leave
Leave Balance
Assigned Schedule
```

Never bypass server-side visibility.

---

# 38. MANAGER SELF-SERVICE

Managers may access employees under their authorized scope.

The scope must come from the existing Data Visibility architecture.

Do not implement:

```text
if role === 'manager'
```

logic throughout controllers.

---

# 39. HR REPORTS

Prepare HR reporting endpoints for:

```text
Employee count
Employees by department
Employees by branch
Attendance summary
Leave summary
Leave balance
Employee status
```

Reports must respect Data Visibility.

---

# 40. HR DASHBOARD

Prepare dashboard metrics such as:

```text
Total Employees
Active Employees
New Employees
Terminated Employees
Today's Attendance
Absent Today
Late Today
Pending Leave Requests
```

Do not perform expensive unbounded queries on every dashboard request.

Use appropriate:

```text
indexes
aggregation
caching
precomputed metrics
```

where necessary.

---

# 41. HR + NOTIFICATIONS

Integrate with existing Notifications.

Examples:

```text
Leave submitted
Leave approved
Leave rejected
Attendance correction submitted
Document expiring
Employment event
```

Use BullMQ for asynchronous notification work where appropriate.

---

# 42. HR + OUTBOX

Important domain events should integrate with the existing Outbox Pattern.

Examples:

```text
EmployeeCreated
EmployeeUpdated
EmployeeStatusChanged
LeaveRequested
LeaveApproved
LeaveRejected
AttendanceCorrected
```

Only create events where they provide real value.

---

# 43. HR + AUDIT LOG

Use the existing Audit Log.

Important HR operations:

```text
Employee created
Employee updated
Employee deactivated
Employee terminated
Role/account relationship changed
Attendance corrected
Leave approved
Leave rejected
Employee document changed
Department changed
Designation changed
```

must be auditable where appropriate.

---

# 44. HR + ACCOUNTING

Do NOT implement payroll automatically in this phase unless explicitly required.

However, design the HR domain so future Payroll integration is possible.

Future architecture:

```text
Employee
   ↓
Employment
   ↓
Payroll
   ↓
Payment
   ↓
Accounting
```

Do not create fake payroll logic just to appear complete.

---

# 45. HR + USER ACCOUNT

Keep these concepts separate:

```text
Employee
    ≠
User Account
```

Example:

```text
Employee:
John

User Account:
john@example.com

Role:
Sales Staff

Designation:
Sales Executive
```

This distinction must remain clear.

---

# 46. DATABASE DESIGN

Use TypeORM entities following the existing database conventions.

Review:

```text
primary keys
foreign keys
indexes
unique constraints
timestamps
soft delete
audit fields
company scope
branch scope
```

Avoid unnecessary nullable columns.

---

# 47. DATABASE INDEXES

Create appropriate indexes for:

```text
employeeCode
email
companyId
branchId
departmentId
designationId
managerId
status
hireDate
attendance date
employeeId
leave employeeId
leave status
leave dates
```

Do not blindly index every column.

---

# 48. API DESIGN

Follow the existing REST API conventions.

Example:

```text
GET    /hr/employees
POST   /hr/employees
GET    /hr/employees/:id
PATCH  /hr/employees/:id
DELETE /hr/employees/:id

GET    /hr/departments
POST   /hr/departments

GET    /hr/designations
POST   /hr/designations

GET    /hr/attendance
POST   /hr/attendance

GET    /hr/leaves
POST   /hr/leaves
POST   /hr/leaves/:id/approve
POST   /hr/leaves/:id/reject

GET    /hr/leave-balances

GET    /hr/holidays

GET    /hr/shifts

GET    /hr/reports/*
```

Use the actual project's API conventions.

---

# 49. VALIDATION

Validate:

```text
dates
employee IDs
department IDs
designation IDs
company IDs
branch IDs
leave periods
attendance times
shift times
document metadata
```

Prevent:

```text
invalid dates
endDate < startDate
duplicate attendance
invalid employee scope
unauthorized company/branch assignment
```

---

# 50. AUTHORIZATION

Every HR endpoint must pass through:

```text
Authentication
    ↓
Permission
    ↓
Data Visibility
    ↓
Business Rule
```

Do not depend on frontend authorization.

---

# 51. BOLA / IDOR TESTING

Test:

```text
Employee A
   X
Employee B's data

Branch A HR
   X
Branch B employees

Company A HR
   X
Company B employees
```

Also test direct UUID/resource ID manipulation.

---

# 52. SECURITY / PRIVACY

HR data is sensitive.

Protect:

```text
personal information
contact information
documents
attendance
leave
employment records
```

Do not expose sensitive information unnecessarily through:

```text
API responses
logs
errors
notifications
queue payloads
```

---

# 53. SEARCH / FILTER

Employee listing should support appropriate filters:

```text
name
employeeCode
status
company
branch
department
designation
manager
employment type
hire date
```

All filters must respect Data Visibility.

---

# 54. PAGINATION

Use pagination for:

```text
employees
attendance
leave requests
documents
employment history
HR audit data
reports
```

Apply safe page-size limits.

---

# 55. TRANSACTIONS

Use database transactions for workflows requiring atomic changes.

Examples:

```text
Employee creation + user relationship
Employee assignment
Leave approval + balance update
Attendance correction
Employee termination + related state changes
```

Use transactions only where necessary.

---

# 56. STATE MACHINE

Do not allow arbitrary status changes.

For example:

```text
PENDING
   ↓
APPROVED
```

or:

```text
PENDING
   ↓
REJECTED
```

must follow valid transitions.

Reject invalid transitions.

---

# 57. CONCURRENCY

Test:

```text
Two managers approve same leave
Two requests consume same leave balance
Two users modify employee assignment
Two users create same employee code
```

Prevent inconsistent state.

---

# 58. SOFT DELETE

Use soft delete where appropriate for master/reference data.

Be careful with:

```text
attendance
leave
employment history
audit log
```

Do not destroy historical HR records unnecessarily.

---

# 59. TESTING

Create:

```text
Unit tests
Integration tests
E2E tests
Authorization tests
Data Visibility tests
Concurrency tests
```

Critical test scenarios:

```text
Employee CRUD
Employee scope
Department CRUD
Designation CRUD
Attendance
Leave
Leave approval
Leave rejection
Leave balance
Holiday
Shift
Employee document access
HR reports
RBAC
BOLA
```

---

# 60. BRUNO

Add/update Bruno collection for:

```text
HR Authentication
Employee
Department
Designation
Attendance
Leave
Leave Approval
Leave Balance
Holiday
Shift
Reports
```

Include negative authorization cases.

Examples:

```text
Unauthorized
Forbidden
Wrong company
Wrong branch
Wrong employee
Invalid ID
Invalid date
Invalid status transition
```

---

# 61. PERFORMANCE

Review:

```text
employee listing
attendance reports
leave reports
dashboard
department reports
```

for:

```text
N+1
unbounded queries
missing indexes
expensive joins
```

---

# 62. REDIS

Use Redis only where it provides value.

Potential use cases:

```text
HR dashboard cache
frequently accessed master data
short-lived locks
rate limiting
```

Do not cache sensitive employee information unnecessarily.

---

# 63. BULLMQ

Use BullMQ for asynchronous work such as:

```text
notification
document expiry reminders
large HR reports
scheduled HR jobs
```

Jobs must be retry-safe and idempotent.

---

# 64. DOCUMENT EXPIRATION

If employee documents support expiry dates:

```text
Document
    ↓
Expiry detection
    ↓
BullMQ
    ↓
Notification
```

Do not run expensive full-table scans on every request.

---

# 65. SCHEDULED JOBS

If scheduled HR jobs are required, implement them safely.

Examples:

```text
Daily attendance processing
Leave reminders
Document expiry reminders
```

Prevent duplicate execution when multiple workers are running.

---

# 66. API ERROR HANDLING

Follow the project's existing error response architecture.

Do not leak:

```text
database errors
stack traces
internal paths
sensitive HR information
```

---

# 67. DOCUMENTATION

Create/update HR documentation:

```text
docs/hr/
```

Recommended:

```text
architecture.md
employee.md
attendance.md
leave.md
permissions.md
data-visibility.md
api.md
```

Only create useful documentation.

---

# 68. IMPLEMENTATION RULE

Do not implement every optional feature automatically.

First inspect the repository and determine:

```text
What already exists?
What is missing?
What can be reused?
What is required?
What is optional?
```

Then implement the required HR scope.

---

# 69. FINAL VERIFICATION

After implementation run:

```text
lint
typecheck
unit tests
integration tests
e2e tests
Bruno tests
build
Docker build
```

Use the project's actual commands.

Do not invent scripts.

---

# 70. FINAL REPORT

At the end report:

## A. Implemented

```text
Employee
Department
Designation
Employment
Attendance
Leave
Leave Balance
Holiday
Shift
Work Schedule
Employee Documents
Employee Assignment
HR Reports
HR Dashboard
```

Only list what was actually implemented.

## B. Files Created

List actual files.

## C. Files Modified

List actual files.

## D. Database Changes

List:

```text
entities
migrations
indexes
constraints
```

## E. API Endpoints

List actual endpoints.

## F. Permissions

List actual HR permissions.

## G. Data Visibility

Explain:

```text
Employee scope
Department scope
Branch scope
Company scope
Manager scope
```

based on the actual implementation.

## H. Tests

Report:

```text
Passed
Failed
Skipped
```

Do not claim tests passed if they were not executed.

## I. Remaining Work

Clearly separate:

```text
Required
Optional
Future
```

---

# 71. IMPORTANT FINAL RULES

Do NOT:

```text
create duplicate authentication
create duplicate RBAC
create duplicate User model
create duplicate Company model
create duplicate Branch model
create duplicate Audit Log
hardcode roles
hardcode visibility
trust client-provided companyId
trust client-provided branchId
trust client-provided approvedBy
allow unauthorized document access
allow arbitrary leave status changes
allow duplicate attendance
use floating point for financial values
```

---

# 72. HR DOMAIN PRINCIPLES

Maintain these distinctions:

```text
Employee
    ≠
User Account

Designation
    ≠
Security Role

Department
    ≠
Permission Group

Company
    ≠
Branch

Role
    ≠
Data Visibility

Permission
    ≠
Data Scope
```

The architecture should remain flexible.

---

# 73. TARGET ARCHITECTURE

The intended relationship is:

```text
                    ┌─────────────────┐
                    │      User       │
                    └────────┬────────┘
                             │
                       Authentication
                             │
                             ▼
                    ┌─────────────────┐
                    │ Dynamic RBAC    │
                    └────────┬────────┘
                             │
                    Permission + Scope
                             │
                             ▼
                    ┌─────────────────┐
                    │    Employee     │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
     Department         Designation       Employment
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
                  ┌──────────┼──────────┐
                  ▼          ▼          ▼
             Attendance    Leave      Schedule
                  │          │          │
                  └──────────┼──────────┘
                             ▼
                       HR Reports
                             │
                             ▼
                      Notifications
                             │
                         BullMQ
```

---

# 74. PHASE 30 COMPLETION CRITERIA

Phase 30 is complete only when:

```text
[ ] Employee Management implemented
[ ] Department implemented
[ ] Designation implemented
[ ] Employment implemented where required
[ ] Employee/User relationship implemented
[ ] Attendance implemented
[ ] Leave Type implemented
[ ] Leave Request implemented
[ ] Leave Approval implemented
[ ] Leave Balance implemented
[ ] Holiday implemented
[ ] Shift implemented
[ ] Work Schedule implemented
[ ] Employee Assignment implemented
[ ] Employee Documents implemented where required
[ ] Dynamic RBAC integrated
[ ] Data Visibility integrated
[ ] Audit Log integrated
[ ] Notifications integrated where required
[ ] Outbox integrated where required
[ ] BullMQ integrated where required
[ ] HR reports implemented
[ ] HR dashboard implemented where required
[ ] API validation implemented
[ ] Authorization tested
[ ] BOLA/IDOR tested
[ ] Concurrency tested
[ ] Unit tests implemented
[ ] Integration tests implemented
[ ] E2E tests implemented
[ ] Bruno collection updated
[ ] Docker build verified
[ ] TypeScript build passes
[ ] Documentation updated
```

The final objective is:

```text
A secure, scalable, auditable,
multi-company / multi-branch HR Management system
that integrates cleanly with the existing
Fashion ERP architecture.
```

**Do not optimize for the number of files created.**

**Optimize for correct domain modeling, security, data visibility, historical integrity, maintainability, and production reliability.**

**Inspect first. Implement second. Verify everything.**
