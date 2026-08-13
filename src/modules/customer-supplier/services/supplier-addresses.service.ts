import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupplierAddress } from '../entities/supplier-address.entity';
import { CreateAddressDto } from '../dto/create-address.dto';
import { UpdateAddressDto } from '../dto/update-address.dto';
import { SuppliersService } from './suppliers.service';
import { AddressType } from '../entities/address-type.enum';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';

/** Mirrors CustomerAddressesService exactly — see its docblock. */
@Injectable()
export class SupplierAddressesService {
  constructor(
    @InjectRepository(SupplierAddress)
    private readonly addressRepository: Repository<SupplierAddress>,
    private readonly suppliersService: SuppliersService,
  ) {}

  private async assertSupplierOwned(
    supplierId: string,
    companyId: string,
  ): Promise<void> {
    await this.suppliersService.findByIdInCompany(supplierId, companyId);
  }

  async findAllForSupplier(
    supplierId: string,
    companyId: string,
  ): Promise<SupplierAddress[]> {
    await this.assertSupplierOwned(supplierId, companyId);
    return this.addressRepository.find({
      where: { supplierId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByIdForSupplier(
    id: string,
    supplierId: string,
    companyId: string,
  ): Promise<SupplierAddress> {
    await this.assertSupplierOwned(supplierId, companyId);
    const address = await this.addressRepository.findOne({
      where: { id, supplierId },
    });
    if (!address) {
      throw new AppException(ErrorCode.NotFound, 'Supplier address not found');
    }
    return address;
  }

  async findByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<SupplierAddress> {
    const address = await this.addressRepository.findOne({ where: { id } });
    if (!address) {
      throw new AppException(ErrorCode.NotFound, 'Supplier address not found');
    }
    await this.assertSupplierOwned(address.supplierId, companyId);
    return address;
  }

  async create(
    supplierId: string,
    companyId: string,
    dto: CreateAddressDto,
  ): Promise<SupplierAddress> {
    await this.assertSupplierOwned(supplierId, companyId);

    if (dto.isPrimary) {
      await this.addressRepository.update(
        { supplierId, isPrimary: true },
        { isPrimary: false },
      );
    }

    const address = this.addressRepository.create({
      supplierId,
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
  ): Promise<SupplierAddress> {
    const address = await this.findByIdInCompany(id, companyId);

    if (dto.isPrimary === true && !address.isPrimary) {
      await this.addressRepository.update(
        { supplierId: address.supplierId, isPrimary: true },
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
