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
import { TrialBalanceResponseDto } from '../dto/trial-balance-response.dto';
import { ErrorResponseDto } from '../../../common/swagger/dto/error-response.dto';

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
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({
    summary:
      'Return the posted-trial-balance snapshot for the requested as-of date',
  })
  @ApiOkResponse({
    type: TrialBalanceResponseDto,
    description:
      'Trial balance rows grouped by account, constrained by DataScope company/branch visibility.',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Validation failed for query parameters.',
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Missing, invalid, expired, or revoked JWT session.',
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description:
      'The authenticated user lacks the required permission or scope for this report.',
  })
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
