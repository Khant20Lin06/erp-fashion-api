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
  CreateEmployeeShiftAssignmentDto,
  EmployeeShiftAssignmentResponseDto,
  toEmployeeShiftAssignmentResponseDto,
} from '../dto/employee-shift-assignments.dto';
import { EmployeeShiftAssignmentsService } from '../services/employee-shift-assignments.service';

const RESOURCE = 'shifts';

@ApiTags('Payroll - Employee Shift Assignments')
@Controller('employees/:employeeId/shifts')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class EmployeeShiftAssignmentsController {
  constructor(
    private readonly assignmentsService: EmployeeShiftAssignmentsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('shifts.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() query: PaginationDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<{ data: EmployeeShiftAssignmentResponseDto[]; meta: unknown }> {
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
      data: result.data.map(toEmployeeShiftAssignmentResponseDto),
      meta: result.meta,
    };
  }

  @Post()
  @RequirePermission('shifts.update')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: CreateEmployeeShiftAssignmentDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<EmployeeShiftAssignmentResponseDto> {
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
    return toEmployeeShiftAssignmentResponseDto(entity);
  }
}
