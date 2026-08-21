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
}

export interface LlmEmbeddingResult {
  embeddings: number[][];
  model: string;
  usage: LlmUsage | null;
}

export interface LlmProvider {
  chat(options: LlmChatOptions): Promise<LlmChatResult>;
  embed(texts: string[]): Promise<LlmEmbeddingResult>;
  supportsToolCalling(): boolean;
  supportsStreaming(): boolean;
}
