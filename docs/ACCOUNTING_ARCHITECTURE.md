# ACCOUNTING_ARCHITECTURE.md

Current-state note as of Friday, August 14, 2026: this document preserves
the original Phase 17 accounting boundary language. Later implemented
phases already supersede statements here that treat Outbox/Kafka,
Redis/BullMQ, Notifications, or Reports as future work.

Accounting / General Ledger domain implemented in Phase 17
(`src/modules/accounting/`). Owns the sole double-entry source of truth for
the entire system and the one authorized, additive integration point into
Phase 16's `PaymentsService`. Builds on top of — never duplicates — the
operational balances Phase 12/13/16 already maintain
(`Sale.paidAmount`/`balanceAmount`, `PurchaseOrder.paidAmount`/
`balanceAmount`), per `docs/CUSTOMER_SUPPLIER_ARCHITECTURE.md` §18's own
advance framing and `docs/PAYMENT_ARCHITECTURE.md` §13/§14's explicit
Payment-vs-Accounting boundary.

## 1. Domain Ownership

Six new entities, in a new `src/modules/accounting/` module:

```text
Account                 — company-scoped, hierarchical chart of accounts (D4)
CompanyJournalCounter    — per-(company, year) journal-number sequence (D-numbering)
FiscalYear               — company-scoped OPEN/CLOSED year (D10)
AccountingPeriod         — belongs to a FiscalYear, OPEN/LOCKED (D10)
JournalEntry             — header; the sole accounting source of truth (D1)
JournalEntryLine         — line; the sole accounting source of truth (D1)
```

No `general_ledger`, `opening_balances`, `cash_accounts`, `bank_accounts`,
or `tax_accounts` table exists anywhere (D23). General Ledger and Trial
Balance are pure read-query projections over `journal_entry_lines`
(`GeneralLedgerService`/`TrialBalanceService`), never physical tables (D5).

## 2. JournalEntry + JournalEntryLine — the Sole Source of Truth (D1)

Every financial fact in this system is a `JournalEntryLine` belonging to a
`JournalEntry`. Nothing else in this codebase writes accounting data — not
`Payment`, not `Sale`, not `PurchaseOrder`. Those entities remain
operational records (D9 in `docs/PAYMENT_ARCHITECTURE.md`); Phase 17 reads
their output as plain data (via the same in-transaction `EntityManager`
Phase 16 already established) and produces journal entries from it — it
never duplicates their fields into a second ledger table.

`GeneralLedgerService`/`TrialBalanceService` join `journal_entry_lines` to
`journal_entries` (for the `status = POSTED` filter) and `accounts` (for
names) — filtering `POSTED` only. `DRAFT`/`CANCELLED` journal lines never
appear in either read projection, since they are not yet, or never became,
real financial facts.

## 3. Account — Chart of Accounts (D4)

`Account` (`accounts`) is company-scoped and self-referencing
(`parentId -> accounts`, `ON DELETE RESTRICT`), a direct structural mirror
of Phase 09's `Category` entity: `UNIQUE(company_id, code)`, cycle
prevention (`AccountsService.assertNoCycle()`, walking the ancestor chain
of a proposed new parent bounded by the company's total account count —
byte-for-byte the same algorithm as `CategoriesService.assertNoCycle()`),
cross-company parent rejected (400).

`accountType` is exactly the five standard classifications
(`ASSET|LIABILITY|EQUITY|REVENUE|EXPENSE`) — no `CASH`/`BANK`/
`RECEIVABLE`/`PAYABLE`/`COGS` subtype. This was a deliberate LOCKED
decision: nothing in the actual posting implementation ever branches on
`accountType` to decide "is this the cash account" — that resolution comes
from `PaymentMethod.glAccountId` (§6 below), not from the account's own
type. Inventing subtypes with no real consumer would have been speculative
schema.

No DELETE endpoint exists for `Account` at all — the locked API surface
(D22) lists only `GET`/`POST`/`PATCH`. Deactivation (`PATCH` with
`isActive: false`) is the only lifecycle transition, consistent with D4's
"no delete if referenced by any posted journal line — prefer deactivation"
instruction taken to its simplest safe form (never expose delete in the
first place, rather than exposing it and blocking it conditionally).

## 4. Journal Lifecycle (D2, D3)

`JournalEntryStatus`: `DRAFT -> POSTED` (terminal, immutable) or
`DRAFT -> CANCELLED` (terminal). `POSTED` is never revisited — no
PATCH/DELETE endpoint exists for a `JournalEntry` at all, and `post()`
rejects (409) any entry whose current status is not `DRAFT`.

**`CANCELLED` was added here but NOT added to `Payment` in Phase 16 —
deliberate, not an inconsistency.** Payment's D4 lifecycle decision
(`docs/PAYMENT_ARCHITECTURE.md` §6) collapsed to CONFIRMED-only creation
specifically because a Payment is always immediately, atomically allocated
in the same call that creates it — there is no genuine DRAFT interval for
a Payment to exist unposted in. A manual `JournalEntry` (D12) is the
opposite case: a user may legitimately build a multi-line draft over
several requests, realize it is wrong, and need a real terminal state to
put it in rather than leaving an abandoned DRAFT forever postable. Adding
`CANCELLED` here answers a real need this phase's own API surface creates;
Phase 16 correctly did not add an equivalent because nothing in its flow
ever needed it.

## 5. Double-Entry Validation (LOCKED spec's "Double-entry invariants")

Enforced in `src/modules/accounting/utils/double-entry.ts`, shared by
`JournalEntriesService.post()`/`createInternal()`:

- **Per-line**: exactly one of `debitAmount`/`creditAmount` is non-zero and
  positive, the other is exactly zero (`assertOneSidedLine()`).
- **Per-journal**: `SUM(debitAmount) === SUM(creditAmount)` across all
  lines (`assertBalanced()`).

**Decimal-safe arithmetic decision (documented per the locked spec's own
request to state which approach was taken)**: this balance check uses
**integer-cents arithmetic** (`toCents()`: `Math.round(Number(amount) *
100)`, summed as integers, converted back via `centsToDecimalString()`) —
not the `.toFixed(2)`-per-value convention every other money field in this
codebase uses (`Sale.grandTotal`, `Payment.amount`, etc.). The reason: this
is the one place in the entire codebase where an *exact equality* is
checked across a *sum of potentially many* values, and summing native JS
floats before rounding is exactly the failure mode that can make
`0.10 + 0.20 !== 0.30` true — verified directly in
`double-entry.spec.ts`'s "avoids the classic 0.1 + 0.2 floating-point
error" test. Every individual amount is still stored and returned as a
`.toFixed(2)` `DECIMAL(14,2)` string everywhere else (DTOs, entity
columns, response shapes) — only the balance-check summation itself uses
integer cents internally.

`totalDebit`/`totalCredit` on `JournalEntry` are a denormalized cache,
recomputed and re-validated from the actual `JournalEntryLine` rows at
`post()` time — never trusted as authoritative on their own, even though
`create()` also computes a best-effort draft value for immediate display.

## 6. PaymentMethod.glAccountId — the Cash/Bank Side Resolution (D6, judgment call)

The locked spec requires: "The actual Account used on the cash/bank side
must be resolved from PaymentMethod configuration... If the required
accounting account mapping does not exist: FAIL the transaction." This
strongly implied `PaymentMethod` needed a new field, which is exactly the
kind of judgment call the locked spec explicitly delegated (mirroring how
Phase 16 itself resolved its own D4 lifecycle ambiguity).

**Decision: `PaymentMethod.glAccountId`** — a new, additive, nullable
`char(36)` column with a real FK to `accounts` (`ON DELETE RESTRICT`),
added via this phase's own migration (`ALTER TABLE payment_methods ADD
gl_account_id ... ADD CONSTRAINT ...`). This is a real FK, unlike
`Customer.receivableAccountId`/`Supplier.payableAccountId`'s deliberately
FK-less placeholders from Phase 11 — those were FK-less because no Chart
of Accounts table existed yet when Phase 11 created them; `accounts`
exists by the time this column is added within this same Phase 17
migration, so there is no reason to leave the reference undeclared.

No endpoint exposes this column for writing — `CreatePaymentMethodDto`
does not include it, and `PaymentMethod`'s locked API surface (D14, Phase
16) has no PATCH endpoint at all. It is set only via direct data
administration (the e2e suite sets it with a raw `UPDATE` query, exactly
mirroring how the locked spec expects real-world configuration to happen
for a resource with no update endpoint).

**Why this was judged a safe additive change, not a STOP-worthy conflict**:
it adds exactly one nullable column and one FK to an existing table — no
existing column, index, or FK on `payment_methods` is touched (confirmed
live: `SHOW CREATE TABLE payment_methods` after `DOWN` is byte-identical
to its pre-Phase-17 schema — see the implementation report's migration
evidence). No Phase 16 read or write path (`PaymentMethodsService`,
`PaymentMethodsController`, any existing e2e/unit test) references or
depends on this column, since it is simply absent from every DTO Phase 16
built. Phase 16's own `PaymentMethod` entity docblock already flagged (D8)
that "no CashAccount/BankAccount/balance lives on PaymentMethod" as a
Phase-16-scope statement, not a permanent prohibition on Phase 17 ever
adding an accounting-mapping field once a Chart of Accounts existed to
point at.

## 7. Payment -> GL Automatic Posting Flow (D6, D7, D13)

`AccountingPostingService.postPayment()` is the entire cross-phase
integration surface. Its methods accept the caller's transactional
`EntityManager` and **never open their own transaction** — exactly
mirroring `SalesService.applyPayment()`'s / `PurchaseOrdersService.
applyPayment()`'s own contract from Phase 16.

**The one authorized change to `PaymentsService.create()` (D19)**: after
the `Payment` and every `PaymentAllocation` row already exist (so
`sourceId = savedPayment.id` is a real, transaction-local row), the
transaction callback fetches `PaymentMethod`/`Customer`/`Supplier` via the
same transactional `manager` (never the injected repositories, so the read
is consistent with this transaction's own writes) and calls:

```typescript
await this.accountingPostingService.postPayment(
  savedPayment,
  paymentMethodForPosting,
  customerForPosting,
  supplierForPosting,
  userId,
  manager,
);
```

No other line in `create()` — the idempotency check, lock-ordering logic,
`applyPayment()` calls, numbering, or Payment/PaymentAllocation row
creation — was touched. See the implementation report for the literal
before/after comparison.

**Posting rules (LOCKED)**:

```text
RECEIPT: Dr <cash/bank Account from PaymentMethod.glAccountId>
         Cr <Customer.receivableAccountId's Account>

PAYMENT: Dr <Supplier.payableAccountId's Account>
         Cr <cash/bank Account from PaymentMethod.glAccountId>
```

**Fail-closed account-mapping semantics**: if `PaymentMethod.glAccountId`
is null, or does not resolve to a real/active/same-company `Account` row,
or `Customer.receivableAccountId`/`Supplier.payableAccountId` is null or
does not resolve to a real/active/same-company `Account` row —
`AccountingPostingService` throws `AppException(ErrorCode.ValidationError,
...)`. This propagates out of the `TransactionService.run()` callback
inside `PaymentsService.create()`, rolling back **everything** in that
transaction: no `Payment` row, no `PaymentAllocation` row, no
`Sale`/`PurchaseOrder` balance change, no `JournalEntry` — proven live by
a dedicated e2e rollback-safety test that queries the database directly
after the failed request, not just the HTTP response.

**`ValidationError` vs. `Conflict` reasoning**: a missing account mapping
is a configuration/setup problem (someone forgot to configure the
PaymentMethod or Customer/Supplier before taking payments against them) —
closer in kind to "companyId does not reference an active company" (also
`ValidationError` throughout this codebase) than to a genuine runtime
race/state conflict like "this journal is already POSTED" (`Conflict`).
`Conflict` is reserved in this phase for lifecycle-state violations
(double-posting, locked period, closed fiscal year) — situations where the
request was well-formed but the current state disallows it. A missing
account mapping is knowable and fixable in advance, so it is treated as a
request-shape/configuration problem instead.

## 8. Idempotency / Duplicate-Posting Prevention (D15)

`UNIQUE(company_id, source_type, source_id)` on `journal_entries` (partial
in effect, since MySQL treats multiple `NULL`s as non-colliding — the same
behavior `Payment.idempotencyKey`'s own nullable-unique index already
relies on). For Payment posting: `sourceType = 'PAYMENT'`, `sourceId =
payment.id`.

Two-layer protection, mirroring `PaymentsService`'s own idempotency
handling exactly:

1. `AccountingPostingService.postPayment()` checks
   `JournalEntriesService.findBySource(companyId, PAYMENT, payment.id,
   manager)` before creating anything; if found, returns the existing
   journal instead of creating a duplicate.
2. A race backstop: `isDuplicateSourceError()` catches
   `ER_DUP_ENTRY`/errno `1062` narrowed to the source-uniqueness index
   specifically (via the error message containing `"source"` — the index
   is literally named `IDX_je_company_source`), re-fetching the winning
   row instead of surfacing a 500 or creating a duplicate.

In practice, this race cannot actually occur for Payment posting, since
`sourceId = payment.id` is a brand-new UUID unique to each `create()`
call — but `createInternal()`/`findBySource()` are the shared mechanism
any future non-Payment automatic-posting caller would reuse, so the
backstop is implemented at this shared layer rather than assumed
unnecessary.

## 9. Period / Fiscal-Year Enforcement (D10)

`FiscalYear` (`OPEN|CLOSED`) and `AccountingPeriod` (`OPEN|LOCKED`) are
both minimal — no automatic closing/locking workflow, just the status
fields and posting-time enforcement. Journal posting resolves the period
by `companyId` (via the fiscal year) + `entryDate` falling within
`[startDate, endDate]`. Posting into a LOCKED period, or a period whose
fiscal year is CLOSED, is rejected with `409 Conflict` — never silently
redirected to a different period.

**How a period gets created in the first place (D10's own explicit
delegation — no POST endpoint is listed in D22)**:
`AccountingPeriodResolverService.resolveOpenPeriod()` **lazily
auto-creates** a calendar-year `FiscalYear` (Jan 1 - Dec 31 of the entry
date's year, status `OPEN`) and a matching full-year `AccountingPeriod`
(status `OPEN`) the first time any journal entry needs to post into a
`(companyId, year)` for which no period exists yet. A second call for a
date in the same calendar year finds the existing period and reuses it —
verified by a dedicated unit test that at most one pair is ever created
per (company, year), with a race-guard re-check immediately before insert
to prevent a duplicate pair under genuine concurrent first-use.

This was chosen over the alternative (require periods to be pre-seeded
through some lower-level, non-controller mechanism) because the locked
spec explicitly requires `POST /journal-entries/:id/post` and Payment
posting to work end-to-end without inventing an unlisted endpoint — a
purely pre-seeded requirement would leave both of those locked, listed
endpoints permanently broken for any company that has not been manually
seeded through direct DB access, which is not a real operational path.
Lazy creation never implements "automatic closing" (still explicitly
forbidden by D10) — it only ever creates `OPEN` periods on first use;
locking/closing remains entirely a manual, direct-data-administration
step, since no PATCH endpoint for either resource exists (D22 lists none).

## 10. GL / Trial Balance — Read Projections, Never Physical Tables (D5, D20)

`GeneralLedgerService.query()` and `TrialBalanceService.query()` are the
entire read surface (`GET /general-ledger`, `GET /trial-balance`) — plain
`SELECT`/`GROUP BY` queries over `journal_entry_lines` joined to
`journal_entries` (status filter) and `accounts` (names), always filtered
to `status = POSTED`. Neither ever reads `Payment.amount`,
`Sale.paidAmount`, or `PurchaseOrder.balanceAmount` — those are
operational data, not accounting source of truth (D5). No dashboard,
chart, KPI engine, or Balance Sheet/P&L/Cash Flow report exists (D20).

Trial Balance additionally computes global `totalDebit`/`totalCredit`
across all account rows using the same integer-cents summation discipline
as `double-entry.ts` — proven to be exactly equal by a dedicated e2e test
asserting `trialBalance.totalDebit === trialBalance.totalCredit` after
posting real journals through the real API.

## 11. RBAC (D14)

Exactly eight new permissions, appended to the existing idempotent
`rbac.seed.ts` catalog — verified live (first run: 8 new permissions, 8
new grants, 4 new `ALL`-scope rows; re-run: zero output beyond the
completion line):

| Permission | Notes |
|---|---|
| `accounts.read` | `GET /accounts`, `GET /accounts/:id` |
| `accounts.create` | `POST /accounts` |
| `accounts.update` | `PATCH /accounts/:id` (including activate/deactivate via `isActive`) |
| `journal_entries.read` | `GET /journal-entries`, `GET /journal-entries/:id` |
| `journal_entries.create` | `POST /journal-entries` (creates DRAFT) |
| `journal_entries.post` | `POST /journal-entries/:id/post` |
| `general_ledger.read` | `GET /general-ledger` |
| `trial_balance.read` | `GET /trial-balance` |

No `.approve`/`.reject`/`.reverse`/`.delete`/`general_ledger.write` or any
other verb — exactly D14's locked list, nothing more. `general_ledger` and
`trial_balance` are their own distinct `RoleResourceScope` resources (not
folded into `journal_entries`), so GL/Trial-Balance read access can be
granted independently of manual journal-entry authoring access.

## 12. DataScope / Company Scoping

`resolveRequestCompanyId()` (Phase 09's helper, unmodified) is reused
identically by all four new controllers — no new scope kind, no second
authorization mechanism. Cross-company `Account`/`JournalEntry` ids
resolve to `404`, never a leaked existence signal or a `403`, matching
every phase's convention since Phase 09 (verified live by dedicated e2e
tests on both resources).

## 13. Transactions Used

- `AccountsService`: no `TransactionService.run()` — single-row
  create/update operations, consistent with Category's own precedent.
- `JournalEntriesService.create()`: one `TransactionService.run()` call
  wrapping period resolution, journal-number generation, and
  `JournalEntry`+`JournalEntryLine` row creation.
- `JournalEntriesService.post()`: one `TransactionService.run()` call
  wrapping the row lock (`SELECT ... FOR UPDATE`), balance re-derivation,
  period/fiscal-year re-validation, and the `POSTED` status update.
- `AccountingPostingService.postPayment()`/`JournalEntriesService.
  createInternal()`: **no own transaction** — participate in
  `PaymentsService.create()`'s single existing `TransactionService.run()`
  call (D7, D13). A posting failure at any point rolls back the entire
  Payment transaction.

## 14. Migration / Database Schema (D23)

One migration, `1786590000000-CreateAccountingTables.ts`, in dependency
order: `accounts -> company_journal_counters -> fiscal_years ->
accounting_periods -> journal_entries -> journal_entry_lines`, plus one
additive `ALTER TABLE payment_methods ADD gl_account_id ...` at the end
(after `accounts` exists, since it FKs to it). Verified UP -> DOWN -> UP
against real Dockerized MySQL 8.0.40 with `SHOW CREATE TABLE` inspection
of all six new tables and the modified `payment_methods` table — see the
implementation report for the full live evidence, including a byte-for-
byte diff proving `payments`/`payment_methods`/`purchase_orders`/
`stock_movements` are identical before the migration and after a full
DOWN cycle (with `payment_methods` correctly losing exactly its
`gl_account_id` column/FK on DOWN and nothing else).

## 15. Explicit Deferrals — Full List (per this phase's own locked D1-D24)

- **Sale/Purchase posting** (D6): no automatic GL posting from
  `SalesService.confirm()` or `PurchaseOrdersService.confirm()` — neither
  file was modified by this phase at all (confirmed by grep — see the
  implementation report). Only `Payment` posts automatically.
- **COGS / inventory valuation** (D8): no stock-to-GL integration of any
  kind exists.
- **Tax** (D17): no `TaxRate`/`TaxCode`/`InputTax`/`OutputTax` posting
  infrastructure. Existing tax-snapshot data on `Sale`/`SaleItem` is not
  read by this phase at all.
- **Multi-currency** (D16): `JournalEntry`/`JournalEntryLine` carry no
  `currency` column at all — everything posts in the company's base
  currency, matching the Payment's own currency 1:1 (no conversion). No
  `Currency` entity, no `ExchangeRate`.
- **Reversal / correction** (D3, D21): no reversal endpoint, no correction
  API. `JournalEntryStatus.Cancelled` only reaches an unposted `DRAFT` —
  nothing in this phase ever reverses a `POSTED` journal's financial
  effect. A future phase adding reversal would need to decide, as Phase 16
  explicitly deferred for Payment refunds, whether a reversal is a new
  `JournalEntry` (accounting-correct, preserves immutable history) or a
  mutation of the original (which D3 currently forbids entirely).
- **Approval workflow** (D2): no `SUBMITTED`/`APPROVED`/`REJECTED` states
  — `DRAFT -> POSTED`/`CANCELLED` only, exactly as locked.
- **Cash/Bank entities** (D18): no `CashAccount`/`BankAccount`/
  `BankReconciliation` — cash/bank accounts are ordinary `Account` rows
  with `accountType = ASSET`, distinguished only by
  `PaymentMethod.glAccountId` pointing at them.
- **Outbox / events / background workers** (D7): Payment->GL posting is
  synchronous, inside the same transaction, by design — no
  Outbox/BullMQ/Redis/event-subscriber pattern exists anywhere in this
  phase, and none is needed for anything this phase itself does (see §16,
  "Next phase" note, for why Phase 18's own Outbox work does not retroactively
  create a gap here).
- **Reporting dashboards** (D20): only the two locked read endpoints exist
  — no Balance Sheet, P&L, Cash Flow, or KPI engine.
- **Opening Balance generation** (D11): `JournalSourceType.OpeningBalance`
  exists as a reserved enum value — nothing in this phase ever creates a
  journal with this `sourceType`. No endpoint or automatic trigger
  consumes `Customer.openingBalanceAmount`/`Supplier.openingBalanceAmount`
  as a journal seed value. This is a deliberate minimal-scope choice: the
  mechanism (the enum value, and the fact that `JournalEntry` has no
  structural reason it couldn't carry this `sourceType`) is ready for a
  future phase to use, without this phase inventing an endpoint or trigger
  with no concrete current caller.
- **No Bruno API collection** — consistent with every prior phase.

## 16. AI_CONTEXT / Next-Phase Integration Contract

Phase 17's own posting is synchronous by construction (D7) — nothing it
does needs an Outbox, event bus, or background worker to be correct. A
future "Phase 18 — Outbox Pattern" is expected to be an infrastructure
phase (reliable async delivery for cross-service/cross-process
integration), not something Phase 17 itself needs retrofitted. If a
future phase adds Sale/Purchase-to-GL posting (explicitly out of scope
here per D6), *that* future work may benefit from an Outbox to avoid
holding open a long transaction across Sale confirmation and GL posting —
but that is a decision for whichever phase actually builds Sale/Purchase
posting, not a gap this phase leaves behind.

## 17. Security Decisions Summary

- Never trust client-submitted `journalNumber`/`status`/`sourceType`/
  `sourceId`/`postedBy`/`postedAt` — `CreateJournalEntryDto` has no fields
  for any of these; `sourceType` is always server-set to `MANUAL` for
  entries created through the public API. The existing global
  `forbidNonWhitelisted` `ValidationPipe` rejects any attempt to submit
  them (400).
- Cross-company `Account`/`JournalEntry` id -> 404 (IDOR-safe, no
  existence leak), matching every phase's convention since Phase 09.
- Posting into a locked period / closed fiscal year -> 409, never silently
  redirected to a different period.
- Missing Payment account mapping -> 400 (`ValidationError`), the entire
  Payment transaction rolls back — no partial state of any kind.
- Unknown/extra fields -> 400 (existing global `ValidationPipe`).
- No refund/reverse/void/PATCH/DELETE endpoint anywhere on `JournalEntry`
  once `POSTED` -> 404/405.
