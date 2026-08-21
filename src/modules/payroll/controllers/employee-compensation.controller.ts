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
  CreateEmployeeCompensationDto,
  EmployeeCompensationResponseDto,
  toEmployeeCompensationResponseDto,
} from '../dto/employee-compensation.dto';
import { EmployeeCompensationService } from '../services/employee-compensation.service';

const RESOURCE = 'employee_compensations';

@ApiTags('Payroll - Employee Compensation')
@Controller('employees/:employeeId/compensation')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class EmployeeCompensationController {
  constructor(
    private readonly compensationService: EmployeeCompensationService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('employee_compensations.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() query: PaginationDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<{ data: EmployeeCompensationResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const result = await this.compensationService.findAllForEmployee(
      employeeId,
      companyId,
      query.page,
      query.limit,
    );
    return {
      data: result.data.map(toEmployeeCompensationResponseDto),
      meta: result.meta,
    };
  }

  @Post()
  @RequirePermission('employee_compensations.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: CreateEmployeeCompensationDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<EmployeeCompensationResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.compensationService.create(
      employeeId,
      companyId,
      user.id,
      dto,
    );
    return toEmployeeCompensationResponseDto(entity);
  }
}
