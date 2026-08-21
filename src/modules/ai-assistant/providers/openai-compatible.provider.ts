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
  LlmUsage,
} from './llm-provider.interface';

interface OpenAiChatCompletionResponse {
  model: string;
  choices: Array<{
    message: {
      content: string | null;
      tool_calls?: Array<{
        id: string;
        function: { name: string; arguments: string };
      }>;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAiEmbeddingResponse {
  model: string;
  data: Array<{ embedding: number[]; index: number }>;
  usage?: { prompt_tokens: number; total_tokens: number };
}

/**
 * A single implementation targeting any OpenAI-compatible chat-completions
 * + embeddings API (matches the Phase 19 spec's own "should support
 * OpenAI-compatible APIs where possible" instruction). Uses Node's native
 * fetch with an explicit AbortController timeout — the same pattern
 * `postSignedWebhook` (Phase 23) already established in this codebase, no
 * new HTTP client dependency introduced.
 *
 * Every failure mode (timeout, network error, 429, 5xx, malformed
 * response) is normalized into an AppException using this codebase's
 * existing error convention — callers (AiChatService/AiKnowledgeService)
 * decide how to degrade, but this provider itself never returns a
 * fabricated result.
 */
@Injectable()
export class OpenAiCompatibleProvider implements LlmProvider {
  private readonly logger = new Logger(OpenAiCompatibleProvider.name);
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
      model: this.config.chatModel,
      messages: options.messages.map((message) =>
        this.toOpenAiMessage(message),
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

    const response = await this.request<OpenAiChatCompletionResponse>(
      '/chat/completions',
      body,
    );

    const choice = response.choices?.[0];
    if (!choice) {
      throw new AppException(
        ErrorCode.InternalError,
        'AI provider returned no completion choices',
      );
    }

    const toolCalls: LlmToolCall[] | null = choice.message.tool_calls?.length
      ? choice.message.tool_calls.map((call) => ({
          id: call.id,
          name: call.function.name,
          arguments: call.function.arguments,
        }))
      : null;

    return {
      content: choice.message.content,
      toolCalls,
      model: response.model,
      usage: this.toUsage(response.usage),
    };
  }

  async embed(texts: string[]): Promise<LlmEmbeddingResult> {
    this.assertConfigured();
    if (!this.config.embeddingModel) {
      throw new AppException(
        ErrorCode.InternalError,
        'AI_EMBEDDING_MODEL is not configured',
      );
    }

    const response = await this.request<OpenAiEmbeddingResponse>(
      '/embeddings',
      { model: this.config.embeddingModel, input: texts },
    );

    const embeddings = [...response.data]
      .sort((a, b) => a.index - b.index)
      .map((row) => row.embedding);

    return {
      embeddings,
      model: response.model,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: 0,
            totalTokens: response.usage.total_tokens,
          }
        : null,
    };
  }

  private assertConfigured(): void {
    if (!this.config.baseUrl || !this.config.apiKey || !this.config.chatModel) {
      throw new AppException(
        ErrorCode.InternalError,
        'AI provider is not configured (AI_BASE_URL/AI_API_KEY/AI_CHAT_MODEL)',
      );
    }
  }

  private toOpenAiMessage(message: LlmChatMessage): Record<string, unknown> {
    const base: Record<string, unknown> = {
      role: message.role,
      content: message.content,
    };
    if (message.toolCallId) {
      base.tool_call_id = message.toolCallId;
    }
    if (message.name) {
      base.name = message.name;
    }
    if (message.toolCalls?.length) {
      base.tool_calls = message.toolCalls.map((call) => ({
        id: call.id,
        type: 'function',
        function: { name: call.name, arguments: call.arguments },
      }));
    }
    return base;
  }

  private toUsage(
    usage: OpenAiChatCompletionResponse['usage'],
  ): LlmUsage | null {
    if (!usage) {
      return null;
    }
    return {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
    };
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.requestTimeoutMs,
    );

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      const isAbort = (error as Error).name === 'AbortError';
      this.logger.warn(
        `AI provider request to ${path} failed: ${isAbort ? 'timeout' : (error as Error).message}`,
      );
      throw new AppException(
        ErrorCode.InternalError,
        isAbort
          ? 'AI provider request timed out'
          : 'AI provider is unreachable',
      );
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 429) {
      throw new AppException(
        ErrorCode.RateLimited,
        'AI provider rate limit exceeded',
      );
    }
    if (!response.ok) {
      this.logger.warn(
        `AI provider request to ${path} returned HTTP ${response.status}`,
      );
      throw new AppException(
        ErrorCode.InternalError,
        `AI provider returned HTTP ${response.status}`,
      );
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new AppException(
        ErrorCode.InternalError,
        'AI provider returned an invalid response',
      );
    }
  }
}
