import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiKnowledgeChunk } from '../entities/ai-knowledge-chunk.entity';
import { AiKnowledgeStatus } from '../entities/ai-knowledge-status.enum';
import { AiConfig } from '../../../config/ai.config';
import { LLM_PROVIDER } from '../providers/llm-provider.interface';
import type { LlmProvider } from '../providers/llm-provider.interface';

export interface RagRetrievedChunk {
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  content: string;
  score: number;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Retrieval (Phase 19 §19). Tenant filtering happens at the SQL query layer
 * (WHERE company_id IN (:companyId, NULL-for-SYSTEM)) — never "load
 * everything then filter in app code." Similarity ranking itself is
 * app-side cosine similarity over the filtered candidate set (documented
 * MySQL-8.0-has-no-vector-type limitation — see AiKnowledgeChunk's own
 * docblock), which is why the candidate set must already be tenant-scoped
 * before this runs, not after.
 */
@Injectable()
export class AiRagService {
  private readonly config: AiConfig;

  constructor(
    @InjectRepository(AiKnowledgeChunk)
    private readonly chunkRepository: Repository<AiKnowledgeChunk>,
    @Inject(LLM_PROVIDER) private readonly llmProvider: LlmProvider,
    configService: ConfigService,
  ) {
    this.config = configService.get<AiConfig>('ai')!;
  }

  async retrieve(
    companyId: string,
    question: string,
  ): Promise<RagRetrievedChunk[]> {
    const candidates = await this.chunkRepository
      .createQueryBuilder('chunk')
      .innerJoin('chunk.document', 'document')
      .where('document.status = :status', { status: AiKnowledgeStatus.Ready })
      .andWhere('(chunk.companyId = :companyId OR chunk.companyId IS NULL)', {
        companyId,
      })
      .select([
        'chunk.id',
        'chunk.documentId',
        'chunk.chunkIndex',
        'chunk.content',
        'chunk.embedding',
      ])
      .addSelect('document.title', 'documentTitle')
      .getRawMany<{
        chunk_id: string;
        chunk_document_id: string;
        chunk_chunk_index: number;
        chunk_content: string;
        chunk_embedding: string;
        documentTitle: string;
      }>();

    if (candidates.length === 0) {
      return [];
    }

    const embeddingResult = await this.llmProvider.embed([question]);
    const questionEmbedding = embeddingResult.embeddings[0];

    const ranked = candidates
      .map((row) => {
        const embedding =
          typeof row.chunk_embedding === 'string'
            ? (JSON.parse(row.chunk_embedding) as number[])
            : (row.chunk_embedding as unknown as number[]);
        return {
          documentId: row.chunk_document_id,
          documentTitle: row.documentTitle,
          chunkIndex: row.chunk_chunk_index,
          content: row.chunk_content,
          score: cosineSimilarity(questionEmbedding, embedding),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.ragTopK);

    return ranked;
  }
}
