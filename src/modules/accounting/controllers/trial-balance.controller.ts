import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  TrialBalanceService,
  TrialBalanceResult,
} from '../services/trial-balance.service';
import { TrialBalanceQueryDto } from '../dto/trial-balance-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyBranchScope } from '../../master-data/utils/resolve-request-company-branch-scope';

const RESOURCE = 'trial_balance';

/** D20 (LOCKED): GET /trial-balance only — a read-only query endpoint, never a physical table (D5). */
@ApiTags('Accounting - Trial Balance')
@Controller('trial-balance')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class TrialBalanceController {
  constructor(
    private readonly trialBalanceService: TrialBalanceService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('trial_balance.read')
  async query(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TrialBalanceQueryDto,
  ): Promise<TrialBalanceResult> {
    const scope = await resolveRequestCompanyBranchScope(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
      query.branchId,
    );
    return this.trialBalanceService.query(scope.companyId, {
      ...query,
      branchId: scope.branchId,
      allowedBranchIds: scope.allowedBranchIds,
    });
  }
}
