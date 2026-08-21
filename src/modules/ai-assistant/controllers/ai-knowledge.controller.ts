import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
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
  AiKnowledgeDocumentResponseDto,
  CreateAiKnowledgeDocumentDto,
  ListAiKnowledgeDocumentsDto,
  toAiKnowledgeDocumentResponseDto,
} from '../dto/ai-knowledge.dto';
import { AiKnowledgeService } from '../services/ai-knowledge.service';

const RESOURCE = 'ai_knowledge';

@ApiTags('AI Assistant - Knowledge')
@Controller('ai/knowledge')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AiKnowledgeController {
  constructor(
    private readonly knowledgeService: AiKnowledgeService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('ai_knowledge.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAiKnowledgeDocumentsDto,
  ): Promise<{ data: AiKnowledgeDocumentResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.knowledgeService.findAll(companyId, query);
    return {
      data: result.data.map(toAiKnowledgeDocumentResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('ai_knowledge.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<AiKnowledgeDocumentResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const document = await this.knowledgeService.findByIdInCompany(
      id,
      companyId,
    );
    return toAiKnowledgeDocumentResponseDto(document);
  }

  @Post()
  @RequirePermission('ai_knowledge.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAiKnowledgeDocumentDto,
  ): Promise<AiKnowledgeDocumentResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    const document = await this.knowledgeService.create(
      companyId,
      user.id,
      dto,
    );
    return toAiKnowledgeDocumentResponseDto(document);
  }

  @Post(':id/reingest')
  @RequirePermission('ai_knowledge.ingest')
  async reingest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<AiKnowledgeDocumentResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const document = await this.knowledgeService.reingest(id, companyId);
    return toAiKnowledgeDocumentResponseDto(document);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('ai_knowledge.delete')
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
    await this.knowledgeService.delete(id, companyId);
  }
}
