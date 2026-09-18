import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Customer } from '../entities/customer.entity';
import { CustomerStatus } from '../entities/customer-status.enum';
import { CustomerGroupStatus } from '../entities/customer-group-status.enum';
import { PaymentTermStatus } from '../entities/payment-term-status.enum';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { UpdateCustomerDto } from '../dto/update-customer.dto';
import { ListCustomersDto } from '../dto/list-customers.dto';
import { CompaniesService } from '../../organization/services/companies.service';
import { BranchesService } from '../../organization/services/branches.service';
import { CustomerGroupsService } from './customer-groups.service';
import { PaymentTermsService } from './payment-terms.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';

import { CustomerNote } from '../entities/customer-note.entity';
import { Sale } from '../../sales/entities/sale.entity';

export interface PaginatedCustomers {
  data: Customer[];
  meta: { page: number; limit: number; total: number };
}

const SORTABLE_FIELDS = [
  'createdAt',
  'name',
  'customerCode',
  'status',
] as const;

/**
 * Customer as an independently modeled entity (Phase 11 locked decision §1).
 * Company-scoped as the primary tenancy key; branchId is optional and, when
 * supplied, is validated to belong to the same company — the exact
 * Warehouse/Employee cross-company integrity rule from Phase 07/08 (never
 * relies on a composite FK to express "these two FK targets must agree").
 * creditLimit/creditDays/openingBalanceAmount/receivableAccountId are
 * validated as configured master data only — no live balance calculation,
 * no ledger writes exist anywhere in this service (Phase 11 locked
 * decision §7/§8/§9).
 */
@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    private readonly companiesService: CompaniesService,
    private readonly branchesService: BranchesService,
    private readonly customerGroupsService: CustomerGroupsService,
    private readonly paymentTermsService: PaymentTermsService,
    @InjectRepository(CustomerNote)
    private readonly customerNoteRepository?: Repository<CustomerNote>,
    @InjectRepository(Sale)
    private readonly saleRepository?: Repository<Sale>,
  ) {}

  async findAll(
    companyId: string,
    query: ListCustomersDto,
  ): Promise<PaginatedCustomers> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(
      query.sort,
      SORTABLE_FIELDS,
      'createdAt',
    );

    const qb = this.customerRepository
      .createQueryBuilder('customer')
      .where('customer.companyId = :companyId', { companyId });

    if (query.branchId) {
      qb.andWhere('customer.branchId = :branchId', {
        branchId: query.branchId,
      });
    }
    if (query.customerGroupId) {
      qb.andWhere('customer.customerGroupId = :customerGroupId', {
        customerGroupId: query.customerGroupId,
      });
    }
    if (query.status) {
      qb.andWhere('customer.status = :status', { status: query.status });
    }
    if (query.search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('customer.name LIKE :search', {
              search: `%${query.search}%`,
            })
            .orWhere('customer.customerCode LIKE :search', {
              search: `%${query.search}%`,
            })
            .orWhere('customer.phone LIKE :search', {
              search: `%${query.search}%`,
            })
            .orWhere('customer.email LIKE :search', {
              search: `%${query.search}%`,
            });
        }),
      );
    }

    qb.orderBy(`customer.${sortField}`, query.order ?? 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(id: string, companyId: string): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: { id, companyId },
    });
    if (!customer) {
      throw new AppException(ErrorCode.NotFound, 'Customer not found');
    }
    return customer;
  }

  /**
   * Used by CustomerPortalService to find-or-create a Customer for a
   * newly-verified Telegram phone number. Returns the active customer for
   * that phone only — a soft-deleted/inactive match is never silently
   * reused (the caller's find-or-create then correctly creates a fresh
   * customer instead).
   */
  async findActiveByPhone(
    companyId: string,
    phone: string,
  ): Promise<Customer | null> {
    return this.customerRepository.findOne({
      where: { companyId, phone, status: CustomerStatus.Active },
    });
  }

  private async assertValidBranch(
    branchId: string,
    companyId: string,
  ): Promise<void> {
    const branch = await this.branchesService.findActiveByIdOrNull(branchId);
    if (!branch) {
      throw new AppException(
        ErrorCode.ValidationError,
        'branchId does not reference an active branch',
      );
    }
    if (branch.companyId !== companyId) {
      throw new AppException(
        ErrorCode.ValidationError,
        'branchId does not belong to the resolved company',
      );
    }
  }

  private async assertValidCustomerGroup(
    customerGroupId: string,
    companyId: string,
  ): Promise<void> {
    const group = await this.customerGroupsService.findByIdInCompany(
      customerGroupId,
      companyId,
    );
    if (group.status !== CustomerGroupStatus.Active) {
      throw new AppException(
        ErrorCode.ValidationError,
        'customerGroupId must reference an active customer group',
      );
    }
  }

  private async assertValidPaymentTerm(
    paymentTermId: string,
    companyId: string,
  ): Promise<void> {
    const term = await this.paymentTermsService.findByIdInCompany(
      paymentTermId,
      companyId,
    );
    if (term.status !== PaymentTermStatus.Active) {
      throw new AppException(
        ErrorCode.ValidationError,
        'paymentTermId must reference an active payment term',
      );
    }
  }

  async create(companyId: string, dto: CreateCustomerDto): Promise<Customer> {
    const company = await this.companiesService.findActiveByIdOrNull(companyId);
    if (!company) {
      throw new AppException(
        ErrorCode.ValidationError,
        'companyId does not reference an active company',
      );
    }

    if (dto.branchId) {
      await this.assertValidBranch(dto.branchId, companyId);
    }
    if (dto.customerGroupId) {
      await this.assertValidCustomerGroup(dto.customerGroupId, companyId);
    }
    if (dto.paymentTermId) {
      await this.assertValidPaymentTerm(dto.paymentTermId, companyId);
    }

    const existing = await this.customerRepository.findOne({
      where: { companyId, customerCode: dto.customerCode },
    });
    if (existing) {
      throw new AppException(
        ErrorCode.Conflict,
        'Customer code already exists for this company',
      );
    }

    const customer = this.customerRepository.create({
      companyId,
      branchId: dto.branchId ?? null,
      customerCode: dto.customerCode,
      name: dto.name,
      displayName: dto.displayName ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      customerGroupId: dto.customerGroupId ?? null,
      paymentTermId: dto.paymentTermId ?? null,
      creditLimit: dto.creditLimit ?? '0.00',
      creditDays: dto.creditDays ?? 0,
      openingBalanceAmount: dto.openingBalanceAmount ?? '0.00',
      receivableAccountId: dto.receivableAccountId ?? null,
      status: CustomerStatus.Active,
      notes: dto.notes ?? null,
    });

    return this.customerRepository.save(customer);
  }

  async update(
    id: string,
    companyId: string,
    dto: UpdateCustomerDto,
  ): Promise<Customer> {
    const customer = await this.findByIdInCompany(id, companyId);

    if (dto.customerGroupId !== undefined) {
      if (dto.customerGroupId !== null) {
        await this.assertValidCustomerGroup(dto.customerGroupId, companyId);
      }
      customer.customerGroupId = dto.customerGroupId;
    }
    if (dto.paymentTermId !== undefined) {
      if (dto.paymentTermId !== null) {
        await this.assertValidPaymentTerm(dto.paymentTermId, companyId);
      }
      customer.paymentTermId = dto.paymentTermId;
    }
    if (dto.name !== undefined) customer.name = dto.name;
    if (dto.displayName !== undefined) customer.displayName = dto.displayName;
    if (dto.phone !== undefined) customer.phone = dto.phone;
    if (dto.email !== undefined) customer.email = dto.email;
    if (dto.creditLimit !== undefined) customer.creditLimit = dto.creditLimit;
    if (dto.creditDays !== undefined) customer.creditDays = dto.creditDays;
    if (dto.openingBalanceAmount !== undefined) {
      customer.openingBalanceAmount = dto.openingBalanceAmount;
    }
    if (dto.receivableAccountId !== undefined) {
      customer.receivableAccountId = dto.receivableAccountId;
    }
    if (dto.notes !== undefined) customer.notes = dto.notes;

    return this.customerRepository.save(customer);
  }

  async activate(id: string, companyId: string): Promise<Customer> {
    const customer = await this.findByIdInCompany(id, companyId);
    customer.status = CustomerStatus.Active;
    return this.customerRepository.save(customer);
  }

  async deactivate(id: string, companyId: string): Promise<Customer> {
    const customer = await this.findByIdInCompany(id, companyId);
    customer.status = CustomerStatus.Inactive;
    return this.customerRepository.save(customer);
  }

  async block(id: string, companyId: string): Promise<Customer> {
    const customer = await this.findByIdInCompany(id, companyId);
    customer.status = CustomerStatus.Blocked;
    return this.customerRepository.save(customer);
  }

  /** Soft delete only — preserves historical integrity for future Sales references (Phase 11 §34). */
  async remove(id: string, companyId: string): Promise<void> {
    const customer = await this.findByIdInCompany(id, companyId);
    await this.customerRepository.softRemove(customer);
  }

  async getAnalytics(id: string, companyId: string) {
    await this.findByIdInCompany(id, companyId);

    if (!this.saleRepository) {
      return {
        customerId: id,
        totalPurchase: 0,
        totalOrders: 0,
        averageOrderValue: 0,
        lastPurchaseDate: null,
        favoriteCategories: [],
        favoriteBrands: [],
        rfmSegment: 'New',
      };
    }

    const sales = await this.saleRepository
      .createQueryBuilder('s')
      .where('s.customerId = :customerId', { customerId: id })
      .andWhere('s.companyId = :companyId', { companyId })
      .andWhere('s.status = :status', { status: 'CONFIRMED' })
      .andWhere('s.deletedAt IS NULL')
      .orderBy('s.createdAt', 'DESC')
      .getMany();

    const totalOrders = sales.length;
    let totalPurchase = 0;
    for (const s of sales) {
      totalPurchase += parseFloat(s.grandTotal || '0');
    }
    const averageOrderValue =
      totalOrders > 0 ? Math.round(totalPurchase / totalOrders) : 0;
    const lastPurchaseDate =
      sales.length > 0 ? sales[0].createdAt.toISOString() : null;

    let favoriteCategories: string[] = [];
    let favoriteBrands: string[] = [];

    if (totalOrders > 0) {
      const topCats = await this.saleRepository.query(
        `SELECT c.name as name, COUNT(*) as cnt
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         JOIN product_variants pv ON pv.id = si.product_variant_id
         JOIN products p ON p.id = pv.product_id
         JOIN categories c ON c.id = p.category_id
         WHERE s.customer_id = ? AND s.company_id = ? AND s.status = 'CONFIRMED' AND s.deleted_at IS NULL
         GROUP BY c.id, c.name
         ORDER BY cnt DESC
         LIMIT 3`,
        [id, companyId],
      );
      favoriteCategories = topCats.map((r: { name: string }) => r.name);

      const topBrands = await this.saleRepository.query(
        `SELECT b.name as name, COUNT(*) as cnt
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         JOIN product_variants pv ON pv.id = si.product_variant_id
         JOIN products p ON p.id = pv.product_id
         JOIN brands b ON b.id = p.brand_id
         WHERE s.customer_id = ? AND s.company_id = ? AND s.status = 'CONFIRMED' AND s.deleted_at IS NULL
         GROUP BY b.id, b.name
         ORDER BY cnt DESC
         LIMIT 3`,
        [id, companyId],
      );
      favoriteBrands = topBrands.map((r: { name: string }) => r.name);
    }

    let rfmSegment = 'New';
    if (totalOrders > 0 && sales[0].createdAt) {
      const daysSinceLast = Math.floor(
        (Date.now() - sales[0].createdAt.getTime()) / (1000 * 3600 * 24),
      );
      if (daysSinceLast <= 30 && totalPurchase >= 200000) {
        rfmSegment = 'VIP';
      } else if (daysSinceLast <= 60 && totalOrders >= 3) {
        rfmSegment = 'Loyal';
      } else if (daysSinceLast <= 90) {
        rfmSegment = 'Active';
      } else if (daysSinceLast <= 180) {
        rfmSegment = 'At-Risk';
      } else {
        rfmSegment = 'Lost';
      }
    }

    return {
      customerId: id,
      totalPurchase,
      totalOrders,
      averageOrderValue,
      lastPurchaseDate,
      favoriteCategories,
      favoriteBrands,
      rfmSegment,
    };
  }

  async getNotes(customerId: string, companyId: string) {
    await this.findByIdInCompany(customerId, companyId);
    if (!this.customerNoteRepository) return [];
    return this.customerNoteRepository.find({
      where: { customerId, companyId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async createNote(
    customerId: string,
    companyId: string,
    userId: string,
    dto: { content: string; noteType?: string },
  ) {
    await this.findByIdInCompany(customerId, companyId);
    if (!dto.content || !dto.content.trim()) {
      throw new AppException(ErrorCode.ValidationError, 'Content is required');
    }
    if (!this.customerNoteRepository) {
      throw new AppException(ErrorCode.InternalError, 'Note repository not available');
    }
    const note = this.customerNoteRepository.create({
      companyId,
      customerId,
      userId,
      content: dto.content.trim(),
      noteType: dto.noteType?.trim() || 'NOTE',
    });
    return this.customerNoteRepository.save(note);
  }
}
