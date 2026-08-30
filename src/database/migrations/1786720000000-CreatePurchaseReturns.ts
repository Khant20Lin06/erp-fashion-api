import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePurchaseReturns1786720000000
  implements MigrationInterface
{
  name = 'CreatePurchaseReturns1786720000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`purchase_invoices\` ADD \`credited_amount\` decimal(14,2) NOT NULL DEFAULT '0.00'`,
    );
    await queryRunner.query(
      `CREATE TABLE \`company_purchase_return_counters\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` char(36) NOT NULL, \`year\` int NOT NULL, \`last_sequence\` int NOT NULL DEFAULT '0', UNIQUE INDEX \`IDX_cprtc_company_year\` (\`company_id\`, \`year\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`purchase_returns\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`return_number\` varchar(50) NOT NULL, \`company_id\` char(36) NOT NULL, \`branch_id\` char(36) NULL, \`supplier_id\` char(36) NOT NULL, \`purchase_order_id\` char(36) NOT NULL, \`purchase_invoice_id\` char(36) NOT NULL, \`status\` enum ('DRAFT', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT', \`reason\` varchar(255) NOT NULL, \`notes\` varchar(1000) NULL, \`subtotal\` decimal(14,2) NOT NULL, \`credit_applied_amount\` decimal(14,2) NOT NULL DEFAULT '0.00', \`supplier_credit_amount\` decimal(14,2) NOT NULL DEFAULT '0.00', \`currency\` char(3) NOT NULL, \`created_by\` char(36) NULL, \`completed_by\` char(36) NULL, \`completed_at\` timestamp NULL, UNIQUE INDEX \`IDX_prtn_company_return_number\` (\`company_id\`, \`return_number\`), INDEX \`IDX_prtn_company_id\` (\`company_id\`), INDEX \`IDX_prtn_branch_id\` (\`branch_id\`), INDEX \`IDX_prtn_supplier_id\` (\`supplier_id\`), INDEX \`IDX_prtn_purchase_order_id\` (\`purchase_order_id\`), INDEX \`IDX_prtn_purchase_invoice_id\` (\`purchase_invoice_id\`), INDEX \`IDX_prtn_status\` (\`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`purchase_return_items\` (\`id\` varchar(36) NOT NULL, \`purchase_return_id\` char(36) NOT NULL, \`purchase_order_item_id\` char(36) NOT NULL, \`product_variant_id\` char(36) NOT NULL, \`quantity\` int NOT NULL, \`unit_cost_snapshot\` decimal(14,2) NOT NULL, \`line_total\` decimal(14,2) NOT NULL, \`product_name_snapshot\` varchar(200) NOT NULL, \`sku_snapshot\` varchar(100) NOT NULL, \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX \`IDX_prtni_purchase_return_id\` (\`purchase_return_id\`), INDEX \`IDX_prtni_purchase_order_item_id\` (\`purchase_order_item_id\`), INDEX \`IDX_prtni_product_variant_id\` (\`product_variant_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`company_purchase_return_counters\` ADD CONSTRAINT \`FK_cprtc_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_returns\` ADD CONSTRAINT \`FK_prtn_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_returns\` ADD CONSTRAINT \`FK_prtn_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_returns\` ADD CONSTRAINT \`FK_prtn_supplier\` FOREIGN KEY (\`supplier_id\`) REFERENCES \`suppliers\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_returns\` ADD CONSTRAINT \`FK_prtn_purchase_order\` FOREIGN KEY (\`purchase_order_id\`) REFERENCES \`purchase_orders\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_returns\` ADD CONSTRAINT \`FK_prtn_purchase_invoice\` FOREIGN KEY (\`purchase_invoice_id\`) REFERENCES \`purchase_invoices\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_returns\` ADD CONSTRAINT \`FK_prtn_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_returns\` ADD CONSTRAINT \`FK_prtn_completed_by\` FOREIGN KEY (\`completed_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_return_items\` ADD CONSTRAINT \`FK_prtni_return\` FOREIGN KEY (\`purchase_return_id\`) REFERENCES \`purchase_returns\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_return_items\` ADD CONSTRAINT \`FK_prtni_purchase_order_item\` FOREIGN KEY (\`purchase_order_item_id\`) REFERENCES \`purchase_order_items\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_return_items\` ADD CONSTRAINT \`FK_prtni_product_variant\` FOREIGN KEY (\`product_variant_id\`) REFERENCES \`product_variants\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_movements\` MODIFY COLUMN \`movement_type\` enum ('PURCHASE_RECEIPT', 'SALE_ISSUE', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'OPENING_BALANCE', 'SALE_RETURN', 'PURCHASE_RETURN') NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_movements\` MODIFY COLUMN \`reference_type\` enum ('GOODS_RECEIPT', 'SALE', 'STOCK_TRANSFER', 'STOCK_ADJUSTMENT', 'SALE_RETURN', 'PURCHASE_RETURN') NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`stock_movements\` MODIFY COLUMN \`reference_type\` enum ('GOODS_RECEIPT', 'SALE', 'STOCK_TRANSFER', 'STOCK_ADJUSTMENT', 'SALE_RETURN') NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_movements\` MODIFY COLUMN \`movement_type\` enum ('PURCHASE_RECEIPT', 'SALE_ISSUE', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'OPENING_BALANCE', 'SALE_RETURN') NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_return_items\` DROP FOREIGN KEY \`FK_prtni_product_variant\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_return_items\` DROP FOREIGN KEY \`FK_prtni_purchase_order_item\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_return_items\` DROP FOREIGN KEY \`FK_prtni_return\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_returns\` DROP FOREIGN KEY \`FK_prtn_completed_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_returns\` DROP FOREIGN KEY \`FK_prtn_created_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_returns\` DROP FOREIGN KEY \`FK_prtn_purchase_invoice\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_returns\` DROP FOREIGN KEY \`FK_prtn_purchase_order\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_returns\` DROP FOREIGN KEY \`FK_prtn_supplier\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_returns\` DROP FOREIGN KEY \`FK_prtn_branch\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_returns\` DROP FOREIGN KEY \`FK_prtn_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`company_purchase_return_counters\` DROP FOREIGN KEY \`FK_cprtc_company\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_prtni_product_variant_id\` ON \`purchase_return_items\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_prtni_purchase_order_item_id\` ON \`purchase_return_items\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_prtni_purchase_return_id\` ON \`purchase_return_items\``,
    );
    await queryRunner.query(`DROP TABLE \`purchase_return_items\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_prtn_status\` ON \`purchase_returns\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_prtn_purchase_invoice_id\` ON \`purchase_returns\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_prtn_purchase_order_id\` ON \`purchase_returns\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_prtn_supplier_id\` ON \`purchase_returns\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_prtn_branch_id\` ON \`purchase_returns\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_prtn_company_id\` ON \`purchase_returns\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_prtn_company_return_number\` ON \`purchase_returns\``,
    );
    await queryRunner.query(`DROP TABLE \`purchase_returns\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_cprtc_company_year\` ON \`company_purchase_return_counters\``,
    );
    await queryRunner.query(`DROP TABLE \`company_purchase_return_counters\``);
    await queryRunner.query(
      `ALTER TABLE \`purchase_invoices\` DROP COLUMN \`credited_amount\``,
    );
  }
}
