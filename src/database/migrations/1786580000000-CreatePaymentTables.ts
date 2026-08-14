import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePaymentTables1786580000000 implements MigrationInterface {
  name = 'CreatePaymentTables1786580000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- payment_methods ----
    await queryRunner.query(
      `CREATE TABLE \`payment_methods\` (\`id\` varchar(36) NOT NULL, \`company_id\` varchar(36) NOT NULL, \`code\` varchar(50) NOT NULL, \`name\` varchar(200) NOT NULL, \`status\` enum ('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE', \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, \`deleted_at\` timestamp NULL, UNIQUE INDEX \`IDX_pm_company_code\` (\`company_id\`, \`code\`), INDEX \`IDX_pm_status\` (\`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- company_payment_counters ----
    await queryRunner.query(
      `CREATE TABLE \`company_payment_counters\` (\`id\` varchar(36) NOT NULL, \`company_id\` varchar(36) NOT NULL, \`year\` int NOT NULL, \`last_sequence\` int NOT NULL DEFAULT '0', UNIQUE INDEX \`IDX_cpc_company_year\` (\`company_id\`, \`year\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- payments ----
    await queryRunner.query(
      `CREATE TABLE \`payments\` (\`id\` varchar(36) NOT NULL, \`payment_number\` varchar(50) NOT NULL, \`company_id\` varchar(36) NOT NULL, \`branch_id\` varchar(36) NULL, \`direction\` enum ('RECEIPT', 'PAYMENT') NOT NULL, \`customer_id\` varchar(36) NULL, \`supplier_id\` varchar(36) NULL, \`payment_method_id\` varchar(36) NOT NULL, \`amount\` decimal(14,2) NOT NULL, \`currency\` char(3) NOT NULL, \`reference\` varchar(255) NULL, \`idempotency_key\` varchar(255) NULL, \`status\` enum ('CONFIRMED', 'CANCELLED') NOT NULL DEFAULT 'CONFIRMED', \`payment_date\` timestamp NOT NULL, \`notes\` varchar(1000) NULL, \`created_by\` varchar(36) NULL, \`updated_by\` varchar(36) NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp NULL, UNIQUE INDEX \`IDX_pay_company_payment_number\` (\`company_id\`, \`payment_number\`), UNIQUE INDEX \`IDX_pay_company_idempotency_key\` (\`company_id\`, \`idempotency_key\`), INDEX \`IDX_pay_company_id\` (\`company_id\`), INDEX \`IDX_pay_branch_id\` (\`branch_id\`), INDEX \`IDX_pay_direction\` (\`direction\`), INDEX \`IDX_pay_customer_id\` (\`customer_id\`), INDEX \`IDX_pay_supplier_id\` (\`supplier_id\`), INDEX \`IDX_pay_payment_method_id\` (\`payment_method_id\`), INDEX \`IDX_pay_status\` (\`status\`), INDEX \`IDX_pay_payment_date\` (\`payment_date\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- payment_allocations ----
    await queryRunner.query(
      `CREATE TABLE \`payment_allocations\` (\`id\` varchar(36) NOT NULL, \`payment_id\` varchar(36) NOT NULL, \`reference_type\` enum ('SALE', 'PURCHASE_ORDER') NOT NULL, \`reference_id\` varchar(36) NOT NULL, \`allocated_amount\` decimal(14,2) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_pa_payment_id\` (\`payment_id\`), INDEX \`IDX_pa_reference_type_reference_id\` (\`reference_type\`, \`reference_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- Foreign keys ----
    await queryRunner.query(
      `ALTER TABLE \`payment_methods\` ADD CONSTRAINT \`FK_pm_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`company_payment_counters\` ADD CONSTRAINT \`FK_cpymtc_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`payments\` ADD CONSTRAINT \`FK_pay_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`payments\` ADD CONSTRAINT \`FK_pay_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`payments\` ADD CONSTRAINT \`FK_pay_customer\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`payments\` ADD CONSTRAINT \`FK_pay_supplier\` FOREIGN KEY (\`supplier_id\`) REFERENCES \`suppliers\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`payments\` ADD CONSTRAINT \`FK_pay_payment_method\` FOREIGN KEY (\`payment_method_id\`) REFERENCES \`payment_methods\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`payments\` ADD CONSTRAINT \`FK_pay_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`payments\` ADD CONSTRAINT \`FK_pay_updated_by\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`payment_allocations\` ADD CONSTRAINT \`FK_pa_payment\` FOREIGN KEY (\`payment_id\`) REFERENCES \`payments\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`payment_allocations\` DROP FOREIGN KEY \`FK_pa_payment\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`payments\` DROP FOREIGN KEY \`FK_pay_updated_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`payments\` DROP FOREIGN KEY \`FK_pay_created_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`payments\` DROP FOREIGN KEY \`FK_pay_payment_method\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`payments\` DROP FOREIGN KEY \`FK_pay_supplier\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`payments\` DROP FOREIGN KEY \`FK_pay_customer\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`payments\` DROP FOREIGN KEY \`FK_pay_branch\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`payments\` DROP FOREIGN KEY \`FK_pay_company\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`company_payment_counters\` DROP FOREIGN KEY \`FK_cpymtc_company\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`payment_methods\` DROP FOREIGN KEY \`FK_pm_company\``,
    );

    await queryRunner.query(
      `DROP INDEX \`IDX_pa_reference_type_reference_id\` ON \`payment_allocations\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pa_payment_id\` ON \`payment_allocations\``,
    );
    await queryRunner.query(`DROP TABLE \`payment_allocations\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_pay_payment_date\` ON \`payments\``,
    );
    await queryRunner.query(`DROP INDEX \`IDX_pay_status\` ON \`payments\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_pay_payment_method_id\` ON \`payments\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pay_supplier_id\` ON \`payments\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pay_customer_id\` ON \`payments\``,
    );
    await queryRunner.query(`DROP INDEX \`IDX_pay_direction\` ON \`payments\``);
    await queryRunner.query(`DROP INDEX \`IDX_pay_branch_id\` ON \`payments\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_pay_company_id\` ON \`payments\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pay_company_idempotency_key\` ON \`payments\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pay_company_payment_number\` ON \`payments\``,
    );
    await queryRunner.query(`DROP TABLE \`payments\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_cpc_company_year\` ON \`company_payment_counters\``,
    );
    await queryRunner.query(`DROP TABLE \`company_payment_counters\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_pm_status\` ON \`payment_methods\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_pm_company_code\` ON \`payment_methods\``,
    );
    await queryRunner.query(`DROP TABLE \`payment_methods\``);
  }
}
