import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupplierContact } from '../entities/supplier-contact.entity';
import { CreateContactDto } from '../dto/create-contact.dto';
import { UpdateContactDto } from '../dto/update-contact.dto';
import { SuppliersService } from './suppliers.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';

/** Mirrors CustomerContactsService exactly — see its docblock. */
@Injectable()
export class SupplierContactsService {
  constructor(
    @InjectRepository(SupplierContact)
    private readonly contactRepository: Repository<SupplierContact>,
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
  ): Promise<SupplierContact[]> {
    await this.assertSupplierOwned(supplierId, companyId);
    return this.contactRepository.find({
      where: { supplierId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<SupplierContact> {
    const contact = await this.contactRepository.findOne({ where: { id } });
    if (!contact) {
      throw new AppException(ErrorCode.NotFound, 'Supplier contact not found');
    }
    await this.assertSupplierOwned(contact.supplierId, companyId);
    return contact;
  }

  async create(
    supplierId: string,
    companyId: string,
    dto: CreateContactDto,
  ): Promise<SupplierContact> {
    await this.assertSupplierOwned(supplierId, companyId);

    if (dto.isPrimary) {
      await this.contactRepository.update(
        { supplierId, isPrimary: true },
        { isPrimary: false },
      );
    }

    const contact = this.contactRepository.create({
      supplierId,
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
  ): Promise<SupplierContact> {
    const contact = await this.findByIdInCompany(id, companyId);

    if (dto.isPrimary === true && !contact.isPrimary) {
      await this.contactRepository.update(
        { supplierId: contact.supplierId, isPrimary: true },
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
