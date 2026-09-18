import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOnlineOrdersTable1786790000000
  implements MigrationInterface
{
  name = 'CreateOnlineOrdersTable1786790000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`online_orders\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` char(36) NOT NULL, \`sale_id\` char(36) NOT NULL, \`customer_id\` char(36) NOT NULL, \`source\` enum ('TELEGRAM', 'WEBSITE', 'FACEBOOK') NOT NULL, \`status\` enum ('PENDING_REVIEW', 'CONFIRMED', 'PACKED', 'ON_MY_WAY', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'PENDING_REVIEW', \`telegram_user_id\` varchar(64) NULL, \`telegram_username\` varchar(64) NULL, \`delivery_address\` varchar(500) NOT NULL, \`status_updated_at\` timestamp NULL, INDEX \`IDX_oo_company_id\` (\`company_id\`), INDEX \`IDX_oo_customer_id\` (\`customer_id\`), INDEX \`IDX_oo_source\` (\`source\`), INDEX \`IDX_oo_status\` (\`status\`), UNIQUE INDEX \`IDX_oo_sale_id\` (\`sale_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `ALTER TABLE \`online_orders\` ADD CONSTRAINT \`FK_oo_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`online_orders\` ADD CONSTRAINT \`FK_oo_sale\` FOREIGN KEY (\`sale_id\`) REFERENCES \`sales\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`online_orders\` ADD CONSTRAINT \`FK_oo_customer\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`online_orders\` DROP FOREIGN KEY \`FK_oo_customer\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`online_orders\` DROP FOREIGN KEY \`FK_oo_sale\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`online_orders\` DROP FOREIGN KEY \`FK_oo_company\``,
    );
    await queryRunner.query('DROP TABLE `online_orders`');
  }
}
