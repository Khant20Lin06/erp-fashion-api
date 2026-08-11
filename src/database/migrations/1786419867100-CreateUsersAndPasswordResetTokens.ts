import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersAndPasswordResetTokens1786419867100 implements MigrationInterface {
  name = 'CreateUsersAndPasswordResetTokens1786419867100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`users\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`email\` varchar(255) NOT NULL, \`password_hash\` varchar(255) NOT NULL, \`first_name\` varchar(100) NOT NULL, \`last_name\` varchar(100) NOT NULL, \`display_name\` varchar(200) NOT NULL, \`status\` enum ('ACTIVE', 'INACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE', \`is_email_verified\` tinyint NOT NULL DEFAULT 0, \`last_login_at\` timestamp NULL, \`password_changed_at\` timestamp NULL, INDEX \`IDX_3676155292d72c67cd4e090514\` (\`status\`), UNIQUE INDEX \`IDX_97672ac88f789774dd47f7c8be\` (\`email\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`password_reset_tokens\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`user_id\` varchar(36) NOT NULL, \`token_hash\` varchar(255) NOT NULL, \`expires_at\` timestamp NOT NULL, \`used_at\` timestamp NULL, INDEX \`IDX_52ac39dd8a28730c63aeb428c9\` (\`user_id\`), INDEX \`IDX_7c038e5a589b06cbe4320cc88b\` (\`expires_at\`), UNIQUE INDEX \`IDX_91185d86d5d7557b19abbb2868\` (\`token_hash\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`password_reset_tokens\` ADD CONSTRAINT \`FK_52ac39dd8a28730c63aeb428c9c\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`password_reset_tokens\` DROP FOREIGN KEY \`FK_52ac39dd8a28730c63aeb428c9c\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_91185d86d5d7557b19abbb2868\` ON \`password_reset_tokens\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_7c038e5a589b06cbe4320cc88b\` ON \`password_reset_tokens\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_52ac39dd8a28730c63aeb428c9\` ON \`password_reset_tokens\``,
    );
    await queryRunner.query(`DROP TABLE \`password_reset_tokens\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_97672ac88f789774dd47f7c8be\` ON \`users\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_3676155292d72c67cd4e090514\` ON \`users\``,
    );
    await queryRunner.query(`DROP TABLE \`users\``);
  }
}
