import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProfitLossService } from '../services/profit-loss.service';
import type { ProfitLossResult } from '../services/profit-loss.service';
import { ProfitLossQueryDto } from '../dto/profit-loss-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyBranchScope } from '../../master-data/utils/resolve-request-company-branch-scope';
import { validateDateRange } from '../../../shared/utils/validate-date-range';

const RESOURCE = 'reports';

@ApiTags('Reports - Profit & Loss')
@Controller('reports/profit-loss')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ProfitLossController {
  constructor(
    private readonly profitLossService: ProfitLossService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('reports.profit_loss.read')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ProfitLossQueryDto,
  ): Promise<ProfitLossResult> {
    validateDateRange(query.fromDate, query.toDate);
    const scope = await resolveRequestCompanyBranchScope(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
      query.branchId,
    );
    return this.profitLossService.query(scope.companyId, {
      ...query,
      branchId: scope.branchId,
      allowedBranchIds: scope.allowedBranchIds,
    });
  }
}
