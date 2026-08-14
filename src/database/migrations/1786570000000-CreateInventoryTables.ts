import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInventoryTables1786570000000 implements MigrationInterface {
  name = 'CreateInventoryTables1786570000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- company_goods_receipt_counters ----
    await queryRunner.query(
      `CREATE TABLE \`company_goods_receipt_counters\` (\`id\` varchar(36) NOT NULL, \`company_id\` varchar(36) NOT NULL, \`year\` int NOT NULL, \`last_sequence\` int NOT NULL DEFAULT '0', UNIQUE INDEX \`IDX_cgrc_company_year\` (\`company_id\`, \`year\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- warehouse_stock ----
    await queryRunner.query(
      `CREATE TABLE \`warehouse_stock\` (\`id\` varchar(36) NOT NULL, \`warehouse_id\` varchar(36) NOT NULL, \`product_variant_id\` varchar(36) NOT NULL, \`on_hand_quantity\` int NOT NULL DEFAULT '0', \`reserved_quantity\` int NOT NULL DEFAULT '0', \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_ws_warehouse_variant\` (\`warehouse_id\`, \`product_variant_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- stock_movements ----
    await queryRunner.query(
      `CREATE TABLE \`stock_movements\` (\`id\` varchar(36) NOT NULL, \`warehouse_id\` varchar(36) NOT NULL, \`product_variant_id\` varchar(36) NOT NULL, \`movement_type\` enum ('PURCHASE_RECEIPT', 'SALE_ISSUE', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'OPENING_BALANCE') NOT NULL, \`quantity_change\` int NOT NULL, \`quantity_after\` int NOT NULL, \`reference_type\` enum ('GOODS_RECEIPT', 'SALE', 'STOCK_TRANSFER', 'STOCK_ADJUSTMENT') NOT NULL, \`reference_id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`created_by\` varchar(36) NULL, INDEX \`IDX_sm_warehouse_id\` (\`warehouse_id\`), INDEX \`IDX_sm_product_variant_id\` (\`product_variant_id\`), INDEX \`IDX_sm_movement_type\` (\`movement_type\`), INDEX \`IDX_sm_reference_type\` (\`reference_type\`), INDEX \`IDX_sm_reference_id\` (\`reference_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- goods_receipts ----
    await queryRunner.query(
      `CREATE TABLE \`goods_receipts\` (\`id\` varchar(36) NOT NULL, \`receipt_number\` varchar(50) NOT NULL, \`purchase_order_id\` varchar(36) NOT NULL, \`warehouse_id\` varchar(36) NOT NULL, \`supplier_id\` varchar(36) NOT NULL, \`company_id\` varchar(36) NOT NULL, \`receipt_date\` timestamp NOT NULL, \`notes\` varchar(1000) NULL, \`received_by\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_gr_purchase_order_id\` (\`purchase_order_id\`), INDEX \`IDX_gr_warehouse_id\` (\`warehouse_id\`), INDEX \`IDX_gr_supplier_id\` (\`supplier_id\`), INDEX \`IDX_gr_company_id\` (\`company_id\`), INDEX \`IDX_gr_receipt_date\` (\`receipt_date\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- goods_receipt_items ----
    await queryRunner.query(
      `CREATE TABLE \`goods_receipt_items\` (\`id\` varchar(36) NOT NULL, \`goods_receipt_id\` varchar(36) NOT NULL, \`purchase_order_item_id\` varchar(36) NOT NULL, \`product_variant_id\` varchar(36) NOT NULL, \`received_quantity\` int NOT NULL, \`rejected_quantity\` int NOT NULL DEFAULT '0', \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_gri_goods_receipt_id\` (\`goods_receipt_id\`), INDEX \`IDX_gri_purchase_order_item_id\` (\`purchase_order_item_id\`), INDEX \`IDX_gri_product_variant_id\` (\`product_variant_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- company_stock_transfer_counters ----
    await queryRunner.query(
      `CREATE TABLE \`company_stock_transfer_counters\` (\`id\` varchar(36) NOT NULL, \`company_id\` varchar(36) NOT NULL, \`year\` int NOT NULL, \`last_sequence\` int NOT NULL DEFAULT '0', UNIQUE INDEX \`IDX_cstc_company_year\` (\`company_id\`, \`year\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- stock_transfers ----
    await queryRunner.query(
      `CREATE TABLE \`stock_transfers\` (\`id\` varchar(36) NOT NULL, \`transfer_number\` varchar(50) NOT NULL, \`source_warehouse_id\` varchar(36) NOT NULL, \`destination_warehouse_id\` varchar(36) NOT NULL, \`company_id\` varchar(36) NOT NULL, \`notes\` varchar(1000) NULL, \`created_by\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_st_source_warehouse_id\` (\`source_warehouse_id\`), INDEX \`IDX_st_destination_warehouse_id\` (\`destination_warehouse_id\`), INDEX \`IDX_st_company_id\` (\`company_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- stock_transfer_items ----
    await queryRunner.query(
      `CREATE TABLE \`stock_transfer_items\` (\`id\` varchar(36) NOT NULL, \`stock_transfer_id\` varchar(36) NOT NULL, \`product_variant_id\` varchar(36) NOT NULL, \`quantity\` int NOT NULL, INDEX \`IDX_sti_stock_transfer_id\` (\`stock_transfer_id\`), INDEX \`IDX_sti_product_variant_id\` (\`product_variant_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- company_stock_adjustment_counters ----
    await queryRunner.query(
      `CREATE TABLE \`company_stock_adjustment_counters\` (\`id\` varchar(36) NOT NULL, \`company_id\` varchar(36) NOT NULL, \`year\` int NOT NULL, \`last_sequence\` int NOT NULL DEFAULT '0', UNIQUE INDEX \`IDX_csac_company_year\` (\`company_id\`, \`year\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- stock_adjustments ----
    await queryRunner.query(
      `CREATE TABLE \`stock_adjustments\` (\`id\` varchar(36) NOT NULL, \`adjustment_number\` varchar(50) NOT NULL, \`warehouse_id\` varchar(36) NOT NULL, \`product_variant_id\` varchar(36) NOT NULL, \`quantity_change\` int NOT NULL, \`reason\` enum ('OPENING_BALANCE', 'DAMAGE', 'LOSS', 'FOUND', 'CORRECTION') NOT NULL, \`company_id\` varchar(36) NOT NULL, \`notes\` varchar(1000) NULL, \`created_by\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_sa_warehouse_id\` (\`warehouse_id\`), INDEX \`IDX_sa_product_variant_id\` (\`product_variant_id\`), INDEX \`IDX_sa_reason\` (\`reason\`), INDEX \`IDX_sa_company_id\` (\`company_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- Foreign keys ----
    await queryRunner.query(
      `ALTER TABLE \`company_goods_receipt_counters\` ADD CONSTRAINT \`FK_cgrc_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`warehouse_stock\` ADD CONSTRAINT \`FK_ws_warehouse\` FOREIGN KEY (\`warehouse_id\`) REFERENCES \`warehouses\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`warehouse_stock\` ADD CONSTRAINT \`FK_ws_product_variant\` FOREIGN KEY (\`product_variant_id\`) REFERENCES \`product_variants\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`stock_movements\` ADD CONSTRAINT \`FK_sm_warehouse\` FOREIGN KEY (\`warehouse_id\`) REFERENCES \`warehouses\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_movements\` ADD CONSTRAINT \`FK_sm_product_variant\` FOREIGN KEY (\`product_variant_id\`) REFERENCES \`product_variants\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_movements\` ADD CONSTRAINT \`FK_sm_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`goods_receipts\` ADD CONSTRAINT \`FK_gr_purchase_order\` FOREIGN KEY (\`purchase_order_id\`) REFERENCES \`purchase_orders\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`goods_receipts\` ADD CONSTRAINT \`FK_gr_warehouse\` FOREIGN KEY (\`warehouse_id\`) REFERENCES \`warehouses\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`goods_receipts\` ADD CONSTRAINT \`FK_gr_supplier\` FOREIGN KEY (\`supplier_id\`) REFERENCES \`suppliers\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`goods_receipts\` ADD CONSTRAINT \`FK_gr_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`goods_receipts\` ADD CONSTRAINT \`FK_gr_received_by\` FOREIGN KEY (\`received_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`goods_receipt_items\` ADD CONSTRAINT \`FK_gri_goods_receipt\` FOREIGN KEY (\`goods_receipt_id\`) REFERENCES \`goods_receipts\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`goods_receipt_items\` ADD CONSTRAINT \`FK_gri_purchase_order_item\` FOREIGN KEY (\`purchase_order_item_id\`) REFERENCES \`purchase_order_items\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`goods_receipt_items\` ADD CONSTRAINT \`FK_gri_product_variant\` FOREIGN KEY (\`product_variant_id\`) REFERENCES \`product_variants\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`company_stock_transfer_counters\` ADD CONSTRAINT \`FK_cstc_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`stock_transfers\` ADD CONSTRAINT \`FK_st_source_warehouse\` FOREIGN KEY (\`source_warehouse_id\`) REFERENCES \`warehouses\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_transfers\` ADD CONSTRAINT \`FK_st_destination_warehouse\` FOREIGN KEY (\`destination_warehouse_id\`) REFERENCES \`warehouses\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_transfers\` ADD CONSTRAINT \`FK_st_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_transfers\` ADD CONSTRAINT \`FK_st_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`stock_transfer_items\` ADD CONSTRAINT \`FK_sti_stock_transfer\` FOREIGN KEY (\`stock_transfer_id\`) REFERENCES \`stock_transfers\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_transfer_items\` ADD CONSTRAINT \`FK_sti_product_variant\` FOREIGN KEY (\`product_variant_id\`) REFERENCES \`product_variants\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`company_stock_adjustment_counters\` ADD CONSTRAINT \`FK_csac_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`stock_adjustments\` ADD CONSTRAINT \`FK_stkadj_warehouse\` FOREIGN KEY (\`warehouse_id\`) REFERENCES \`warehouses\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_adjustments\` ADD CONSTRAINT \`FK_stkadj_product_variant\` FOREIGN KEY (\`product_variant_id\`) REFERENCES \`product_variants\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_adjustments\` ADD CONSTRAINT \`FK_stkadj_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_adjustments\` ADD CONSTRAINT \`FK_stkadj_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`stock_adjustments\` DROP FOREIGN KEY \`FK_stkadj_created_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_adjustments\` DROP FOREIGN KEY \`FK_stkadj_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_adjustments\` DROP FOREIGN KEY \`FK_stkadj_product_variant\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_adjustments\` DROP FOREIGN KEY \`FK_stkadj_warehouse\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`company_stock_adjustment_counters\` DROP FOREIGN KEY \`FK_csac_company\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`stock_transfer_items\` DROP FOREIGN KEY \`FK_sti_product_variant\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_transfer_items\` DROP FOREIGN KEY \`FK_sti_stock_transfer\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`stock_transfers\` DROP FOREIGN KEY \`FK_st_created_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_transfers\` DROP FOREIGN KEY \`FK_st_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_transfers\` DROP FOREIGN KEY \`FK_st_destination_warehouse\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_transfers\` DROP FOREIGN KEY \`FK_st_source_warehouse\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`company_stock_transfer_counters\` DROP FOREIGN KEY \`FK_cstc_company\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`goods_receipt_items\` DROP FOREIGN KEY \`FK_gri_product_variant\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`goods_receipt_items\` DROP FOREIGN KEY \`FK_gri_purchase_order_item\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`goods_receipt_items\` DROP FOREIGN KEY \`FK_gri_goods_receipt\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`goods_receipts\` DROP FOREIGN KEY \`FK_gr_received_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`goods_receipts\` DROP FOREIGN KEY \`FK_gr_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`goods_receipts\` DROP FOREIGN KEY \`FK_gr_supplier\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`goods_receipts\` DROP FOREIGN KEY \`FK_gr_warehouse\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`goods_receipts\` DROP FOREIGN KEY \`FK_gr_purchase_order\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`stock_movements\` DROP FOREIGN KEY \`FK_sm_created_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_movements\` DROP FOREIGN KEY \`FK_sm_product_variant\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`stock_movements\` DROP FOREIGN KEY \`FK_sm_warehouse\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`warehouse_stock\` DROP FOREIGN KEY \`FK_ws_product_variant\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`warehouse_stock\` DROP FOREIGN KEY \`FK_ws_warehouse\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`company_goods_receipt_counters\` DROP FOREIGN KEY \`FK_cgrc_company\``,
    );

    await queryRunner.query(
      `DROP INDEX \`IDX_sa_company_id\` ON \`stock_adjustments\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_sa_reason\` ON \`stock_adjustments\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_sa_product_variant_id\` ON \`stock_adjustments\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_sa_warehouse_id\` ON \`stock_adjustments\``,
    );
    await queryRunner.query(`DROP TABLE \`stock_adjustments\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_csac_company_year\` ON \`company_stock_adjustment_counters\``,
    );
    await queryRunner.query(`DROP TABLE \`company_stock_adjustment_counters\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_sti_product_variant_id\` ON \`stock_transfer_items\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_sti_stock_transfer_id\` ON \`stock_transfer_items\``,
    );
    await queryRunner.query(`DROP TABLE \`stock_transfer_items\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_st_company_id\` ON \`stock_transfers\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_st_destination_warehouse_id\` ON \`stock_transfers\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_st_source_warehouse_id\` ON \`stock_transfers\``,
    );
    await queryRunner.query(`DROP TABLE \`stock_transfers\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_cstc_company_year\` ON \`company_stock_transfer_counters\``,
    );
    await queryRunner.query(`DROP TABLE \`company_stock_transfer_counters\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_gri_product_variant_id\` ON \`goods_receipt_items\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_gri_purchase_order_item_id\` ON \`goods_receipt_items\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_gri_goods_receipt_id\` ON \`goods_receipt_items\``,
    );
    await queryRunner.query(`DROP TABLE \`goods_receipt_items\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_gr_receipt_date\` ON \`goods_receipts\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_gr_company_id\` ON \`goods_receipts\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_gr_supplier_id\` ON \`goods_receipts\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_gr_warehouse_id\` ON \`goods_receipts\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_gr_purchase_order_id\` ON \`goods_receipts\``,
    );
    await queryRunner.query(`DROP TABLE \`goods_receipts\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_sm_reference_id\` ON \`stock_movements\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_sm_reference_type\` ON \`stock_movements\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_sm_movement_type\` ON \`stock_movements\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_sm_product_variant_id\` ON \`stock_movements\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_sm_warehouse_id\` ON \`stock_movements\``,
    );
    await queryRunner.query(`DROP TABLE \`stock_movements\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_ws_warehouse_variant\` ON \`warehouse_stock\``,
    );
    await queryRunner.query(`DROP TABLE \`warehouse_stock\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_cgrc_company_year\` ON \`company_goods_receipt_counters\``,
    );
    await queryRunner.query(`DROP TABLE \`company_goods_receipt_counters\``);
  }
}
