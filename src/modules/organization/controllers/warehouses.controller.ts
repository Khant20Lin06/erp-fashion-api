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

@ApiTags('Organization - Warehouses')
@Controller('warehouses')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Get()
  @RequirePermission('warehouses.read')
  async findAll(
    @Query() query: ListWarehousesDto,
  ): Promise<{ data: WarehouseResponseDto[]; meta: unknown }> {
    const result = await this.warehousesService.findAll(query);
    return {
      data: result.data.map(toWarehouseResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('warehouses.read')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WarehouseResponseDto> {
    const warehouse = await this.warehousesService.findById(id);
    return toWarehouseResponseDto(warehouse);
  }

  @Post()
  @RequirePermission('warehouses.create')
  async create(@Body() dto: CreateWarehouseDto): Promise<WarehouseResponseDto> {
    const warehouse = await this.warehousesService.create(dto);
    return toWarehouseResponseDto(warehouse);
  }

  @Patch(':id')
  @RequirePermission('warehouses.update')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWarehouseDto,
  ): Promise<WarehouseResponseDto> {
    const warehouse = await this.warehousesService.update(id, dto);
    return toWarehouseResponseDto(warehouse);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('warehouses.update')
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WarehouseResponseDto> {
    const warehouse = await this.warehousesService.activate(id);
    return toWarehouseResponseDto(warehouse);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('warehouses.update')
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WarehouseResponseDto> {
    const warehouse = await this.warehousesService.deactivate(id);
    return toWarehouseResponseDto(warehouse);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('warehouses.delete')
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.warehousesService.remove(id);
  }
}
