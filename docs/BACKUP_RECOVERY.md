# Backup And Recovery

## MySQL

- Backup before every production migration.
- Keep scheduled logical backups and periodic restore drills.
- Treat accounting, payments, and inventory tables as financially critical.
- Do not mark backup testing PASS unless a real restore was executed.

## Redis

- Redis is cache/infrastructure only and must fail open.
- Redis data loss should not corrupt source-of-truth financial records.
- Rebuild cache from MySQL after Redis restart or replacement.

## Kafka / Outbox

- Kafka transport outages must not block financial commits.
- The transactional outbox preserves unpublished events in MySQL until the worker can publish them.
- Recovery procedure:
  1. restore Kafka or restart the broker
  2. verify worker readiness
  3. confirm outbox pending/failed counts drain
  4. verify `processed_events` idempotency remains intact

## BullMQ / Notifications

- Notification jobs remain retryable in Redis/BullMQ.
- After worker restart, verify queue backlog drains and failed notifications are observable.
- Do not manually replay jobs until the root cause of the failure is known.

## Migration Safety

- Recommended sequence:
  1. build
  2. backup/check
  3. migration up
  4. application startup
  5. smoke verification
- Never modify previously applied historical migrations.
