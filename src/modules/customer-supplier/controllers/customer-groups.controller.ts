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
import { CustomerGroupsService } from '../services/customer-groups.service';
import { CreateCustomerGroupDto } from '../dto/create-customer-group.dto';
import { UpdateCustomerGroupDto } from '../dto/update-customer-group.dto';
import { ListCustomerGroupsDto } from '../dto/list-customer-groups.dto';
import {
  CustomerGroupResponseDto,
  toCustomerGroupResponseDto,
} from '../dto/customer-group-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';

const RESOURCE = 'customer_groups';

@ApiTags('Customer/Supplier - Customer Groups')
@Controller('customer-groups')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CustomerGroupsController {
  constructor(
    private readonly customerGroupsService: CustomerGroupsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('customer_groups.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListCustomerGroupsDto,
  ): Promise<{ data: CustomerGroupResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.customerGroupsService.findAll(companyId, query);
    return {
      data: result.data.map(toCustomerGroupResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('customer_groups.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<CustomerGroupResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.customerGroupsService.findByIdInCompany(
      id,
      companyId,
    );
    return toCustomerGroupResponseDto(entity);
  }

  @Post()
  @RequirePermission('customer_groups.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCustomerGroupDto,
  ): Promise<CustomerGroupResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    const entity = await this.customerGroupsService.create(companyId, dto);
    return toCustomerGroupResponseDto(entity);
  }

  @Patch(':id')
  @RequirePermission('customer_groups.update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerGroupDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<CustomerGroupResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.customerGroupsService.update(id, companyId, dto);
    return toCustomerGroupResponseDto(entity);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('customer_groups.update')
  async activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<CustomerGroupResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.customerGroupsService.activate(id, companyId);
    return toCustomerGroupResponseDto(entity);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('customer_groups.update')
  async deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<CustomerGroupResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.customerGroupsService.deactivate(id, companyId);
    return toCustomerGroupResponseDto(entity);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('customer_groups.delete')
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
    await this.customerGroupsService.remove(id, companyId);
  }
}
