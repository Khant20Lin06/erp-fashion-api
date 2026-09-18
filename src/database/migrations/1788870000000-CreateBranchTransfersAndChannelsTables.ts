import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBranchTransfersAndChannelsTables1788870000000
  implements MigrationInterface
{
  name = 'CreateBranchTransfersAndChannelsTables1788870000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`branch_transfers\` (
        \`id\` char(36) NOT NULL,
        \`transfer_number\` varchar(50) NOT NULL,
        \`company_id\` char(36) NOT NULL,
        \`source_branch_id\` char(36) NOT NULL,
        \`source_warehouse_id\` char(36) NOT NULL,
        \`destination_branch_id\` char(36) NOT NULL,
        \`destination_warehouse_id\` char(36) NOT NULL,
        \`status\` enum('REQUESTED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'REQUESTED',
        \`transit_method\` varchar(100) NULL,
        \`tracking_number\` varchar(100) NULL,
        \`driver_name\` varchar(100) NULL,
        \`driver_phone\` varchar(50) NULL,
        \`dispatched_at\` timestamp NULL,
        \`dispatched_by\` char(36) NULL,
        \`received_at\` timestamp NULL,
        \`received_by\` char(36) NULL,
        \`notes\` varchar(1000) NULL,
        \`created_by\` char(36) NOT NULL,
        \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_branch_transfers_company_number\` (\`company_id\`, \`transfer_number\`),
        INDEX \`IDX_branch_transfers_status\` (\`status\`),
        INDEX \`IDX_branch_transfers_source\` (\`source_branch_id\`),
        INDEX \`IDX_branch_transfers_destination\` (\`destination_branch_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`branch_transfer_items\` (
        \`id\` char(36) NOT NULL,
        \`transfer_id\` char(36) NOT NULL,
        \`product_variant_id\` char(36) NOT NULL,
        \`requested_quantity\` int NOT NULL DEFAULT 1,
        \`shipped_quantity\` int NOT NULL DEFAULT 0,
        \`received_quantity\` int NOT NULL DEFAULT 0,
        \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_branch_transfer_items_transfer\` (\`transfer_id\`),
        INDEX \`IDX_branch_transfer_items_variant\` (\`product_variant_id\`),
        CONSTRAINT \`FK_branch_transfer_items_transfer\` FOREIGN KEY (\`transfer_id\`) REFERENCES \`branch_transfers\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`ecommerce_channels\` (
        \`id\` char(36) NOT NULL,
        \`company_id\` char(36) NOT NULL,
        \`code\` varchar(50) NOT NULL,
        \`name\` varchar(100) NOT NULL,
        \`status\` enum('ACTIVE', 'PAUSED', 'DISCONNECTED') NOT NULL DEFAULT 'ACTIVE',
        \`api_key\` varchar(255) NULL,
        \`webhook_secret\` varchar(255) NULL,
        \`stock_buffer\` int NOT NULL DEFAULT 0,
        \`last_synced_at\` timestamp NULL,
        \`synced_orders_count\` int NOT NULL DEFAULT 0,
        \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_ecommerce_channels_company_code\` (\`company_id\`, \`code\`),
        INDEX \`IDX_ecommerce_channels_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`branch_transfer_items\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`branch_transfers\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`ecommerce_channels\`;`);
  }
}
