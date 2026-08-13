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
import { SupplierGroupsService } from '../services/supplier-groups.service';
import { CreateSupplierGroupDto } from '../dto/create-supplier-group.dto';
import { UpdateSupplierGroupDto } from '../dto/update-supplier-group.dto';
import { ListSupplierGroupsDto } from '../dto/list-supplier-groups.dto';
import {
  SupplierGroupResponseDto,
  toSupplierGroupResponseDto,
} from '../dto/supplier-group-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';

const RESOURCE = 'supplier_groups';

@ApiTags('Customer/Supplier - Supplier Groups')
@Controller('supplier-groups')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SupplierGroupsController {
  constructor(
    private readonly supplierGroupsService: SupplierGroupsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('supplier_groups.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListSupplierGroupsDto,
  ): Promise<{ data: SupplierGroupResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.supplierGroupsService.findAll(companyId, query);
    return {
      data: result.data.map(toSupplierGroupResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('supplier_groups.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<SupplierGroupResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.supplierGroupsService.findByIdInCompany(
      id,
      companyId,
    );
    return toSupplierGroupResponseDto(entity);
  }

  @Post()
  @RequirePermission('supplier_groups.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSupplierGroupDto,
  ): Promise<SupplierGroupResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    const entity = await this.supplierGroupsService.create(companyId, dto);
    return toSupplierGroupResponseDto(entity);
  }

  @Patch(':id')
  @RequirePermission('supplier_groups.update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierGroupDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<SupplierGroupResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.supplierGroupsService.update(id, companyId, dto);
    return toSupplierGroupResponseDto(entity);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('supplier_groups.update')
  async activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<SupplierGroupResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.supplierGroupsService.activate(id, companyId);
    return toSupplierGroupResponseDto(entity);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('supplier_groups.update')
  async deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<SupplierGroupResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.supplierGroupsService.deactivate(id, companyId);
    return toSupplierGroupResponseDto(entity);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('supplier_groups.delete')
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
    await this.supplierGroupsService.remove(id, companyId);
  }
}
