import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePurchaseRfqAndSupplierQuotationTables1786730000000
  implements MigrationInterface
{
  name = 'CreatePurchaseRfqAndSupplierQuotationTables1786730000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`company_purchase_rfq_counters\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` char(36) NOT NULL, \`year\` int NOT NULL, \`last_sequence\` int NOT NULL DEFAULT '0', UNIQUE INDEX \`IDX_cprfqc_company_year\` (\`company_id\`, \`year\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`company_supplier_quotation_counters\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` char(36) NOT NULL, \`year\` int NOT NULL, \`last_sequence\` int NOT NULL DEFAULT '0', UNIQUE INDEX \`IDX_csqc_company_year\` (\`company_id\`, \`year\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`purchase_rfqs\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`rfq_number\` varchar(50) NOT NULL, \`company_id\` char(36) NOT NULL, \`branch_id\` char(36) NULL, \`purchase_request_id\` char(36) NULL, \`title\` varchar(160) NOT NULL, \`required_date\` timestamp NOT NULL, \`status\` enum ('DRAFT', 'SENT', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT', \`invited_supplier_ids\` text NOT NULL, \`notes\` varchar(1000) NULL, \`created_by\` char(36) NULL, \`updated_by\` char(36) NULL, UNIQUE INDEX \`IDX_prfq_company_number\` (\`company_id\`, \`rfq_number\`), INDEX \`IDX_prfq_company_id\` (\`company_id\`), INDEX \`IDX_prfq_branch_id\` (\`branch_id\`), INDEX \`IDX_prfq_purchase_request_id\` (\`purchase_request_id\`), INDEX \`IDX_prfq_required_date\` (\`required_date\`), INDEX \`IDX_prfq_status\` (\`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`purchase_rfq_items\` (\`id\` varchar(36) NOT NULL, \`purchase_rfq_id\` char(36) NOT NULL, \`product_variant_id\` char(36) NOT NULL, \`quantity\` int NOT NULL, \`reason_snapshot\` varchar(255) NOT NULL, \`product_name_snapshot\` varchar(200) NOT NULL, \`sku_snapshot\` varchar(100) NOT NULL, \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX \`IDX_prfqi_purchase_rfq_id\` (\`purchase_rfq_id\`), INDEX \`IDX_prfqi_product_variant_id\` (\`product_variant_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`supplier_quotations\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`quotation_number\` varchar(50) NOT NULL, \`company_id\` char(36) NOT NULL, \`purchase_rfq_id\` char(36) NOT NULL, \`supplier_id\` char(36) NOT NULL, \`payment_term_id\` char(36) NULL, \`lead_time_days\` int NULL, \`status\` enum ('SUBMITTED', 'AWARDED', 'REJECTED') NOT NULL DEFAULT 'SUBMITTED', \`subtotal\` decimal(14,2) NOT NULL, \`discount_amount\` decimal(14,2) NOT NULL DEFAULT '0.00', \`tax_amount\` decimal(14,2) NOT NULL DEFAULT '0.00', \`grand_total\` decimal(14,2) NOT NULL, \`currency\` char(3) NOT NULL, \`notes\` varchar(1000) NULL, \`created_by\` char(36) NULL, \`updated_by\` char(36) NULL, UNIQUE INDEX \`IDX_sq_company_number\` (\`company_id\`, \`quotation_number\`), UNIQUE INDEX \`IDX_sq_company_rfq_supplier\` (\`company_id\`, \`purchase_rfq_id\`, \`supplier_id\`), INDEX \`IDX_sq_company_id\` (\`company_id\`), INDEX \`IDX_sq_purchase_rfq_id\` (\`purchase_rfq_id\`), INDEX \`IDX_sq_supplier_id\` (\`supplier_id\`), INDEX \`IDX_sq_payment_term_id\` (\`payment_term_id\`), INDEX \`IDX_sq_status\` (\`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`supplier_quotation_items\` (\`id\` varchar(36) NOT NULL, \`supplier_quotation_id\` char(36) NOT NULL, \`purchase_rfq_item_id\` char(36) NOT NULL, \`product_variant_id\` char(36) NOT NULL, \`quantity\` int NOT NULL, \`unit_cost_snapshot\` decimal(14,2) NOT NULL, \`discount_snapshot\` decimal(14,2) NOT NULL DEFAULT '0.00', \`tax_snapshot\` decimal(14,2) NOT NULL DEFAULT '0.00', \`line_total\` decimal(14,2) NOT NULL, \`product_name_snapshot\` varchar(200) NOT NULL, \`sku_snapshot\` varchar(100) NOT NULL, \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX \`IDX_sqi_supplier_quotation_id\` (\`supplier_quotation_id\`), INDEX \`IDX_sqi_purchase_rfq_item_id\` (\`purchase_rfq_item_id\`), INDEX \`IDX_sqi_product_variant_id\` (\`product_variant_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` ADD \`source_supplier_quotation_id\` char(36) NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_po_source_supplier_quotation_id\` ON \`purchase_orders\` (\`source_supplier_quotation_id\`)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`company_purchase_rfq_counters\` ADD CONSTRAINT \`FK_cprfqc_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`company_supplier_quotation_counters\` ADD CONSTRAINT \`FK_csqc_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_rfqs\` ADD CONSTRAINT \`FK_prfq_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_rfqs\` ADD CONSTRAINT \`FK_prfq_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_rfqs\` ADD CONSTRAINT \`FK_prfq_purchase_request\` FOREIGN KEY (\`purchase_request_id\`) REFERENCES \`purchase_requests\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_rfqs\` ADD CONSTRAINT \`FK_prfq_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_rfqs\` ADD CONSTRAINT \`FK_prfq_updated_by\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_rfq_items\` ADD CONSTRAINT \`FK_prfqi_rfq\` FOREIGN KEY (\`purchase_rfq_id\`) REFERENCES \`purchase_rfqs\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_rfq_items\` ADD CONSTRAINT \`FK_prfqi_product_variant\` FOREIGN KEY (\`product_variant_id\`) REFERENCES \`product_variants\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`supplier_quotations\` ADD CONSTRAINT \`FK_sq_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`supplier_quotations\` ADD CONSTRAINT \`FK_sq_purchase_rfq\` FOREIGN KEY (\`purchase_rfq_id\`) REFERENCES \`purchase_rfqs\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`supplier_quotations\` ADD CONSTRAINT \`FK_sq_supplier\` FOREIGN KEY (\`supplier_id\`) REFERENCES \`suppliers\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`supplier_quotations\` ADD CONSTRAINT \`FK_sq_payment_term\` FOREIGN KEY (\`payment_term_id\`) REFERENCES \`payment_terms\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`supplier_quotations\` ADD CONSTRAINT \`FK_sq_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`supplier_quotations\` ADD CONSTRAINT \`FK_sq_updated_by\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`supplier_quotation_items\` ADD CONSTRAINT \`FK_sqi_quotation\` FOREIGN KEY (\`supplier_quotation_id\`) REFERENCES \`supplier_quotations\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`supplier_quotation_items\` ADD CONSTRAINT \`FK_sqi_purchase_rfq_item\` FOREIGN KEY (\`purchase_rfq_item_id\`) REFERENCES \`purchase_rfq_items\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`supplier_quotation_items\` ADD CONSTRAINT \`FK_sqi_product_variant\` FOREIGN KEY (\`product_variant_id\`) REFERENCES \`product_variants\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` ADD CONSTRAINT \`FK_po_source_supplier_quotation\` FOREIGN KEY (\`source_supplier_quotation_id\`) REFERENCES \`supplier_quotations\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` DROP FOREIGN KEY \`FK_po_source_supplier_quotation\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`supplier_quotation_items\` DROP FOREIGN KEY \`FK_sqi_product_variant\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`supplier_quotation_items\` DROP FOREIGN KEY \`FK_sqi_purchase_rfq_item\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`supplier_quotation_items\` DROP FOREIGN KEY \`FK_sqi_quotation\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`supplier_quotations\` DROP FOREIGN KEY \`FK_sq_updated_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`supplier_quotations\` DROP FOREIGN KEY \`FK_sq_created_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`supplier_quotations\` DROP FOREIGN KEY \`FK_sq_payment_term\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`supplier_quotations\` DROP FOREIGN KEY \`FK_sq_supplier\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`supplier_quotations\` DROP FOREIGN KEY \`FK_sq_purchase_rfq\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`supplier_quotations\` DROP FOREIGN KEY \`FK_sq_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_rfq_items\` DROP FOREIGN KEY \`FK_prfqi_product_variant\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_rfq_items\` DROP FOREIGN KEY \`FK_prfqi_rfq\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_rfqs\` DROP FOREIGN KEY \`FK_prfq_updated_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_rfqs\` DROP FOREIGN KEY \`FK_prfq_created_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_rfqs\` DROP FOREIGN KEY \`FK_prfq_purchase_request\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_rfqs\` DROP FOREIGN KEY \`FK_prfq_branch\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_rfqs\` DROP FOREIGN KEY \`FK_prfq_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`company_supplier_quotation_counters\` DROP FOREIGN KEY \`FK_csqc_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`company_purchase_rfq_counters\` DROP FOREIGN KEY \`FK_cprfqc_company\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_po_source_supplier_quotation_id\` ON \`purchase_orders\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_orders\` DROP COLUMN \`source_supplier_quotation_id\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_sqi_product_variant_id\` ON \`supplier_quotation_items\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_sqi_purchase_rfq_item_id\` ON \`supplier_quotation_items\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_sqi_supplier_quotation_id\` ON \`supplier_quotation_items\``,
    );
    await queryRunner.query(`DROP TABLE \`supplier_quotation_items\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_sq_status\` ON \`supplier_quotations\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_sq_payment_term_id\` ON \`supplier_quotations\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_sq_supplier_id\` ON \`supplier_quotations\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_sq_purchase_rfq_id\` ON \`supplier_quotations\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_sq_company_id\` ON \`supplier_quotations\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_sq_company_rfq_supplier\` ON \`supplier_quotations\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_sq_company_number\` ON \`supplier_quotations\``,
    );
    await queryRunner.query(`DROP TABLE \`supplier_quotations\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_prfqi_product_variant_id\` ON \`purchase_rfq_items\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_prfqi_purchase_rfq_id\` ON \`purchase_rfq_items\``,
    );
    await queryRunner.query(`DROP TABLE \`purchase_rfq_items\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_prfq_status\` ON \`purchase_rfqs\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_prfq_required_date\` ON \`purchase_rfqs\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_prfq_purchase_request_id\` ON \`purchase_rfqs\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_prfq_branch_id\` ON \`purchase_rfqs\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_prfq_company_id\` ON \`purchase_rfqs\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_prfq_company_number\` ON \`purchase_rfqs\``,
    );
    await queryRunner.query(`DROP TABLE \`purchase_rfqs\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_csqc_company_year\` ON \`company_supplier_quotation_counters\``,
    );
    await queryRunner.query(
      `DROP TABLE \`company_supplier_quotation_counters\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_cprfqc_company_year\` ON \`company_purchase_rfq_counters\``,
    );
    await queryRunner.query(`DROP TABLE \`company_purchase_rfq_counters\``);
  }
}
