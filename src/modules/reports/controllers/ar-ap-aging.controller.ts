import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ArApAgingService } from '../services/ar-ap-aging.service';
import type { ArApAgingResult } from '../services/ar-ap-aging.service';
import { ArApAgingQueryDto } from '../dto/ar-ap-aging-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyBranchScope } from '../../master-data/utils/resolve-request-company-branch-scope';

const RESOURCE = 'reports';

@ApiTags('Reports - AR/AP Aging')
@Controller('reports/ar-ap-aging')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ArApAgingController {
  constructor(
    private readonly arApAgingService: ArApAgingService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('reports.ar_ap.read')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ArApAgingQueryDto,
  ): Promise<ArApAgingResult> {
    const scope = await resolveRequestCompanyBranchScope(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
      query.branchId,
    );
    return this.arApAgingService.query(scope.companyId, {
      ...query,
      branchId: scope.branchId,
      allowedBranchIds: scope.allowedBranchIds,
    });
  }
}
