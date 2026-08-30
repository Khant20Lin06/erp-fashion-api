import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEnterprisePurchaseLifecycle1786740000000
  implements MigrationInterface
{
  name = 'AddEnterprisePurchaseLifecycle1786740000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` MODIFY COLUMN \`status\` enum ('DRAFT', 'SUBMITTED', 'APPROVED', 'CONFIRMED', 'REJECTED', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` ADD COLUMN \`submitted_at\` timestamp NULL AFTER \`updated_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` ADD COLUMN \`submitted_by\` char(36) NULL AFTER \`submitted_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` ADD COLUMN \`approved_at\` timestamp NULL AFTER \`submitted_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` ADD COLUMN \`approved_by\` char(36) NULL AFTER \`approved_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` ADD COLUMN \`rejected_at\` timestamp NULL AFTER \`approved_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` ADD COLUMN \`rejected_by\` char(36) NULL AFTER \`rejected_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` ADD COLUMN \`rejected_reason\` varchar(500) NULL AFTER \`rejected_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` ADD COLUMN \`closed_at\` timestamp NULL AFTER \`rejected_reason\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` ADD COLUMN \`closed_by\` char(36) NULL AFTER \`closed_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` ADD COLUMN \`close_reason\` varchar(500) NULL AFTER \`closed_by\``,
    );

    await queryRunner.query(
      `DROP INDEX \`IDX_pi_company_purchase_order\` ON \`purchase_invoices\``,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_pi_company_purchase_order\` ON \`purchase_invoices\` (\`company_id\`, \`purchase_order_id\`)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_invoices\` ADD COLUMN \`status\` enum ('DRAFT', 'POSTED', 'VOIDED') NOT NULL DEFAULT 'DRAFT' AFTER \`due_date\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_invoices\` ADD COLUMN \`posted_at\` timestamp NULL AFTER \`updated_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_invoices\` ADD COLUMN \`posted_by\` char(36) NULL AFTER \`posted_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_invoices\` ADD COLUMN \`voided_at\` timestamp NULL AFTER \`posted_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_invoices\` ADD COLUMN \`voided_by\` char(36) NULL AFTER \`voided_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_invoices\` ADD COLUMN \`void_reason\` varchar(500) NULL AFTER \`voided_by\``,
    );
    await queryRunner.query(
      `UPDATE \`purchase_invoices\` SET \`status\` = 'POSTED', \`posted_at\` = COALESCE(\`updated_at\`, \`created_at\`), \`posted_by\` = COALESCE(\`updated_by\`, \`created_by\`)`,
    );

    await queryRunner.query(
      `ALTER TABLE \`payments\` ADD COLUMN \`reversed_at\` timestamp NULL AFTER \`updated_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`payments\` ADD COLUMN \`reversed_by\` char(36) NULL AFTER \`reversed_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`payments\` ADD COLUMN \`reversal_reason\` varchar(500) NULL AFTER \`reversed_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`payments\` ADD COLUMN \`reallocated_at\` timestamp NULL AFTER \`reversal_reason\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`payments\` ADD COLUMN \`reallocated_by\` char(36) NULL AFTER \`reallocated_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`payments\` ADD COLUMN \`reallocation_reason\` varchar(500) NULL AFTER \`reallocated_by\``,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`payments\` DROP COLUMN \`reallocation_reason\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`payments\` DROP COLUMN \`reallocated_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`payments\` DROP COLUMN \`reallocated_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`payments\` DROP COLUMN \`reversal_reason\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`payments\` DROP COLUMN \`reversed_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`payments\` DROP COLUMN \`reversed_at\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`purchase_invoices\` DROP COLUMN \`void_reason\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_invoices\` DROP COLUMN \`voided_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_invoices\` DROP COLUMN \`voided_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_invoices\` DROP COLUMN \`posted_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_invoices\` DROP COLUMN \`posted_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_invoices\` DROP COLUMN \`status\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pi_company_purchase_order\` ON \`purchase_invoices\``,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`IDX_pi_company_purchase_order\` ON \`purchase_invoices\` (\`company_id\`, \`purchase_order_id\`)`,
    );

    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` DROP COLUMN \`close_reason\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` DROP COLUMN \`closed_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` DROP COLUMN \`closed_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` DROP COLUMN \`rejected_reason\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` DROP COLUMN \`rejected_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` DROP COLUMN \`rejected_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` DROP COLUMN \`approved_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` DROP COLUMN \`approved_at\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` DROP COLUMN \`submitted_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` DROP COLUMN \`submitted_at\``,
    );
    await queryRunner.query(
      `UPDATE \`purchase_orders\` SET \`status\` = 'DRAFT' WHERE \`status\` = 'SUBMITTED'`,
    );
    await queryRunner.query(
      `UPDATE \`purchase_orders\` SET \`status\` = 'CONFIRMED' WHERE \`status\` IN ('APPROVED', 'CLOSED')`,
    );
    await queryRunner.query(
      `UPDATE \`purchase_orders\` SET \`status\` = 'CANCELLED' WHERE \`status\` = 'REJECTED'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` MODIFY COLUMN \`status\` enum ('DRAFT', 'CONFIRMED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT'`,
    );
  }
}
