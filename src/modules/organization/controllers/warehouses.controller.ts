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
import { WarehousesService } from '../services/warehouses.service';
import { CreateWarehouseDto } from '../dto/create-warehouse.dto';
import { UpdateWarehouseDto } from '../dto/update-warehouse.dto';
import { ListWarehousesDto } from '../dto/list-warehouses.dto';
import {
  WarehouseResponseDto,
  toWarehouseResponseDto,
} from '../dto/warehouse-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';

const RESOURCE = 'warehouses';

@ApiTags('Organization - Warehouses')
@Controller('warehouses')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class WarehousesController {
  constructor(
    private readonly warehousesService: WarehousesService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('warehouses.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListWarehousesDto,
  ): Promise<{ data: WarehouseResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.warehousesService.findAll(companyId, query);
    return {
      data: result.data.map(toWarehouseResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('warehouses.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<WarehouseResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const warehouse = await this.warehousesService.findByIdInCompany(
      id,
      companyId,
    );
    return toWarehouseResponseDto(warehouse);
  }

  @Post()
  @RequirePermission('warehouses.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWarehouseDto,
  ): Promise<WarehouseResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    const warehouse = await this.warehousesService.create(companyId, dto);
    return toWarehouseResponseDto(warehouse);
  }

  @Patch(':id')
  @RequirePermission('warehouses.update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWarehouseDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<WarehouseResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const warehouse = await this.warehousesService.update(id, companyId, dto);
    return toWarehouseResponseDto(warehouse);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('warehouses.update')
  async activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<WarehouseResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const warehouse = await this.warehousesService.activate(id, companyId);
    return toWarehouseResponseDto(warehouse);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('warehouses.update')
  async deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<WarehouseResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const warehouse = await this.warehousesService.deactivate(id, companyId);
    return toWarehouseResponseDto(warehouse);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('warehouses.delete')
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
    await this.warehousesService.remove(id, companyId);
  }
}
