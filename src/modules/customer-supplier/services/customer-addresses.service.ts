import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerAddress } from '../entities/customer-address.entity';
import { CreateAddressDto } from '../dto/create-address.dto';
import { UpdateAddressDto } from '../dto/update-address.dto';
import { CustomersService } from './customers.service';
import { AddressType } from '../entities/address-type.enum';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';

/**
 * Addresses owned by a Customer (Phase 11 locked decision §2 — separate
 * table, NOT PartyAddress). Every method requires the resolved companyId
 * and re-verifies the owning Customer exists within it via
 * CustomersService.findByIdInCompany() — never trusts a client-supplied
 * customerId without that check (IDOR-safe: a cross-company or
 * nonexistent customerId surfaces as 404, matching the Phase 09/10
 * "never leak existence" convention). `isPrimary` is a single-primary-per-
 * customer invariant enforced here at the service layer (MySQL cannot
 * express a partial/filtered unique index) — setting a new primary
 * atomically un-sets any previous one for the same customer.
 */
@Injectable()
export class CustomerAddressesService {
  constructor(
    @InjectRepository(CustomerAddress)
    private readonly addressRepository: Repository<CustomerAddress>,
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
  ): Promise<CustomerAddress[]> {
    await this.assertCustomerOwned(customerId, companyId);
    return this.addressRepository.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByIdForCustomer(
    id: string,
    customerId: string,
    companyId: string,
  ): Promise<CustomerAddress> {
    await this.assertCustomerOwned(customerId, companyId);
    const address = await this.addressRepository.findOne({
      where: { id, customerId },
    });
    if (!address) {
      throw new AppException(ErrorCode.NotFound, 'Customer address not found');
    }
    return address;
  }

  /** Flat-route lookup by address id alone, still company-scoped via the owning customer. */
  async findByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<CustomerAddress> {
    const address = await this.addressRepository.findOne({ where: { id } });
    if (!address) {
      throw new AppException(ErrorCode.NotFound, 'Customer address not found');
    }
    await this.assertCustomerOwned(address.customerId, companyId);
    return address;
  }

  async create(
    customerId: string,
    companyId: string,
    dto: CreateAddressDto,
  ): Promise<CustomerAddress> {
    await this.assertCustomerOwned(customerId, companyId);

    if (dto.isPrimary) {
      await this.addressRepository.update(
        { customerId, isPrimary: true },
        { isPrimary: false },
      );
    }

    const address = this.addressRepository.create({
      customerId,
      label: dto.label ?? AddressType.Other,
      recipientName: dto.recipientName ?? null,
      addressLine1: dto.addressLine1,
      addressLine2: dto.addressLine2 ?? null,
      city: dto.city ?? null,
      state: dto.state ?? null,
      postalCode: dto.postalCode ?? null,
      country: dto.country ?? null,
      phone: dto.phone ?? null,
      isPrimary: dto.isPrimary ?? false,
    });

    return this.addressRepository.save(address);
  }

  async update(
    id: string,
    companyId: string,
    dto: UpdateAddressDto,
  ): Promise<CustomerAddress> {
    const address = await this.findByIdInCompany(id, companyId);

    if (dto.isPrimary === true && !address.isPrimary) {
      await this.addressRepository.update(
        { customerId: address.customerId, isPrimary: true },
        { isPrimary: false },
      );
    }

    if (dto.label !== undefined) address.label = dto.label;
    if (dto.recipientName !== undefined)
      address.recipientName = dto.recipientName;
    if (dto.addressLine1 !== undefined) address.addressLine1 = dto.addressLine1;
    if (dto.addressLine2 !== undefined) address.addressLine2 = dto.addressLine2;
    if (dto.city !== undefined) address.city = dto.city;
    if (dto.state !== undefined) address.state = dto.state;
    if (dto.postalCode !== undefined) address.postalCode = dto.postalCode;
    if (dto.country !== undefined) address.country = dto.country;
    if (dto.phone !== undefined) address.phone = dto.phone;
    if (dto.isPrimary !== undefined) address.isPrimary = dto.isPrimary;

    return this.addressRepository.save(address);
  }

  async remove(id: string, companyId: string): Promise<void> {
    const address = await this.findByIdInCompany(id, companyId);
    await this.addressRepository.softRemove(address);
  }
}
