import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 18 — Transactional Outbox / Event infrastructure (D-locked, see
 * docs/EVENT_ARCHITECTURE.md). Two new tables, no dependency between them:
 * outbox_events (producer-side durable publish-intent log, written in the
 * SAME transaction as the business mutation it accompanies) and
 * processed_events (consumer-side idempotency ledger, DB-table-backed, not
 * an in-memory Set). No ALTER to any existing table — purely additive.
 *
 * outbox_events.aggregate_id carries no FK (polymorphic pointer — matches
 * the StockMovement.reference_id / PaymentAllocation.reference_id /
 * JournalEntryLine.reference_id precedent already established in this
 * schema, since aggregate_id points to a different table depending on
 * aggregate_type). company_id/branch_id DO get real FKs since every event
 * this phase emits is company-scoped exactly like every other transactional
 * document table.
 *
 * processed_events has no FK to outbox_events at all — a consumer records
 * what event ids it has processed independently of the producer's own
 * bookkeeping (consumers may in principle run as an entirely separate
 * service reading only from Kafka).
 */
export class CreateOutboxTables1786600000000 implements MigrationInterface {
  name = 'CreateOutboxTables1786600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- outbox_events ----
    await queryRunner.query(
      `CREATE TABLE \`outbox_events\` (\`id\` varchar(36) NOT NULL, \`event_id\` char(36) NOT NULL, \`event_type\` varchar(150) NOT NULL, \`event_version\` int NOT NULL DEFAULT '1', \`aggregate_type\` varchar(100) NOT NULL, \`aggregate_id\` char(36) NOT NULL, \`company_id\` char(36) NOT NULL, \`branch_id\` char(36) NULL, \`source\` varchar(100) NOT NULL, \`correlation_id\` varchar(100) NULL, \`causation_id\` varchar(100) NULL, \`occurred_at\` timestamp NOT NULL, \`payload\` json NOT NULL, \`status\` enum ('PENDING', 'PUBLISHED', 'FAILED') NOT NULL DEFAULT 'PENDING', \`attempt_count\` int NOT NULL DEFAULT '0', \`available_at\` timestamp NOT NULL, \`published_at\` timestamp NULL, \`last_error\` varchar(1000) NULL, \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE INDEX \`IDX_oe_event_id\` (\`event_id\`), INDEX \`IDX_oe_status_available_at\` (\`status\`, \`available_at\`), INDEX \`IDX_oe_company_occurred_at\` (\`company_id\`, \`occurred_at\`), INDEX \`IDX_oe_company_id\` (\`company_id\`), INDEX \`IDX_oe_status\` (\`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `ALTER TABLE \`outbox_events\` ADD CONSTRAINT \`FK_oe_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`outbox_events\` ADD CONSTRAINT \`FK_oe_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    // ---- processed_events ----
    await queryRunner.query(
      `CREATE TABLE \`processed_events\` (\`id\` varchar(36) NOT NULL, \`event_id\` varchar(36) NOT NULL, \`consumer_name\` varchar(150) NOT NULL, \`processed_at\` timestamp NOT NULL, \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE INDEX \`IDX_pe_event_id_consumer_name\` (\`event_id\`, \`consumer_name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ---- processed_events (no FK dependents) ----
    await queryRunner.query(
      `DROP INDEX \`IDX_pe_event_id_consumer_name\` ON \`processed_events\``,
    );
    await queryRunner.query(`DROP TABLE \`processed_events\``);

    // ---- outbox_events ----
    await queryRunner.query(
      `ALTER TABLE \`outbox_events\` DROP FOREIGN KEY \`FK_oe_branch\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`outbox_events\` DROP FOREIGN KEY \`FK_oe_company\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_oe_status\` ON \`outbox_events\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_oe_company_id\` ON \`outbox_events\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_oe_company_occurred_at\` ON \`outbox_events\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_oe_status_available_at\` ON \`outbox_events\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_oe_event_id\` ON \`outbox_events\``,
    );
    await queryRunner.query(`DROP TABLE \`outbox_events\``);
  }
}
