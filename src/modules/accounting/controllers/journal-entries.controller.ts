import {
  Body,
  Controller,
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
import { JournalEntriesService } from '../services/journal-entries.service';
import { CreateJournalEntryDto } from '../dto/create-journal-entry.dto';
import { ListJournalEntriesDto } from '../dto/list-journal-entries.dto';
import {
  JournalEntryResponseDto,
  toJournalEntryResponseDto,
} from '../dto/journal-entry-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';

const RESOURCE = 'journal_entries';

/**
 * Manual journal entry API (D12/D22, LOCKED): GET (list+detail)/POST
 * (creates DRAFT)/POST :id/post (DRAFT->POSTED) only. No PATCH/DELETE on
 * POSTED journals (D3) — no PATCH/DELETE endpoint exists for this resource
 * at all.
 */
@ApiTags('Accounting - Journal Entries')
@Controller('journal-entries')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class JournalEntriesController {
  constructor(
    private readonly journalEntriesService: JournalEntriesService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('journal_entries.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListJournalEntriesDto,
  ): Promise<{ data: JournalEntryResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.journalEntriesService.findAll(companyId, query);
    return {
      data: result.data.map(toJournalEntryResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('journal_entries.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<JournalEntryResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entry = await this.journalEntriesService.findByIdInCompany(
      id,
      companyId,
    );
    return toJournalEntryResponseDto(entry);
  }

  @Post()
  @RequirePermission('journal_entries.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateJournalEntryDto,
  ): Promise<JournalEntryResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    const entry = await this.journalEntriesService.create(
      companyId,
      user.id,
      dto,
    );
    return toJournalEntryResponseDto(entry);
  }

  @Post(':id/post')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('journal_entries.post')
  async postEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<JournalEntryResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entry = await this.journalEntriesService.post(id, companyId, user.id);
    return toJournalEntryResponseDto(entry);
  }
}
