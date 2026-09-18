# Bot login reliability — September 14, 2026

## Incident evidence

The September 12 n8n failures at approximately 15:09:59 and 15:10:05 UTC lost their original status/body in the HTTP node's JSON parser. Do not describe them as a proven 502, 504, or bad password.

`.tmp/fashion-tunnel-20260912-204644.err.log` in the workspace root records the tunnel disconnecting at **15:10:00 UTC**, failing to serve an incoming request, and reconnecting at **15:10:19**. This closely matches the incident. API logs show preceding successful login requests in 68–118 ms, last at 15:09:44, with no corresponding login completion during the reported failures. This supports a tunnel interruption rather than an application login exception.

Read-only diagnostics on September 13 found MySQL maximum used connections 4 against a server limit of 151, zero connection-limit errors, and an API pool size of 10. These are observations, not a load-capacity guarantee. The bot had 172 active refresh sessions. Its configured auth limiter is **10 attempts per 60 seconds** per source/email. A new login for every customer update can exhaust this allowance across customers and creates unnecessary refresh sessions; that remains a scaling limitation. Security limits were not disabled or increased.

## Implemented changes

- Login explicitly declares `application/json; charset=utf-8` and `Cache-Control: no-store`.
- The global exception filter explicitly overwrites a previously assigned non-JSON content type before sending JSON. Application-raised 5xx exceptions no longer return upstream HTML/internal details inside their message.
- Preserve the existing API contract: success is `{ "user": { ... } }` with both HttpOnly session cookies. Errors are `{ "success": false, "statusCode": 401, "code": "UNAUTHORIZED", "message": "...", "path": "...", "timestamp": "...", "requestId": "..." }`. Failed authentication does not issue session cookies.
- n8n consumes the full Text response without eager JSON parsing; Text bodies arrive as `data`, while other adapters may use `body`. Both are handled. A successful status, JSON user profile, and both named session cookies are required before subsequent API calls.
- Only transport failures and 502/503/504/520–524/530 trigger login retries: at most three total attempts, with 5- and 15-second delays and a 12-second request timeout. Credential errors and 429 are not retried. The same pending shopping update is preserved.
- The reducer retains bounded status, content type, Cloudflare Ray ID and request ID diagnostics without copying response bodies/passwords/cookies into the diagnostic object. Ordinary n8n HTTP execution storage can still retain raw response headers according to workflow retention settings.

## Verification

- 35 backend auth/filter/guard/service tests passed; build passed. The HTTP contract suite uses the real controller, guard, validation and exception filter with isolated dependencies. It covers success/cookies, malformed JSON, validation, 401, rapid-request 429, and application 500/502/503/504. It is not a production database load benchmark.
- 79 root workflow/transport/shopping tests passed, including the actual n8n `data` response shape.
- Manual-only n8n probe `dZcTz14zJ1TdumAr`, execution 14: three injected gateway failures stop after three attempts without any API/order action.
- Execution 17: one injected gateway failure followed by **real** public bot login; both cookies present and pending update preserved.
- Execution 18: same recovery, then **real authenticated GET /auth/me** returned 200 with the expected bot ID. No Telegram messages or production orders were created by these probes. Probe remains inactive/unpublished.
- September 13 disposable database test: 50 independent customers, duplicate-event isolation, and 20 concurrent checkout retries producing exactly one Sale, one SaleItem and one OnlineOrder in `fashion_shopping_concurrency_test`.

## Infrastructure boundary and remaining work

Cloudflare can generate errors before a request reaches Nest. The application cannot set the body or Content-Type of those responses, nor guarantee a response when a TCP connection fails or the host is stopped. Cloudflare documents that [Quick Tunnels have no uptime SLA and are for development](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/), and [tunnel 502 errors can occur when the local origin is unreachable](https://developers.cloudflare.com/tunnel/troubleshooting/).

On September 14 Docker Desktop and the old tunnel were stopped. Starting Docker and the existing compose stack restored the API. The replacement tunnel is `https://bundle-physically-relationship-surgeon.trycloudflare.com` (PID 16984; root log `.tmp/fashion-tunnel-20260914-085015.err.log`). Its address/lifetime is temporary.

Always-on hosting or a supervised named tunnel on an always-on host is still required for 24/7 service. A gateway under our control can normalize received upstream errors, but cannot guarantee delivery during all network/edge failures. For many simultaneous customers, implement protected shared bot-session reuse with expiry, serialized refresh/reauthentication, and revocation handling; never store shared credentials in customer shopping state. Native Telegram checkout through final order submission has not been reverified in this change. Do not claim `orderCreated: true` for a production Telegram order from the isolated tests.
