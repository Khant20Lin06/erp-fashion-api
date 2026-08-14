import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PurchaseReportsService } from '../services/purchase-reports.service';
import type {
  PurchaseSummary,
  PurchaseByDateRow,
  PurchaseBySupplierRow,
} from '../services/purchase-reports.service';
import { PurchaseReportQueryDto } from '../dto/purchase-report-query.dto';
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
import { validateDateRange } from '../../../shared/utils/validate-date-range';

const RESOURCE = 'reports';

@ApiTags('Reports - Purchases')
@Controller('reports/purchases')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PurchaseReportsController {
  constructor(
    private readonly purchaseReportsService: PurchaseReportsService,
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

  @Get('summary')
  @RequirePermission('reports.purchases.read')
  async summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PurchaseReportQueryDto,
  ): Promise<PurchaseSummary> {
    validateDateRange(query.fromDate, query.toDate);
    const scope = await this.resolveScope(
      user,
      query.companyId,
      query.branchId,
    );
    return this.purchaseReportsService.summary(scope.companyId, {
      ...query,
      branchId: scope.branchId,
      allowedBranchIds: scope.allowedBranchIds,
    });
  }

  @Get('by-date')
  @RequirePermission('reports.purchases.read')
  async byDate(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PurchaseReportQueryDto,
  ): Promise<PurchaseByDateRow[]> {
    validateDateRange(query.fromDate, query.toDate);
    const scope = await this.resolveScope(
      user,
      query.companyId,
      query.branchId,
    );
    return this.purchaseReportsService.byDate(scope.companyId, {
      ...query,
      branchId: scope.branchId,
      allowedBranchIds: scope.allowedBranchIds,
    });
  }

  @Get('by-supplier')
  @RequirePermission('reports.purchases.read')
  async bySupplier(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PurchaseReportQueryDto,
  ): Promise<PurchaseBySupplierRow[]> {
    validateDateRange(query.fromDate, query.toDate);
    const scope = await this.resolveScope(
      user,
      query.companyId,
      query.branchId,
    );
    return this.purchaseReportsService.bySupplier(scope.companyId, {
      ...query,
      branchId: scope.branchId,
      allowedBranchIds: scope.allowedBranchIds,
    });
  }
}
