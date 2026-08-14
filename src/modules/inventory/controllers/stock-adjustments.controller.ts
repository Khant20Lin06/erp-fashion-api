import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { StockAdjustmentsService } from '../services/stock-adjustments.service';
import { CreateStockAdjustmentDto } from '../dto/create-stock-adjustment.dto';
import { ListStockAdjustmentsDto } from '../dto/list-stock-adjustments.dto';
import {
  StockAdjustmentResponseDto,
  toStockAdjustmentResponseDto,
} from '../dto/stock-adjustment-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';

const RESOURCE = 'stock_adjustments';

/**
 * StockAdjustment API (Phase 14 locked decision D10/D11/D23). No PATCH, no
 * DELETE, no approval workflow — creation immediately mutates stock,
 * permission-gated by RBAC only.
 */
@ApiTags('Stock Adjustments')
@Controller('stock-adjustments')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class StockAdjustmentsController {
  constructor(
    private readonly stockAdjustmentsService: StockAdjustmentsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('stock_adjustments.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListStockAdjustmentsDto,
  ): Promise<{ data: StockAdjustmentResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.stockAdjustmentsService.findAll(companyId, query);
    return {
      data: result.data.map(toStockAdjustmentResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('stock_adjustments.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<StockAdjustmentResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.stockAdjustmentsService.findByIdInCompany(
      id,
      companyId,
    );
    return toStockAdjustmentResponseDto(entity);
  }

  @Post()
  @RequirePermission('stock_adjustments.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateStockAdjustmentDto,
  ): Promise<StockAdjustmentResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    const entity = await this.stockAdjustmentsService.create(
      companyId,
      user.id,
      dto,
    );
    return toStockAdjustmentResponseDto(entity);
  }
}
