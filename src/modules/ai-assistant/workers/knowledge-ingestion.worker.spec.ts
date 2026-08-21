import { Job } from 'bullmq';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { KnowledgeIngestionWorker } from './knowledge-ingestion.worker';
import { AiIngestKnowledgeJobData } from './knowledge-ingestion-job.interface';
import { AiKnowledgeDocument } from '../entities/ai-knowledge-document.entity';
import { AiKnowledgeChunk } from '../entities/ai-knowledge-chunk.entity';
import { AiKnowledgeStatus } from '../entities/ai-knowledge-status.enum';
import type { LlmProvider } from '../providers/llm-provider.interface';

describe('KnowledgeIngestionWorker', () => {
  let worker: KnowledgeIngestionWorker;
  let documentRepository: jest.Mocked<
    Pick<Repository<AiKnowledgeDocument>, 'findOne' | 'update'>
  >;
  let chunkRepository: jest.Mocked<
    Pick<Repository<AiKnowledgeChunk>, 'delete' | 'create' | 'save'>
  >;
  let llmProvider: jest.Mocked<Pick<LlmProvider, 'embed'>>;

  // With chunkSize=1000/overlap=150 (see configService mock below), content
  // this short always produces exactly ONE chunk — keeps embeddings-count
  // assertions simple and independent of the chunking algorithm's exact math.
  const buildDocument = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'doc-1',
      companyId: 'company-a',
      content: 'x'.repeat(500),
      status: AiKnowledgeStatus.Pending,
      ...overrides,
    }) as AiKnowledgeDocument;

  const buildJob = (documentId: string): Job<AiIngestKnowledgeJobData> =>
    ({ data: { documentId } }) as Job<AiIngestKnowledgeJobData>;

  interface TestableWorker {
    process(job: Job<AiIngestKnowledgeJobData>): Promise<void>;
  }
  const asTestable = (target: KnowledgeIngestionWorker): TestableWorker =>
    target as unknown as TestableWorker;

  beforeEach(() => {
    documentRepository = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    chunkRepository = {
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
      create: jest.fn((data: unknown) => data as AiKnowledgeChunk) as never,
      save: jest.fn().mockResolvedValue(undefined),
    };
    llmProvider = {
      embed: jest.fn(),
    };

    const configService: Pick<ConfigService, 'get'> = {
      get: jest.fn((key: string) => {
        if (key === 'queue') return { aiIngestionWorkerConcurrency: 2 };
        if (key === 'ai') return { chunkSize: 1000, chunkOverlap: 150 };
        return undefined;
      }),
    };

    worker = new KnowledgeIngestionWorker(
      {} as Redis,
      configService as ConfigService,
      documentRepository as unknown as Repository<AiKnowledgeDocument>,
      chunkRepository as unknown as Repository<AiKnowledgeChunk>,
      llmProvider as unknown as LlmProvider,
    );
  });

  it('is a no-op when the document no longer exists', async () => {
    documentRepository.findOne.mockResolvedValue(null);
    await asTestable(worker).process(buildJob('missing'));
    expect(llmProvider.embed).not.toHaveBeenCalled();
  });

  it('marks the document PROCESSING before starting ingestion', async () => {
    documentRepository.findOne.mockResolvedValue(buildDocument());
    llmProvider.embed.mockResolvedValue({
      embeddings: [[0.1, 0.2]],
      model: 'test-model',
      usage: null,
    });
    await asTestable(worker).process(buildJob('doc-1'));
    expect(documentRepository.update).toHaveBeenCalledWith('doc-1', {
      status: AiKnowledgeStatus.Processing,
    });
  });

  it('marks the document FAILED (not a fabricated READY) when content produces zero chunks', async () => {
    documentRepository.findOne.mockResolvedValue(
      buildDocument({ content: '   ' }),
    );
    await asTestable(worker).process(buildJob('doc-1'));
    expect(documentRepository.update).toHaveBeenLastCalledWith(
      'doc-1',
      expect.objectContaining({ status: AiKnowledgeStatus.Failed }),
    );
    expect(llmProvider.embed).not.toHaveBeenCalled();
  });

  it('persists real chunks with real embeddings and marks READY on success', async () => {
    documentRepository.findOne.mockResolvedValue(buildDocument());
    llmProvider.embed.mockResolvedValue({
      embeddings: [[0.1, 0.2]],
      model: 'test-embedding-model',
      usage: null,
    });

    await asTestable(worker).process(buildJob('doc-1'));

    expect(chunkRepository.save).toHaveBeenCalled();
    expect(documentRepository.update).toHaveBeenLastCalledWith(
      'doc-1',
      expect.objectContaining({
        status: AiKnowledgeStatus.Ready,
        embeddingModel: 'test-embedding-model',
      }),
    );
  });

  it('deletes prior chunks before writing new ones (re-ingestion case)', async () => {
    documentRepository.findOne.mockResolvedValue(buildDocument());
    llmProvider.embed.mockResolvedValue({
      embeddings: [[0.1, 0.2]],
      model: 'test-model',
      usage: null,
    });
    await asTestable(worker).process(buildJob('doc-1'));
    expect(chunkRepository.delete).toHaveBeenCalledWith({
      documentId: 'doc-1',
    });
  });

  it('marks FAILED with the real error message and rethrows when the embedding provider fails', async () => {
    documentRepository.findOne.mockResolvedValue(buildDocument());
    llmProvider.embed.mockRejectedValue(new Error('provider unreachable'));

    await expect(asTestable(worker).process(buildJob('doc-1'))).rejects.toThrow(
      'provider unreachable',
    );
    expect(documentRepository.update).toHaveBeenLastCalledWith(
      'doc-1',
      expect.objectContaining({
        status: AiKnowledgeStatus.Failed,
        errorMessage: 'provider unreachable',
      }),
    );
  });

  it('marks FAILED when the embedding count does not match the chunk count (never silently mismatches data)', async () => {
    // This document is long enough (2000 chars, chunkSize=1000/overlap=150)
    // to produce multiple real chunks, but the provider is mocked to
    // return only one embedding — a genuine count mismatch.
    documentRepository.findOne.mockResolvedValue(
      buildDocument({ content: 'x'.repeat(2000) }),
    );
    llmProvider.embed.mockResolvedValue({
      embeddings: [[0.1, 0.2]],
      model: 'test-model',
      usage: null,
    });

    await expect(
      asTestable(worker).process(buildJob('doc-1')),
    ).rejects.toThrow();
    expect(documentRepository.update).toHaveBeenLastCalledWith(
      'doc-1',
      expect.objectContaining({ status: AiKnowledgeStatus.Failed }),
    );
  });
});
