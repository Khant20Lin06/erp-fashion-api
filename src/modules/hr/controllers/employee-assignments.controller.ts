import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { resolveRequestCompanyBranchScope } from '../../master-data/utils/resolve-request-company-branch-scope';
import {
  CreateEmployeeAssignmentDto,
  EmployeeAssignmentResponseDto,
  ListEmployeeAssignmentsDto,
  toEmployeeAssignmentResponseDto,
  UpdateEmployeeAssignmentDto,
} from '../dto/employee-assignments.dto';
import { EmployeeAssignmentsService } from '../services/employee-assignments.service';

const RESOURCE = 'employee_assignments';

@ApiTags('HR - Employee Assignments')
@Controller('employee-assignments')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class EmployeeAssignmentsController {
  constructor(
    private readonly assignmentsService: EmployeeAssignmentsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('employee_assignments.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListEmployeeAssignmentsDto,
  ): Promise<{ data: EmployeeAssignmentResponseDto[]; meta: unknown }> {
    const scope = await resolveRequestCompanyBranchScope(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
      query.branchId,
    );
    const result = await this.assignmentsService.findAll(
      scope.companyId,
      query,
      scope.allowedBranchIds,
    );
    return {
      data: result.data.map(toEmployeeAssignmentResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('employee_assignments.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<EmployeeAssignmentResponseDto> {
    const scope = await resolveRequestCompanyBranchScope(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
      undefined,
    );
    const entity = await this.assignmentsService.findByIdInScope(
      id,
      scope.companyId,
      scope.allowedBranchIds,
    );
    return toEmployeeAssignmentResponseDto(entity);
  }

  @Post()
  @RequirePermission('employee_assignments.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEmployeeAssignmentDto,
  ): Promise<EmployeeAssignmentResponseDto> {
    await resolveRequestCompanyBranchScope(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
      dto.branchId,
    );
    const entity = await this.assignmentsService.create(dto);
    return toEmployeeAssignmentResponseDto(entity);
  }

  @Patch(':id')
  @RequirePermission('employee_assignments.update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeAssignmentDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<EmployeeAssignmentResponseDto> {
    const scope = await resolveRequestCompanyBranchScope(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
      undefined,
    );
    await this.assignmentsService.findByIdInScope(
      id,
      scope.companyId,
      scope.allowedBranchIds,
    );
    const entity = await this.assignmentsService.update(
      id,
      scope.companyId,
      dto,
    );
    return toEmployeeAssignmentResponseDto(entity);
  }
}
