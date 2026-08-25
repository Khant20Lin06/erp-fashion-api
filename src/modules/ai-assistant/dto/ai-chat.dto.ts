import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  AiConversationResponseDto,
  AiMessageResponseDto,
} from './ai-conversations.dto';

export class AiChatRequestDto {
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  /** Must appear in the remote tier's live listModels() catalog (GET
   * /ai/chat/models) or is silently ignored (falls back to AI_CHAT_MODEL)
   * — see AiChatService.resolveRequestedModel. Never forwarded to the
   * provider unchecked (Phase 19.1 follow-up). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string;
}

export interface AiChatSourceDto {
  documentId: string;
  title: string;
  chunkIndex: number;
}

/**
 * Which HybridLlmProvider tier actually produced this reply (Phase
 * 19.1) — derived from AiMessage.model, never a separately-tracked or
 * guessable value: 'local_fallback' whenever model===LocalFallbackProvider
 * (the deterministic tier's own class name, always used verbatim), else
 * 'local_llm' when the request had an Ollama tier configured, else
 * 'remote_llm'. Purely informational for the frontend UI — never affects
 * authorization or data access, and never exposes provider URLs/keys.
 */
export type AiChatMode = 'remote_llm' | 'local_llm' | 'local_fallback';

export interface AiChatResponseDto {
  conversation: AiConversationResponseDto;
  message: AiMessageResponseDto;
  sources: AiChatSourceDto[];
  mode: AiChatMode;
}

export interface AiModelInfoDto {
  id: string;
  name: string;
  /** Null when the provider's catalog doesn't expose pricing — never
   * estimated. Free models genuinely have 0 here, not null. */
  promptPricePerMillionTokens: number | null;
  completionPricePerMillionTokens: number | null;
}

/** GET /ai/chat/models — the real, live remote-tier model catalog (e.g.
 * OpenRouter's full ~400-model list with real pricing), so the frontend
 * never hardcodes a list that could drift from what the deployment's
 * provider actually offers. defaultModel is what's used when the request
 * omits `model` entirely (AI_CHAT_MODEL); it's included in `models` too
 * (with real pricing looked up) whenever the catalog fetch succeeds.
 * Both are empty/null when the remote tier isn't configured, or when the
 * live catalog fetch failed — the frontend should hide the picker rather
 * than show one with nothing selectable. */
export interface AiModelsResponseDto {
  models: AiModelInfoDto[];
  defaultModel: string | null;
}
