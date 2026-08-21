import { Repository, SelectQueryBuilder } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AiRagService } from './ai-rag.service';
import { AiKnowledgeChunk } from '../entities/ai-knowledge-chunk.entity';
import type { LlmProvider } from '../providers/llm-provider.interface';

describe('AiRagService', () => {
  let service: AiRagService;
  let chunkRepository: jest.Mocked<
    Pick<Repository<AiKnowledgeChunk>, 'createQueryBuilder'>
  >;
  let queryBuilder: jest.Mocked<
    Pick<
      SelectQueryBuilder<AiKnowledgeChunk>,
      'innerJoin' | 'where' | 'andWhere' | 'select' | 'addSelect' | 'getRawMany'
    >
  >;
  let llmProvider: jest.Mocked<Pick<LlmProvider, 'embed'>>;
  let configService: Pick<ConfigService, 'get'>;

  const buildRow = (overrides: Record<string, unknown> = {}) => ({
    chunk_id: 'chunk-1',
    chunk_document_id: 'doc-1',
    chunk_chunk_index: 0,
    chunk_content: 'some knowledge content',
    chunk_embedding: JSON.stringify([1, 0, 0]),
    documentTitle: 'Policy Doc',
    ...overrides,
  });

  beforeEach(() => {
    queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    chunkRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    llmProvider = {
      embed: jest.fn().mockResolvedValue({
        embeddings: [[1, 0, 0]],
        model: 'test-embedding-model',
        usage: null,
      }),
    };
    configService = {
      get: jest.fn().mockReturnValue({ ragTopK: 5 }),
    };

    service = new AiRagService(
      chunkRepository as unknown as Repository<AiKnowledgeChunk>,
      llmProvider as unknown as LlmProvider,
      configService as ConfigService,
    );
  });

  it('filters candidates to the requesting company (or SYSTEM/null-company) at the query level', async () => {
    await service.retrieve('company-a', 'What is our return policy?');
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      '(chunk.companyId = :companyId OR chunk.companyId IS NULL)',
      { companyId: 'company-a' },
    );
  });

  it('only searches READY documents', async () => {
    await service.retrieve('company-a', 'question');
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'document.status = :status',
      {
        status: 'READY',
      },
    );
  });

  it('returns an empty array without calling the embedding provider when there are no candidates', async () => {
    queryBuilder.getRawMany.mockResolvedValue([]);
    const result = await service.retrieve('company-a', 'question');
    expect(result).toEqual([]);
    expect(llmProvider.embed).not.toHaveBeenCalled();
  });

  it('ranks candidates by cosine similarity to the question embedding, most relevant first', async () => {
    queryBuilder.getRawMany.mockResolvedValue([
      buildRow({ chunk_id: 'low', chunk_embedding: JSON.stringify([0, 1, 0]) }),
      buildRow({
        chunk_id: 'high',
        chunk_embedding: JSON.stringify([1, 0, 0]),
      }),
    ]);
    llmProvider.embed.mockResolvedValue({
      embeddings: [[1, 0, 0]],
      model: 'test-embedding-model',
      usage: null,
    });

    const result = await service.retrieve('company-a', 'question');
    expect(result[0].content).toBe('some knowledge content');
    // The perfectly-aligned vector [1,0,0] must rank above the orthogonal [0,1,0].
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  it('never returns more than the configured ragTopK chunks', async () => {
    configService.get = jest.fn().mockReturnValue({ ragTopK: 2 });
    service = new AiRagService(
      chunkRepository as unknown as Repository<AiKnowledgeChunk>,
      llmProvider as unknown as LlmProvider,
      configService as ConfigService,
    );
    queryBuilder.getRawMany.mockResolvedValue([
      buildRow({ chunk_id: 'a' }),
      buildRow({ chunk_id: 'b' }),
      buildRow({ chunk_id: 'c' }),
    ]);

    const result = await service.retrieve('company-a', 'question');
    expect(result).toHaveLength(2);
  });

  it('never fabricates a citation — every returned source maps to a real retrieved row', async () => {
    queryBuilder.getRawMany.mockResolvedValue([
      buildRow({ chunk_document_id: 'real-doc-1', chunk_chunk_index: 3 }),
    ]);
    const result = await service.retrieve('company-a', 'question');
    expect(result[0].documentId).toBe('real-doc-1');
    expect(result[0].chunkIndex).toBe(3);
  });
});
