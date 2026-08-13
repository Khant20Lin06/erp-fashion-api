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
import { SupplierContactsService } from '../services/supplier-contacts.service';
import { CreateContactDto } from '../dto/create-contact.dto';
import { UpdateContactDto } from '../dto/update-contact.dto';
import {
  ContactResponseDto,
  toSupplierContactResponseDto,
} from '../dto/contact-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';

const RESOURCE = 'supplier_contacts';

/** Dual nested+flat route convention, mirroring CustomerContactsController. */
@ApiTags('Customer/Supplier - Supplier Contacts')
@Controller()
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SupplierContactsController {
  constructor(
    private readonly contactsService: SupplierContactsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get('suppliers/:supplierId/contacts')
  @RequirePermission('supplier_contacts.read')
  async findAllForSupplier(
    @CurrentUser() user: AuthenticatedUser,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<ContactResponseDto[]> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const contacts = await this.contactsService.findAllForSupplier(
      supplierId,
      companyId,
    );
    return contacts.map(toSupplierContactResponseDto);
  }

  @Post('suppliers/:supplierId/contacts')
  @RequirePermission('supplier_contacts.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Body() dto: CreateContactDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<ContactResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const contact = await this.contactsService.create(
      supplierId,
      companyId,
      dto,
    );
    return toSupplierContactResponseDto(contact);
  }

  @Get('supplier-contacts/:id')
  @RequirePermission('supplier_contacts.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<ContactResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const contact = await this.contactsService.findByIdInCompany(id, companyId);
    return toSupplierContactResponseDto(contact);
  }

  @Patch('supplier-contacts/:id')
  @RequirePermission('supplier_contacts.update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<ContactResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const contact = await this.contactsService.update(id, companyId, dto);
    return toSupplierContactResponseDto(contact);
  }

  @Delete('supplier-contacts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('supplier_contacts.delete')
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
    await this.contactsService.remove(id, companyId);
  }
}
