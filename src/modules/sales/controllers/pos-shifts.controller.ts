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
import { PosShiftsService } from '../services/pos-shifts.service';
import { OpenPosShiftDto } from '../dto/open-pos-shift.dto';
import { ClosePosShiftDto } from '../dto/close-pos-shift.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';

const RESOURCE = 'sales';

@ApiTags('POS Shifts')
@Controller('pos/shifts')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PosShiftsController {
  constructor(
    private readonly posShiftsService: PosShiftsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get('current')
  @RequirePermission('sales.read')
  async getCurrentShift(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
    @Query('companyId') companyIdQuery?: string,
  ) {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    return this.posShiftsService.getCurrentShift(
      companyId,
      branchId,
      user.id,
    );
  }

  @Post('open')
  @RequirePermission('sales.create')
  async openShift(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: OpenPosShiftDto,
    @Query('companyId') companyIdQuery?: string,
  ) {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    return this.posShiftsService.openShift(companyId, user.id, dto);
  }

  @Post(':id/close')
  @RequirePermission('sales.create')
  async closeShift(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ClosePosShiftDto,
    @Query('companyId') companyIdQuery?: string,
  ) {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    return this.posShiftsService.closeShift(companyId, id, dto);
  }

  @Get()
  @RequirePermission('sales.read')
  async listShifts(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
    @Query('limit') limitQuery?: string,
    @Query('companyId') companyIdQuery?: string,
  ) {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const limit = limitQuery ? parseInt(limitQuery, 10) : 20;
    return this.posShiftsService.listShifts(companyId, branchId, limit);
  }

  @Get(':id')
  @RequirePermission('sales.read')
  async getShiftById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ) {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    return this.posShiftsService.getShiftById(companyId, id);
  }
}
