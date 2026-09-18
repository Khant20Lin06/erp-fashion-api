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
import { CustomersService } from '../services/customers.service';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { UpdateCustomerDto } from '../dto/update-customer.dto';
import { ListCustomersDto } from '../dto/list-customers.dto';
import {
  CustomerResponseDto,
  toCustomerResponseDto,
} from '../dto/customer-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';

const RESOURCE = 'customers';

@ApiTags('Customer/Supplier - Customers')
@Controller('customers')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('customers.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListCustomersDto,
  ): Promise<{ data: CustomerResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.customersService.findAll(companyId, query);
    return { data: result.data.map(toCustomerResponseDto), meta: result.meta };
  }

  @Get(':id')
  @RequirePermission('customers.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<CustomerResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.customersService.findByIdInCompany(id, companyId);
    return toCustomerResponseDto(entity);
  }

  @Get(':id/analytics')
  @RequirePermission('customers.read')
  async getAnalytics(
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
    return this.customersService.getAnalytics(id, companyId);
  }

  @Get(':id/notes')
  @RequirePermission('customers.read')
  async getNotes(
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
    return this.customersService.getNotes(id, companyId);
  }

  @Post(':id/notes')
  @RequirePermission('customers.update')
  async createNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { content: string; noteType?: string },
    @Query('companyId') companyIdQuery?: string,
  ) {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    return this.customersService.createNote(id, companyId, user.id, dto);
  }

  @Post()
  @RequirePermission('customers.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCustomerDto,
  ): Promise<CustomerResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    const entity = await this.customersService.create(companyId, dto);
    return toCustomerResponseDto(entity);
  }

  @Patch(':id')
  @RequirePermission('customers.update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<CustomerResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.customersService.update(id, companyId, dto);
    return toCustomerResponseDto(entity);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('customers.update')
  async activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<CustomerResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.customersService.activate(id, companyId);
    return toCustomerResponseDto(entity);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('customers.update')
  async deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<CustomerResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.customersService.deactivate(id, companyId);
    return toCustomerResponseDto(entity);
  }

  @Post(':id/block')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('customers.update')
  async block(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<CustomerResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.customersService.block(id, companyId);
    return toCustomerResponseDto(entity);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('customers.delete')
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
    await this.customersService.remove(id, companyId);
  }
}
