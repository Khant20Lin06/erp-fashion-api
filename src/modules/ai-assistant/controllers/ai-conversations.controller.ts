import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';
import {
  AiConversationResponseDto,
  AiMessageResponseDto,
  ListAiConversationsDto,
  toAiConversationResponseDto,
  toAiMessageResponseDto,
} from '../dto/ai-conversations.dto';
import { AiConversationService } from '../services/ai-conversation.service';

const RESOURCE = 'ai_assistant';

@ApiTags('AI Assistant - Conversations')
@Controller('ai/conversations')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AiConversationsController {
  constructor(
    private readonly conversationService: AiConversationService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('ai_assistant.conversations.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAiConversationsDto,
  ): Promise<{ data: AiConversationResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.conversationService.findAll(
      companyId,
      user.id,
      query,
    );
    return {
      data: result.data.map(toAiConversationResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('ai_assistant.conversations.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<AiConversationResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const conversation = await this.conversationService.findOwnedByIdOrThrow(
      id,
      companyId,
      user.id,
    );
    return toAiConversationResponseDto(conversation);
  }

  @Get(':id/messages')
  @RequirePermission('ai_assistant.conversations.read')
  async findMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<{ data: AiMessageResponseDto[] }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    await this.conversationService.findOwnedByIdOrThrow(id, companyId, user.id);
    const messages = await this.conversationService.getRecentMessages(id);
    return { data: messages.map(toAiMessageResponseDto) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('ai_assistant.conversations.delete')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<void> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    await this.conversationService.delete(id, companyId, user.id);
  }
}
