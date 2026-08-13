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
import { CustomerAddressesService } from '../services/customer-addresses.service';
import { CreateAddressDto } from '../dto/create-address.dto';
import { UpdateAddressDto } from '../dto/update-address.dto';
import {
  AddressResponseDto,
  toCustomerAddressResponseDto,
} from '../dto/address-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';

const RESOURCE = 'customer_addresses';

/**
 * Dual nested+flat route convention, matching Phase 10's
 * /products/:id/variants + /product-variants/:id pattern (Phase 11 §18).
 * Nested routes list/create under the owning Customer; flat routes read/
 * update/delete a single address by its own id (still company-scoped via
 * the owning Customer, never trusting the id alone).
 */
@ApiTags('Customer/Supplier - Customer Addresses')
@Controller()
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CustomerAddressesController {
  constructor(
    private readonly addressesService: CustomerAddressesService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get('customers/:customerId/addresses')
  @RequirePermission('customer_addresses.read')
  async findAllForCustomer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<AddressResponseDto[]> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const addresses = await this.addressesService.findAllForCustomer(
      customerId,
      companyId,
    );
    return addresses.map(toCustomerAddressResponseDto);
  }

  @Post('customers/:customerId/addresses')
  @RequirePermission('customer_addresses.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: CreateAddressDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<AddressResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const address = await this.addressesService.create(
      customerId,
      companyId,
      dto,
    );
    return toCustomerAddressResponseDto(address);
  }

  @Get('customer-addresses/:id')
  @RequirePermission('customer_addresses.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<AddressResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const address = await this.addressesService.findByIdInCompany(
      id,
      companyId,
    );
    return toCustomerAddressResponseDto(address);
  }

  @Patch('customer-addresses/:id')
  @RequirePermission('customer_addresses.update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAddressDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<AddressResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const address = await this.addressesService.update(id, companyId, dto);
    return toCustomerAddressResponseDto(address);
  }

  @Delete('customer-addresses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('customer_addresses.delete')
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
    await this.addressesService.remove(id, companyId);
  }
}
