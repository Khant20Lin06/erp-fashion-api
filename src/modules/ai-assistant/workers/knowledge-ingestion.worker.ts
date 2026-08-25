import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { BaseQueueWorker } from '../../queue/base-queue-worker';
import { QueueNames } from '../../queue/queue-names';
import { BULLMQ_CONNECTION } from '../../queue/bullmq-connection.provider';
import { QueueConfig } from '../../../config/queue.config';
import { AiConfig } from '../../../config/ai.config';
import { AiKnowledgeDocument } from '../entities/ai-knowledge-document.entity';
import { AiKnowledgeChunk } from '../entities/ai-knowledge-chunk.entity';
import { AiKnowledgeStatus } from '../entities/ai-knowledge-status.enum';
import { AiIngestKnowledgeJobData } from './knowledge-ingestion-job.interface';
import { chunkText } from '../services/chunking.util';
import { LLM_PROVIDER } from '../providers/llm-provider.interface';
import type { LlmProvider } from '../providers/llm-provider.interface';
import { MetricsRegistryService } from '../../../observability/metrics/metrics-registry.service';
import { QdrantVectorStoreService } from '../services/qdrant-vector-store.service';

/**
 * Ingestion pipeline (Phase 19 §15/§17/§18): chunk deterministically, embed
 * via the configured provider, persist chunks+embeddings, mark READY. On
 * any real failure (provider unreachable, invalid response) marks the
 * document FAILED with the real error message — never a fabricated
 * READY/success state (§41).
 *
 * HARD BOUNDARY (same as every other worker in this codebase): only reads/
 * writes AiKnowledgeDocument/AiKnowledgeChunk — never touches Sales/
 * Payment/Inventory/JournalEntry tables.
 */
@Injectable()
export class KnowledgeIngestionWorker extends BaseQueueWorker<AiIngestKnowledgeJobData> {
  private readonly aiConfig: AiConfig;

  constructor(
    @Inject(BULLMQ_CONNECTION) connection: Redis,
    configService: ConfigService,
    @InjectRepository(AiKnowledgeDocument)
    private readonly documentRepository: Repository<AiKnowledgeDocument>,
    @InjectRepository(AiKnowledgeChunk)
    private readonly chunkRepository: Repository<AiKnowledgeChunk>,
    @Inject(LLM_PROVIDER) private readonly llmProvider: LlmProvider,
    private readonly vectorStore: QdrantVectorStoreService,
    @Optional() metrics?: MetricsRegistryService,
  ) {
    super(
      QueueNames.AI_KNOWLEDGE_INGESTION,
      connection,
      configService.get<QueueConfig>('queue')!.aiIngestionWorkerConcurrency,
      metrics,
    );
    this.aiConfig = configService.get<AiConfig>('ai')!;
  }

  protected async process(job: Job<AiIngestKnowledgeJobData>): Promise<void> {
    const document = await this.documentRepository.findOne({
      where: { id: job.data.documentId },
    });
    if (!document) {
      this.logger.warn(
        `AiKnowledgeDocument ${job.data.documentId} not found — skipping`,
      );
      return;
    }

    await this.documentRepository.update(document.id, {
      status: AiKnowledgeStatus.Processing,
    });

    try {
      const chunks = chunkText(
        document.content,
        this.aiConfig.chunkSize,
        this.aiConfig.chunkOverlap,
      );

      if (chunks.length === 0) {
        await this.documentRepository.update(document.id, {
          status: AiKnowledgeStatus.Failed,
          errorMessage: 'Document content produced zero chunks',
          chunkCount: 0,
        });
        return;
      }

      // Remove any prior chunks (re-ingestion case) before writing fresh ones.
      await this.chunkRepository.delete({ documentId: document.id });

      const embeddingResult = await this.llmProvider.embed(chunks);
      if (embeddingResult.embeddings.length !== chunks.length) {
        throw new Error(
          `Embedding provider returned ${embeddingResult.embeddings.length} vectors for ${chunks.length} chunks`,
        );
      }

      const chunkEntities = chunks.map((content, index) =>
        this.chunkRepository.create({
          documentId: document.id,
          companyId: document.companyId,
          chunkIndex: index,
          content,
          embedding: embeddingResult.embeddings[index],
        }),
      );
      const savedChunks = await this.chunkRepository.save(chunkEntities);

      // Best-effort — Qdrant being down never fails ingestion, since MySQL
      // (the chunk content itself) already succeeded; RAG simply retrieves
      // nothing extra until Qdrant is reachable again and this document is
      // re-ingested. embeddingModel is recorded regardless, so a later
      // re-ingest is always possible.
      await this.vectorStore.upsertDocumentChunks(
        document.id,
        savedChunks.map((chunk) => ({
          chunkId: chunk.id,
          documentId: chunk.documentId,
          companyId: chunk.companyId,
          embedding: chunk.embedding,
        })),
      );

      await this.documentRepository.update(document.id, {
        status: AiKnowledgeStatus.Ready,
        errorMessage: null,
        chunkCount: chunkEntities.length,
        embeddingModel: embeddingResult.model,
      });
    } catch (error) {
      await this.documentRepository.update(document.id, {
        status: AiKnowledgeStatus.Failed,
        errorMessage: (error as Error).message.slice(0, 1000),
      });
      throw error;
    }
  }
}
