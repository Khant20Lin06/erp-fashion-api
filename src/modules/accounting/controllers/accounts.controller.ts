import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AccountsService } from '../services/accounts.service';
import { CreateAccountDto } from '../dto/create-account.dto';
import { UpdateAccountDto } from '../dto/update-account.dto';
import { ListAccountsDto } from '../dto/list-accounts.dto';
import {
  AccountResponseDto,
  toAccountResponseDto,
} from '../dto/account-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';

const RESOURCE = 'accounts';

/**
 * Chart of Accounts API (D22, LOCKED): GET (list+detail)/POST/PATCH only —
 * no DELETE endpoint exists (D4: "prefer deactivation" — PATCH with
 * isActive:false is the only lifecycle transition).
 */
@ApiTags('Accounting - Accounts')
@Controller('accounts')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AccountsController {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('accounts.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAccountsDto,
  ): Promise<{ data: AccountResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.accountsService.findAll(companyId, query);
    return {
      data: result.data.map(toAccountResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('accounts.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<AccountResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const account = await this.accountsService.findByIdInCompany(id, companyId);
    return toAccountResponseDto(account);
  }

  @Post()
  @RequirePermission('accounts.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAccountDto,
  ): Promise<AccountResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    const account = await this.accountsService.create(companyId, dto);
    return toAccountResponseDto(account);
  }

  @Patch(':id')
  @RequirePermission('accounts.update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<AccountResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const account = await this.accountsService.update(id, companyId, dto);
    return toAccountResponseDto(account);
  }
}
