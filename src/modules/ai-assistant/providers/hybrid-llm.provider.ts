import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiConfig } from '../../../config/ai.config';
import { OpenAiCompatibleProvider } from './openai-compatible.provider';
import { OllamaCompatibleProvider } from './ollama-compatible.provider';
import { LocalFallbackProvider } from './local-fallback.provider';
import {
  LlmChatOptions,
  LlmChatResult,
  LlmEmbeddingResult,
  LlmModelInfo,
  LlmProvider,
} from './llm-provider.interface';

/**
 * Per-request hybrid provider (Phase 19.1). This IS the object bound to
 * LLM_PROVIDER — every consumer (AiChatService/AiRagService/
 * KnowledgeIngestionWorker) still depends only on the LlmProvider
 * interface, unaware a fallback chain exists behind it.
 *
 * Unlike the old ProviderFactoryService (which picked one provider once at
 * module-construction time and stuck with it for the app's lifetime), this
 * tries each configured tier IN ORDER ON EVERY CALL:
 *
 *   1. Remote LLM (OpenAiCompatibleProvider) — real credentials configured
 *   2. Local LLM (OllamaCompatibleProvider) — optional, no API key
 *   3. Local deterministic fallback (LocalFallbackProvider) — always
 *      available, never throws, never requires external configuration
 *
 * "Unavailable" is judged per-call by catching whatever AppException the
 * tier's own assertConfigured()/request() throws (misconfigured,
 * unreachable, timeout, non-2xx, invalid response) and moving to the next
 * tier — never by a separate health-check/polling loop, per Phase 19.1 §4
 * ("keep health checks lightweight, do not introduce excessive background
 * polling"). Rate-limit (429) responses are treated as this tier being
 * unavailable for THIS call too, rather than surfaced as a hard failure,
 * since a working fallback answer beats a rate-limit error.
 *
 * chat()/embed() on this class can only fail if AI_FALLBACK_ENABLED=false
 * AND every configured real tier failed — in the default configuration
 * (fallback enabled) this provider never throws.
 */
@Injectable()
export class HybridLlmProvider implements LlmProvider {
  private readonly logger = new Logger(HybridLlmProvider.name);
  private readonly config: AiConfig;

  constructor(
    configService: ConfigService,
    private readonly remoteProvider: OpenAiCompatibleProvider,
    private readonly localLlmProvider: OllamaCompatibleProvider,
    private readonly fallbackProvider: LocalFallbackProvider,
  ) {
    this.config = configService.get<AiConfig>('ai')!;
  }

  supportsToolCalling(): boolean {
    return true;
  }

  supportsStreaming(): boolean {
    return false;
  }

  async chat(options: LlmChatOptions): Promise<LlmChatResult> {
    const { result, tierPrefix } = await this.tryInPriorityOrder(
      (provider) => provider.chat(options),
      'chat',
    );
    // Tag the model string with which tier actually answered, e.g.
    // "remote:gpt-4o-mini" / "local_llm:llama3" / the fallback's own
    // class name is already distinguishable as-is. AiChatService derives
    // AiChatResponseDto.mode from this exact prefix rather than needing
    // its own copy of the provider-priority/config logic.
    return tierPrefix
      ? { ...result, model: `${tierPrefix}:${result.model}` }
      : result;
  }

  async embed(texts: string[]): Promise<LlmEmbeddingResult> {
    const { result } = await this.tryInPriorityOrder(
      (provider) => provider.embed(texts),
      'embed',
    );
    return result;
  }

  /** The model picker only ever means "which remote model" — the local
   * LLM/fallback tiers have no catalog concept, so this talks to the
   * remote tier directly rather than going through tryInPriorityOrder.
   * Returns [] rather than throwing when the remote tier isn't
   * configured/reachable, same as OpenAiCompatibleProvider.listModels()
   * itself — an empty picker degrades to "no override offered", never a
   * chat-blocking error. */
  async listModels(): Promise<LlmModelInfo[]> {
    if (!this.isRemoteConfigured() || !this.remoteProvider.listModels) {
      return [];
    }
    try {
      return await this.remoteProvider.listModels();
    } catch (error) {
      this.logger.warn(`Model listing failed: ${(error as Error).message}`);
      return [];
    }
  }

  private async tryInPriorityOrder<T>(
    call: (provider: LlmProvider) => Promise<T>,
    operation: 'chat' | 'embed',
  ): Promise<{ result: T; tierPrefix: 'remote' | 'local_llm' | undefined }> {
    const remoteConfigured =
      operation === 'embed'
        ? this.isRemoteEmbeddingConfigured()
        : this.isRemoteConfigured();
    if (remoteConfigured) {
      try {
        return {
          result: await call(this.remoteProvider),
          tierPrefix: 'remote',
        };
      } catch (error) {
        this.logger.warn(
          `Remote LLM ${operation} failed, trying next tier: ${(error as Error).message}`,
        );
      }
    }

    if (this.isLocalLlmConfigured()) {
      try {
        return {
          result: await call(this.localLlmProvider),
          tierPrefix: 'local_llm',
        };
      } catch (error) {
        this.logger.warn(
          `Local LLM ${operation} failed, trying next tier: ${(error as Error).message}`,
        );
      }
    }

    // The fallback provider's chat()/embed() never throw (see
    // LocalFallbackProvider's own docblock) — this is the terminal tier
    // whenever AI_FALLBACK_ENABLED is true (the default), so chat/embed
    // requests succeed even with zero external AI configuration. No
    // prefix needed — LocalFallbackProvider's own model string
    // (its class name) is already unambiguous.
    if (this.config.fallbackEnabled) {
      return {
        result: await call(this.fallbackProvider),
        tierPrefix: undefined,
      };
    }

    // Fallback explicitly disabled and every real tier is either
    // unconfigured or just failed — re-run whichever real tier was
    // actually eligible (or remote by default if neither was configured)
    // so the caller sees a genuine, specific AppException instead of a
    // fabricated generic one.
    const lastResortProvider = this.isLocalLlmConfigured()
      ? this.localLlmProvider
      : this.remoteProvider;
    return { result: await call(lastResortProvider), tierPrefix: undefined };
  }

  private isRemoteConfigured(): boolean {
    return !!(
      this.config.baseUrl &&
      this.config.apiKey &&
      this.config.chatModel
    );
  }

  /** Deliberately independent of isRemoteConfigured() — a deployment can
   * have chat and embeddings pointed at entirely different providers
   * (e.g. OpenRouter for chat, since it has no /embeddings endpoint, plus
   * OpenAI direct for embeddings), so neither tier's availability should
   * gate the other's. */
  private isRemoteEmbeddingConfigured(): boolean {
    return !!(
      this.config.embeddingBaseUrl &&
      this.config.embeddingApiKey &&
      this.config.embeddingModel
    );
  }

  private isLocalLlmConfigured(): boolean {
    return !!(this.config.ollamaBaseUrl && this.config.ollamaChatModel);
  }
}
