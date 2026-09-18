import { Body, Controller, Get, Optional, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { PerUserRateLimitGuard } from '../../../common/security/per-user-rate-limit.guard';
import { RateLimit } from '../../../common/security/rate-limit.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';
import { AiChatRequestDto } from '../dto/ai-chat.dto';
import type {
  AiChatResponseDto,
  AiModelsResponseDto,
} from '../dto/ai-chat.dto';
import {
  toAiConversationResponseDto,
  toAiMessageResponseDto,
} from '../dto/ai-conversations.dto';
import { AiChatService } from '../services/ai-chat.service';
import { AiDomainAgentRegistryService } from '../services/ai-domain-agent-registry.service';
import type { DomainAgentDescriptor } from '../agents/domain-agent.interface';

const RESOURCE = 'ai_assistant';

/**
 * Mirrors AI_CHAT_RATE_LIMIT_PER_MINUTE's default (config/ai.config.ts) —
 * this endpoint calls a paid/metered LLM provider per request, so it needs
 * its own tighter per-user limit on top of the global IP-based floor
 * (docs/SECURITY_RULES.md #28: "Search... Reports... Public APIs" that are
 * resource-intensive must be rate-limited). Read from the same env var at
 * decoration time since decorator metadata is static (evaluated once at
 * class-definition time, before Nest's DI/ConfigService exist) — the
 * numeric env var itself remains the single source of truth either way.
 */
const AI_CHAT_RATE_LIMIT_MAX = parseInt(
  process.env.AI_CHAT_RATE_LIMIT_PER_MINUTE ?? '10',
  10,
);

@ApiTags('AI Assistant')
@Controller('ai/chat')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AiChatController {
  constructor(
    private readonly aiChatService: AiChatService,
    private readonly dataScopeService: DataScopeService,
    @Optional()
    private readonly domainAgentRegistryService?: AiDomainAgentRegistryService,
  ) {}

  @Get('models')
  @RequirePermission('ai_assistant.chat')
  async listModels(): Promise<AiModelsResponseDto> {
    return this.aiChatService.listAvailableModels();
  }

  @Get('agents')
  @RequirePermission('ai_assistant.chat')
  async listAgents(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DomainAgentDescriptor[]> {
    return (
      (await this.domainAgentRegistryService?.listAvailableAgentsForUser(
        user,
      )) ?? []
    );
  }

  @Post()
  @UseGuards(PerUserRateLimitGuard)
  @RateLimit({ max: AI_CHAT_RATE_LIMIT_MAX, windowSeconds: 60 })
  @RequirePermission('ai_assistant.chat')
  async chat(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AiChatRequestDto,
  ): Promise<AiChatResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );

    const { conversation, message, sources, mode, agent, supervisorTrace } =
      await this.aiChatService.chat(user, companyId, dto);

    return {
      conversation: toAiConversationResponseDto(conversation),
      message: toAiMessageResponseDto(message),
      sources,
      mode,
      agent,
      supervisorTrace,
    };
  }
}
