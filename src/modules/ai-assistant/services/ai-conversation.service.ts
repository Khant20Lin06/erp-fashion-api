import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiConversation } from '../entities/ai-conversation.entity';
import { AiMessage } from '../entities/ai-message.entity';
import { AiMessageRole } from '../entities/ai-message-role.enum';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { ListAiConversationsDto } from '../dto/ai-conversations.dto';
import { AiConfig } from '../../../config/ai.config';

/**
 * Conversation persistence + strict ownership (Phase 19 §7/§8): every
 * conversation belongs to exactly one company AND one user — never shared.
 * Cross-company/cross-user access returns 404 (never-leak-existence),
 * matching the exact convention every other resource-scoped controller in
 * this codebase uses (see WebhookSubscriptionsService.findByIdInCompany).
 */
@Injectable()
export class AiConversationService {
  private readonly aiConfig: AiConfig;

  constructor(
    @InjectRepository(AiConversation)
    private readonly conversationRepository: Repository<AiConversation>,
    @InjectRepository(AiMessage)
    private readonly messageRepository: Repository<AiMessage>,
    configService: ConfigService,
  ) {
    this.aiConfig = configService.get<AiConfig>('ai')!;
  }

  async findAll(
    companyId: string,
    userId: string,
    query: ListAiConversationsDto,
  ): Promise<{
    data: AiConversation[];
    meta: { page: number; limit: number; total: number };
  }> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const [data, total] = await this.conversationRepository.findAndCount({
      where: { companyId, userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, meta: { page, limit, total } };
  }

  async findOwnedByIdOrThrow(
    id: string,
    companyId: string,
    userId: string,
  ): Promise<AiConversation> {
    const conversation = await this.conversationRepository.findOne({
      where: { id, companyId, userId },
    });
    if (!conversation) {
      throw new AppException(ErrorCode.NotFound, 'Conversation not found');
    }
    return conversation;
  }

  async getOrCreate(
    conversationId: string | undefined,
    companyId: string,
    branchId: string | undefined,
    userId: string,
  ): Promise<AiConversation> {
    if (conversationId) {
      return this.findOwnedByIdOrThrow(conversationId, companyId, userId);
    }

    const entity = this.conversationRepository.create({
      companyId,
      branchId: branchId ?? null,
      userId,
      title: null,
    });
    return this.conversationRepository.save(entity);
  }

  /** Bounded recent history only (Phase 19 §42/§43) — never unlimited context growth. No fabricated summarization of older messages; just a hard cutoff. */
  async getRecentMessages(conversationId: string): Promise<AiMessage[]> {
    const messages = await this.messageRepository.find({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      take: this.aiConfig.maxHistoryMessages,
    });
    return messages.reverse();
  }

  async appendMessage(
    conversationId: string,
    role: AiMessageRole,
    content: string,
    options?: {
      toolCalls?: unknown;
      toolResults?: unknown;
      model?: string;
      promptTokens?: number;
      completionTokens?: number;
    },
  ): Promise<AiMessage> {
    const entity = this.messageRepository.create({
      conversationId,
      role,
      content,
      toolCalls: options?.toolCalls ?? null,
      toolResults: options?.toolResults ?? null,
      model: options?.model ?? null,
      promptTokens: options?.promptTokens ?? null,
      completionTokens: options?.completionTokens ?? null,
    });
    return this.messageRepository.save(entity);
  }

  /**
   * Best-effort cleanup for the case AiChatService.chat() persists the
   * user's message (appendMessage) and then the LLM call itself fails
   * entirely (Phase 19.1 — previously this left a permanent orphaned
   * USER-role message with no ASSISTANT reply and no title). Deliberately
   * a hard delete, not soft — an orphaned message from a failed request
   * was never a real conversation turn worth retaining history for.
   * Failure here is logged by the caller but never allowed to mask the
   * original chat error.
   */
  async deleteMessage(messageId: string): Promise<void> {
    await this.messageRepository.delete({ id: messageId });
  }

  async setTitleIfUnset(conversationId: string, title: string): Promise<void> {
    await this.conversationRepository
      .createQueryBuilder()
      .update(AiConversation)
      .set({ title })
      .where('id = :id', { id: conversationId })
      .andWhere('title IS NULL')
      .execute();
  }

  async delete(id: string, companyId: string, userId: string): Promise<void> {
    const conversation = await this.findOwnedByIdOrThrow(id, companyId, userId);
    await this.conversationRepository.softRemove(conversation);
  }
}
