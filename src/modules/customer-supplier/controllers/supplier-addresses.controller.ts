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
import { SupplierAddressesService } from '../services/supplier-addresses.service';
import { CreateAddressDto } from '../dto/create-address.dto';
import { UpdateAddressDto } from '../dto/update-address.dto';
import {
  AddressResponseDto,
  toSupplierAddressResponseDto,
} from '../dto/address-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';

const RESOURCE = 'supplier_addresses';

/** Mirrors CustomerAddressesController's dual nested+flat route convention exactly — see its docblock. */
@ApiTags('Customer/Supplier - Supplier Addresses')
@Controller()
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SupplierAddressesController {
  constructor(
    private readonly addressesService: SupplierAddressesService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get('suppliers/:supplierId/addresses')
  @RequirePermission('supplier_addresses.read')
  async findAllForSupplier(
    @CurrentUser() user: AuthenticatedUser,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<AddressResponseDto[]> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const addresses = await this.addressesService.findAllForSupplier(
      supplierId,
      companyId,
    );
    return addresses.map(toSupplierAddressResponseDto);
  }

  @Post('suppliers/:supplierId/addresses')
  @RequirePermission('supplier_addresses.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
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
      supplierId,
      companyId,
      dto,
    );
    return toSupplierAddressResponseDto(address);
  }

  @Get('supplier-addresses/:id')
  @RequirePermission('supplier_addresses.read')
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
    return toSupplierAddressResponseDto(address);
  }

  @Patch('supplier-addresses/:id')
  @RequirePermission('supplier_addresses.update')
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
    return toSupplierAddressResponseDto(address);
  }

  @Delete('supplier-addresses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('supplier_addresses.delete')
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
