import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import { AiConfig } from '../../../config/ai.config';
import {
  LlmChatMessage,
  LlmChatOptions,
  LlmChatResult,
  LlmEmbeddingResult,
  LlmProvider,
  LlmToolCall,
} from './llm-provider.interface';

interface OllamaChatResponse {
  model: string;
  message: {
    content: string;
    tool_calls?: Array<{
      function: { name: string; arguments: Record<string, unknown> };
    }>;
  };
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaEmbeddingsResponse {
  embedding: number[];
}

/**
 * Optional local-LLM tier (Phase 19.1) targeting an Ollama-compatible HTTP
 * server (POST /api/chat, POST /api/embeddings — Ollama's own native wire
 * format, not the OpenAI-compatible shim some builds also expose, since the
 * native endpoints need no API key and are the most common local setup).
 *
 * This is entirely optional infrastructure: if OLLAMA_BASE_URL is unset,
 * every call throws immediately (assertConfigured) exactly like
 * OpenAiCompatibleProvider does when unconfigured — HybridLlmProvider
 * treats that the same as "this tier is unavailable" and moves on. The ERP
 * must start and run normally whether or not an Ollama server exists;
 * nothing here is invoked at module-construction time, only lazily on the
 * first chat/embed call that actually reaches this tier.
 *
 * Ollama does not require an API key, and tool-call argument shape differs
 * from OpenAI's (already-parsed object, not a JSON string) — normalized
 * back to this app's LlmToolCall.arguments (a string) for a uniform
 * contract across providers.
 */
@Injectable()
export class OllamaCompatibleProvider implements LlmProvider {
  private readonly logger = new Logger(OllamaCompatibleProvider.name);
  private readonly config: AiConfig;

  constructor(configService: ConfigService) {
    this.config = configService.get<AiConfig>('ai')!;
  }

  supportsToolCalling(): boolean {
    return true;
  }

  supportsStreaming(): boolean {
    return false;
  }

  async chat(options: LlmChatOptions): Promise<LlmChatResult> {
    this.assertConfigured();

    const body: Record<string, unknown> = {
      model: this.config.ollamaChatModel,
      stream: false,
      messages: options.messages.map((message) =>
        this.toOllamaMessage(message),
      ),
    };
    if (options.tools?.length) {
      body.tools = options.tools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
    }

    const response = await this.request<OllamaChatResponse>('/api/chat', body);

    const toolCalls: LlmToolCall[] | null = response.message.tool_calls?.length
      ? response.message.tool_calls.map((call, index) => ({
          id: `ollama-call-${index}`,
          name: call.function.name,
          arguments: JSON.stringify(call.function.arguments ?? {}),
        }))
      : null;

    return {
      content: response.message.content || null,
      toolCalls,
      model: response.model,
      usage:
        response.prompt_eval_count !== undefined &&
        response.eval_count !== undefined
          ? {
              promptTokens: response.prompt_eval_count,
              completionTokens: response.eval_count,
              totalTokens: response.prompt_eval_count + response.eval_count,
            }
          : null,
    };
  }

  async embed(texts: string[]): Promise<LlmEmbeddingResult> {
    this.assertConfigured();
    if (!this.config.ollamaEmbeddingModel) {
      throw new AppException(
        ErrorCode.InternalError,
        'OLLAMA_EMBEDDING_MODEL is not configured',
      );
    }

    // Ollama's native /api/embeddings takes one prompt per call — no batch
    // endpoint in the native API, unlike OpenAI's /embeddings.
    const embeddings = await Promise.all(
      texts.map((text) =>
        this.request<OllamaEmbeddingsResponse>('/api/embeddings', {
          model: this.config.ollamaEmbeddingModel,
          prompt: text,
        }).then((response) => response.embedding),
      ),
    );

    return {
      embeddings,
      model: this.config.ollamaEmbeddingModel,
      usage: null,
    };
  }

  private assertConfigured(): void {
    if (!this.config.ollamaBaseUrl || !this.config.ollamaChatModel) {
      throw new AppException(
        ErrorCode.InternalError,
        'Local LLM provider is not configured (OLLAMA_BASE_URL/OLLAMA_CHAT_MODEL)',
      );
    }
  }

  private toOllamaMessage(message: LlmChatMessage): Record<string, unknown> {
    const base: Record<string, unknown> = {
      role: message.role,
      content: message.content,
    };
    if (message.toolCalls?.length) {
      base.tool_calls = message.toolCalls.map((call) => ({
        function: {
          name: call.name,
          arguments: this.safeParseArguments(call.arguments),
        },
      }));
    }
    return base;
  }

  private safeParseArguments(raw: string): Record<string, unknown> {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.requestTimeoutMs,
    );

    let response: Response;
    try {
      response = await fetch(`${this.config.ollamaBaseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      const isAbort = (error as Error).name === 'AbortError';
      this.logger.warn(
        `Local LLM request to ${path} failed: ${isAbort ? 'timeout' : (error as Error).message}`,
      );
      throw new AppException(
        ErrorCode.InternalError,
        isAbort
          ? 'Local LLM provider request timed out'
          : 'Local LLM provider is unreachable',
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      this.logger.warn(
        `Local LLM request to ${path} returned HTTP ${response.status}`,
      );
      throw new AppException(
        ErrorCode.InternalError,
        `Local LLM provider returned HTTP ${response.status}`,
      );
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new AppException(
        ErrorCode.InternalError,
        'Local LLM provider returned an invalid response',
      );
    }
  }
}
