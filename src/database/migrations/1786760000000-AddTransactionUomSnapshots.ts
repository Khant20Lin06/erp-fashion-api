import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTransactionUomSnapshots1786760000000
  implements MigrationInterface
{
  name = 'AddTransactionUomSnapshots1786760000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`sale_items\` ADD \`uom_id\` varchar(36) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sale_items\` ADD \`uom_code_snapshot\` varchar(20) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sale_items\` ADD \`uom_name_snapshot\` varchar(100) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sale_items\` ADD \`base_quantity_snapshot\` int NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sale_items\` ADD \`conversion_factor_to_base_snapshot\` decimal(14,4) NOT NULL DEFAULT 1.0000`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sale_items\` ADD INDEX \`IDX_sale_item_uom_id\` (\`uom_id\`)`,
    );
    await queryRunner.query(
      `UPDATE \`sale_items\` SET \`base_quantity_snapshot\` = \`quantity\`, \`conversion_factor_to_base_snapshot\` = 1.0000 WHERE \`base_quantity_snapshot\` = 0`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sale_items\` ADD CONSTRAINT \`FK_sale_item_uom\` FOREIGN KEY (\`uom_id\`) REFERENCES \`uoms\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`purchase_order_items\` ADD \`uom_id\` varchar(36) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_order_items\` ADD \`uom_code_snapshot\` varchar(20) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_order_items\` ADD \`uom_name_snapshot\` varchar(100) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_order_items\` ADD \`base_quantity_snapshot\` int NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_order_items\` ADD \`conversion_factor_to_base_snapshot\` decimal(14,4) NOT NULL DEFAULT 1.0000`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_order_items\` ADD INDEX \`IDX_purchase_order_item_uom_id\` (\`uom_id\`)`,
    );
    await queryRunner.query(
      `UPDATE \`purchase_order_items\` SET \`base_quantity_snapshot\` = \`quantity\`, \`conversion_factor_to_base_snapshot\` = 1.0000 WHERE \`base_quantity_snapshot\` = 0`,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_order_items\` ADD CONSTRAINT \`FK_purchase_order_item_uom\` FOREIGN KEY (\`uom_id\`) REFERENCES \`uoms\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE \`goods_receipt_items\` ADD \`uom_id\` varchar(36) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`goods_receipt_items\` ADD \`uom_code_snapshot\` varchar(20) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`goods_receipt_items\` ADD \`uom_name_snapshot\` varchar(100) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`goods_receipt_items\` ADD \`conversion_factor_to_base_snapshot\` decimal(14,4) NOT NULL DEFAULT 1.0000`,
    );
    await queryRunner.query(
      `ALTER TABLE \`goods_receipt_items\` ADD \`base_received_quantity\` int NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE \`goods_receipt_items\` ADD \`base_rejected_quantity\` int NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE \`goods_receipt_items\` ADD INDEX \`IDX_goods_receipt_item_uom_id\` (\`uom_id\`)`,
    );
    await queryRunner.query(
      `UPDATE \`goods_receipt_items\` SET \`conversion_factor_to_base_snapshot\` = 1.0000, \`base_received_quantity\` = \`received_quantity\`, \`base_rejected_quantity\` = \`rejected_quantity\` WHERE \`base_received_quantity\` = 0 AND \`base_rejected_quantity\` = 0`,
    );
    await queryRunner.query(
      `ALTER TABLE \`goods_receipt_items\` ADD CONSTRAINT \`FK_goods_receipt_item_uom\` FOREIGN KEY (\`uom_id\`) REFERENCES \`uoms\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`goods_receipt_items\` DROP FOREIGN KEY \`FK_goods_receipt_item_uom\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`goods_receipt_items\` DROP INDEX \`IDX_goods_receipt_item_uom_id\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`goods_receipt_items\` DROP COLUMN \`base_rejected_quantity\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`goods_receipt_items\` DROP COLUMN \`base_received_quantity\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`goods_receipt_items\` DROP COLUMN \`conversion_factor_to_base_snapshot\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`goods_receipt_items\` DROP COLUMN \`uom_name_snapshot\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`goods_receipt_items\` DROP COLUMN \`uom_code_snapshot\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`goods_receipt_items\` DROP COLUMN \`uom_id\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`purchase_order_items\` DROP FOREIGN KEY \`FK_purchase_order_item_uom\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_order_items\` DROP INDEX \`IDX_purchase_order_item_uom_id\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_order_items\` DROP COLUMN \`conversion_factor_to_base_snapshot\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_order_items\` DROP COLUMN \`base_quantity_snapshot\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_order_items\` DROP COLUMN \`uom_name_snapshot\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_order_items\` DROP COLUMN \`uom_code_snapshot\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`purchase_order_items\` DROP COLUMN \`uom_id\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`sale_items\` DROP FOREIGN KEY \`FK_sale_item_uom\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`sale_items\` DROP INDEX \`IDX_sale_item_uom_id\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`sale_items\` DROP COLUMN \`conversion_factor_to_base_snapshot\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`sale_items\` DROP COLUMN \`base_quantity_snapshot\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`sale_items\` DROP COLUMN \`uom_name_snapshot\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`sale_items\` DROP COLUMN \`uom_code_snapshot\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`sale_items\` DROP COLUMN \`uom_id\``,
    );
  }
}
