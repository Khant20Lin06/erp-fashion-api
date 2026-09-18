import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiToolAuditLogsTable1788840000000 implements MigrationInterface {
  name = 'CreateAiToolAuditLogsTable1788840000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`ai_tool_audit_logs\` (
        \`id\` varchar(36) NOT NULL,
        \`conversation_id\` varchar(36) NULL,
        \`user_id\` char(36) NOT NULL,
        \`company_id\` char(36) NOT NULL,
        \`branch_id\` char(36) NULL,
        \`tool_name\` varchar(100) NOT NULL,
        \`tool_type\` varchar(20) NOT NULL DEFAULT 'read',
        \`risk_level\` varchar(20) NOT NULL DEFAULT 'low',
        \`arguments\` json NOT NULL,
        \`status\` enum('SUCCESS', 'FAILED', 'DENIED_PERMISSION', 'DENIED_GUARDRAILS', 'APPROVAL_REQUIRED') NOT NULL DEFAULT 'SUCCESS',
        \`error_message\` text NULL,
        \`duration_ms\` int NOT NULL DEFAULT 0,
        \`approved_by\` char(36) NULL,
        \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX \`IDX_ai_tool_audit_comp_tool_created\` (\`company_id\`, \`tool_name\`, \`created_at\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryRunner.query(`
      ALTER TABLE \`ai_tool_audit_logs\`
        ADD CONSTRAINT \`FK_ai_tool_audit_company\`
        FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`)
        ON DELETE RESTRICT ON UPDATE NO ACTION;
    `);

    await queryRunner.query(`
      ALTER TABLE \`ai_tool_audit_logs\`
        ADD CONSTRAINT \`FK_ai_tool_audit_user\`
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`)
        ON DELETE RESTRICT ON UPDATE NO ACTION;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`ai_tool_audit_logs\` DROP FOREIGN KEY \`FK_ai_tool_audit_user\``);
    await queryRunner.query(`ALTER TABLE \`ai_tool_audit_logs\` DROP FOREIGN KEY \`FK_ai_tool_audit_company\``);
    await queryRunner.query(`DROP TABLE \`ai_tool_audit_logs\``);
  }
}
