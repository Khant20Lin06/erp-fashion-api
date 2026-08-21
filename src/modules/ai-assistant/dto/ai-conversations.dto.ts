import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { AiConversation } from '../entities/ai-conversation.entity';
import { AiMessage } from '../entities/ai-message.entity';
import { AiMessageRole } from '../entities/ai-message-role.enum';

export class ListAiConversationsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;
}

export interface AiConversationResponseDto {
  id: string;
  companyId: string;
  branchId: string | null;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiMessageResponseDto {
  id: string;
  role: AiMessageRole;
  content: string;
  toolCalls: unknown;
  toolResults: unknown;
  model: string | null;
  createdAt: Date;
}

export function toAiConversationResponseDto(
  conversation: AiConversation,
): AiConversationResponseDto {
  return {
    id: conversation.id,
    companyId: conversation.companyId,
    branchId: conversation.branchId,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

export function toAiMessageResponseDto(
  message: AiMessage,
): AiMessageResponseDto {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    toolCalls: message.toolCalls,
    toolResults: message.toolResults,
    model: message.model,
    createdAt: message.createdAt,
  };
}
