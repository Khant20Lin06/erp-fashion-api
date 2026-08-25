import { Repository, SelectQueryBuilder } from 'typeorm';
import { AiKnowledgeService } from './ai-knowledge.service';
import { AiKnowledgeDocument } from '../entities/ai-knowledge-document.entity';
import { AiKnowledgeScope } from '../entities/ai-knowledge-scope.enum';
import { AiKnowledgeStatus } from '../entities/ai-knowledge-status.enum';
import { ErrorCode } from '../../../core/errors/error-codes';
import { QueueService } from '../../queue/queue.service';
import { QueueNames } from '../../queue/queue-names';

describe('AiKnowledgeService', () => {
  let service: AiKnowledgeService;
  let documentRepository: jest.Mocked<
    Pick<
      Repository<AiKnowledgeDocument>,
      'findOne' | 'create' | 'save' | 'softRemove' | 'createQueryBuilder'
    >
  >;
  let queryBuilder: jest.Mocked<
    Pick<
      SelectQueryBuilder<AiKnowledgeDocument>,
      'where' | 'andWhere' | 'orderBy' | 'skip' | 'take' | 'getManyAndCount'
    >
  >;
  let queueService: jest.Mocked<Pick<QueueService, 'enqueue'>>;

  const buildDocument = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'doc-1',
      companyId: 'company-a',
      scope: AiKnowledgeScope.Company,
      title: 'Return Policy',
      content: 'Our return policy is...',
      contentHash: 'hash123',
      status: AiKnowledgeStatus.Pending,
      chunkCount: 0,
      embeddingModel: null,
      errorMessage: null,
      createdBy: 'user-1',
      ...overrides,
    }) as AiKnowledgeDocument;

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    documentRepository = {
      findOne: jest.fn(),
      create: jest.fn((data: unknown) => data as AiKnowledgeDocument) as never,
      save: jest.fn((data: unknown) =>
        Promise.resolve(data as AiKnowledgeDocument),
      ) as never,
      softRemove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    queueService = {
      enqueue: jest.fn().mockResolvedValue(undefined),
    };

    service = new AiKnowledgeService(
      documentRepository as unknown as Repository<AiKnowledgeDocument>,
      queueService as unknown as QueueService,
    );
  });

  describe('create', () => {
    it('computes a stable content hash and enqueues an ingestion job', async () => {
      const document = await service.create('company-a', 'user-1', {
        scope: AiKnowledgeScope.Company,
        title: 'Return Policy',
        content: 'Our return policy is 30 days.',
      });

      expect(document.contentHash).toHaveLength(64); // sha256 hex
      expect(queueService.enqueue).toHaveBeenCalledWith(
        QueueNames.AI_KNOWLEDGE_INGESTION,
        expect.any(String),
        { documentId: document.id },
        { jobId: `ai-ingest-${document.id}` },
      );
    });

    it('SYSTEM-scope documents are stored with companyId null, never tied to the creating company', async () => {
      const document = await service.create('company-a', 'user-1', {
        scope: AiKnowledgeScope.System,
        title: 'Generic ERP Guide',
        content: 'How to use this ERP...',
      });
      expect(document.companyId).toBeNull();
    });

    it('COMPANY-scope documents are stored with the real companyId', async () => {
      const document = await service.create('company-a', 'user-1', {
        scope: AiKnowledgeScope.Company,
        title: 'Company Policy',
        content: 'Internal policy text',
      });
      expect(document.companyId).toBe('company-a');
    });

    it('starts every new document as PENDING — never a fabricated READY state', async () => {
      const document = await service.create('company-a', 'user-1', {
        scope: AiKnowledgeScope.Company,
        title: 'Doc',
        content: 'content',
      });
      expect(document.status).toBe(AiKnowledgeStatus.Pending);
      expect(document.chunkCount).toBe(0);
    });
  });

  describe('findByIdInCompany — cross-company isolation', () => {
    it('throws NotFound for a COMPANY-scope document belonging to a different company', async () => {
      documentRepository.findOne.mockResolvedValue(
        buildDocument({ companyId: 'company-b' }),
      );
      await expect(
        service.findByIdInCompany('doc-1', 'company-a'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });

    it('allows access to a SYSTEM-scope document regardless of requesting company', async () => {
      documentRepository.findOne.mockResolvedValue(
        buildDocument({ scope: AiKnowledgeScope.System, companyId: null }),
      );
      const document = await service.findByIdInCompany('doc-1', 'company-a');
      expect(document.id).toBe('doc-1');
    });

    it('throws NotFound when the document does not exist at all', async () => {
      documentRepository.findOne.mockResolvedValue(null);
      await expect(
        service.findByIdInCompany('missing', 'company-a'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });

  describe('reingest', () => {
    it('resets status to PENDING and re-enqueues — never marks READY without real re-processing', async () => {
      documentRepository.findOne.mockResolvedValue(
        buildDocument({
          status: AiKnowledgeStatus.Failed,
          errorMessage: 'boom',
        }),
      );
      const document = await service.reingest('doc-1', 'company-a');
      expect(document.status).toBe(AiKnowledgeStatus.Pending);
      expect(document.errorMessage).toBeNull();
      expect(queueService.enqueue).toHaveBeenCalled();
    });

    it('enqueues with a jobId different from create()\'s stable one, since BullMQ silently drops add() for a jobId that already completed — reusing it here would make reingest a permanent no-op after the first successful ingestion', async () => {
      documentRepository.findOne.mockResolvedValue(buildDocument());
      await service.reingest('doc-1', 'company-a');
      const [, , , options] = queueService.enqueue.mock.calls[0];
      expect(options?.jobId).not.toBe('ai-ingest-doc-1');
      expect(options?.jobId).toMatch(/^ai-ingest-doc-1-\d+$/);
    });

    it('rejects reingest for a document in a different company', async () => {
      documentRepository.findOne.mockResolvedValue(
        buildDocument({ companyId: 'company-b' }),
      );
      await expect(
        service.reingest('doc-1', 'company-a'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });

  describe('delete', () => {
    it('soft-removes the document', async () => {
      documentRepository.findOne.mockResolvedValue(buildDocument());
      await service.delete('doc-1', 'company-a');
      expect(documentRepository.softRemove).toHaveBeenCalled();
    });
  });
});
