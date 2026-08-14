/**
 * Phase 18 addition: raises Jest's default per-test/per-hook timeout
 * (normally 5000ms) for the whole e2e suite.
 *
 * Every e2e spec in this project bootstraps the full `AppModule` via
 * `Test.createTestingModule({ imports: [AppModule] }).compile()` +
 * `app.init()`/`app.close()`. Since Phase 18 wires `KafkaModule` and
 * `OutboxModule` at the `AppModule` level (and `PaymentEventConsumer`
 * starts a real Kafka consumer group on module init), EVERY e2e suite now
 * pays a real network round-trip to Kafka on `beforeAll`/`afterAll` —
 * not just Payment-related suites. Measured directly against the real
 * broker this project's docker-compose brings up: `consumer.run()` (group
 * join) took ~3.1s and `consumer.disconnect()` (group leave) took ~5.5s on
 * their own — already exceeding the previous 5000ms default before any DB
 * work or HTTP calls happen at all.
 *
 * This is a real cost of testing against real infrastructure (this
 * project's own established discipline — see CLAUDE.md/AI_CONTEXT.md
 * "verify against real infra, not mocks"), not a flaky test — so the fix
 * is to budget for it honestly rather than mock Kafka out of the e2e tier.
 * 30s comfortably covers Kafka connect + consumer group join/leave + the
 * DB work every suite's fixtures already do.
 */
jest.setTimeout(30000);
