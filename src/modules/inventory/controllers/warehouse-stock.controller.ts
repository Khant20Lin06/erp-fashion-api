import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WarehouseStockService } from '../services/warehouse-stock.service';
import { ListWarehouseStockDto } from '../dto/list-warehouse-stock.dto';
import {
  WarehouseStockResponseDto,
  toWarehouseStockResponseDto,
} from '../dto/warehouse-stock-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';

const RESOURCE = 'warehouse_stock';

/**
 * Read-only Warehouse Stock API (Phase 14 locked API surface). No POST/
 * PATCH/DELETE — every WarehouseStock row is mutated internally only, by
 * GoodsReceipt/Sale-confirm/StockTransfer/StockAdjustment.
 */
@ApiTags('Warehouse Stock')
@Controller('warehouse-stock')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class WarehouseStockController {
  constructor(
    private readonly warehouseStockService: WarehouseStockService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('warehouse_stock.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListWarehouseStockDto,
  ): Promise<{ data: WarehouseStockResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.warehouseStockService.findAll(companyId, query);
    return {
      data: result.data.map(toWarehouseStockResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('warehouse_stock.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<WarehouseStockResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.warehouseStockService.findByIdInCompany(
      id,
      companyId,
    );
    return toWarehouseStockResponseDto(entity);
  }
}
