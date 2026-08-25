/**
 * The one boundary the LLM crosses. Every provider implementation must sit
 * entirely behind this interface — no business service ever imports a
 * provider SDK/HTTP client directly (Phase 19 §5). Tool-calling and
 * embeddings are separate capabilities a provider may or may not support;
 * callers must check supportsToolCalling()/supportsStreaming() rather than
 * assuming.
 */

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export interface LlmToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LlmChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: LlmToolCall[];
  name?: string;
}

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LlmChatResult {
  content: string | null;
  toolCalls: LlmToolCall[] | null;
  model: string;
  /** Null when the provider response did not include usage data — never estimated (Phase 19 §31). */
  usage: LlmUsage | null;
}

export interface LlmChatOptions {
  messages: LlmChatMessage[];
  tools?: LlmToolDefinition[];
  /** Overrides the tier's configured default chat model for this call
   * only, when the caller requested one and it passed the tier's own
   * allow-list check. A provider that has no notion of model selection
   * (e.g. LocalFallbackProvider) simply ignores this. */
  model?: string;
}

export interface LlmEmbeddingResult {
  embeddings: number[][];
  model: string;
  usage: LlmUsage | null;
}

export interface LlmModelInfo {
  id: string;
  name: string;
  /** Null when the provider's catalog doesn't expose pricing (never
   * estimated/guessed — same convention as LlmUsage, Phase 19 §31). */
  promptPricePerMillionTokens: number | null;
  completionPricePerMillionTokens: number | null;
}

export interface LlmProvider {
  chat(options: LlmChatOptions): Promise<LlmChatResult>;
  embed(texts: string[]): Promise<LlmEmbeddingResult>;
  supportsToolCalling(): boolean;
  supportsStreaming(): boolean;
  /** Optional — only a provider whose backend exposes a real model
   * catalog (e.g. OpenRouter's public /models) implements this. Absent
   * on providers with a single fixed model (Ollama tier, deterministic
   * fallback), so callers must check for the method before calling it. */
  listModels?(): Promise<LlmModelInfo[]>;
}
