import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SalesReportsService } from '../services/sales-reports.service';
import type {
  SalesSummary,
  SalesByDateRow,
  SalesByCustomerRow,
  SalesByBranchRow,
  SalesByProductRow,
  SalesCustomerSummary,
} from '../services/sales-reports.service';
import { SalesReportQueryDto } from '../dto/sales-report-query.dto';
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

@ApiTags('Reports - Sales')
@Controller('reports/sales')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SalesReportsController {
  constructor(
    private readonly salesReportsService: SalesReportsService,
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
  @RequirePermission('reports.sales.read')
  async summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SalesReportQueryDto,
  ): Promise<SalesSummary> {
    validateDateRange(query.fromDate, query.toDate);
    const scope = await this.resolveScope(
      user,
      query.companyId,
      query.branchId,
    );
    return this.salesReportsService.summary(scope.companyId, {
      ...query,
      branchId: scope.branchId,
      allowedBranchIds: scope.allowedBranchIds,
    });
  }

  @Get('by-date')
  @RequirePermission('reports.sales.read')
  async byDate(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SalesReportQueryDto,
  ): Promise<SalesByDateRow[]> {
    validateDateRange(query.fromDate, query.toDate);
    const scope = await this.resolveScope(
      user,
      query.companyId,
      query.branchId,
    );
    return this.salesReportsService.byDate(scope.companyId, {
      ...query,
      branchId: scope.branchId,
      allowedBranchIds: scope.allowedBranchIds,
    });
  }

  @Get('by-customer')
  @RequirePermission('reports.sales.read')
  async byCustomer(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SalesReportQueryDto,
  ): Promise<SalesByCustomerRow[]> {
    validateDateRange(query.fromDate, query.toDate);
    const scope = await this.resolveScope(
      user,
      query.companyId,
      query.branchId,
    );
    return this.salesReportsService.byCustomer(scope.companyId, {
      ...query,
      branchId: scope.branchId,
      allowedBranchIds: scope.allowedBranchIds,
    });
  }

  @Get('customer-summary')
  @RequirePermission('reports.sales.read')
  async customerSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SalesReportQueryDto,
  ): Promise<SalesCustomerSummary> {
    validateDateRange(query.fromDate, query.toDate);
    const scope = await this.resolveScope(
      user,
      query.companyId,
      query.branchId,
    );
    return this.salesReportsService.customerSummary(scope.companyId, {
      ...query,
      branchId: scope.branchId,
      allowedBranchIds: scope.allowedBranchIds,
    });
  }

  @Get('by-branch')
  @RequirePermission('reports.sales.read')
  async byBranch(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SalesReportQueryDto,
  ): Promise<SalesByBranchRow[]> {
    validateDateRange(query.fromDate, query.toDate);
    const scope = await this.resolveScope(
      user,
      query.companyId,
      query.branchId,
    );
    return this.salesReportsService.byBranch(scope.companyId, {
      ...query,
      branchId: scope.branchId,
      allowedBranchIds: scope.allowedBranchIds,
    });
  }

  @Get('by-product')
  @RequirePermission('reports.sales.read')
  async byProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SalesReportQueryDto,
  ): Promise<SalesByProductRow[]> {
    validateDateRange(query.fromDate, query.toDate);
    const scope = await this.resolveScope(
      user,
      query.companyId,
      query.branchId,
    );
    return this.salesReportsService.byProduct(scope.companyId, {
      ...query,
      branchId: scope.branchId,
      allowedBranchIds: scope.allowedBranchIds,
    });
  }
}
