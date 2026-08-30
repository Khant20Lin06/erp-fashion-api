import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { EntityManager, Repository } from 'typeorm';
import { SupplierQuotation } from '../entities/supplier-quotation.entity';
import { SupplierQuotationItem } from '../entities/supplier-quotation-item.entity';
import { CompanySupplierQuotationCounter } from '../entities/company-supplier-quotation-counter.entity';
import { PurchaseRfq } from '../entities/purchase-rfq.entity';
import { CreateSupplierQuotationDto } from '../dto/create-supplier-quotation.dto';
import { ListSupplierQuotationsDto } from '../dto/list-supplier-quotations.dto';
import { SupplierQuotationStatus } from '../entities/supplier-quotation-status.enum';
import { PurchaseRfqStatus } from '../entities/purchase-rfq-status.enum';
import { CompaniesService } from '../../organization/services/companies.service';
import { SuppliersService } from '../../customer-supplier/services/suppliers.service';
import { PaymentTermsService } from '../../customer-supplier/services/payment-terms.service';
import { PaymentTermStatus } from '../../customer-supplier/entities/payment-term-status.enum';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { formatSupplierQuotationNumber } from '../utils/supplier-quotation-number';

export interface PaginatedSupplierQuotations {
  data: SupplierQuotation[];
  meta: { page: number; limit: number; total: number };
}

const ALLOWED_TRANSITIONS: Record<
  SupplierQuotationStatus,
  SupplierQuotationStatus[]
> = {
  [SupplierQuotationStatus.Submitted]: [
    SupplierQuotationStatus.Awarded,
    SupplierQuotationStatus.Rejected,
  ],
  [SupplierQuotationStatus.Awarded]: [],
  [SupplierQuotationStatus.Rejected]: [],
};

@Injectable()
export class SupplierQuotationsService {
  constructor(
    @InjectRepository(SupplierQuotation)
    private readonly supplierQuotationRepository: Repository<SupplierQuotation>,
    @InjectRepository(PurchaseRfq)
    private readonly purchaseRfqRepository: Repository<PurchaseRfq>,
    private readonly companiesService: CompaniesService,
    private readonly suppliersService: SuppliersService,
    private readonly paymentTermsService: PaymentTermsService,
    private readonly transactionService: TransactionService,
  ) {}

  async findAll(
    companyId: string,
    query: ListSupplierQuotationsDto,
  ): Promise<PaginatedSupplierQuotations> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const qb = this.supplierQuotationRepository
      .createQueryBuilder('quotation')
      .leftJoinAndSelect('quotation.items', 'items')
      .leftJoinAndSelect('quotation.purchaseRfq', 'purchaseRfq')
      .where('quotation.companyId = :companyId', { companyId });

    if (query.purchaseRfqId) {
      qb.andWhere('quotation.purchaseRfqId = :purchaseRfqId', {
        purchaseRfqId: query.purchaseRfqId,
      });
    }
    if (query.supplierId) {
      qb.andWhere('quotation.supplierId = :supplierId', {
        supplierId: query.supplierId,
      });
    }
    if (query.status) {
      qb.andWhere('quotation.status = :status', { status: query.status });
    }

    qb.orderBy('quotation.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<SupplierQuotation> {
    const entity = await this.supplierQuotationRepository.findOne({
      where: { id, companyId },
      relations: { items: true, purchaseRfq: true },
    });
    if (!entity) {
      throw new AppException(
        ErrorCode.NotFound,
        'Supplier quotation not found',
      );
    }
    return entity;
  }

  async findAwardedByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<SupplierQuotation> {
    const quotation = await this.findByIdInCompany(id, companyId);
    if (quotation.status !== SupplierQuotationStatus.Awarded) {
      throw new AppException(
        ErrorCode.ValidationError,
        'sourceSupplierQuotationId must reference an awarded quotation',
      );
    }
    return quotation;
  }

  private async generateQuotationNumber(
    companyId: string,
    year: number,
    manager: EntityManager,
  ): Promise<string> {
    await manager.query(
      'INSERT INTO `company_supplier_quotation_counters` (`id`, `company_id`, `year`, `last_sequence`) ' +
        'VALUES (?, ?, ?, 0) ' +
        'ON DUPLICATE KEY UPDATE `last_sequence` = `last_sequence`',
      [randomUUID(), companyId, year],
    );

    const counter = await manager
      .createQueryBuilder(CompanySupplierQuotationCounter, 'counter')
      .where('counter.companyId = :companyId', { companyId })
      .andWhere('counter.year = :year', { year })
      .setLock('pessimistic_write')
      .getOneOrFail();

    const nextSequence = counter.lastSequence + 1;
    await manager.update(CompanySupplierQuotationCounter, counter.id, {
      lastSequence: nextSequence,
    });
    return formatSupplierQuotationNumber(year, nextSequence);
  }

  async create(
    companyId: string,
    userId: string,
    dto: CreateSupplierQuotationDto,
  ): Promise<SupplierQuotation> {
    const company = await this.companiesService.findActiveByIdOrNull(companyId);
    if (!company) {
      throw new AppException(
        ErrorCode.ValidationError,
        'companyId does not reference an active company',
      );
    }

    const supplier = await this.suppliersService.findByIdInCompany(
      dto.supplierId,
      companyId,
    );
    const rfq = await this.purchaseRfqRepository.findOne({
      where: { id: dto.purchaseRfqId, companyId },
      relations: { items: true },
    });
    if (!rfq) {
      throw new AppException(ErrorCode.NotFound, 'Purchase RFQ not found');
    }
    if (
      rfq.status === PurchaseRfqStatus.Cancelled ||
      rfq.status === PurchaseRfqStatus.Closed
    ) {
      throw new AppException(
        ErrorCode.Conflict,
        'Cannot submit a quotation for a closed or cancelled RFQ',
      );
    }
    if (
      Array.isArray(rfq.invitedSupplierIds) &&
      rfq.invitedSupplierIds.length > 0 &&
      !rfq.invitedSupplierIds.includes(supplier.id)
    ) {
      throw new AppException(
        ErrorCode.ValidationError,
        'supplierId is not invited on this RFQ',
      );
    }
    if (dto.paymentTermId) {
      const term = await this.paymentTermsService.findByIdInCompany(
        dto.paymentTermId,
        companyId,
      );
      if (term.status !== PaymentTermStatus.Active) {
        throw new AppException(
          ErrorCode.ValidationError,
          'paymentTermId must reference an active payment term',
        );
      }
    }

    const existing = await this.supplierQuotationRepository.findOne({
      where: {
        companyId,
        purchaseRfqId: dto.purchaseRfqId,
        supplierId: dto.supplierId,
      },
    });
    if (existing) {
      throw new AppException(
        ErrorCode.Conflict,
        'This supplier already has a quotation for the selected RFQ',
      );
    }

    const rfqItemsById = new Map((rfq.items ?? []).map((item) => [item.id, item]));
    for (const item of dto.items) {
      if (!rfqItemsById.has(item.purchaseRfqItemId)) {
        throw new AppException(
          ErrorCode.ValidationError,
          `purchaseRfqItemId ${item.purchaseRfqItemId} does not belong to the selected RFQ`,
        );
      }
    }
    if (dto.items.length !== rfqItemsById.size) {
      throw new AppException(
        ErrorCode.ValidationError,
        'A quotation must price every RFQ line item exactly once',
      );
    }

    const year = new Date().getUTCFullYear();

    return this.transactionService.run(async (manager) => {
      const quotationNumber = await this.generateQuotationNumber(
        companyId,
        year,
        manager,
      );

      let subtotal = 0;
      let discountTotal = 0;
      let taxTotal = 0;

      const rows = dto.items.map((item) => {
        const rfqItem = rfqItemsById.get(item.purchaseRfqItemId)!;
        const unitCost = Number(item.unitCost);
        const discount = Number(item.discountAmount ?? '0');
        const tax = Number(item.taxAmount ?? '0');
        if (unitCost < 0 || discount < 0 || tax < 0) {
          throw new AppException(
            ErrorCode.ValidationError,
            'unitCost, discountAmount, and taxAmount must be non-negative',
          );
        }

        const lineSubtotal = unitCost * rfqItem.quantity;
        if (discount > lineSubtotal) {
          throw new AppException(
            ErrorCode.ValidationError,
            `discountAmount cannot exceed the line subtotal for RFQ item ${rfqItem.id}`,
          );
        }
        const lineTotal = lineSubtotal - discount + tax;
        subtotal += lineSubtotal;
        discountTotal += discount;
        taxTotal += tax;

        return {
          purchaseRfqItemId: rfqItem.id,
          productVariantId: rfqItem.productVariantId,
          quantity: rfqItem.quantity,
          unitCostSnapshot: unitCost.toFixed(2),
          discountSnapshot: discount.toFixed(2),
          taxSnapshot: tax.toFixed(2),
          lineTotal: lineTotal.toFixed(2),
          productNameSnapshot: rfqItem.productNameSnapshot,
          skuSnapshot: rfqItem.skuSnapshot,
        };
      });

      const grandTotal = subtotal - discountTotal + taxTotal;

      const quotation = manager.create(SupplierQuotation, {
        quotationNumber,
        companyId,
        purchaseRfqId: dto.purchaseRfqId,
        supplierId: dto.supplierId,
        paymentTermId: dto.paymentTermId ?? null,
        leadTimeDays: dto.leadTimeDays ?? null,
        status: SupplierQuotationStatus.Submitted,
        subtotal: subtotal.toFixed(2),
        discountAmount: discountTotal.toFixed(2),
        taxAmount: taxTotal.toFixed(2),
        grandTotal: grandTotal.toFixed(2),
        currency: dto.currency,
        notes: dto.notes?.trim() || null,
        createdBy: userId,
        updatedBy: userId,
      });
      const savedQuotation = await manager.save(SupplierQuotation, quotation);

      for (const row of rows) {
        await manager.save(
          SupplierQuotationItem,
          manager.create(SupplierQuotationItem, {
            supplierQuotationId: savedQuotation.id,
            ...row,
          }),
        );
      }

      savedQuotation.items = await manager.find(SupplierQuotationItem, {
        where: { supplierQuotationId: savedQuotation.id },
      });
      savedQuotation.purchaseRfq = rfq;
      return savedQuotation;
    });
  }

  async updateStatus(
    id: string,
    companyId: string,
    userId: string,
    nextStatus: SupplierQuotationStatus,
  ): Promise<SupplierQuotation> {
    const quotation = await this.findByIdInCompany(id, companyId);
    const allowed = ALLOWED_TRANSITIONS[quotation.status] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw new AppException(
        ErrorCode.Conflict,
        `Cannot transition supplier quotation from ${quotation.status} to ${nextStatus}`,
      );
    }

    await this.transactionService.run(async (manager) => {
      if (nextStatus === SupplierQuotationStatus.Awarded) {
        await manager.update(SupplierQuotation, quotation.id, {
          status: SupplierQuotationStatus.Awarded,
          updatedBy: userId,
        });
        await manager
          .createQueryBuilder()
          .update(SupplierQuotation)
          .set({
            status: SupplierQuotationStatus.Rejected,
            updatedBy: userId,
          })
          .where('purchase_rfq_id = :purchaseRfqId', {
            purchaseRfqId: quotation.purchaseRfqId,
          })
          .andWhere('company_id = :companyId', { companyId })
          .andWhere('id <> :id', { id: quotation.id })
          .andWhere('status = :status', {
            status: SupplierQuotationStatus.Submitted,
          })
          .execute();
        await manager.update(PurchaseRfq, quotation.purchaseRfqId, {
          status: PurchaseRfqStatus.Closed,
          updatedBy: userId,
        });
        return;
      }

      await manager.update(SupplierQuotation, quotation.id, {
        status: nextStatus,
        updatedBy: userId,
      });
    });

    return this.findByIdInCompany(id, companyId);
  }
}
