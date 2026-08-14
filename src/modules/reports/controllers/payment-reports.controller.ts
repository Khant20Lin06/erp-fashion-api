import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaymentReportsService } from '../services/payment-reports.service';
import type {
  PaymentByDateRow,
  PaymentByDirectionRow,
  PaymentByMethodRow,
} from '../services/payment-reports.service';
import { PaymentReportQueryDto } from '../dto/payment-report-query.dto';
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

@ApiTags('Reports - Payments')
@Controller('reports/payments')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PaymentReportsController {
  constructor(
    private readonly paymentReportsService: PaymentReportsService,
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

  @Get('by-date')
  @RequirePermission('reports.payments.read')
  async byDate(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaymentReportQueryDto,
  ): Promise<PaymentByDateRow[]> {
    validateDateRange(query.fromDate, query.toDate);
    const scope = await this.resolveScope(
      user,
      query.companyId,
      query.branchId,
    );
    return this.paymentReportsService.byDate(scope.companyId, {
      ...query,
      branchId: scope.branchId,
      allowedBranchIds: scope.allowedBranchIds,
    });
  }

  @Get('by-direction')
  @RequirePermission('reports.payments.read')
  async byDirection(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaymentReportQueryDto,
  ): Promise<PaymentByDirectionRow[]> {
    validateDateRange(query.fromDate, query.toDate);
    const scope = await this.resolveScope(
      user,
      query.companyId,
      query.branchId,
    );
    return this.paymentReportsService.byDirection(scope.companyId, {
      ...query,
      branchId: scope.branchId,
      allowedBranchIds: scope.allowedBranchIds,
    });
  }

  @Get('by-method')
  @RequirePermission('reports.payments.read')
  async byMethod(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaymentReportQueryDto,
  ): Promise<PaymentByMethodRow[]> {
    validateDateRange(query.fromDate, query.toDate);
    const scope = await this.resolveScope(
      user,
      query.companyId,
      query.branchId,
    );
    return this.paymentReportsService.byMethod(scope.companyId, {
      ...query,
      branchId: scope.branchId,
      allowedBranchIds: scope.allowedBranchIds,
    });
  }
}
