import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSalesTables1786550000000 implements MigrationInterface {
  name = 'CreateSalesTables1786550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- company_sale_counters ----
    await queryRunner.query(
      `CREATE TABLE \`company_sale_counters\` (\`id\` varchar(36) NOT NULL, \`company_id\` varchar(36) NOT NULL, \`year\` int NOT NULL, \`last_sequence\` int NOT NULL DEFAULT '0', UNIQUE INDEX \`IDX_csc_company_year\` (\`company_id\`, \`year\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- sales ----
    await queryRunner.query(
      `CREATE TABLE \`sales\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`sale_number\` varchar(50) NOT NULL, \`sale_type\` enum ('POS', 'RETAIL', 'WHOLESALE') NOT NULL DEFAULT 'RETAIL', \`customer_id\` varchar(36) NOT NULL, \`sales_account_id\` varchar(36) NULL, \`company_id\` varchar(36) NOT NULL, \`branch_id\` varchar(36) NULL, \`warehouse_id\` varchar(36) NULL, \`transaction_date\` timestamp NOT NULL, \`status\` enum ('DRAFT', 'CONFIRMED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT', \`subtotal\` decimal(14,2) NOT NULL, \`discount_amount\` decimal(14,2) NOT NULL DEFAULT '0.00', \`tax_amount\` decimal(14,2) NOT NULL DEFAULT '0.00', \`grand_total\` decimal(14,2) NOT NULL, \`paid_amount\` decimal(14,2) NOT NULL DEFAULT '0.00', \`balance_amount\` decimal(14,2) NOT NULL, \`currency\` char(3) NOT NULL, \`notes\` varchar(1000) NULL, \`created_by\` varchar(36) NULL, \`updated_by\` varchar(36) NULL, INDEX \`IDX_sale_type\` (\`sale_type\`), INDEX \`IDX_sale_customer_id\` (\`customer_id\`), INDEX \`IDX_sale_sales_account_id\` (\`sales_account_id\`), INDEX \`IDX_sale_company_id\` (\`company_id\`), INDEX \`IDX_sale_branch_id\` (\`branch_id\`), INDEX \`IDX_sale_warehouse_id\` (\`warehouse_id\`), INDEX \`IDX_sale_transaction_date\` (\`transaction_date\`), INDEX \`IDX_sale_status\` (\`status\`), UNIQUE INDEX \`IDX_sale_company_number\` (\`company_id\`, \`sale_number\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- sale_items ----
    await queryRunner.query(
      `CREATE TABLE \`sale_items\` (\`id\` varchar(36) NOT NULL, \`sale_id\` varchar(36) NOT NULL, \`product_variant_id\` varchar(36) NOT NULL, \`quantity\` int NOT NULL, \`unit_price_snapshot\` decimal(14,2) NOT NULL, \`discount_snapshot\` decimal(14,2) NOT NULL DEFAULT '0.00', \`tax_snapshot\` decimal(14,2) NOT NULL DEFAULT '0.00', \`line_total\` decimal(14,2) NOT NULL, \`product_name_snapshot\` varchar(200) NOT NULL, \`sku_snapshot\` varchar(100) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_si_sale_id\` (\`sale_id\`), INDEX \`IDX_si_product_variant_id\` (\`product_variant_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- Foreign keys ----
    await queryRunner.query(
      `ALTER TABLE \`company_sale_counters\` ADD CONSTRAINT \`FK_csc_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`sales\` ADD CONSTRAINT \`FK_sale_customer\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sales\` ADD CONSTRAINT \`FK_sale_sales_account\` FOREIGN KEY (\`sales_account_id\`) REFERENCES \`sales_accounts\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sales\` ADD CONSTRAINT \`FK_sale_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sales\` ADD CONSTRAINT \`FK_sale_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sales\` ADD CONSTRAINT \`FK_sale_warehouse\` FOREIGN KEY (\`warehouse_id\`) REFERENCES \`warehouses\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sales\` ADD CONSTRAINT \`FK_sale_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sales\` ADD CONSTRAINT \`FK_sale_updated_by\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`sale_items\` ADD CONSTRAINT \`FK_si_sale\` FOREIGN KEY (\`sale_id\`) REFERENCES \`sales\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sale_items\` ADD CONSTRAINT \`FK_si_product_variant\` FOREIGN KEY (\`product_variant_id\`) REFERENCES \`product_variants\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`sale_items\` DROP FOREIGN KEY \`FK_si_product_variant\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`sale_items\` DROP FOREIGN KEY \`FK_si_sale\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`sales\` DROP FOREIGN KEY \`FK_sale_updated_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`sales\` DROP FOREIGN KEY \`FK_sale_created_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`sales\` DROP FOREIGN KEY \`FK_sale_warehouse\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`sales\` DROP FOREIGN KEY \`FK_sale_branch\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`sales\` DROP FOREIGN KEY \`FK_sale_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`sales\` DROP FOREIGN KEY \`FK_sale_sales_account\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`sales\` DROP FOREIGN KEY \`FK_sale_customer\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`company_sale_counters\` DROP FOREIGN KEY \`FK_csc_company\``,
    );

    await queryRunner.query(
      `DROP INDEX \`IDX_si_product_variant_id\` ON \`sale_items\``,
    );
    await queryRunner.query(`DROP INDEX \`IDX_si_sale_id\` ON \`sale_items\``);
    await queryRunner.query(`DROP TABLE \`sale_items\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_sale_company_number\` ON \`sales\``,
    );
    await queryRunner.query(`DROP INDEX \`IDX_sale_status\` ON \`sales\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_sale_transaction_date\` ON \`sales\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_sale_warehouse_id\` ON \`sales\``,
    );
    await queryRunner.query(`DROP INDEX \`IDX_sale_branch_id\` ON \`sales\``);
    await queryRunner.query(`DROP INDEX \`IDX_sale_company_id\` ON \`sales\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_sale_sales_account_id\` ON \`sales\``,
    );
    await queryRunner.query(`DROP INDEX \`IDX_sale_customer_id\` ON \`sales\``);
    await queryRunner.query(`DROP INDEX \`IDX_sale_type\` ON \`sales\``);
    await queryRunner.query(`DROP TABLE \`sales\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_csc_company_year\` ON \`company_sale_counters\``,
    );
    await queryRunner.query(`DROP TABLE \`company_sale_counters\``);
  }
}
