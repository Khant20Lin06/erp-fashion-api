import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { AiKnowledgeDocument } from '../entities/ai-knowledge-document.entity';
import { AiKnowledgeScope } from '../entities/ai-knowledge-scope.enum';
import { AiKnowledgeStatus } from '../entities/ai-knowledge-status.enum';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import {
  CreateAiKnowledgeDocumentDto,
  ListAiKnowledgeDocumentsDto,
} from '../dto/ai-knowledge.dto';
import { QueueService } from '../../queue/queue.service';
import { QueueNames } from '../../queue/queue-names';
import {
  AI_INGEST_KNOWLEDGE_JOB,
  AiIngestKnowledgeJobData,
} from '../workers/knowledge-ingestion-job.interface';

/**
 * Knowledge document CRUD + ingestion trigger (Phase 19 §14/§15). Content
 * ingestion (POST /ai/knowledge) persists metadata synchronously then
 * enqueues a BullMQ job — the HTTP request never blocks on
 * chunking/embedding (§15's own "must not block HTTP requests
 * unnecessarily" rule).
 */
@Injectable()
export class AiKnowledgeService {
  constructor(
    @InjectRepository(AiKnowledgeDocument)
    private readonly documentRepository: Repository<AiKnowledgeDocument>,
    private readonly queueService: QueueService,
  ) {}

  async findAll(
    companyId: string,
    query: ListAiKnowledgeDocumentsDto,
  ): Promise<{
    data: AiKnowledgeDocument[];
    meta: { page: number; limit: number; total: number };
  }> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const qb = this.documentRepository
      .createQueryBuilder('document')
      .where(
        '(document.companyId = :companyId OR document.scope = :systemScope)',
        {
          companyId,
          systemScope: AiKnowledgeScope.System,
        },
      );

    if (query.status) {
      qb.andWhere('document.status = :status', { status: query.status });
    }

    qb.orderBy('document.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<AiKnowledgeDocument> {
    const document = await this.documentRepository.findOne({
      where: { id },
    });
    if (
      !document ||
      (document.scope === AiKnowledgeScope.Company &&
        document.companyId !== companyId)
    ) {
      throw new AppException(
        ErrorCode.NotFound,
        'Knowledge document not found',
      );
    }
    return document;
  }

  async create(
    companyId: string,
    userId: string,
    dto: CreateAiKnowledgeDocumentDto,
  ): Promise<AiKnowledgeDocument> {
    if (dto.scope === AiKnowledgeScope.Company && !companyId) {
      throw new AppException(
        ErrorCode.ValidationError,
        'companyId is required for COMPANY-scope knowledge documents',
      );
    }

    const contentHash = createHash('sha256').update(dto.content).digest('hex');
    const documentCompanyId =
      dto.scope === AiKnowledgeScope.System ? null : companyId;

    const entity = this.documentRepository.create({
      companyId: documentCompanyId,
      scope: dto.scope,
      title: dto.title,
      content: dto.content,
      contentHash,
      status: AiKnowledgeStatus.Pending,
      chunkCount: 0,
      embeddingModel: null,
      errorMessage: null,
      createdBy: userId,
    });
    const saved = await this.documentRepository.save(entity);

    await this.enqueueIngestion(saved.id);
    return saved;
  }

  async reingest(id: string, companyId: string): Promise<AiKnowledgeDocument> {
    const document = await this.findByIdInCompany(id, companyId);
    document.status = AiKnowledgeStatus.Pending;
    document.errorMessage = null;
    const saved = await this.documentRepository.save(document);
    // A fresh, unique jobId per attempt — BullMQ silently drops add() for a
    // jobId that already exists in ANY state, including "completed", so
    // reusing create()'s stable `ai-ingest-{documentId}` id here (as this
    // used to) meant every re-ingest after the very first successful
    // ingestion was a no-op: the document flipped to PENDING and then sat
    // there forever, since no job was actually enqueued to process it.
    await this.enqueueIngestion(saved.id, `${saved.id}-${Date.now()}`);
    return saved;
  }

  async delete(id: string, companyId: string): Promise<void> {
    const document = await this.findByIdInCompany(id, companyId);
    await this.documentRepository.softRemove(document);
  }

  /** `dedupeKey` defaults to the documentId itself — stable, so a
   * double-submit of the same brand-new document (create()'s only caller)
   * still collapses to one job. reingest() passes a unique key instead
   * since, unlike creation, re-running ingestion for the same document is
   * an intentionally repeatable action. */
  private async enqueueIngestion(
    documentId: string,
    dedupeKey: string = documentId,
  ): Promise<void> {
    await this.queueService.enqueue<AiIngestKnowledgeJobData>(
      QueueNames.AI_KNOWLEDGE_INGESTION,
      AI_INGEST_KNOWLEDGE_JOB,
      { documentId },
      { jobId: `ai-ingest-${dedupeKey}` },
    );
  }
}
