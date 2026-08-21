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
import { resolveRequestCompanyBranchScope } from '../../master-data/utils/resolve-request-company-branch-scope';
import {
  CreateShiftDto,
  ListShiftsDto,
  ShiftResponseDto,
  toShiftResponseDto,
  UpdateShiftDto,
} from '../dto/shifts.dto';
import { ShiftsService } from '../services/shifts.service';

const RESOURCE = 'shifts';

@ApiTags('Payroll - Shifts')
@Controller('shifts')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ShiftsController {
  constructor(
    private readonly shiftsService: ShiftsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('shifts.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListShiftsDto,
  ): Promise<{ data: ShiftResponseDto[]; meta: unknown }> {
    const scope = await resolveRequestCompanyBranchScope(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
      query.branchId,
    );
    const result = await this.shiftsService.findAll(
      scope.companyId,
      query,
      scope.allowedBranchIds,
    );
    return {
      data: result.data.map(toShiftResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('shifts.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<ShiftResponseDto> {
    const scope = await resolveRequestCompanyBranchScope(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
      undefined,
    );
    const entity = await this.shiftsService.findByIdInCompany(
      id,
      scope.companyId,
    );
    return toShiftResponseDto(entity);
  }

  @Post()
  @RequirePermission('shifts.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateShiftDto,
  ): Promise<ShiftResponseDto> {
    const scope = await resolveRequestCompanyBranchScope(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
      dto.branchId,
    );
    const entity = await this.shiftsService.create(scope.companyId, user.id, {
      ...dto,
      branchId: dto.branchId ?? undefined,
    });
    return toShiftResponseDto(entity);
  }

  @Patch(':id')
  @RequirePermission('shifts.update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShiftDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<ShiftResponseDto> {
    const scope = await resolveRequestCompanyBranchScope(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
      undefined,
    );
    const entity = await this.shiftsService.update(
      id,
      scope.companyId,
      user.id,
      dto,
    );
    return toShiftResponseDto(entity);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('shifts.delete')
  async remove(
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
    await this.shiftsService.remove(id, scope.companyId);
  }
}
