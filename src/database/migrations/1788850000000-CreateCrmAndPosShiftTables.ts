import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCrmAndPosShiftTables1788850000000
  implements MigrationInterface
{
  name = 'CreateCrmAndPosShiftTables1788850000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`customer_notes\` (
        \`id\` varchar(36) NOT NULL,
        \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deleted_at\` timestamp(6) NULL,
        \`company_id\` char(36) NOT NULL,
        \`customer_id\` char(36) NOT NULL,
        \`user_id\` char(36) NOT NULL,
        \`note_type\` varchar(32) NOT NULL DEFAULT 'NOTE',
        \`content\` text NOT NULL,
        INDEX \`IDX_customer_notes_customer\` (\`customer_id\`),
        INDEX \`IDX_customer_notes_company\` (\`company_id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`pos_shifts\` (
        \`id\` varchar(36) NOT NULL,
        \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deleted_at\` timestamp(6) NULL,
        \`company_id\` char(36) NOT NULL,
        \`branch_id\` char(36) NOT NULL,
        \`cashier_id\` char(36) NOT NULL,
        \`shift_number\` varchar(50) NOT NULL,
        \`status\` enum('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
        \`opened_at\` timestamp(6) NOT NULL,
        \`closed_at\` timestamp(6) NULL,
        \`opening_cash\` decimal(14,2) NOT NULL DEFAULT '0.00',
        \`expected_cash\` decimal(14,2) NOT NULL DEFAULT '0.00',
        \`actual_cash\` decimal(14,2) NULL,
        \`cash_difference\` decimal(14,2) NULL,
        \`total_sales_amount\` decimal(14,2) NOT NULL DEFAULT '0.00',
        \`total_sales_count\` int NOT NULL DEFAULT 0,
        \`total_returns_amount\` decimal(14,2) NOT NULL DEFAULT '0.00',
        \`payment_summary\` json NULL,
        \`notes\` text NULL,
        INDEX \`IDX_pos_shifts_company\` (\`company_id\`),
        INDEX \`IDX_pos_shifts_branch\` (\`branch_id\`),
        INDEX \`IDX_pos_shifts_cashier\` (\`cashier_id\`),
        INDEX \`IDX_pos_shifts_status\` (\`status\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    );

    // Foreign keys
    await queryRunner.query(
      `ALTER TABLE \`customer_notes\` ADD CONSTRAINT \`FK_cn_customer\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`customer_notes\` ADD CONSTRAINT \`FK_cn_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`customer_notes\` ADD CONSTRAINT \`FK_cn_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`pos_shifts\` ADD CONSTRAINT \`FK_ps_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`pos_shifts\` ADD CONSTRAINT \`FK_ps_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`pos_shifts\` ADD CONSTRAINT \`FK_ps_cashier\` FOREIGN KEY (\`cashier_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`pos_shifts\` DROP FOREIGN KEY \`FK_ps_cashier\``);
    await queryRunner.query(`ALTER TABLE \`pos_shifts\` DROP FOREIGN KEY \`FK_ps_branch\``);
    await queryRunner.query(`ALTER TABLE \`pos_shifts\` DROP FOREIGN KEY \`FK_ps_company\``);
    await queryRunner.query(`ALTER TABLE \`customer_notes\` DROP FOREIGN KEY \`FK_cn_user\``);
    await queryRunner.query(`ALTER TABLE \`customer_notes\` DROP FOREIGN KEY \`FK_cn_company\``);
    await queryRunner.query(`ALTER TABLE \`customer_notes\` DROP FOREIGN KEY \`FK_cn_customer\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`pos_shifts\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`customer_notes\``);
  }
}
