import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AccountingAuditLogService } from '../services/accounting-audit-log.service';
import type { PaginatedAccountingAuditLog } from '../services/accounting-audit-log.service';
import { AccountingAuditLogQueryDto } from '../dto/accounting-audit-log-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyBranchScope } from '../../master-data/utils/resolve-request-company-branch-scope';
import { validateDateRange } from '../../../shared/utils/validate-date-range';

const RESOURCE = 'reports';

/**
 * Accounting Audit Log (Phase 15) — a read projection over JournalEntry/
 * Payment/Sale/PurchaseOrder's existing createdBy/postedBy/createdAt/
 * postedAt/status columns. Not a new audit-logging system; see
 * AccountingAuditLogService's own docblock for the exact derivation rules.
 * DataScope-enforced exactly like every other report controller in this
 * module — never trusts a raw companyId query param.
 */
@ApiTags('Reports - Accounting Audit Log')
@Controller('reports/accounting/audit-log')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AccountingAuditLogController {
  constructor(
    private readonly accountingAuditLogService: AccountingAuditLogService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('reports.accounting_audit.read')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AccountingAuditLogQueryDto,
  ): Promise<PaginatedAccountingAuditLog> {
    validateDateRange(query.fromDate, query.toDate);
    const scope = await resolveRequestCompanyBranchScope(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
      query.branchId,
    );
    return this.accountingAuditLogService.query(
      scope.companyId,
      Object.assign(new AccountingAuditLogQueryDto(), query, {
        branchId: scope.branchId,
        allowedBranchIds: scope.allowedBranchIds,
      }),
    );
  }
}
