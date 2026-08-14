import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BalanceSheetService } from '../services/balance-sheet.service';
import type { BalanceSheetResult } from '../services/balance-sheet.service';
import { BalanceSheetQueryDto } from '../dto/balance-sheet-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyBranchScope } from '../../master-data/utils/resolve-request-company-branch-scope';

const RESOURCE = 'reports';

/**
 * Phase 22 — Balance Sheet. Read-only, DataScope-enforced exactly like
 * GeneralLedgerController/TrialBalanceController (Phase 17 reference
 * pattern) — never trusts a raw companyId query param.
 */
@ApiTags('Reports - Balance Sheet')
@Controller('reports/balance-sheet')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BalanceSheetController {
  constructor(
    private readonly balanceSheetService: BalanceSheetService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('reports.balance_sheet.read')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: BalanceSheetQueryDto,
  ): Promise<BalanceSheetResult> {
    const scope = await resolveRequestCompanyBranchScope(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
      query.branchId,
    );
    return this.balanceSheetService.query(scope.companyId, {
      ...query,
      branchId: scope.branchId,
      allowedBranchIds: scope.allowedBranchIds,
    });
  }
}
