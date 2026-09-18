import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSaleFulfillmentTracking1786770000000
  implements MigrationInterface
{
  name = 'AddSaleFulfillmentTracking1786770000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `sales` ADD COLUMN `fulfillment_status` enum('PENDING_SHIPMENT','SHIPPED','DELIVERED') NULL AFTER `notes`",
    );
    await queryRunner.query(
      'ALTER TABLE `sales` ADD COLUMN `shipped_at` timestamp NULL AFTER `fulfillment_status`',
    );
    await queryRunner.query(
      'ALTER TABLE `sales` ADD COLUMN `delivered_at` timestamp NULL AFTER `shipped_at`',
    );
    await queryRunner.query(
      'CREATE INDEX `IDX_sales_fulfillment_status` ON `sales` (`fulfillment_status`)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX `IDX_sales_fulfillment_status` ON `sales`',
    );
    await queryRunner.query('ALTER TABLE `sales` DROP COLUMN `delivered_at`');
    await queryRunner.query('ALTER TABLE `sales` DROP COLUMN `shipped_at`');
    await queryRunner.query(
      'ALTER TABLE `sales` DROP COLUMN `fulfillment_status`',
    );
  }
}
