import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InventoryReportsService } from '../services/inventory-reports.service';
import type {
  PaginatedMovements,
  SlowMovingStockRow,
  StockSummaryRow,
} from '../services/inventory-reports.service';
import {
  InventoryMovementQueryDto,
  InventoryStockSummaryQueryDto,
  SlowMovingStockQueryDto,
} from '../dto/inventory-report-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import {
  resolveRequestCompanyBranchScope,
  type ResolvedCompanyBranchScope,
} from '../../master-data/utils/resolve-request-company-branch-scope';

const RESOURCE = 'reports';

/**
 * Phase 22 — Inventory reports (stock summary/movement), quantity-only, no
 * valuation/COGS (out of scope per the locked analysis — no cost
 * aggregation data exists in this codebase). DataScope-enforced exactly
 * like every other report controller in this module.
 */
@ApiTags('Reports - Inventory')
@Controller('reports/inventory')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class InventoryReportsController {
  constructor(
    private readonly inventoryReportsService: InventoryReportsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  private async resolveScope(
    user: AuthenticatedUser,
    companyId: string | undefined,
    branchId: string | undefined,
  ): Promise<ResolvedCompanyBranchScope> {
    return resolveRequestCompanyBranchScope(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyId,
      branchId,
    );
  }

  @Get('stock-summary')
  @RequirePermission('reports.inventory.read')
  async stockSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: InventoryStockSummaryQueryDto,
  ): Promise<StockSummaryRow[]> {
    const scope = await this.resolveScope(
      user,
      query.companyId,
      query.branchId,
    );
    return this.inventoryReportsService.stockSummary(scope.companyId, {
      ...query,
      branchId: scope.branchId,
      allowedBranchIds: scope.allowedBranchIds,
    });
  }

  @Get('slow-moving')
  @RequirePermission('reports.inventory.read')
  async slowMoving(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SlowMovingStockQueryDto,
  ): Promise<SlowMovingStockRow[]> {
    const scope = await this.resolveScope(
      user,
      query.companyId,
      query.branchId,
    );
    return this.inventoryReportsService.slowMoving(scope.companyId, {
      ...query,
      branchId: scope.branchId,
      allowedBranchIds: scope.allowedBranchIds,
    });
  }

  @Get('movements')
  @RequirePermission('reports.inventory.read')
  async movements(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: InventoryMovementQueryDto,
  ): Promise<PaginatedMovements> {
    const scope = await this.resolveScope(
      user,
      query.companyId,
      query.branchId,
    );
    return this.inventoryReportsService.movements(
      scope.companyId,
      Object.assign(new InventoryMovementQueryDto(), query, {
        branchId: scope.branchId,
        allowedBranchIds: scope.allowedBranchIds,
      }),
    );
  }
}
