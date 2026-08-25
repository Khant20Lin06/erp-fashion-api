import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hybrid retrieval (Phase 19.1 follow-up — dense vector search via Qdrant
 * alone misses exact-token matches like SKUs, invoice numbers, or product
 * codes that a keyword search catches trivially). MySQL's native FULLTEXT
 * index gives BM25-style relevance ranking (MATCH...AGAINST) without a new
 * external dependency — InnoDB has supported FULLTEXT since 5.6.
 */
export class AddFullTextIndexToAiKnowledgeChunks1786690000000
  implements MigrationInterface
{
  name = 'AddFullTextIndexToAiKnowledgeChunks1786690000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `ai_knowledge_chunks` ADD FULLTEXT INDEX `IDX_aikchunk_content_fulltext` (`content`)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `ai_knowledge_chunks` DROP INDEX `IDX_aikchunk_content_fulltext`',
    );
  }
}
