import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Supplier } from '../entities/supplier.entity';
import { SupplierStatus } from '../entities/supplier-status.enum';
import { SupplierGroupStatus } from '../entities/supplier-group-status.enum';
import { PaymentTermStatus } from '../entities/payment-term-status.enum';
import { CreateSupplierDto } from '../dto/create-supplier.dto';
import { UpdateSupplierDto } from '../dto/update-supplier.dto';
import { ListSuppliersDto } from '../dto/list-suppliers.dto';
import { CompaniesService } from '../../organization/services/companies.service';
import { BranchesService } from '../../organization/services/branches.service';
import { SupplierGroupsService } from './supplier-groups.service';
import { PaymentTermsService } from './payment-terms.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';
import { PurchaseOrder } from '../../purchase/entities/purchase-order.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { GoodsReceipt } from '../../inventory/entities/goods-receipt.entity';

export interface PaginatedSuppliers {
  data: Supplier[];
  meta: { page: number; limit: number; total: number };
}

const SORTABLE_FIELDS = [
  'createdAt',
  'name',
  'supplierCode',
  'status',
] as const;

/** Mirrors CustomersService exactly (Phase 11 locked decision §1) — see its docblock. */
@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(GoodsReceipt)
    private readonly goodsReceiptRepository: Repository<GoodsReceipt>,
    private readonly companiesService: CompaniesService,
    private readonly branchesService: BranchesService,
    private readonly supplierGroupsService: SupplierGroupsService,
    private readonly paymentTermsService: PaymentTermsService,
  ) {}

  async findAll(
    companyId: string,
    query: ListSuppliersDto,
  ): Promise<PaginatedSuppliers> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(
      query.sort,
      SORTABLE_FIELDS,
      'createdAt',
    );

    const qb = this.supplierRepository
      .createQueryBuilder('supplier')
      .where('supplier.companyId = :companyId', { companyId });

    if (query.branchId) {
      qb.andWhere('supplier.branchId = :branchId', {
        branchId: query.branchId,
      });
    }
    if (query.supplierGroupId) {
      qb.andWhere('supplier.supplierGroupId = :supplierGroupId', {
        supplierGroupId: query.supplierGroupId,
      });
    }
    if (query.status) {
      qb.andWhere('supplier.status = :status', { status: query.status });
    }
    if (query.search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('supplier.name LIKE :search', {
              search: `%${query.search}%`,
            })
            .orWhere('supplier.supplierCode LIKE :search', {
              search: `%${query.search}%`,
            })
            .orWhere('supplier.phone LIKE :search', {
              search: `%${query.search}%`,
            })
            .orWhere('supplier.email LIKE :search', {
              search: `%${query.search}%`,
            });
        }),
      );
    }

    qb.orderBy(`supplier.${sortField}`, query.order ?? 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(id: string, companyId: string): Promise<Supplier> {
    const supplier = await this.supplierRepository.findOne({
      where: { id, companyId },
    });
    if (!supplier) {
      throw new AppException(ErrorCode.NotFound, 'Supplier not found');
    }
    return supplier;
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

  private async assertValidSupplierGroup(
    supplierGroupId: string,
    companyId: string,
  ): Promise<void> {
    const group = await this.supplierGroupsService.findByIdInCompany(
      supplierGroupId,
      companyId,
    );
    if (group.status !== SupplierGroupStatus.Active) {
      throw new AppException(
        ErrorCode.ValidationError,
        'supplierGroupId must reference an active supplier group',
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

  async create(companyId: string, dto: CreateSupplierDto): Promise<Supplier> {
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
    if (dto.supplierGroupId) {
      await this.assertValidSupplierGroup(dto.supplierGroupId, companyId);
    }
    if (dto.paymentTermId) {
      await this.assertValidPaymentTerm(dto.paymentTermId, companyId);
    }

    const existing = await this.supplierRepository.findOne({
      where: { companyId, supplierCode: dto.supplierCode },
    });
    if (existing) {
      throw new AppException(
        ErrorCode.Conflict,
        'Supplier code already exists for this company',
      );
    }

    const supplier = this.supplierRepository.create({
      companyId,
      branchId: dto.branchId ?? null,
      supplierCode: dto.supplierCode,
      name: dto.name,
      displayName: dto.displayName ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      country: dto.country ?? null,
      supplierGroupId: dto.supplierGroupId ?? null,
      paymentTermId: dto.paymentTermId ?? null,
      creditDays: dto.creditDays ?? 0,
      openingBalanceAmount: dto.openingBalanceAmount ?? '0.00',
      payableAccountId: dto.payableAccountId ?? null,
      status: SupplierStatus.Active,
      notes: dto.notes ?? null,
    });

    return this.supplierRepository.save(supplier);
  }

  async update(
    id: string,
    companyId: string,
    dto: UpdateSupplierDto,
  ): Promise<Supplier> {
    const supplier = await this.findByIdInCompany(id, companyId);

    if (dto.supplierGroupId !== undefined) {
      if (dto.supplierGroupId !== null) {
        await this.assertValidSupplierGroup(dto.supplierGroupId, companyId);
      }
      supplier.supplierGroupId = dto.supplierGroupId;
    }
    if (dto.paymentTermId !== undefined) {
      if (dto.paymentTermId !== null) {
        await this.assertValidPaymentTerm(dto.paymentTermId, companyId);
      }
      supplier.paymentTermId = dto.paymentTermId;
    }
    if (dto.name !== undefined) supplier.name = dto.name;
    if (dto.displayName !== undefined) supplier.displayName = dto.displayName;
    if (dto.phone !== undefined) supplier.phone = dto.phone;
    if (dto.email !== undefined) supplier.email = dto.email;
    if (dto.country !== undefined) supplier.country = dto.country;
    if (dto.creditDays !== undefined) supplier.creditDays = dto.creditDays;
    if (dto.openingBalanceAmount !== undefined) {
      supplier.openingBalanceAmount = dto.openingBalanceAmount;
    }
    if (dto.payableAccountId !== undefined) {
      supplier.payableAccountId = dto.payableAccountId;
    }
    if (dto.notes !== undefined) supplier.notes = dto.notes;

    return this.supplierRepository.save(supplier);
  }

  async activate(id: string, companyId: string): Promise<Supplier> {
    const supplier = await this.findByIdInCompany(id, companyId);
    supplier.status = SupplierStatus.Active;
    return this.supplierRepository.save(supplier);
  }

  async deactivate(id: string, companyId: string): Promise<Supplier> {
    const supplier = await this.findByIdInCompany(id, companyId);
    supplier.status = SupplierStatus.Inactive;
    return this.supplierRepository.save(supplier);
  }

  async block(id: string, companyId: string): Promise<Supplier> {
    const supplier = await this.findByIdInCompany(id, companyId);
    supplier.status = SupplierStatus.Blocked;
    return this.supplierRepository.save(supplier);
  }

  private async assertNoHistoricalReferences(
    supplierId: string,
    companyId: string,
  ): Promise<void> {
    const [purchaseOrderCount, paymentCount, goodsReceiptCount] =
      await Promise.all([
        this.purchaseOrderRepository.count({
          where: { supplierId, companyId },
        }),
        this.paymentRepository.count({
          where: { supplierId, companyId },
        }),
        this.goodsReceiptRepository.count({
          where: { supplierId, companyId },
        }),
      ]);

    if (purchaseOrderCount || paymentCount || goodsReceiptCount) {
      throw new AppException(
        ErrorCode.Conflict,
        'This supplier already has purchase history and cannot be deleted. Set it inactive or blocked instead.',
      );
    }
  }

  /** Soft delete only — preserves historical integrity for future Purchase references (Phase 11 §34). */
  async remove(id: string, companyId: string): Promise<void> {
    const supplier = await this.findByIdInCompany(id, companyId);
    await this.assertNoHistoricalReferences(id, companyId);
    await this.supplierRepository.softRemove(supplier);
  }
}
