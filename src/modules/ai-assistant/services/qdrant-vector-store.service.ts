import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantConfig } from '../../../config/qdrant.config';

export interface VectorStoreChunk {
  /** AiKnowledgeChunk.id — Qdrant's own point id, so a point maps 1:1 back
   * to the MySQL row that holds the real content/metadata. */
  chunkId: string;
  documentId: string;
  /** Null for SYSTEM-scope chunks, same nullability as
   * AiKnowledgeChunk.companyId — mirrored here so tenant filtering can
   * happen inside Qdrant's own query, not after fetching everything. */
  companyId: string | null;
  embedding: number[];
}

export interface VectorStoreMatch {
  chunkId: string;
  documentId: string;
  score: number;
}

interface QdrantSearchResponse {
  result: Array<{ id: string; score: number; payload: Record<string, unknown> }>;
}

/**
 * Thin REST wrapper over Qdrant (Phase 19.1 follow-up — replaces the
 * brute-force in-app cosine similarity AiRagService used to run over every
 * candidate chunk in MySQL, which doesn't scale past a small knowledge
 * base). Plain fetch + AbortController, matching this codebase's existing
 * convention for external HTTP APIs (see OpenAiCompatibleProvider) rather
 * than adding a client SDK dependency.
 *
 * Qdrant is the source of truth for similarity search ONLY. MySQL
 * (AiKnowledgeChunk) remains the source of truth for chunk content and
 * tenant scoping — every point's payload carries just enough
 * (documentId/companyId) to filter in Qdrant, but the real content is
 * always read back from MySQL by the caller using the returned chunkId.
 * This keeps a single source of truth per concern and means Qdrant being
 * down never risks serving stale/wrong chunk text.
 *
 * Every method degrades to "no results" / a no-op on any failure
 * (unconfigured, unreachable, timeout) rather than throwing — vector
 * search is a retrieval-quality enhancement, not a hard dependency; RAG
 * simply returns no retrieved chunks (same as before this integration
 * existed) if Qdrant is unavailable, never blocking chat.
 */
@Injectable()
export class QdrantVectorStoreService {
  private readonly logger = new Logger(QdrantVectorStoreService.name);
  private readonly config: QdrantConfig;
  private ensuredCollection = false;

  constructor(configService: ConfigService) {
    this.config = configService.get<QdrantConfig>('qdrant')!;
  }

  isConfigured(): boolean {
    return !!this.config.url;
  }

  /**
   * Replaces every existing point for `documentId` with `chunks` in one
   * call — always called with the full fresh chunk set for a document
   * (ingestion/re-ingestion), never a partial update, so stale points
   * from a shorter previous version of the document can't linger.
   */
  async upsertDocumentChunks(
    documentId: string,
    chunks: VectorStoreChunk[],
  ): Promise<void> {
    if (!this.isConfigured()) return;
    await this.deleteDocumentChunks(documentId);
    if (chunks.length === 0) return;

    const dimensions = chunks[0].embedding.length;
    const ensured = await this.ensureCollection(dimensions);
    if (!ensured) return;

    await this.request('PUT', `/collections/${this.config.collectionName}/points?wait=true`, {
      points: chunks.map((chunk) => ({
        id: chunk.chunkId,
        vector: chunk.embedding,
        payload: { documentId: chunk.documentId, companyId: chunk.companyId },
      })),
    });
  }

  async deleteDocumentChunks(documentId: string): Promise<void> {
    if (!this.isConfigured()) return;
    await this.request(
      'POST',
      `/collections/${this.config.collectionName}/points/delete?wait=true`,
      { filter: { must: [{ key: 'documentId', match: { value: documentId } } ] } },
    );
  }

  /**
   * Tenant-scoped ANN search: companyId IS NULL (SYSTEM-scope documents,
   * visible to everyone) OR companyId = the caller's own — same filter
   * AiRagService's SQL WHERE clause used to apply before this migration,
   * now pushed into Qdrant's own filter so it happens at the index/query
   * layer rather than after fetching candidates (Phase 19 §19).
   */
  async search(
    companyId: string,
    queryEmbedding: number[],
    topK: number,
  ): Promise<VectorStoreMatch[]> {
    if (!this.isConfigured()) return [];
    const response = await this.request<QdrantSearchResponse>(
      'POST',
      `/collections/${this.config.collectionName}/points/search`,
      {
        vector: queryEmbedding,
        limit: topK,
        with_payload: true,
        filter: {
          should: [
            { is_null: { key: 'companyId' } },
            { key: 'companyId', match: { value: companyId } },
          ],
        },
      },
    );
    if (!response) return [];
    return response.result.map((point) => ({
      chunkId: String(point.id),
      documentId: String(point.payload.documentId ?? ''),
      score: point.score,
    }));
  }

  /** Collections are created lazily, sized from whatever embedding model
   * actually produced the first chunk — never hardcoded, since switching
   * AI_EMBEDDING_MODEL later can change the vector dimension. Cached
   * per-process after the first successful check so a normal ingestion
   * run doesn't re-check on every call. */
  private async ensureCollection(dimensions: number): Promise<boolean> {
    if (this.ensuredCollection) return true;
    const existing = await this.request(
      'GET',
      `/collections/${this.config.collectionName}`,
    );
    if (existing) {
      this.ensuredCollection = true;
      return true;
    }
    const created = await this.request(
      'PUT',
      `/collections/${this.config.collectionName}`,
      { vectors: { size: dimensions, distance: 'Cosine' } },
    );
    if (created) {
      this.ensuredCollection = true;
      return true;
    }
    return false;
  }

  private async request<T = unknown>(
    method: 'GET' | 'PUT' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T | null> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.requestTimeoutMs,
    );
    try {
      const response = await fetch(`${this.config.url}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status !== 404) {
          this.logger.warn(`Qdrant ${method} ${path} returned HTTP ${response.status}`);
        }
        return null;
      }
      return (await response.json()) as T;
    } catch (error) {
      const isAbort = (error as Error).name === 'AbortError';
      this.logger.warn(
        `Qdrant ${method} ${path} failed: ${isAbort ? 'timeout' : (error as Error).message}`,
      );
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
