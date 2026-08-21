import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InventoryLedgerService } from '../services/inventory-ledger.service';
import { ListInventoryLedgerDto } from '../dto/list-inventory-ledger.dto';
import { StockCardQueryDto } from '../dto/stock-card-query.dto';
import { ReconciliationQueryDto } from '../dto/reconciliation-query.dto';
import {
  InventoryLedgerResponseDto,
} from '../dto/inventory-ledger-response.dto';
import {
  StockCardEntryResponseDto,
  toStockCardEntryResponseDto,
} from '../dto/stock-card-entry-response.dto';
import { ReconciliationResponseDto } from '../dto/reconciliation-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';

const RESOURCE = 'inventory_ledger';

/**
 * Phase 15 — Inventory Ledger. Read-only query layer over the Phase 14
 * StockMovement append-only log and WarehouseStock balance table. No
 * POST/PATCH/DELETE anywhere in this controller — see
 * docs/INVENTORY_ARCHITECTURE.md §17 for the full read-only guarantee and
 * boundary statement. Every route reuses JwtAuthGuard + PermissionGuard +
 * @RequirePermission() + resolveRequestCompanyId(), exactly matching every
 * controller since Phase 09.
 *
 * Route ordering note: /stock-card and /reconciliation are registered
 * before /:id so Nest's route matcher does not swallow them as a UUID path
 * param (mirrors the same static-before-dynamic ordering already required
 * by NestJS routing in general).
 */
@ApiTags('Inventory Ledger')
@Controller('inventory-ledger')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class InventoryLedgerController {
  constructor(
    private readonly inventoryLedgerService: InventoryLedgerService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('inventory_ledger.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListInventoryLedgerDto,
  ): Promise<{ data: InventoryLedgerResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    return this.inventoryLedgerService.findAllView(companyId, query);
  }

  @Get('stock-card')
  @RequirePermission('inventory_ledger.read')
  async getStockCard(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: StockCardQueryDto,
  ): Promise<{ data: StockCardEntryResponseDto[] }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const movements = await this.inventoryLedgerService.getStockCard(
      companyId,
      query.warehouseId,
      query.productVariantId,
    );
    return { data: movements.map(toStockCardEntryResponseDto) };
  }

  @Get('reconciliation')
  @RequirePermission('inventory_ledger.read')
  async getReconciliation(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReconciliationQueryDto,
  ): Promise<ReconciliationResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    return this.inventoryLedgerService.getReconciliation(
      companyId,
      query.warehouseId,
      query.productVariantId,
    );
  }

  @Get(':id')
  @RequirePermission('inventory_ledger.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<InventoryLedgerResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    return this.inventoryLedgerService.findByIdViewInCompany(
      id,
      companyId,
    );
  }
}
