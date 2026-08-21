import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  PayrollConfigurationResponseDto,
  toPayrollConfigurationResponseDto,
  UpsertPayrollConfigurationDto,
} from '../dto/payroll-configuration.dto';
import { PayrollConfigurationService } from '../services/payroll-configuration.service';

const RESOURCE = 'payroll_configuration';

@ApiTags('Payroll - Configuration')
@Controller('payroll/configuration')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PayrollConfigurationController {
  constructor(
    private readonly configurationService: PayrollConfigurationService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('payroll_configuration.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PayrollConfigurationResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity =
      await this.configurationService.findByCompanyIdOrNull(companyId);
    if (!entity) {
      throw new AppException(
        ErrorCode.NotFound,
        'Payroll configuration has not been set up for this company',
      );
    }
    return toPayrollConfigurationResponseDto(entity);
  }

  @Put()
  @RequirePermission('payroll_configuration.update')
  async upsert(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertPayrollConfigurationDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PayrollConfigurationResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.configurationService.upsert(
      companyId,
      user.id,
      dto,
    );
    return toPayrollConfigurationResponseDto(entity);
  }
}
