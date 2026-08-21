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
