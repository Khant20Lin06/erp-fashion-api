import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePurchaseTables1786560000000 implements MigrationInterface {
  name = 'CreatePurchaseTables1786560000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- company_purchase_counters ----
    await queryRunner.query(
      `CREATE TABLE \`company_purchase_counters\` (\`id\` varchar(36) NOT NULL, \`company_id\` varchar(36) NOT NULL, \`year\` int NOT NULL, \`last_sequence\` int NOT NULL DEFAULT '0', UNIQUE INDEX \`IDX_cpc_company_year\` (\`company_id\`, \`year\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- purchase_orders ----
    await queryRunner.query(
      `CREATE TABLE \`purchase_orders\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`purchase_order_number\` varchar(50) NOT NULL, \`purchase_type\` enum ('STANDARD', 'CREDIT') NOT NULL DEFAULT 'STANDARD', \`supplier_id\` varchar(36) NOT NULL, \`company_id\` varchar(36) NOT NULL, \`branch_id\` varchar(36) NULL, \`warehouse_id\` varchar(36) NULL, \`payment_term_id\` varchar(36) NULL, \`transaction_date\` timestamp NOT NULL, \`expected_delivery_date\` timestamp NULL, \`status\` enum ('DRAFT', 'CONFIRMED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT', \`subtotal\` decimal(14,2) NOT NULL, \`discount_amount\` decimal(14,2) NOT NULL DEFAULT '0.00', \`tax_amount\` decimal(14,2) NOT NULL DEFAULT '0.00', \`grand_total\` decimal(14,2) NOT NULL, \`paid_amount\` decimal(14,2) NOT NULL DEFAULT '0.00', \`balance_amount\` decimal(14,2) NOT NULL, \`currency\` char(3) NOT NULL, \`notes\` varchar(1000) NULL, \`created_by\` varchar(36) NULL, \`updated_by\` varchar(36) NULL, INDEX \`IDX_po_purchase_type\` (\`purchase_type\`), INDEX \`IDX_po_supplier_id\` (\`supplier_id\`), INDEX \`IDX_po_company_id\` (\`company_id\`), INDEX \`IDX_po_branch_id\` (\`branch_id\`), INDEX \`IDX_po_warehouse_id\` (\`warehouse_id\`), INDEX \`IDX_po_payment_term_id\` (\`payment_term_id\`), INDEX \`IDX_po_transaction_date\` (\`transaction_date\`), INDEX \`IDX_po_status\` (\`status\`), UNIQUE INDEX \`IDX_po_company_number\` (\`company_id\`, \`purchase_order_number\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- purchase_order_items ----
    await queryRunner.query(
      `CREATE TABLE \`purchase_order_items\` (\`id\` varchar(36) NOT NULL, \`purchase_order_id\` varchar(36) NOT NULL, \`product_variant_id\` varchar(36) NOT NULL, \`quantity\` int NOT NULL, \`unit_cost_snapshot\` decimal(14,2) NOT NULL, \`discount_snapshot\` decimal(14,2) NOT NULL DEFAULT '0.00', \`tax_snapshot\` decimal(14,2) NOT NULL DEFAULT '0.00', \`line_total\` decimal(14,2) NOT NULL, \`product_name_snapshot\` varchar(200) NOT NULL, \`sku_snapshot\` varchar(100) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_poi_purchase_order_id\` (\`purchase_order_id\`), INDEX \`IDX_poi_product_variant_id\` (\`product_variant_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- Foreign keys ----
    await queryRunner.query(
      `ALTER TABLE \`company_purchase_counters\` ADD CONSTRAINT \`FK_cpc_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` ADD CONSTRAINT \`FK_po_supplier\` FOREIGN KEY (\`supplier_id\`) REFERENCES \`suppliers\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` ADD CONSTRAINT \`FK_po_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` ADD CONSTRAINT \`FK_po_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` ADD CONSTRAINT \`FK_po_warehouse\` FOREIGN KEY (\`warehouse_id\`) REFERENCES \`warehouses\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` ADD CONSTRAINT \`FK_po_payment_term\` FOREIGN KEY (\`payment_term_id\`) REFERENCES \`payment_terms\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` ADD CONSTRAINT \`FK_po_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` ADD CONSTRAINT \`FK_po_updated_by\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`purchase_order_items\` ADD CONSTRAINT \`FK_poi_purchase_order\` FOREIGN KEY (\`purchase_order_id\`) REFERENCES \`purchase_orders\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_order_items\` ADD CONSTRAINT \`FK_poi_product_variant\` FOREIGN KEY (\`product_variant_id\`) REFERENCES \`product_variants\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`purchase_order_items\` DROP FOREIGN KEY \`FK_poi_product_variant\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_order_items\` DROP FOREIGN KEY \`FK_poi_purchase_order\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` DROP FOREIGN KEY \`FK_po_updated_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` DROP FOREIGN KEY \`FK_po_created_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` DROP FOREIGN KEY \`FK_po_payment_term\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` DROP FOREIGN KEY \`FK_po_warehouse\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` DROP FOREIGN KEY \`FK_po_branch\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` DROP FOREIGN KEY \`FK_po_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` DROP FOREIGN KEY \`FK_po_supplier\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`company_purchase_counters\` DROP FOREIGN KEY \`FK_cpc_company\``,
    );

    await queryRunner.query(
      `DROP INDEX \`IDX_poi_product_variant_id\` ON \`purchase_order_items\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_poi_purchase_order_id\` ON \`purchase_order_items\``,
    );
    await queryRunner.query(`DROP TABLE \`purchase_order_items\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_po_company_number\` ON \`purchase_orders\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_po_status\` ON \`purchase_orders\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_po_transaction_date\` ON \`purchase_orders\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_po_payment_term_id\` ON \`purchase_orders\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_po_warehouse_id\` ON \`purchase_orders\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_po_branch_id\` ON \`purchase_orders\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_po_company_id\` ON \`purchase_orders\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_po_supplier_id\` ON \`purchase_orders\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_po_purchase_type\` ON \`purchase_orders\``,
    );
    await queryRunner.query(`DROP TABLE \`purchase_orders\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_cpc_company_year\` ON \`company_purchase_counters\``,
    );
    await queryRunner.query(`DROP TABLE \`company_purchase_counters\``);
  }
}
