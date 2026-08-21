import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRefreshSessions1786630000000 implements MigrationInterface {
  name = 'CreateRefreshSessions1786630000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`refresh_sessions\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`user_id\` char(36) NOT NULL, \`token_hash\` varchar(255) NOT NULL, \`expires_at\` timestamp NOT NULL, \`revoked_at\` timestamp NULL, \`replaced_by_id\` char(36) NULL, UNIQUE INDEX \`IDX_refresh_session_token_hash\` (\`token_hash\`), INDEX \`IDX_refresh_session_user\` (\`user_id\`), INDEX \`IDX_refresh_session_expires_at\` (\`expires_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`refresh_sessions\` ADD CONSTRAINT \`FK_refresh_session_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`refresh_sessions\` DROP FOREIGN KEY \`FK_refresh_session_user\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_refresh_session_expires_at\` ON \`refresh_sessions\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_refresh_session_user\` ON \`refresh_sessions\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_refresh_session_token_hash\` ON \`refresh_sessions\``,
    );
    await queryRunner.query(`DROP TABLE \`refresh_sessions\``);
  }
}
