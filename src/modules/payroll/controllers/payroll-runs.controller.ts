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
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import {
  CreatePayrollRunDto,
  ListPayrollRunsDto,
  PayrollRunEmployeeResponseDto,
  PayrollRunResponseDto,
  toPayrollRunEmployeeResponseDto,
  toPayrollRunResponseDto,
} from '../dto/payroll-runs.dto';
import { PayrollRunsService } from '../services/payroll-runs.service';

const RESOURCE = 'payroll_runs';

@ApiTags('Payroll - Runs')
@Controller('payroll/runs')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PayrollRunsController {
  constructor(
    private readonly runsService: PayrollRunsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('payroll_runs.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPayrollRunsDto,
  ): Promise<{ data: PayrollRunResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.runsService.findAll(companyId, query);
    return {
      data: result.data.map(toPayrollRunResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('payroll_runs.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PayrollRunResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.runsService.findByIdInCompany(id, companyId);
    return toPayrollRunResponseDto(entity);
  }

  @Get(':id/employees')
  @RequirePermission('payroll_runs.read')
  async findEmployees(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<{ data: PayrollRunEmployeeResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const result = await this.runsService.findEmployeesForRun(
      id,
      companyId,
      query.page,
      query.limit,
    );
    return {
      data: result.data.map((payslip) =>
        toPayrollRunEmployeeResponseDto(payslip),
      ),
      meta: result.meta,
    };
  }

  @Get(':id/employees/:employeeId')
  @RequirePermission('payroll_runs.read')
  async findEmployeeDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PayrollRunEmployeeResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const { payslip, items } = await this.runsService.findEmployeeDetailForRun(
      id,
      employeeId,
      companyId,
    );
    return toPayrollRunEmployeeResponseDto(payslip, items);
  }

  @Post()
  @RequirePermission('payroll_runs.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePayrollRunDto,
  ): Promise<PayrollRunResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    const entity = await this.runsService.create(companyId, user.id, dto);
    return toPayrollRunResponseDto(entity);
  }

  @Post(':id/calculate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('payroll_runs.calculate')
  async calculate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PayrollRunResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.runsService.calculate(id, companyId);
    return toPayrollRunResponseDto(entity);
  }

  @Post(':id/finalize')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('payroll_runs.finalize')
  async finalize(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PayrollRunResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.runsService.finalize(id, companyId, user.id);
    return toPayrollRunResponseDto(entity);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('payroll_runs.cancel')
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PayrollRunResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.runsService.cancel(id, companyId);
    return toPayrollRunResponseDto(entity);
  }
}
