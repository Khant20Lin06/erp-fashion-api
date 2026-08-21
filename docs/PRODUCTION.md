# Production Deployment Notes

## Runtime Roles

- `APP_ROLE=api`: HTTP traffic, auth, CRUD, reports, and cache-backed reads.
- `APP_ROLE=worker`: outbox polling, Kafka consumers, and BullMQ workers.
- `APP_ROLE=all`: local development and all-in-one test mode only.

## Deployment Order

1. Build the production image.
2. Validate required environment variables.
3. Take a MySQL backup/checkpoint.
4. Run migrations explicitly.
5. Start `worker` and `api`.
6. Verify `/api/v1/health/live`, `/api/v1/health/ready`, `/metrics`, `/docs`, and `/docs-json`.

## Readiness Semantics

- `api` readiness requires MySQL.
- `worker` readiness requires MySQL, Redis, Kafka, and BullMQ Redis connectivity.
- Liveness is process-only and must not fail because Redis or Kafka is temporarily unavailable.

## Tuning Knobs

- `DB_POOL_SIZE`
- `DB_CONNECT_TIMEOUT_MS`
- `REDIS_CONNECT_TIMEOUT_MS`
- `KAFKA_CONNECTION_TIMEOUT_MS`
- `KAFKA_REQUEST_TIMEOUT_MS`
- `NOTIFICATION_WORKER_CONCURRENCY`
- `READINESS_TIMEOUT_MS`
- `HTTP_REQUEST_TIMEOUT_MS`
- `HTTP_KEEP_ALIVE_TIMEOUT_MS`
- `HTTP_HEADERS_TIMEOUT_MS`

## Metrics

- `/metrics` exposes low-cardinality operational metrics only.
- Do not expose `/metrics` publicly without network controls or reverse-proxy protection.
