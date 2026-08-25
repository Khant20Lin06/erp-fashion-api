import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiKnowledgeChunk } from '../entities/ai-knowledge-chunk.entity';
import { AiKnowledgeStatus } from '../entities/ai-knowledge-status.enum';
import { AiConfig } from '../../../config/ai.config';
import { LLM_PROVIDER } from '../providers/llm-provider.interface';
import type { LlmProvider } from '../providers/llm-provider.interface';
import { QdrantVectorStoreService } from './qdrant-vector-store.service';

export interface RagRetrievedChunk {
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  content: string;
  score: number;
}

interface RankedChunkId {
  chunkId: string;
  /** 1-based rank within its own tier's result list (1 = best) — RRF
   * combines ranks, not raw scores, specifically because dense cosine
   * similarity and MySQL's fulltext relevance score are on incomparable
   * scales (Phase 19.1 follow-up §3's own reasoning). */
  rank: number;
}

/** Reciprocal Rank Fusion — standard, dependency-free way to merge two
 * differently-scaled ranked lists (dense vector + BM25-style keyword) into
 * one, without inventing a score-normalization scheme. k=60 is the
 * standard RRF constant from the original paper (Cormack et al.), not a
 * tuned value specific to this dataset. */
const RRF_K = 60;

function reciprocalRankFusion(
  ...rankedLists: RankedChunkId[][]
): Map<string, number> {
  const fused = new Map<string, number>();
  for (const list of rankedLists) {
    for (const { chunkId, rank } of list) {
      const contribution = 1 / (RRF_K + rank);
      fused.set(chunkId, (fused.get(chunkId) ?? 0) + contribution);
    }
  }
  return fused;
}

/**
 * Hybrid retrieval (Phase 19 §19, migrated to Qdrant in a Phase 19.1
 * follow-up, extended to hybrid dense+keyword in a further follow-up).
 *
 * Two independent retrieval tiers run in parallel and are merged with
 * Reciprocal Rank Fusion:
 *   1. Dense — Qdrant ANN search over the question's embedding. Finds
 *      semantically related chunks even with zero shared vocabulary
 *      (paraphrases, synonyms).
 *   2. Keyword — MySQL FULLTEXT MATCH...AGAINST (BM25-style relevance).
 *      Finds exact-token matches — SKUs, invoice numbers, product codes,
 *      specific terminology — that embedding similarity alone can miss or
 *      under-rank, since a single distinctive token can be diluted by a
 *      long chunk's overall semantic content.
 *
 * Each tier is entirely independent: Qdrant unconfigured/unreachable still
 * lets keyword search run and vice versa (a MySQL fulltext query failing,
 * e.g. a search-mode-incompatible query string, is caught and treated as
 * "no keyword matches" rather than failing retrieval outright). Only when
 * BOTH tiers return nothing does retrieve() return an empty array — RAG
 * context is an enhancement to chat, never a hard dependency, in every
 * degradation path.
 */
@Injectable()
export class AiRagService {
  private readonly config: AiConfig;

  constructor(
    @InjectRepository(AiKnowledgeChunk)
    private readonly chunkRepository: Repository<AiKnowledgeChunk>,
    @Inject(LLM_PROVIDER) private readonly llmProvider: LlmProvider,
    private readonly vectorStore: QdrantVectorStoreService,
    configService: ConfigService,
  ) {
    this.config = configService.get<AiConfig>('ai')!;
  }

  async retrieve(
    companyId: string,
    question: string,
  ): Promise<RagRetrievedChunk[]> {
    const [denseRanked, keywordRanked] = await Promise.all([
      this.searchDense(companyId, question),
      this.searchKeyword(companyId, question),
    ]);

    const fused = reciprocalRankFusion(denseRanked, keywordRanked);
    if (fused.size === 0) {
      return [];
    }

    const rankedIds = [...fused.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.config.ragTopK)
      .map(([chunkId]) => chunkId);

    // Re-checks READY status and tenant scope against MySQL directly
    // rather than trusting either tier's own filtering alone — a chunk
    // whose parent document was re-ingested/failed/deleted since it was
    // indexed must never surface stale content (Phase 19 §19).
    const chunks = await this.chunkRepository
      .createQueryBuilder('chunk')
      .innerJoin('chunk.document', 'document')
      .where('chunk.id IN (:...ids)', { ids: rankedIds })
      .andWhere('document.status = :status', { status: AiKnowledgeStatus.Ready })
      .andWhere('(chunk.companyId = :companyId OR chunk.companyId IS NULL)', {
        companyId,
      })
      .select(['chunk.id', 'chunk.documentId', 'chunk.chunkIndex', 'chunk.content'])
      .addSelect('document.title', 'documentTitle')
      .getRawMany<{
        chunk_id: string;
        chunk_document_id: string;
        chunk_chunk_index: number;
        chunk_content: string;
        documentTitle: string;
      }>();

    const chunkById = new Map(chunks.map((row) => [row.chunk_id, row]));

    return rankedIds
      .map((chunkId) => {
        const row = chunkById.get(chunkId);
        if (!row) return null;
        return {
          documentId: row.chunk_document_id,
          documentTitle: row.documentTitle,
          chunkIndex: row.chunk_chunk_index,
          content: row.chunk_content,
          score: fused.get(chunkId)!,
        };
      })
      .filter((chunk): chunk is RagRetrievedChunk => chunk !== null);
  }

  private async searchDense(
    companyId: string,
    question: string,
  ): Promise<RankedChunkId[]> {
    if (!this.vectorStore.isConfigured()) {
      return [];
    }
    const embeddingResult = await this.llmProvider.embed([question]);
    const matches = await this.vectorStore.search(
      companyId,
      embeddingResult.embeddings[0],
      this.config.ragTopK,
    );
    return matches.map((match, index) => ({
      chunkId: match.chunkId,
      rank: index + 1,
    }));
  }

  /** MySQL's own NATURAL LANGUAGE MODE fulltext search — a real BM25-style
   * relevance ranking (InnoDB's implementation), not a fabricated/estimated
   * score. Returns [] on any query failure (e.g. the question is only
   * stopwords, which some fulltext configurations reject) rather than
   * throwing — this tier degrading never blocks the dense tier's results
   * from still reaching the assistant. */
  private async searchKeyword(
    companyId: string,
    question: string,
  ): Promise<RankedChunkId[]> {
    try {
      const rows = await this.chunkRepository
        .createQueryBuilder('chunk')
        .innerJoin('chunk.document', 'document')
        .where('document.status = :status', { status: AiKnowledgeStatus.Ready })
        .andWhere('(chunk.companyId = :companyId OR chunk.companyId IS NULL)', {
          companyId,
        })
        .andWhere('MATCH(chunk.content) AGAINST(:question IN NATURAL LANGUAGE MODE)', {
          question,
        })
        .select(['chunk.id'])
        .limit(this.config.ragTopK)
        .getRawMany<{ chunk_id: string }>();
      return rows.map((row, index) => ({ chunkId: row.chunk_id, rank: index + 1 }));
    } catch {
      return [];
    }
  }
}
