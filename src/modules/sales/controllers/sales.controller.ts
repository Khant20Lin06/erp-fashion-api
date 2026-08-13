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
import { SalesService } from '../services/sales.service';
import { CreateSaleDto } from '../dto/create-sale.dto';
import { ListSalesDto } from '../dto/list-sales.dto';
import { SaleResponseDto, toSaleResponseDto } from '../dto/sale-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';

const RESOURCE = 'sales';

/**
 * Sales API (Phase 12, locked decisions). No generic PATCH endpoint that
 * can mutate status or any financial/historical field — status changes
 * only via the dedicated confirm/cancel operations, and there is no
 * update endpoint at all (nothing in this phase requires editing a DRAFT
 * sale beyond recreating it). Reuses resolveRequestCompanyId() /
 * DataScopeService exactly as every controller since Phase 09.
 */
@ApiTags('Sales')
@Controller('sales')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SalesController {
  constructor(
    private readonly salesService: SalesService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('sales.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListSalesDto,
  ): Promise<{ data: SaleResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.salesService.findAll(companyId, query);
    return { data: result.data.map(toSaleResponseDto), meta: result.meta };
  }

  @Get(':id')
  @RequirePermission('sales.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<SaleResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.salesService.findByIdInCompany(id, companyId);
    return toSaleResponseDto(entity);
  }

  @Post()
  @RequirePermission('sales.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSaleDto,
  ): Promise<SaleResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    const entity = await this.salesService.create(companyId, user.id, dto);
    return toSaleResponseDto(entity);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales.confirm')
  async confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<SaleResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.salesService.confirm(id, companyId, user.id);
    return toSaleResponseDto(entity);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales.cancel')
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<SaleResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.salesService.cancel(id, companyId, user.id);
    return toSaleResponseDto(entity);
  }
}
