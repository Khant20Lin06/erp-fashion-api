# Backend customer assistant

The customer bot uses a Lead agent to select Sales or Support. Each specialist
has its own prompt and read-only tools. Vercel AI SDK runs inside Nest; n8n
transports updates and renders the existing Telegram cards. This configuration
is independent of the staff ERP assistant.

## Configuration

Set `CUSTOMER_MULTI_AGENT_ENABLED=true`,
`CUSTOMER_MULTI_AGENT_PROVIDER=google`, `CUSTOMER_MULTI_AGENT_MODEL` to an
available model ID, and `GOOGLE_GENERATIVE_AI_API_KEY` (or `GEMINI_API_KEY`).
The explicit `openai-compatible` provider uses `AI_BASE_URL`, `AI_API_KEY`, and
`AI_CHAT_MODEL` when no customer-specific model is set. Restart/recreate the
backend after environment changes; Docker Compose restart alone does not load
changed env-file values. Enable n8n `assistantEnabled` only after verifying the
backend provider. Never put the provider key into workflow JSON.

`BOT_SESSION_ALLOWED_EMAILS` is a comma-separated allowlist for the separate
`POST /api/v1/auth/bot-session` endpoint. Empty disables it. The request uses the
existing email/password credential; a successful response contains `{user}` and
an HttpOnly access cookie. It does not issue refresh cookies or create refresh
sessions. Set n8n `authMode=bot-session` only after this endpoint is verified.
Ordinary `/auth/login` and its refresh/session behavior are unchanged.

## Durable execution

1. `POST /customer-portal/shopping/step` returns an `AGENT` continuation and an
   operation token when natural language needs the team.
2. n8n calls `POST /customer-portal/shopping/assistant` with only
   `{companyId, update, operationToken}` and its authenticated bot cookie.
3. The backend locks the customer's shopping session, verifies the durable
   event and token, and claims a run. It releases the transaction before model
   or tool IO. A concurrent request returns `{status:"busy",retryAfterMs:1000}`.
4. A ready result contains `{status:"ready",action,degraded,trace}`. Retries reuse
   the persisted result. n8n sends only `action` back to the original shopping
   continuation. A null action invokes the existing deterministic fallback.

The assistant has a 40-second outer deadline, a 60-second recovery lease, and
at most two run claims per operation. The existing operation expires after
180 seconds. A stale worker cannot overwrite a newer owner's result. The
existing durable limit permits at most eight tool calls for the operation,
including recovery attempts. Model/provider retries are bounded separately.

## Data and checkout authority

Sales can search, read product detail, and retrieve popularity. Support can
read approved public policy and orders belonging to the currently linked
Telegram customer. Identity and company are supplied by the backend, never by
the model. Public policy comes from `CUSTOMER_BOT_PUBLIC_POLICIES`; missing data
must not be presented as an invented policy. Popularity currently measures
all-time confirmed line revenue, not sales in a recent date window.

The model returns an existing shopping action. Product cards, available colors,
sizes, variant/SKU resolution, current prices, cart mutation, and confirmed order
creation remain in the deterministic shopping service. Model tools cannot
submit orders, alter inventory, cancel orders, or charge payments. Diagnostics
store bounded agent names/counters, not prompts, reasoning, keys, or tool data.

## Verification and hosting

Unit suites exercise routing/tool separation, durable duplicate suppression,
scope/stale-token rejection, invalid output, and timeout fallback. The existing
`scripts/test-shopping-concurrency.cjs` adds a real SQL claim/cache/restart test
using only the fixed disposable `fashion_shopping_concurrency_test` database.
Fixture tests are not proof of Gemini response quality or live Telegram delivery.

A quick Cloudflare tunnel can fail before requests reach Nest and return HTML.
This code cannot enforce JSON on Cloudflare-generated responses. For 24/7 use,
deploy the backend with supervised restart, stable DNS, health monitoring, and
persistent MySQL/Redis. A named tunnel stabilizes the URL but still depends on
the host computer, its power, and its network connection.
