import { registerAs } from '@nestjs/config';

export interface AiConfig {
  enabled: boolean;
  provider: string;
  baseUrl: string | undefined;
  apiKey: string | undefined;
  chatModel: string | undefined;
  embeddingModel: string | undefined;
  /** Separate base URL/key for embeddings, since a chat provider often
   * doesn't serve embeddings at all (OpenRouter has no /embeddings
   * endpoint) — defaults to baseUrl/apiKey for a provider that does serve
   * both (e.g. talking to OpenAI directly for everything), but must be
   * set independently to mix providers (OpenRouter for chat, OpenAI
   * direct for embeddings). */
  embeddingBaseUrl: string | undefined;
  embeddingApiKey: string | undefined;
  /** Optional local LLM tier (Ollama-compatible). Unset by default —
   * the ERP must run identically whether or not this is configured. */
  ollamaBaseUrl: string | undefined;
  ollamaChatModel: string | undefined;
  ollamaEmbeddingModel: string | undefined;
  /** Whether HybridLlmProvider may fall through to the API-key-free
   * deterministic LocalFallbackProvider when remote/local LLM tiers are
   * unavailable. Defaults to true — "the assistant should remain usable
   * even when no external API key is configured" is a hard requirement
   * (Phase 19.1), not an opt-in. */
  fallbackEnabled: boolean;
  requestTimeoutMs: number;
  maxHistoryMessages: number;
  ragTopK: number;
  chunkSize: number;
  chunkOverlap: number;
  chatRateLimitPerMinute: number;
  ingestionWorkerConcurrency: number;
}

/**
 * AI Assistant provider configuration (Phase 19, extended Phase 19.1 for
 * hybrid remote/local/fallback provider selection — see
 * HybridLlmProvider). AI_ENABLED gates every AI route/worker at startup —
 * with no provider configured, the ERP itself must keep functioning
 * unaffected. Never hardcode a provider URL, API key, or model name in
 * application code — always read through ConfigService, matching the
 * Kafka/Redis config docblocks' own instruction.
 */
export default registerAs('ai', (): AiConfig => ({
  enabled: process.env.AI_ENABLED === 'true',
  provider: process.env.AI_PROVIDER ?? 'openai-compatible',
  baseUrl: process.env.AI_BASE_URL,
  apiKey: process.env.AI_API_KEY,
  chatModel: process.env.AI_CHAT_MODEL,
  embeddingModel: process.env.AI_EMBEDDING_MODEL,
  embeddingBaseUrl: process.env.AI_EMBEDDING_BASE_URL ?? process.env.AI_BASE_URL,
  embeddingApiKey: process.env.AI_EMBEDDING_API_KEY ?? process.env.AI_API_KEY,
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
  ollamaChatModel: process.env.OLLAMA_CHAT_MODEL,
  ollamaEmbeddingModel: process.env.OLLAMA_EMBEDDING_MODEL,
  fallbackEnabled: process.env.AI_FALLBACK_ENABLED !== 'false',
  requestTimeoutMs: parseInt(process.env.AI_REQUEST_TIMEOUT_MS ?? '30000', 10),
  maxHistoryMessages: parseInt(process.env.AI_MAX_HISTORY_MESSAGES ?? '20', 10),
  ragTopK: parseInt(process.env.AI_RAG_TOP_K ?? '5', 10),
  chunkSize: parseInt(process.env.AI_CHUNK_SIZE ?? '1000', 10),
  chunkOverlap: parseInt(process.env.AI_CHUNK_OVERLAP ?? '150', 10),
  chatRateLimitPerMinute: parseInt(
    process.env.AI_CHAT_RATE_LIMIT_PER_MINUTE ?? '10',
    10,
  ),
  ingestionWorkerConcurrency: parseInt(
    process.env.AI_INGESTION_WORKER_CONCURRENCY ?? '2',
    10,
  ),
}));
