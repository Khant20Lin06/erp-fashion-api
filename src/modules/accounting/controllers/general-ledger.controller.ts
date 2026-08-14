import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  GeneralLedgerService,
  PaginatedGeneralLedger,
} from '../services/general-ledger.service';
import { GeneralLedgerQueryDto } from '../dto/general-ledger-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyBranchScope } from '../../master-data/utils/resolve-request-company-branch-scope';
import { validateDateRange } from '../../../shared/utils/validate-date-range';

/**
 * D20 (LOCKED): GET /general-ledger only — a read-only query endpoint over
 * POSTED JournalEntryLine rows (D5). No dashboard/chart/KPI/report of any
 * kind. Data visibility resolved against the 'general_ledger' resource
 * (not 'journal_entries') so GL read access can be granted independently
 * of manual journal entry access, per D14's distinct
 * general_ledger.read permission.
 */
const RESOURCE = 'general_ledger';

@ApiTags('Accounting - General Ledger')
@Controller('general-ledger')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class GeneralLedgerController {
  constructor(
    private readonly generalLedgerService: GeneralLedgerService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('general_ledger.read')
  async query(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GeneralLedgerQueryDto,
  ): Promise<PaginatedGeneralLedger> {
    validateDateRange(query.fromDate, query.toDate);
    const scope = await resolveRequestCompanyBranchScope(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
      query.branchId,
    );
    return this.generalLedgerService.query(
      scope.companyId,
      Object.assign(new GeneralLedgerQueryDto(), query, {
        branchId: scope.branchId,
        allowedBranchIds: scope.allowedBranchIds,
      }),
    );
  }
}
