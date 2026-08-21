import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiAssistantTables1786670000000 implements MigrationInterface {
  name = 'CreateAiAssistantTables1786670000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- ai_conversations ----
    await queryRunner.query(
      `CREATE TABLE \`ai_conversations\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` char(36) NOT NULL, \`branch_id\` char(36) NULL, \`user_id\` char(36) NOT NULL, \`title\` varchar(255) NULL, INDEX \`IDX_aiconv_company_user_created\` (\`company_id\`, \`user_id\`, \`created_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- ai_messages ----
    await queryRunner.query(
      `CREATE TABLE \`ai_messages\` (\`id\` varchar(36) NOT NULL, \`conversation_id\` char(36) NOT NULL, \`role\` enum ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL') NOT NULL, \`content\` text NOT NULL, \`tool_calls\` json NULL, \`tool_results\` json NULL, \`model\` varchar(150) NULL, \`prompt_tokens\` int NULL, \`completion_tokens\` int NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_aimsg_conversation_created\` (\`conversation_id\`, \`created_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- ai_knowledge_documents ----
    await queryRunner.query(
      `CREATE TABLE \`ai_knowledge_documents\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` char(36) NULL, \`scope\` enum ('SYSTEM', 'COMPANY') NOT NULL, \`title\` varchar(255) NOT NULL, \`content\` longtext NOT NULL, \`content_hash\` char(64) NOT NULL, \`status\` enum ('PENDING', 'PROCESSING', 'READY', 'FAILED') NOT NULL DEFAULT 'PENDING', \`error_message\` varchar(1000) NULL, \`chunk_count\` int NOT NULL DEFAULT '0', \`embedding_model\` varchar(150) NULL, \`created_by\` char(36) NULL, INDEX \`IDX_aikdoc_company_status\` (\`company_id\`, \`status\`), INDEX \`IDX_aikdoc_company_hash\` (\`company_id\`, \`content_hash\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- ai_knowledge_chunks ----
    await queryRunner.query(
      `CREATE TABLE \`ai_knowledge_chunks\` (\`id\` varchar(36) NOT NULL, \`document_id\` char(36) NOT NULL, \`company_id\` char(36) NULL, \`chunk_index\` int NOT NULL, \`content\` text NOT NULL, \`embedding\` json NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_aikchunk_document_index\` (\`document_id\`, \`chunk_index\`), INDEX \`IDX_aikchunk_company_document\` (\`company_id\`, \`document_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    // ---- FKs ----
    await queryRunner.query(
      `ALTER TABLE \`ai_conversations\` ADD CONSTRAINT \`FK_aiconv_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`ai_conversations\` ADD CONSTRAINT \`FK_aiconv_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`ai_messages\` ADD CONSTRAINT \`FK_aimsg_conversation\` FOREIGN KEY (\`conversation_id\`) REFERENCES \`ai_conversations\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`ai_knowledge_documents\` ADD CONSTRAINT \`FK_aikdoc_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`ai_knowledge_documents\` ADD CONSTRAINT \`FK_aikdoc_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`ai_knowledge_chunks\` ADD CONSTRAINT \`FK_aikchunk_document\` FOREIGN KEY (\`document_id\`) REFERENCES \`ai_knowledge_documents\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`ai_knowledge_chunks\` DROP FOREIGN KEY \`FK_aikchunk_document\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`ai_knowledge_documents\` DROP FOREIGN KEY \`FK_aikdoc_created_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`ai_knowledge_documents\` DROP FOREIGN KEY \`FK_aikdoc_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`ai_messages\` DROP FOREIGN KEY \`FK_aimsg_conversation\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`ai_conversations\` DROP FOREIGN KEY \`FK_aiconv_user\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`ai_conversations\` DROP FOREIGN KEY \`FK_aiconv_company\``,
    );

    await queryRunner.query(
      `DROP INDEX \`IDX_aikchunk_company_document\` ON \`ai_knowledge_chunks\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_aikchunk_document_index\` ON \`ai_knowledge_chunks\``,
    );
    await queryRunner.query(`DROP TABLE \`ai_knowledge_chunks\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_aikdoc_company_hash\` ON \`ai_knowledge_documents\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_aikdoc_company_status\` ON \`ai_knowledge_documents\``,
    );
    await queryRunner.query(`DROP TABLE \`ai_knowledge_documents\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_aimsg_conversation_created\` ON \`ai_messages\``,
    );
    await queryRunner.query(`DROP TABLE \`ai_messages\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_aiconv_company_user_created\` ON \`ai_conversations\``,
    );
    await queryRunner.query(`DROP TABLE \`ai_conversations\``);
  }
}
