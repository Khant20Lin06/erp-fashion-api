import { registerAs } from '@nestjs/config';

export interface QdrantConfig {
  /** Unset means vector search is disabled entirely — AiRagService then
   * returns no results rather than throwing (RAG degrades to "the
   * assistant answers from tools/general knowledge only", same as before
   * this integration existed, never a hard failure). */
  url: string | undefined;
  collectionName: string;
  requestTimeoutMs: number;
}

export default registerAs('qdrant', (): QdrantConfig => ({
  url: process.env.QDRANT_URL,
  collectionName: process.env.QDRANT_COLLECTION ?? 'ai_knowledge_chunks',
  requestTimeoutMs: parseInt(process.env.QDRANT_REQUEST_TIMEOUT_MS ?? '10000', 10),
}));
