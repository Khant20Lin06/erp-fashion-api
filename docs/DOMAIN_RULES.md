# DOMAIN_RULES.md

# Domain & Business Rules

This document is the authoritative source for business rules and domain behavior.

AI MUST follow these rules when implementing business logic.

AI MUST NOT invent, assume, or silently change business rules.

If a requirement conflicts with this document, STOP and ask the human engineer.

---

# 1. DOMAIN PRINCIPLES

The system represents real business operations.

Business rules must be:

* explicit
* testable
* deterministic
* traceable
* independent from UI where practical

Do not put important business rules only inside:

* controllers
* UI components
* database triggers
* client-side validation

Critical business rules must be enforced on the backend/domain layer.

---

# 2. ENTITY RULES

Document the important entities in the system.

Example:

```text
User
Role
Permission
Organization
Branch
Warehouse
Product
ProductVariant
Customer
Supplier
Purchase
PurchaseItem
Sale
SaleItem
Payment
Return
StockMovement
```

For every important entity document:

* purpose
* required fields
* allowed states
* relationships
* ownership
* lifecycle
* restrictions

---

# 3. ENTITY LIFECYCLE

Every stateful entity must have clearly defined states.

Example:

```text
DRAFT
  ↓
CONFIRMED
  ↓
COMPLETED
```

Possible cancellation:

```text
DRAFT
  ↓
CANCELLED
```

AI must not introduce new states without approval.

AI must not allow invalid state transitions.

Example:

```text
COMPLETED → DRAFT
```

must be rejected unless explicitly allowed.

---

# 4. USER RULES

Users represent authenticated system actors.

Rules:

* A user must have a valid identity.
* User access must be controlled by authorization.
* User permissions must be evaluated server-side.
* Sensitive operations must require appropriate permission.

Never trust frontend-only authorization.

---

# 5. ROLE & PERMISSION RULES

Roles are authorization containers.

Permissions should define actions such as:

```text
CREATE
READ
UPDATE
DELETE
APPROVE
CANCEL
EXPORT
IMPORT
```

Example:

```text
Sales Staff
    → create sale
    → read allowed sales
    → cannot approve own restricted operations

Sales Manager
    → manage sales
    → approve sales
    → view permitted sales scope

Super Admin
    → full administrative access
```

These are examples only.

The actual project permissions must be defined explicitly below.

### Project-specific permission rules

```text
[ADD ACTUAL RULES HERE]
```

AI must never assume that a role has permission merely because its name sounds privileged.

---

# 6. DATA VISIBILITY RULES

Authorization and data visibility are separate concerns.

A user may have:

```text
READ permission
```

but still only be allowed to see a subset of records.

Example:

```text
Sales Staff
    → own sales only

Sales Manager
    → permitted branch/team sales

Super Admin
    → all sales
```

The exact visibility rules must be defined here.

### Visibility Matrix

| Role          | Entity | Visibility             |
| ------------- | ------ | ---------------------- |
| Sales Staff   | Sale   | Own records            |
| Sales Manager | Sale   | Team / permitted scope |
| Super Admin   | Sale   | All records            |

AI must enforce visibility at the backend query/service layer.

Do not fetch all records and filter them only on the frontend.

---

# 7. ORGANIZATION / TENANT RULES

If the system supports organizations or tenants:

Every tenant-owned entity must belong to the correct organization.

Example:

```text
Organization
    ↓
Branch
    ↓
Warehouse
    ↓
Sales
    ↓
Sale Items
```

Users must not access another organization's data unless explicitly authorized.

AI must consider tenant boundaries when implementing:

* queries
* mutations
* reports
* exports
* background jobs
* APIs

---

# 8. BRANCH RULES

If the system supports branches:

A branch belongs to an organization.

Users may have access to:

* one branch
* multiple branches
* all branches

depending on their authorization scope.

AI must not assume that every authenticated user can access every branch.

---

# 9. WAREHOUSE RULES

A warehouse belongs to an organization/branch according to the project architecture.

Stock operations must identify the correct warehouse.

Stock must not be modified without a valid stock operation.

Examples:

```text
Purchase
    → increases stock

Sale
    → decreases stock

Sales Return
    → increases stock

Purchase Return
    → decreases stock

Stock Adjustment
    → changes stock according to approved adjustment
```

Actual stock rules must be defined here.

---

# 10. PRODUCT RULES

Products must follow the project's product model.

Document:

* SKU rules
* barcode rules
* variant rules
* unit rules
* pricing rules
* active/inactive behavior
* deletion restrictions

Example:

A product already referenced by transactions must not be physically deleted.

Prefer deactivation/archiving where appropriate.

---

# 11. INVENTORY RULES

Inventory changes must be traceable.

Every stock change should have a business reason.

Examples:

```text
PURCHASE
SALE
SALE_RETURN
PURCHASE_RETURN
ADJUSTMENT
TRANSFER
```

Do not modify stock directly without creating the appropriate business operation or stock movement record.

---

# 12. STOCK CONSISTENCY

The system must preserve stock consistency.

Important invariants:

```text
Available Stock
=
Valid Stock Movements
```

If negative stock is not allowed:

```text
available_quantity >= 0
```

must be enforced.

If negative stock is allowed for specific scenarios, document those scenarios explicitly.

AI must not decide this rule automatically.

---

# 13. PURCHASE RULES

Document the purchase lifecycle.

Example:

```text
DRAFT
 ↓
CONFIRMED
 ↓
RECEIVED
 ↓
COMPLETED
```

Define:

* when stock increases
* when supplier balance changes
* when payment is recorded
* when a purchase can be cancelled
* when a purchase can be edited

Example:

A draft purchase may be edited.

A received purchase may require a controlled adjustment instead of direct editing.

Actual project behavior must be defined here.

---

# 14. SALES RULES

Document the sales lifecycle.

Example:

```text
DRAFT
 ↓
CONFIRMED
 ↓
COMPLETED
```

Define:

* stock deduction timing
* payment timing
* invoice generation
* customer balance
* cancellation
* return eligibility

Example:

Stock must not be deducted merely because a draft sale exists.

The exact rule must be defined by the business requirements.

---

# 15. SALES RETURN RULES

A return must reference the original sale where applicable.

Define:

* who can create returns
* which items can be returned
* maximum return quantity
* return time limits
* stock effect
* payment/refund effect
* approval requirements

Example:

```text
Original Sold Quantity = 10
Already Returned = 3

Maximum Returnable = 7
```

AI must enforce the actual project rule.

---

# 16. PAYMENT RULES

Payments are financial operations.

Document:

* supported payment methods
* payment states
* partial payment rules
* overpayment rules
* refund rules
* cancellation rules

Example:

```text
UNPAID
PARTIALLY_PAID
PAID
REFUNDED
```

Never silently mark a payment as successful.

External payment confirmation must be validated according to the integration contract.

---

# 17. ACCOUNTING RULES

If accounting exists, financial transactions must follow the accounting rules defined by the project.

Important concepts may include:

```text
Account
Journal
Debit
Credit
Ledger
Receivable
Payable
Payment
Refund
```

Every financial mutation must preserve accounting consistency.

Do not create accounting entries merely because they "seem reasonable."

Follow the documented accounting rules.

---

# 18. APPROVAL RULES

Define operations requiring approval.

Examples:

```text
Large discount
Sales return
Stock adjustment
Purchase cancellation
Payment refund
Credit sale
```

Approval rules must define:

* who can approve
* who cannot approve
* whether self-approval is allowed
* approval limits
* required states

Example:

```text
Requester != Approver
```

if self-approval is prohibited.

---

# 19. AUDIT RULES

Important business operations must be auditable.

Examples:

* login/security events
* permission changes
* price changes
* stock adjustments
* sales cancellation
* returns
* refunds
* accounting changes

Audit records should identify:

```text
who
what
when
where
before
after
reason
```

Do not expose sensitive information unnecessarily in audit logs.

---

# 20. SOFT DELETE RULES

Define which entities may be deleted.

Example:

Master data may support:

```text
ACTIVE
INACTIVE
ARCHIVED
```

Transactional records should generally not be physically deleted after they become financially or operationally significant.

Actual deletion policy must be documented here.

---

# 21. IMMUTABILITY RULES

Some records become immutable after a certain state.

Example:

```text
COMPLETED SALE
```

may not allow direct modification.

Instead use:

```text
RETURN
ADJUSTMENT
REVERSAL
CANCELLATION
```

according to the domain rules.

AI must not update immutable transactional data directly.

---

# 22. IDEMPOTENCY RULES

Operations that may be retried must be safe against duplicate execution.

Especially:

* payment callbacks
* order creation
* stock operations
* queue jobs
* external API requests
* synchronization

Example:

```text
same idempotency key
        ↓
same operation
        ↓
must not create duplicate transaction
```

AI must consider idempotency when implementing retryable operations.

---

# 23. CONCURRENCY RULES

Business operations involving shared state must consider concurrent execution.

Examples:

```text
Two users selling the last item
Two workers processing the same payment
Two requests updating the same order
Two users approving the same transaction
```

The implementation must preserve domain invariants under concurrency.

Do not rely only on frontend checks.

---

# 24. DATE & TIME RULES

Document:

* system timezone
* business timezone
* date storage format
* transaction date rules
* reporting date rules

Do not use local machine time blindly.

All important date/time behavior must follow the project's defined timezone policy.

---

# 25. MONEY RULES

Money must be handled using appropriate exact numeric representation.

Do not use floating-point arithmetic for financial calculations unless explicitly justified.

Define:

* currency
* decimal precision
* rounding mode
* tax calculation
* discount calculation
* total calculation

Example:

```text
Subtotal
- Discount
+ Tax
= Grand Total
```

Actual calculation rules must be defined here.

---

# 26. BUSINESS INVARIANTS

List rules that must ALWAYS remain true.

Examples:

```text
A sale cannot reference a nonexistent product.

A sale item cannot have an invalid quantity.

A completed sale cannot become draft.

A user cannot access another tenant's data.

A return cannot exceed the returnable quantity.

A stock movement must reference a valid business operation.

A payment cannot be silently marked successful.
```

Add all project-specific invariants here.

---

# 27. CROSS-MODULE RULES

Document rules that involve multiple modules.

Example:

```text
Sales
  ↓
Inventory
  ↓
Accounting
```

A completed sale may affect:

* inventory
* customer balance
* revenue
* accounting ledger
* reports

These changes must remain consistent.

AI must inspect all affected modules before modifying cross-module behavior.

---

# 28. EVENT / QUEUE RULES

For asynchronous operations document:

* event name
* producer
* consumer
* retry behavior
* maximum retries
* timeout
* idempotency
* failure behavior

Example:

```text
SaleCompleted
    ↓
Inventory Worker
    ↓
Accounting Worker
    ↓
Notification Worker
```

AI must not assume asynchronous operations are automatically safe.

---

# 29. REPORTING RULES

Reports must use the defined business meaning of data.

For example:

"Total Sales" must have a clearly defined meaning.

Define whether it includes:

* cancelled sales
* returned sales
* refunded sales
* draft sales
* tax
* discount

AI must not invent reporting formulas.

---

# 30. SEARCH & FILTER RULES

Document which records users are allowed to search.

Search must respect:

* tenant boundaries
* branch boundaries
* role permissions
* data visibility rules

Do not bypass authorization through search endpoints.

---

# 31. BUSINESS RULE CHANGE POLICY

Business rules must not be changed silently.

When a requirement changes:

1. Update this document.
2. Identify affected modules.
3. Update tests.
4. Update implementation.
5. Run regression tests.
6. Document the change.

The documentation and implementation must remain consistent.

---

# 32. AI DECISION POLICY

AI may:

* implement documented business rules
* suggest improvements
* identify contradictions
* identify missing rules
* write tests for documented rules

AI must NOT:

* invent business rules
* invent permission behavior
* invent accounting behavior
* invent stock behavior
* invent financial calculations
* silently change domain behavior
* silently change state transitions

If a business rule is missing and the decision affects system correctness:

STOP and ask the human engineer.

---

# 33. FINAL DOMAIN PRINCIPLE

Business logic must be:

Explicit.

Testable.

Auditable.

Consistent.

Predictable.

The AI implements the domain rules.

The AI does not define the domain rules.

The human/business owner defines the rules.
