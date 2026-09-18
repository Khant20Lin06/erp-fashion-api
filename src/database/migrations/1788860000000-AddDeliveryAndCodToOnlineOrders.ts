import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeliveryAndCodToOnlineOrders1788860000000
  implements MigrationInterface
{
  name = 'AddDeliveryAndCodToOnlineOrders1788860000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`online_orders\`
        ADD COLUMN \`courier_service\` varchar(100) NULL,
        ADD COLUMN \`tracking_number\` varchar(100) NULL,
        ADD COLUMN \`cod_amount\` decimal(14,2) NOT NULL DEFAULT '0.00',
        ADD COLUMN \`cod_status\` enum('NONE', 'PENDING', 'SETTLED', 'FAILED') NOT NULL DEFAULT 'NONE',
        ADD COLUMN \`rider_name\` varchar(100) NULL,
        ADD COLUMN \`rider_phone\` varchar(50) NULL,
        ADD COLUMN \`settled_at\` timestamp NULL,
        ADD COLUMN \`settled_by\` char(36) NULL,
        ADD INDEX \`IDX_online_orders_cod_status\` (\`cod_status\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`online_orders\`
        DROP INDEX \`IDX_online_orders_cod_status\`,
        DROP COLUMN \`settled_by\`,
        DROP COLUMN \`settled_at\`,
        DROP COLUMN \`rider_phone\`,
        DROP COLUMN \`rider_name\`,
        DROP COLUMN \`cod_status\`,
        DROP COLUMN \`cod_amount\`,
        DROP COLUMN \`tracking_number\`,
        DROP COLUMN \`courier_service\``,
    );
  }
}
