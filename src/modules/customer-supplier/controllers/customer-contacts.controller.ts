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
import { CustomerContactsService } from '../services/customer-contacts.service';
import { CreateContactDto } from '../dto/create-contact.dto';
import { UpdateContactDto } from '../dto/update-contact.dto';
import {
  ContactResponseDto,
  toCustomerContactResponseDto,
} from '../dto/contact-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';

const RESOURCE = 'customer_contacts';

/** Dual nested+flat route convention, mirroring CustomerAddressesController. */
@ApiTags('Customer/Supplier - Customer Contacts')
@Controller()
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CustomerContactsController {
  constructor(
    private readonly contactsService: CustomerContactsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get('customers/:customerId/contacts')
  @RequirePermission('customer_contacts.read')
  async findAllForCustomer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<ContactResponseDto[]> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const contacts = await this.contactsService.findAllForCustomer(
      customerId,
      companyId,
    );
    return contacts.map(toCustomerContactResponseDto);
  }

  @Post('customers/:customerId/contacts')
  @RequirePermission('customer_contacts.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
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
      customerId,
      companyId,
      dto,
    );
    return toCustomerContactResponseDto(contact);
  }

  @Get('customer-contacts/:id')
  @RequirePermission('customer_contacts.read')
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
    return toCustomerContactResponseDto(contact);
  }

  @Patch('customer-contacts/:id')
  @RequirePermission('customer_contacts.update')
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
    return toCustomerContactResponseDto(contact);
  }

  @Delete('customer-contacts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('customer_contacts.delete')
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
