import { Repository, SelectQueryBuilder } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AiRagService } from './ai-rag.service';
import { AiKnowledgeChunk } from '../entities/ai-knowledge-chunk.entity';
import type { LlmProvider } from '../providers/llm-provider.interface';
import type { QdrantVectorStoreService } from './qdrant-vector-store.service';

type MockQueryBuilder = jest.Mocked<
  Pick<
    SelectQueryBuilder<AiKnowledgeChunk>,
    'innerJoin' | 'where' | 'andWhere' | 'select' | 'addSelect' | 'limit' | 'getRawMany'
  >
>;

function buildQueryBuilder(getRawManyResult: unknown[] = []): MockQueryBuilder {
  return {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(getRawManyResult),
  };
}

describe('AiRagService', () => {
  let service: AiRagService;
  let chunkRepository: jest.Mocked<
    Pick<Repository<AiKnowledgeChunk>, 'createQueryBuilder'>
  >;
  // retrieve() issues up to two independent createQueryBuilder() calls per
  // call — one for the keyword (fulltext) search, one for the final
  // content fetch of the fused/ranked ids. Each test wires up whichever of
  // these two queues it needs via keywordQueryBuilder/contentQueryBuilder;
  // createQueryBuilder is a queue so call order doesn't need to be assumed.
  let queryBuilderQueue: MockQueryBuilder[];
  let llmProvider: jest.Mocked<Pick<LlmProvider, 'embed'>>;
  let vectorStore: jest.Mocked<Pick<QdrantVectorStoreService, 'isConfigured' | 'search'>>;
  let configService: Pick<ConfigService, 'get'>;

  const buildRow = (overrides: Record<string, unknown> = {}) => ({
    chunk_id: 'chunk-1',
    chunk_document_id: 'doc-1',
    chunk_chunk_index: 0,
    chunk_content: 'some knowledge content',
    documentTitle: 'Policy Doc',
    ...overrides,
  });

  function queueQueryBuilders(...builders: MockQueryBuilder[]) {
    queryBuilderQueue = [...builders];
  }

  beforeEach(() => {
    queryBuilderQueue = [];
    chunkRepository = {
      createQueryBuilder: jest.fn(() => {
        const next = queryBuilderQueue.shift();
        if (!next) {
          throw new Error('createQueryBuilder called more times than the test queued for');
        }
        return next;
      }) as never,
    };
    llmProvider = {
      embed: jest.fn().mockResolvedValue({
        embeddings: [[1, 0, 0]],
        model: 'test-embedding-model',
        usage: null,
      }),
    };
    vectorStore = {
      isConfigured: jest.fn().mockReturnValue(true),
      search: jest.fn().mockResolvedValue([]),
    };
    configService = {
      get: jest.fn().mockReturnValue({ ragTopK: 5 }),
    };

    service = new AiRagService(
      chunkRepository as unknown as Repository<AiKnowledgeChunk>,
      llmProvider as unknown as LlmProvider,
      vectorStore as unknown as QdrantVectorStoreService,
      configService as ConfigService,
    );
  });

  it('runs dense (Qdrant) search when the vector store is configured', async () => {
    queueQueryBuilders(buildQueryBuilder([])); // keyword search finds nothing
    vectorStore.search.mockResolvedValue([]);
    await service.retrieve('company-a', 'What is our return policy?');
    expect(llmProvider.embed).toHaveBeenCalledWith(['What is our return policy?']);
    expect(vectorStore.search).toHaveBeenCalledWith('company-a', [1, 0, 0], 5);
  });

  it('skips dense search entirely when the vector store is unconfigured, but still runs keyword search', async () => {
    vectorStore.isConfigured.mockReturnValue(false);
    queueQueryBuilders(buildQueryBuilder([])); // keyword search
    const result = await service.retrieve('company-a', 'question');
    expect(llmProvider.embed).not.toHaveBeenCalled();
    expect(vectorStore.search).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('returns an empty array without a content-fetch query when both tiers find nothing', async () => {
    queueQueryBuilders(buildQueryBuilder([])); // keyword search only
    vectorStore.search.mockResolvedValue([]);
    const result = await service.retrieve('company-a', 'question');
    expect(result).toEqual([]);
    expect(chunkRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
  });

  it('re-checks READY status and tenant scope in MySQL for the fused chunk ids', async () => {
    const contentQb = buildQueryBuilder([buildRow()]);
    queueQueryBuilders(buildQueryBuilder([]), contentQb); // keyword search, then content fetch
    vectorStore.search.mockResolvedValue([{ chunkId: 'chunk-1', documentId: 'doc-1', score: 0.9 }]);

    await service.retrieve('company-a', 'question');

    expect(contentQb.where).toHaveBeenCalledWith('chunk.id IN (:...ids)', { ids: ['chunk-1'] });
    expect(contentQb.andWhere).toHaveBeenCalledWith('document.status = :status', {
      status: 'READY',
    });
    expect(contentQb.andWhere).toHaveBeenCalledWith(
      '(chunk.companyId = :companyId OR chunk.companyId IS NULL)',
      { companyId: 'company-a' },
    );
  });

  it('ranks a chunk found by both tiers above one found by only one tier (Reciprocal Rank Fusion)', async () => {
    // "both" is dense-rank-1 AND keyword-rank-2; "dense-only" is
    // dense-rank-2 with no keyword match at all. RRF sums 1/(60+rank)
    // across tiers, so "both" must outrank "dense-only" even though
    // "dense-only" alone ranked higher in the dense tier specifically.
    const keywordQb = buildQueryBuilder([{ chunk_id: 'both' }]);
    const contentQb = buildQueryBuilder([
      buildRow({ chunk_id: 'both' }),
      buildRow({ chunk_id: 'dense-only' }),
    ]);
    queueQueryBuilders(keywordQb, contentQb);
    vectorStore.search.mockResolvedValue([
      { chunkId: 'both', documentId: 'doc-1', score: 0.7 },
      { chunkId: 'dense-only', documentId: 'doc-1', score: 0.9 },
    ]);

    await service.retrieve('company-a', 'question');
    // The fused id order (highest RRF score first) is what drives the
    // final content-fetch id list — assert on the ids passed to that
    // query, since buildRow() gives both rows identical text so the
    // returned result array alone can't distinguish which chunk is which.
    expect(contentQb.where).toHaveBeenCalledWith('chunk.id IN (:...ids)', {
      ids: ['both', 'dense-only'],
    });
  });

  it('keyword search alone (dense tier unconfigured) still surfaces exact-token matches', async () => {
    vectorStore.isConfigured.mockReturnValue(false);
    const keywordQb = buildQueryBuilder([{ chunk_id: 'sku-match' }]);
    const contentQb = buildQueryBuilder([buildRow({ chunk_id: 'sku-match' })]);
    queueQueryBuilders(keywordQb, contentQb);

    const result = await service.retrieve('company-a', 'PROD-BULK-050-GRE-S');
    expect(keywordQb.andWhere).toHaveBeenCalledWith(
      'MATCH(chunk.content) AGAINST(:question IN NATURAL LANGUAGE MODE)',
      { question: 'PROD-BULK-050-GRE-S' },
    );
    expect(result).toHaveLength(1);
  });

  it('degrades to dense-only results (never throws) when the keyword query itself fails', async () => {
    const contentQb = buildQueryBuilder([buildRow({ chunk_id: 'dense-hit' })]);
    // First createQueryBuilder() call is the keyword search, which throws;
    // the second is the content fetch, which must still succeed normally.
    let callCount = 0;
    chunkRepository.createQueryBuilder = jest.fn(() => {
      callCount += 1;
      if (callCount === 1) {
        const qb = buildQueryBuilder([]);
        qb.getRawMany.mockRejectedValue(new Error('fulltext query rejected'));
        return qb;
      }
      return contentQb;
    }) as never;
    vectorStore.search.mockResolvedValue([{ chunkId: 'dense-hit', documentId: 'doc-1', score: 0.8 }]);

    const result = await service.retrieve('company-a', 'question');
    expect(result).toHaveLength(1);
    expect(result[0].documentId).toBe('doc-1');
  });

  it('drops a fused match whose chunk no longer passes the MySQL READY/tenant re-check, never fabricating content for it', async () => {
    queueQueryBuilders(buildQueryBuilder([]), buildQueryBuilder([])); // keyword: none, content fetch: filtered out
    vectorStore.search.mockResolvedValue([{ chunkId: 'stale', documentId: 'doc-1', score: 0.9 }]);
    const result = await service.retrieve('company-a', 'question');
    expect(result).toEqual([]);
  });

  it('never fabricates a citation — every returned source maps to a real retrieved row', async () => {
    const contentQb = buildQueryBuilder([
      buildRow({ chunk_document_id: 'real-doc-1', chunk_chunk_index: 3 }),
    ]);
    queueQueryBuilders(buildQueryBuilder([]), contentQb);
    vectorStore.search.mockResolvedValue([
      { chunkId: 'chunk-1', documentId: 'real-doc-1', score: 0.8 },
    ]);
    const result = await service.retrieve('company-a', 'question');
    expect(result[0].documentId).toBe('real-doc-1');
    expect(result[0].chunkIndex).toBe(3);
  });
});
