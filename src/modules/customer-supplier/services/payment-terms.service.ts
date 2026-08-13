import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { PaymentTerm } from '../entities/payment-term.entity';
import { PaymentTermStatus } from '../entities/payment-term-status.enum';
import { Customer } from '../entities/customer.entity';
import { Supplier } from '../entities/supplier.entity';
import { CreatePaymentTermDto } from '../dto/create-payment-term.dto';
import { UpdatePaymentTermDto } from '../dto/update-payment-term.dto';
import { ListPaymentTermsDto } from '../dto/list-payment-terms.dto';
import { CompaniesService } from '../../organization/services/companies.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';

export interface PaginatedPaymentTerms {
  data: PaymentTerm[];
  meta: { page: number; limit: number; total: number };
}

const SORTABLE_FIELDS = [
  'createdAt',
  'name',
  'code',
  'dueDays',
  'status',
] as const;

/**
 * One shared, configurable PaymentTerm catalog referenced by both Customer
 * and Supplier (Phase 11 §6/§12, LOCKED). Mirrors BrandsService's
 * company-scoped CRUD pattern exactly. `remove()` is blocked (409) while any
 * active Customer or Supplier still references this term — mirrors the
 * Phase 09 Category RESTRICT-on-children precedent (delete-while-referenced
 * must never orphan a foreign key).
 */
@Injectable()
export class PaymentTermsService {
  constructor(
    @InjectRepository(PaymentTerm)
    private readonly paymentTermRepository: Repository<PaymentTerm>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    private readonly companiesService: CompaniesService,
  ) {}

  async findAll(
    companyId: string,
    query: ListPaymentTermsDto,
  ): Promise<PaginatedPaymentTerms> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(
      query.sort,
      SORTABLE_FIELDS,
      'createdAt',
    );

    const qb = this.paymentTermRepository
      .createQueryBuilder('paymentTerm')
      .where('paymentTerm.companyId = :companyId', { companyId });

    if (query.status) {
      qb.andWhere('paymentTerm.status = :status', { status: query.status });
    }
    if (query.search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('paymentTerm.name LIKE :search', {
              search: `%${query.search}%`,
            })
            .orWhere('paymentTerm.code LIKE :search', {
              search: `%${query.search}%`,
            });
        }),
      );
    }

    qb.orderBy(`paymentTerm.${sortField}`, query.order ?? 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(id: string, companyId: string): Promise<PaymentTerm> {
    const paymentTerm = await this.paymentTermRepository.findOne({
      where: { id, companyId },
    });
    if (!paymentTerm) {
      throw new AppException(ErrorCode.NotFound, 'Payment term not found');
    }
    return paymentTerm;
  }

  async create(
    companyId: string,
    dto: CreatePaymentTermDto,
  ): Promise<PaymentTerm> {
    const company = await this.companiesService.findActiveByIdOrNull(companyId);
    if (!company) {
      throw new AppException(
        ErrorCode.ValidationError,
        'companyId does not reference an active company',
      );
    }

    const existing = await this.paymentTermRepository.findOne({
      where: { companyId, code: dto.code },
    });
    if (existing) {
      throw new AppException(
        ErrorCode.Conflict,
        'Payment term code already exists for this company',
      );
    }

    const paymentTerm = this.paymentTermRepository.create({
      companyId,
      code: dto.code,
      name: dto.name,
      description: dto.description ?? null,
      dueDays: dto.dueDays,
      status: PaymentTermStatus.Active,
    });

    return this.paymentTermRepository.save(paymentTerm);
  }

  async update(
    id: string,
    companyId: string,
    dto: UpdatePaymentTermDto,
  ): Promise<PaymentTerm> {
    const paymentTerm = await this.findByIdInCompany(id, companyId);

    if (dto.name !== undefined) paymentTerm.name = dto.name;
    if (dto.description !== undefined)
      paymentTerm.description = dto.description;
    if (dto.dueDays !== undefined) paymentTerm.dueDays = dto.dueDays;

    return this.paymentTermRepository.save(paymentTerm);
  }

  async activate(id: string, companyId: string): Promise<PaymentTerm> {
    const paymentTerm = await this.findByIdInCompany(id, companyId);
    paymentTerm.status = PaymentTermStatus.Active;
    return this.paymentTermRepository.save(paymentTerm);
  }

  async deactivate(id: string, companyId: string): Promise<PaymentTerm> {
    const paymentTerm = await this.findByIdInCompany(id, companyId);
    paymentTerm.status = PaymentTermStatus.Inactive;
    return this.paymentTermRepository.save(paymentTerm);
  }

  /** Soft delete, blocked (409) while any Customer or Supplier still references this term. */
  async remove(id: string, companyId: string): Promise<void> {
    const paymentTerm = await this.findByIdInCompany(id, companyId);

    const [customerCount, supplierCount] = await Promise.all([
      this.customerRepository.count({ where: { paymentTermId: id } }),
      this.supplierRepository.count({ where: { paymentTermId: id } }),
    ]);
    if (customerCount > 0 || supplierCount > 0) {
      throw new AppException(
        ErrorCode.Conflict,
        'Payment term is still referenced by a customer or supplier and cannot be deleted',
      );
    }

    await this.paymentTermRepository.softRemove(paymentTerm);
  }
}
