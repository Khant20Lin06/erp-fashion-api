import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { DashboardService } from '../services/dashboard.service';
import { DashboardQueryDto } from '../dto/dashboard-query.dto';
import { DashboardResponseDto } from '../dto/dashboard-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyBranchScope } from '../../master-data/utils/resolve-request-company-branch-scope';
import { validateDateRange } from '../../../shared/utils/validate-date-range';
import { ErrorResponseDto } from '../../../common/swagger/dto/error-response.dto';

const RESOURCE = 'reports';

/**
 * Phase 22 — Dashboard. The one aggregation endpoint this phase caches
 * (locked spec) — DashboardService itself owns the cache-aside logic;
 * this controller only resolves/enforces DataScope, exactly like every
 * other report controller in this module, and never trusts a raw
 * companyId query param.
 */
@ApiTags('Reports - Dashboard')
@Controller('reports/dashboard')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('reports.dashboard.read')
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({
    summary:
      'Return the cached-or-fresh operational dashboard summary for the current scope',
  })
  @ApiOkResponse({
    type: DashboardResponseDto,
    description:
      'Dashboard metrics constrained by DataScope company/branch visibility and safe Redis cache keys.',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Validation failed for query parameters or date range.',
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Missing, invalid, expired, or revoked JWT session.',
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description:
      'The authenticated user lacks the required permission or scope for this dashboard.',
  })
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DashboardQueryDto,
  ): Promise<DashboardResponseDto> {
    validateDateRange(query.fromDate, query.toDate);
    const scope = await resolveRequestCompanyBranchScope(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
      query.branchId,
    );
    return this.dashboardService.getDashboard(scope.companyId, {
      ...query,
      branchId: scope.branchId,
      allowedBranchIds: scope.allowedBranchIds,
    });
  }
}
