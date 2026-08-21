import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';
import { AiChatRequestDto, AiChatResponseDto } from '../dto/ai-chat.dto';
import {
  toAiConversationResponseDto,
  toAiMessageResponseDto,
} from '../dto/ai-conversations.dto';
import { AiChatService } from '../services/ai-chat.service';

const RESOURCE = 'ai_assistant';

@ApiTags('AI Assistant')
@Controller('ai/chat')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AiChatController {
  constructor(
    private readonly aiChatService: AiChatService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Post()
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

    const { conversation, message, sources, mode } =
      await this.aiChatService.chat(user, companyId, dto);

    return {
      conversation: toAiConversationResponseDto(conversation),
      message: toAiMessageResponseDto(message),
      sources,
      mode,
    };
  }
}
