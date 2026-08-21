import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWebhookTables1786660000000 implements MigrationInterface {
  name = 'CreateWebhookTables1786660000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- webhook_subscriptions ----
    await queryRunner.query(
      `CREATE TABLE \`webhook_subscriptions\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` char(36) NOT NULL, \`url\` varchar(500) NOT NULL, \`description\` varchar(500) NULL, \`events\` json NOT NULL, \`secret\` varchar(255) NOT NULL, \`is_active\` tinyint NOT NULL DEFAULT 1, \`failure_count\` int NOT NULL DEFAULT '0', \`last_delivered_at\` timestamp NULL, \`created_by\` char(36) NULL, \`updated_by\` char(36) NULL, INDEX \`IDX_whsub_company_id\` (\`company_id\`), INDEX \`IDX_whsub_is_active\` (\`is_active\`), INDEX \`IDX_whsub_company_active\` (\`company_id\`, \`is_active\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- webhook_deliveries ----
    await queryRunner.query(
      `CREATE TABLE \`webhook_deliveries\` (\`id\` varchar(36) NOT NULL, \`webhook_subscription_id\` char(36) NOT NULL, \`event_id\` char(36) NOT NULL, \`event_type\` varchar(150) NOT NULL, \`status\` enum ('PENDING', 'DELIVERED', 'FAILED') NOT NULL DEFAULT 'PENDING', \`attempt\` int NOT NULL DEFAULT '0', \`response_status\` int NULL, \`response_body\` varchar(1000) NULL, \`error_message\` varchar(1000) NULL, \`delivered_at\` timestamp NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_whdel_subscription_event\` (\`webhook_subscription_id\`, \`event_id\`), INDEX \`IDX_whdel_subscription_id\` (\`webhook_subscription_id\`), INDEX \`IDX_whdel_status\` (\`status\`), INDEX \`IDX_whdel_subscription_created\` (\`webhook_subscription_id\`, \`created_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- FKs ----
    await queryRunner.query(
      `ALTER TABLE \`webhook_subscriptions\` ADD CONSTRAINT \`FK_whsub_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`webhook_subscriptions\` ADD CONSTRAINT \`FK_whsub_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`webhook_deliveries\` ADD CONSTRAINT \`FK_whdel_subscription\` FOREIGN KEY (\`webhook_subscription_id\`) REFERENCES \`webhook_subscriptions\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`webhook_deliveries\` DROP FOREIGN KEY \`FK_whdel_subscription\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`webhook_subscriptions\` DROP FOREIGN KEY \`FK_whsub_created_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`webhook_subscriptions\` DROP FOREIGN KEY \`FK_whsub_company\``,
    );

    await queryRunner.query(
      `DROP INDEX \`IDX_whdel_subscription_created\` ON \`webhook_deliveries\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_whdel_status\` ON \`webhook_deliveries\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_whdel_subscription_id\` ON \`webhook_deliveries\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_whdel_subscription_event\` ON \`webhook_deliveries\``,
    );
    await queryRunner.query(`DROP TABLE \`webhook_deliveries\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_whsub_company_active\` ON \`webhook_subscriptions\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_whsub_is_active\` ON \`webhook_subscriptions\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_whsub_company_id\` ON \`webhook_subscriptions\``,
    );
    await queryRunner.query(`DROP TABLE \`webhook_subscriptions\``);
  }
}
