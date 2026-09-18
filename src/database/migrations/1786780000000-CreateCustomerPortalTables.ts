import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomerPortalTables1786780000000
  implements MigrationInterface
{
  name = 'CreateCustomerPortalTables1786780000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`customer_telegram_links\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`telegram_user_id\` varchar(64) NOT NULL, \`customer_id\` char(36) NOT NULL, \`status\` enum ('ACTIVE', 'REVOKED') NOT NULL DEFAULT 'ACTIVE', \`linked_at\` timestamp NOT NULL, \`revoked_at\` timestamp NULL, INDEX \`IDX_ctl_status\` (\`status\`), UNIQUE INDEX \`IDX_ctl_telegram_user_id\` (\`telegram_user_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`telegram_link_otps\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`telegram_user_id\` varchar(64) NOT NULL, \`phone\` varchar(50) NOT NULL, \`company_id\` char(36) NOT NULL, \`code_hash\` varchar(255) NOT NULL, \`attempt_count\` int NOT NULL DEFAULT '0', \`expires_at\` timestamp NOT NULL, \`consumed_at\` timestamp NULL, INDEX \`IDX_tlo_telegram_user_id\` (\`telegram_user_id\`), INDEX \`IDX_tlo_expires_at\` (\`expires_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `ALTER TABLE \`customer_telegram_links\` ADD CONSTRAINT \`FK_ctl_customer\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`telegram_link_otps\` ADD CONSTRAINT \`FK_tlo_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`telegram_link_otps\` DROP FOREIGN KEY \`FK_tlo_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`customer_telegram_links\` DROP FOREIGN KEY \`FK_ctl_customer\``,
    );
    await queryRunner.query('DROP TABLE `telegram_link_otps`');
    await queryRunner.query('DROP TABLE `customer_telegram_links`');
  }
}
