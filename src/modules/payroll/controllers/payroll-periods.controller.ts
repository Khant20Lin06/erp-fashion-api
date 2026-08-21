import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';
import {
  CreatePayrollPeriodDto,
  ListPayrollPeriodsDto,
  PayrollPeriodResponseDto,
  toPayrollPeriodResponseDto,
} from '../dto/payroll-periods.dto';
import { PayrollPeriodsService } from '../services/payroll-periods.service';

const RESOURCE = 'payroll_periods';

@ApiTags('Payroll - Periods')
@Controller('payroll/periods')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PayrollPeriodsController {
  constructor(
    private readonly periodsService: PayrollPeriodsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('payroll_periods.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPayrollPeriodsDto,
  ): Promise<{ data: PayrollPeriodResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.periodsService.findAll(companyId, query);
    return {
      data: result.data.map(toPayrollPeriodResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('payroll_periods.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PayrollPeriodResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.periodsService.findByIdInCompany(id, companyId);
    return toPayrollPeriodResponseDto(entity);
  }

  @Post()
  @RequirePermission('payroll_periods.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePayrollPeriodDto,
  ): Promise<PayrollPeriodResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    const entity = await this.periodsService.create(companyId, user.id, dto);
    return toPayrollPeriodResponseDto(entity);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('payroll_periods.cancel')
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PayrollPeriodResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.periodsService.cancel(id, companyId, user.id);
    return toPayrollPeriodResponseDto(entity);
  }
}
