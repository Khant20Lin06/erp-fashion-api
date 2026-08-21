import {
  Body,
  Controller,
  Get,
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
  CreateEmployeePayrollComponentDto,
  EmployeePayrollComponentResponseDto,
  toEmployeePayrollComponentResponseDto,
} from '../dto/employee-payroll-components.dto';
import { EmployeePayrollComponentsService } from '../services/employee-payroll-components.service';

const RESOURCE = 'employee_payroll_components';

@ApiTags('Payroll - Employee Payroll Components')
@Controller('employees/:employeeId/payroll-components')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class EmployeePayrollComponentsController {
  constructor(
    private readonly assignmentsService: EmployeePayrollComponentsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('employee_payroll_components.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() query: PaginationDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<{
    data: EmployeePayrollComponentResponseDto[];
    meta: unknown;
  }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const result = await this.assignmentsService.findAllForEmployee(
      employeeId,
      companyId,
      query.page,
      query.limit,
    );
    return {
      data: result.data.map(toEmployeePayrollComponentResponseDto),
      meta: result.meta,
    };
  }

  @Post()
  @RequirePermission('employee_payroll_components.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: CreateEmployeePayrollComponentDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<EmployeePayrollComponentResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.assignmentsService.create(
      employeeId,
      companyId,
      dto,
    );
    return toEmployeePayrollComponentResponseDto(entity);
  }
}
