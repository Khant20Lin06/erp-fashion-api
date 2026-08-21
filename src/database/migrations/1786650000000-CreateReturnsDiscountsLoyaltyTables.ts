import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReturnsDiscountsLoyaltyTables1786650000000 implements MigrationInterface {
  name = 'CreateReturnsDiscountsLoyaltyTables1786650000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- promotions ----
    await queryRunner.query(
      `CREATE TABLE \`promotions\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` char(36) NOT NULL, \`code\` varchar(50) NOT NULL, \`name\` varchar(150) NOT NULL, \`description\` varchar(500) NULL, \`discount_type\` enum ('PERCENTAGE', 'FIXED_AMOUNT') NOT NULL, \`discount_value\` decimal(14,4) NOT NULL, \`minimum_purchase\` decimal(14,2) NOT NULL DEFAULT '0.00', \`maximum_discount_amount\` decimal(14,2) NULL, \`start_date\` date NOT NULL, \`end_date\` date NULL, \`usage_limit\` int NULL, \`usage_count\` int NOT NULL DEFAULT '0', \`status\` enum ('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE', \`created_by\` char(36) NULL, \`updated_by\` char(36) NULL, UNIQUE INDEX \`IDX_promo_company_code\` (\`company_id\`, \`code\`), INDEX \`IDX_promo_status\` (\`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- loyalty_programs ----
    await queryRunner.query(
      `CREATE TABLE \`loyalty_programs\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` char(36) NOT NULL, \`points_per_currency_unit\` decimal(10,4) NOT NULL, \`redemption_value_per_point\` decimal(14,4) NOT NULL, \`minimum_purchase_for_earning\` decimal(14,2) NOT NULL DEFAULT '0.00', \`is_active\` tinyint NOT NULL DEFAULT 1, \`created_by\` char(36) NULL, \`updated_by\` char(36) NULL, UNIQUE INDEX \`IDX_loyalty_program_company\` (\`company_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- loyalty_point_transactions ----
    await queryRunner.query(
      `CREATE TABLE \`loyalty_point_transactions\` (\`id\` varchar(36) NOT NULL, \`company_id\` char(36) NOT NULL, \`customer_id\` char(36) NOT NULL, \`type\` enum ('EARN', 'REDEEM', 'REVERSAL', 'ADJUSTMENT') NOT NULL, \`points_delta\` int NOT NULL, \`redemption_value\` decimal(14,2) NULL, \`source_type\` varchar(50) NULL, \`source_id\` char(36) NULL, \`reverses_transaction_id\` char(36) NULL, \`notes\` varchar(500) NULL, \`created_by\` char(36) NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_loyalty_tx_company_source\` (\`company_id\`, \`source_type\`, \`source_id\`), INDEX \`IDX_loyalty_tx_company_id\` (\`company_id\`), INDEX \`IDX_loyalty_tx_customer_id\` (\`customer_id\`), INDEX \`IDX_loyalty_tx_type\` (\`type\`), INDEX \`IDX_loyalty_tx_customer_created\` (\`customer_id\`, \`created_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- company_sale_return_counters ----
    await queryRunner.query(
      `CREATE TABLE \`company_sale_return_counters\` (\`id\` varchar(36) NOT NULL, \`company_id\` char(36) NOT NULL, \`year\` int NOT NULL, \`last_sequence\` int NOT NULL DEFAULT '0', UNIQUE INDEX \`IDX_csrc_company_year\` (\`company_id\`, \`year\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- sale_returns ----
    await queryRunner.query(
      `CREATE TABLE \`sale_returns\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`return_number\` varchar(50) NOT NULL, \`company_id\` char(36) NOT NULL, \`branch_id\` char(36) NULL, \`sale_id\` char(36) NOT NULL, \`customer_id\` char(36) NOT NULL, \`status\` enum ('DRAFT', 'CONFIRMED', 'REFUNDED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT', \`reason\` varchar(500) NULL, \`notes\` varchar(1000) NULL, \`subtotal\` decimal(14,2) NOT NULL, \`discount_amount\` decimal(14,2) NOT NULL DEFAULT '0.00', \`refund_amount\` decimal(14,2) NOT NULL, \`refunded_amount\` decimal(14,2) NOT NULL DEFAULT '0.00', \`currency\` char(3) NOT NULL, \`created_by\` char(36) NULL, \`confirmed_by\` char(36) NULL, \`confirmed_at\` timestamp NULL, INDEX \`IDX_sret_company_id\` (\`company_id\`), INDEX \`IDX_sret_branch_id\` (\`branch_id\`), INDEX \`IDX_sret_sale_id\` (\`sale_id\`), INDEX \`IDX_sret_customer_id\` (\`customer_id\`), INDEX \`IDX_sret_status\` (\`status\`), UNIQUE INDEX \`IDX_sret_company_return_number\` (\`company_id\`, \`return_number\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- sale_return_items ----
    await queryRunner.query(
      `CREATE TABLE \`sale_return_items\` (\`id\` varchar(36) NOT NULL, \`sale_return_id\` char(36) NOT NULL, \`sale_item_id\` char(36) NOT NULL, \`product_variant_id\` char(36) NOT NULL, \`quantity\` int NOT NULL, \`unit_price_snapshot\` decimal(14,2) NOT NULL, \`discount_amount\` decimal(14,2) NOT NULL DEFAULT '0.00', \`line_total\` decimal(14,2) NOT NULL, \`condition\` enum ('RESTOCK', 'DAMAGED') NOT NULL DEFAULT 'RESTOCK', \`product_name_snapshot\` varchar(200) NOT NULL, \`sku_snapshot\` varchar(100) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_sreti_sale_return_id\` (\`sale_return_id\`), INDEX \`IDX_sreti_sale_item_id\` (\`sale_item_id\`), INDEX \`IDX_sreti_product_variant_id\` (\`product_variant_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- FKs ----
    await queryRunner.query(
      `ALTER TABLE \`promotions\` ADD CONSTRAINT \`FK_promo_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`loyalty_programs\` ADD CONSTRAINT \`FK_loyalty_program_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`loyalty_point_transactions\` ADD CONSTRAINT \`FK_loyalty_tx_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`loyalty_point_transactions\` ADD CONSTRAINT \`FK_loyalty_tx_customer\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`company_sale_return_counters\` ADD CONSTRAINT \`FK_csrc_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sale_returns\` ADD CONSTRAINT \`FK_sret_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sale_returns\` ADD CONSTRAINT \`FK_sret_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sale_returns\` ADD CONSTRAINT \`FK_sret_sale\` FOREIGN KEY (\`sale_id\`) REFERENCES \`sales\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sale_returns\` ADD CONSTRAINT \`FK_sret_customer\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sale_returns\` ADD CONSTRAINT \`FK_sret_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sale_returns\` ADD CONSTRAINT \`FK_sret_confirmed_by\` FOREIGN KEY (\`confirmed_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sale_return_items\` ADD CONSTRAINT \`FK_sreti_sale_return\` FOREIGN KEY (\`sale_return_id\`) REFERENCES \`sale_returns\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sale_return_items\` ADD CONSTRAINT \`FK_sreti_sale_item\` FOREIGN KEY (\`sale_item_id\`) REFERENCES \`sale_items\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sale_return_items\` ADD CONSTRAINT \`FK_sreti_product_variant\` FOREIGN KEY (\`product_variant_id\`) REFERENCES \`product_variants\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    // ---- Additive enum members on existing columns ----
    await queryRunner.query(
      `ALTER TABLE \`stock_movements\` MODIFY COLUMN \`movement_type\` enum ('PURCHASE_RECEIPT', 'SALE_ISSUE', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'OPENING_BALANCE', 'SALE_RETURN') NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_movements\` MODIFY COLUMN \`reference_type\` enum ('GOODS_RECEIPT', 'SALE', 'STOCK_TRANSFER', 'STOCK_ADJUSTMENT', 'SALE_RETURN') NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`payments\` MODIFY COLUMN \`direction\` enum ('RECEIPT', 'PAYMENT', 'REFUND') NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`payment_allocations\` MODIFY COLUMN \`reference_type\` enum ('SALE', 'PURCHASE_ORDER', 'SALE_RETURN') NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`payment_allocations\` MODIFY COLUMN \`reference_type\` enum ('SALE', 'PURCHASE_ORDER') NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`payments\` MODIFY COLUMN \`direction\` enum ('RECEIPT', 'PAYMENT') NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_movements\` MODIFY COLUMN \`reference_type\` enum ('GOODS_RECEIPT', 'SALE', 'STOCK_TRANSFER', 'STOCK_ADJUSTMENT') NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_movements\` MODIFY COLUMN \`movement_type\` enum ('PURCHASE_RECEIPT', 'SALE_ISSUE', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'OPENING_BALANCE') NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE \`sale_return_items\` DROP FOREIGN KEY \`FK_sreti_product_variant\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`sale_return_items\` DROP FOREIGN KEY \`FK_sreti_sale_item\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`sale_return_items\` DROP FOREIGN KEY \`FK_sreti_sale_return\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`sale_returns\` DROP FOREIGN KEY \`FK_sret_confirmed_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`sale_returns\` DROP FOREIGN KEY \`FK_sret_created_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`sale_returns\` DROP FOREIGN KEY \`FK_sret_customer\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`sale_returns\` DROP FOREIGN KEY \`FK_sret_sale\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`sale_returns\` DROP FOREIGN KEY \`FK_sret_branch\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`sale_returns\` DROP FOREIGN KEY \`FK_sret_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`company_sale_return_counters\` DROP FOREIGN KEY \`FK_csrc_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`loyalty_point_transactions\` DROP FOREIGN KEY \`FK_loyalty_tx_customer\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`loyalty_point_transactions\` DROP FOREIGN KEY \`FK_loyalty_tx_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`loyalty_programs\` DROP FOREIGN KEY \`FK_loyalty_program_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`promotions\` DROP FOREIGN KEY \`FK_promo_company\``,
    );

    await queryRunner.query(
      `DROP INDEX \`IDX_sreti_product_variant_id\` ON \`sale_return_items\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_sreti_sale_item_id\` ON \`sale_return_items\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_sreti_sale_return_id\` ON \`sale_return_items\``,
    );
    await queryRunner.query(`DROP TABLE \`sale_return_items\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_sret_company_return_number\` ON \`sale_returns\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_sret_status\` ON \`sale_returns\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_sret_customer_id\` ON \`sale_returns\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_sret_sale_id\` ON \`sale_returns\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_sret_branch_id\` ON \`sale_returns\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_sret_company_id\` ON \`sale_returns\``,
    );
    await queryRunner.query(`DROP TABLE \`sale_returns\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_csrc_company_year\` ON \`company_sale_return_counters\``,
    );
    await queryRunner.query(`DROP TABLE \`company_sale_return_counters\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_loyalty_tx_customer_created\` ON \`loyalty_point_transactions\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_loyalty_tx_type\` ON \`loyalty_point_transactions\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_loyalty_tx_customer_id\` ON \`loyalty_point_transactions\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_loyalty_tx_company_id\` ON \`loyalty_point_transactions\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_loyalty_tx_company_source\` ON \`loyalty_point_transactions\``,
    );
    await queryRunner.query(`DROP TABLE \`loyalty_point_transactions\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_loyalty_program_company\` ON \`loyalty_programs\``,
    );
    await queryRunner.query(`DROP TABLE \`loyalty_programs\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_promo_status\` ON \`promotions\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_promo_company_code\` ON \`promotions\``,
    );
    await queryRunner.query(`DROP TABLE \`promotions\``);
  }
}
