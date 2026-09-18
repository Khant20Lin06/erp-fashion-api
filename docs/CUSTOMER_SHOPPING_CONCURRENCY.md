# Durable customer shopping: first implementation stage

## Contract and ownership

`POST /api/v1/customer-portal/shopping/step` requires JWT/session authentication,
`customer_portal.order.create` AND `products.read`, and authorized product company
scope. The integration is trusted to relay Telegram input and API results.
Customers do not authenticate to this integration endpoint directly.

Initial body: `{companyId, update}`. `update_id` must be a safe nonnegative integer;
the private chat must match the Telegram sender. Continuation body adds
`operationToken` and `response: {statusCode, body?}`. The backend accepts no client
cart/context, cookies or response headers. Request size is bounded to 128 KiB
(the HTTP server can impose a lower limit).

Results are `{status:'ready', context, operationToken?}` or
`{status:'busy', retryAfterMs:1000}`. Context preserves the established shopping
request/message format. n8n continues to call the ordinary guarded catalog,
profile, linking, AI and order endpoints; state storage does not bypass them.

## Database and concurrency

- `shopping_sessions`: deterministic SHA-256 identity of company, authenticated
  bot user and Telegram user; JSON cart/selection/conversation state; active event.
- `shopping_events`: unique session/update receipt, normalized original update,
  input hash, current context, opaque operation token, consumed token and response
  hash. Completed initial duplicates produce no new request/reply; a retry of the
  immediately consumed continuation returns the saved result. Older tokens fail.
- `sales.creation_key` and `creation_hash`: nullable internal retry fields. The
  unique company/key constraint is the final duplicate barrier. Existing callers
  without a key keep their old behavior. These fields are not public sale input.

Session upsert plus `SELECT ... FOR UPDATE` protects every state transition.
Transactions contain no HTTP calls, sleeps, AI calls or second service-owned
transactions. An active event blocks other events for its customer, across API
instances. Incoming busy events are retried by n8n, not durably queued; there is
no claim of global FIFO ordering or guaranteed delivery of every update.

Sale creation keeps its existing transaction ownership. Counter locking and a
current locking read handle concurrent retries; the unique key handles races
across separate year counters. OnlineOrder remains a second write with its own
unique saleId and repeatable creation. No automatic stock reservation was added.

## Apply and verify

From the API directory, with the intended local environment configured:

```powershell
node -r ts-node/register/transpile-only scripts/migrate-shopping-state.cjs
npm run build
```

The migration helper runs only AddSaleCreationKey1788810000000,
CreateShoppingState1788820000000 and AddShoppingEventPayload1788830000000. It
leaves unrelated pending migrations untouched. These are additive migrations;
their down methods remove feature data and must not be used for ordinary retry.
Deploy migrations before starting the new application version. MySQL DDL is not
fully transactional; investigate partial migration failures before rerunning.

`scripts/test-shopping-concurrency.cjs` runs against the fixed disposable database
`fashion_shopping_concurrency_test`. Provision it separately with access for the
existing local app user. The script refuses another database name and recreates
only its test tables. It does not create real customer orders in the app database.

```powershell
node -r ts-node/register/transpile-only scripts/test-shopping-concurrency.cjs
```

It exercises real MySQL migrations, row locks, duplicate receipts, restart replay,
50 independent customer sessions, and 20 concurrent same-key sales/online orders.
Catalog/customer/pricing lookups for the sale test are controlled fixtures; this
does not benchmark AI throughput, Telegram limits, or the full live checkout.

## Recovery and retention

If n8n stops before persisting an API response, replay the original normalized
update as `{companyId, update}` using the **same authenticated bot account**.
It returns the saved request/token. Failed idempotent order calls are retried
twice by the workflow; persistent timeout/5xx leaves the active event intact for
operator recovery. A changed company/account creates a different session and
must not be used to recover an old checkout.

Operators with database access can locate pending work with:

```sql
SELECT s.company_id, s.bot_user_id, s.telegram_user_id,
       s.active_event_id, e.update_payload, s.updated_at
FROM shopping_sessions s
JOIN shopping_events e ON e.session_id = s.id AND e.event_id = s.active_event_id
WHERE s.active_event_id IS NOT NULL;
```

Treat this output as customer data. Feed `update_payload` back through the same
workflow/account; do not edit cart JSON, invent a new checkout key, or clear a
pending submission. Definitive errors and legacy orders without keys still need
staff reconciliation. If an old receipt predates update_payload, use the original
execution/update only if available; do not guess it.

Receipts currently have no automatic deletion policy. They contain customer text
and context, so protect them and define an operational retention period before
large rollout. Never prune pending events or delete session rows that still own
receipts. Cart inactivity expiry does not imply receipt expiry.

Outbound Telegram delivery remains outside the order transaction. Failure to send
a reply cannot undo a committed sale, and a repeated continuation can repeat a
reply. A durable delivery queue, AI budgets, inbound durable FIFO queue, capacity
benchmarks and permanent hosting are separate rollout stages.

## Rollout status

The old workflow's static-data carts are not migrated automatically. Before
switching the live workflow, finish/reconcile its in-flight checkouts and tell
customers with unfinished carts to select their items again. Do not run old and
new order intake simultaneously: legacy requests may have no idempotency key.

Local migrations and source tests are tracked in the workspace implementation
plan. The generated n8n workflow is an inactive import artifact. Import/publish
and a real Telegram end-to-end checkout still require the connected live n8n
environment; local service tests are not proof of live workflow activation.
