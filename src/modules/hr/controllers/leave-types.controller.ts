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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';
import {
  CreateLeaveTypeDto,
  LeaveTypeResponseDto,
  ListLeaveTypesDto,
  toLeaveTypeResponseDto,
  UpdateLeaveTypeDto,
} from '../dto/leave-types.dto';
import { LeaveTypesService } from '../services/leave-types.service';

const RESOURCE = 'leave_types';

@ApiTags('HR - Leave Types')
@Controller('leave-types')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class LeaveTypesController {
  constructor(
    private readonly leaveTypesService: LeaveTypesService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('leave_types.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListLeaveTypesDto,
  ): Promise<{ data: LeaveTypeResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.leaveTypesService.findAll(companyId, query);
    return {
      data: result.data.map(toLeaveTypeResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('leave_types.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<LeaveTypeResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.leaveTypesService.findByIdInCompany(
      id,
      companyId,
    );
    return toLeaveTypeResponseDto(entity);
  }

  @Post()
  @RequirePermission('leave_types.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLeaveTypeDto,
  ): Promise<LeaveTypeResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    const entity = await this.leaveTypesService.create(companyId, dto);
    return toLeaveTypeResponseDto(entity);
  }

  @Patch(':id')
  @RequirePermission('leave_types.update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeaveTypeDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<LeaveTypeResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.leaveTypesService.update(id, companyId, dto);
    return toLeaveTypeResponseDto(entity);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('leave_types.update')
  async activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<LeaveTypeResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.leaveTypesService.activate(id, companyId);
    return toLeaveTypeResponseDto(entity);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('leave_types.update')
  async deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<LeaveTypeResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.leaveTypesService.deactivate(id, companyId);
    return toLeaveTypeResponseDto(entity);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('leave_types.delete')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<void> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    await this.leaveTypesService.remove(id, companyId);
  }
}
