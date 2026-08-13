import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerContact } from '../entities/customer-contact.entity';
import { CreateContactDto } from '../dto/create-contact.dto';
import { UpdateContactDto } from '../dto/update-contact.dto';
import { CustomersService } from './customers.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';

/**
 * Contacts owned by a Customer (Phase 11 locked decision §3 — separate
 * table, NOT PartyContact). Ownership/company-scope enforcement mirrors
 * CustomerAddressesService exactly (see its docblock).
 */
@Injectable()
export class CustomerContactsService {
  constructor(
    @InjectRepository(CustomerContact)
    private readonly contactRepository: Repository<CustomerContact>,
    private readonly customersService: CustomersService,
  ) {}

  private async assertCustomerOwned(
    customerId: string,
    companyId: string,
  ): Promise<void> {
    await this.customersService.findByIdInCompany(customerId, companyId);
  }

  async findAllForCustomer(
    customerId: string,
    companyId: string,
  ): Promise<CustomerContact[]> {
    await this.assertCustomerOwned(customerId, companyId);
    return this.contactRepository.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<CustomerContact> {
    const contact = await this.contactRepository.findOne({ where: { id } });
    if (!contact) {
      throw new AppException(ErrorCode.NotFound, 'Customer contact not found');
    }
    await this.assertCustomerOwned(contact.customerId, companyId);
    return contact;
  }

  async create(
    customerId: string,
    companyId: string,
    dto: CreateContactDto,
  ): Promise<CustomerContact> {
    await this.assertCustomerOwned(customerId, companyId);

    if (dto.isPrimary) {
      await this.contactRepository.update(
        { customerId, isPrimary: true },
        { isPrimary: false },
      );
    }

    const contact = this.contactRepository.create({
      customerId,
      name: dto.name,
      jobTitle: dto.jobTitle ?? null,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      mobile: dto.mobile ?? null,
      isPrimary: dto.isPrimary ?? false,
    });

    return this.contactRepository.save(contact);
  }

  async update(
    id: string,
    companyId: string,
    dto: UpdateContactDto,
  ): Promise<CustomerContact> {
    const contact = await this.findByIdInCompany(id, companyId);

    if (dto.isPrimary === true && !contact.isPrimary) {
      await this.contactRepository.update(
        { customerId: contact.customerId, isPrimary: true },
        { isPrimary: false },
      );
    }

    if (dto.name !== undefined) contact.name = dto.name;
    if (dto.jobTitle !== undefined) contact.jobTitle = dto.jobTitle;
    if (dto.email !== undefined) contact.email = dto.email;
    if (dto.phone !== undefined) contact.phone = dto.phone;
    if (dto.mobile !== undefined) contact.mobile = dto.mobile;
    if (dto.isPrimary !== undefined) contact.isPrimary = dto.isPrimary;

    return this.contactRepository.save(contact);
  }

  async remove(id: string, companyId: string): Promise<void> {
    const contact = await this.findByIdInCompany(id, companyId);
    await this.contactRepository.softRemove(contact);
  }
}
