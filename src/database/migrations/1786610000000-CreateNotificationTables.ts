import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 21 — Notifications (async downstream of the existing
 * `payment.confirmed` Kafka event, LOCKED scope). One new table, purely
 * additive — no ALTER to any existing table. `notifications.company_id`
 * and `notifications.user_id` are real FKs (RESTRICT), matching every
 * other transactional-document table's tenancy-FK convention;
 * `source_event_id` carries no FK (it is a Kafka event envelope id, not a
 * row in any local table — same "polymorphic/external pointer, no FK"
 * precedent as StockMovement.reference_id / OutboxEvent.aggregate_id).
 * `user_id` is always NULL in this phase (company-level recipient model —
 * see Notification entity docblock) but the FK/index exist now so a future
 * phase can populate it without another migration.
 */
export class CreateNotificationTables1786610000000 implements MigrationInterface {
  name = 'CreateNotificationTables1786610000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`notifications\` (\`id\` varchar(36) NOT NULL, \`company_id\` char(36) NOT NULL, \`user_id\` char(36) NULL, \`event_type\` varchar(150) NOT NULL, \`channel\` enum ('IN_APP') NOT NULL DEFAULT 'IN_APP', \`title\` varchar(200) NOT NULL, \`body\` text NOT NULL, \`data\` json NOT NULL, \`status\` enum ('PENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING', \`source_event_id\` varchar(36) NOT NULL, \`sent_at\` timestamp NULL, \`failed_at\` timestamp NULL, \`last_error\` varchar(1000) NULL, \`read_at\` timestamp NULL, \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, \`deleted_at\` timestamp NULL, UNIQUE INDEX \`IDX_notif_source_event_channel\` (\`source_event_id\`, \`channel\`), INDEX \`IDX_notif_company_id\` (\`company_id\`), INDEX \`IDX_notif_user_id\` (\`user_id\`), INDEX \`IDX_notif_event_type\` (\`event_type\`), INDEX \`IDX_notif_channel\` (\`channel\`), INDEX \`IDX_notif_status\` (\`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `ALTER TABLE \`notifications\` ADD CONSTRAINT \`FK_notif_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`notifications\` ADD CONSTRAINT \`FK_notif_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`notifications\` DROP FOREIGN KEY \`FK_notif_user\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`notifications\` DROP FOREIGN KEY \`FK_notif_company\``,
    );

    await queryRunner.query(
      `DROP INDEX \`IDX_notif_status\` ON \`notifications\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_notif_channel\` ON \`notifications\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_notif_event_type\` ON \`notifications\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_notif_user_id\` ON \`notifications\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_notif_company_id\` ON \`notifications\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_notif_source_event_channel\` ON \`notifications\``,
    );
    await queryRunner.query(`DROP TABLE \`notifications\``);
  }
}
