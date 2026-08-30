import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EmployeesService } from '../services/employees.service';
import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { UpdateEmployeeDto } from '../dto/update-employee.dto';
import { ListEmployeesDto } from '../dto/list-employees.dto';
import { LinkUserDto } from '../dto/link-user.dto';
import {
  EmployeeResponseDto,
  toEmployeeResponseDto,
} from '../dto/employee-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';
import { resolveRequestCompanyBranchScope } from '../../master-data/utils/resolve-request-company-branch-scope';
import { DataScope } from '../../rbac/enums/data-scope.enum';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';

const RESOURCE = 'employees';

@ApiTags('Employees')
@Controller('employees')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class EmployeesController {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('employees.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListEmployeesDto,
  ): Promise<{ data: EmployeeResponseDto[]; meta: unknown }> {
    const resolved = await this.dataScopeService.resolveScope(
      user.id,
      RESOURCE,
    );
    if (!resolved) {
      throw new AppException(
        ErrorCode.Forbidden,
        'No data scope is configured for this resource',
      );
    }

    const result =
      resolved.scope === DataScope.Own
        ? await this.employeesService.findAllInScope(query, {
            ownUserId: user.id,
          })
        : await this.employeesService.findAllInScope(
            query,
            await resolveRequestCompanyBranchScope(
              this.dataScopeService,
              user.id,
              RESOURCE,
              query.companyId,
              query.branchId,
            ),
          );
    return {
      data: result.data.map(toEmployeeResponseDto),
      meta: result.meta,
    };
  }

  @Get('me/profile')
  @RequirePermission('employees.read')
  async getMyProfile(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EmployeeResponseDto> {
    const employee = await this.employeesService.findByUserId(user.id);
    return toEmployeeResponseDto(employee);
  }

  @Get(':id')
  @RequirePermission('employees.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<EmployeeResponseDto> {
    const resolved = await this.dataScopeService.resolveScope(
      user.id,
      RESOURCE,
    );
    if (!resolved) {
      throw new AppException(
        ErrorCode.Forbidden,
        'No data scope is configured for this resource',
      );
    }

    const employee =
      resolved.scope === DataScope.Own
        ? await this.employeesService.findByIdInScope(id, {
            ownUserId: user.id,
          })
        : await this.employeesService.findByIdInScope(
            id,
            await resolveRequestCompanyBranchScope(
              this.dataScopeService,
              user.id,
              RESOURCE,
              companyIdQuery,
              undefined,
            ),
          );
    return toEmployeeResponseDto(employee);
  }

  @Post()
  @RequirePermission('employees.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEmployeeDto,
  ): Promise<EmployeeResponseDto> {
    const resolved = await this.dataScopeService.resolveScope(
      user.id,
      RESOURCE,
    );
    if (resolved?.scope === DataScope.Own) {
      throw new AppException(
        ErrorCode.Forbidden,
        'Own-scoped access cannot create employees',
      );
    }
    await resolveRequestCompanyBranchScope(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
      dto.branchId,
    );
    const employee = await this.employeesService.create(dto);
    return toEmployeeResponseDto(employee);
  }

  @Patch(':id')
  @RequirePermission('employees.update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<EmployeeResponseDto> {
    const resolved = await this.dataScopeService.resolveScope(
      user.id,
      RESOURCE,
    );
    if (resolved?.scope === DataScope.Own) {
      throw new AppException(
        ErrorCode.Forbidden,
        'Own-scoped access cannot update employees',
      );
    }
    const scope = await resolveRequestCompanyBranchScope(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
      undefined,
    );
    await this.employeesService.findByIdInScope(id, scope);
    const employee = await this.employeesService.update(id, dto);
    return toEmployeeResponseDto(employee);
  }

  @Post(':id/user')
  @RequirePermission('employees.update')
  async linkUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkUserDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<EmployeeResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    await this.employeesService.findByIdInScope(id, { companyId });
    const employee = await this.employeesService.linkUser(id, dto.userId);
    return toEmployeeResponseDto(employee);
  }

  @Delete(':id/user')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('employees.update')
  async unlinkUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<EmployeeResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    await this.employeesService.findByIdInScope(id, { companyId });
    const employee = await this.employeesService.unlinkUser(id);
    return toEmployeeResponseDto(employee);
  }

  @Post(':id/terminate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('employees.update')
  async terminate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<EmployeeResponseDto> {
    const scope = await resolveRequestCompanyBranchScope(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
      undefined,
    );
    await this.employeesService.findByIdInScope(id, scope);
    const employee = await this.employeesService.terminate(id);
    return toEmployeeResponseDto(employee);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('employees.update')
  async activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<EmployeeResponseDto> {
    const scope = await resolveRequestCompanyBranchScope(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
      undefined,
    );
    await this.employeesService.findByIdInScope(id, scope);
    const employee = await this.employeesService.activate(id);
    return toEmployeeResponseDto(employee);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('employees.update')
  async deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<EmployeeResponseDto> {
    const scope = await resolveRequestCompanyBranchScope(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
      undefined,
    );
    await this.employeesService.findByIdInScope(id, scope);
    const employee = await this.employeesService.deactivate(id);
    return toEmployeeResponseDto(employee);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('employees.update')
  async deletePermanent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<void> {
    const scope = await resolveRequestCompanyBranchScope(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
      undefined,
    );
    await this.employeesService.findByIdInScope(id, scope);
    await this.employeesService.deletePermanent(id);
  }
}
