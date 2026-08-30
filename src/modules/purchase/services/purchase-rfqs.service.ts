import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { EntityManager, Repository } from 'typeorm';
import { PurchaseRfq } from '../entities/purchase-rfq.entity';
import { PurchaseRfqItem } from '../entities/purchase-rfq-item.entity';
import { CompanyPurchaseRfqCounter } from '../entities/company-purchase-rfq-counter.entity';
import { CreatePurchaseRfqDto } from '../dto/create-purchase-rfq.dto';
import { ListPurchaseRfqsDto } from '../dto/list-purchase-rfqs.dto';
import { PurchaseRfqStatus } from '../entities/purchase-rfq-status.enum';
import { CompaniesService } from '../../organization/services/companies.service';
import { BranchesService } from '../../organization/services/branches.service';
import { PurchaseRequestsService } from './purchase-requests.service';
import { SuppliersService } from '../../customer-supplier/services/suppliers.service';
import { ProductVariantsService } from '../../products/services/product-variants.service';
import { ProductVariant } from '../../products/entities/product-variant.entity';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { formatPurchaseRfqNumber } from '../utils/purchase-rfq-number';

export interface PaginatedPurchaseRfqs {
  data: PurchaseRfq[];
  meta: { page: number; limit: number; total: number };
}

const ALLOWED_TRANSITIONS: Record<PurchaseRfqStatus, PurchaseRfqStatus[]> = {
  [PurchaseRfqStatus.Draft]: [
    PurchaseRfqStatus.Sent,
    PurchaseRfqStatus.Cancelled,
  ],
  [PurchaseRfqStatus.Sent]: [
    PurchaseRfqStatus.Closed,
    PurchaseRfqStatus.Cancelled,
  ],
  [PurchaseRfqStatus.Closed]: [],
  [PurchaseRfqStatus.Cancelled]: [],
};

@Injectable()
export class PurchaseRfqsService {
  constructor(
    @InjectRepository(PurchaseRfq)
    private readonly purchaseRfqRepository: Repository<PurchaseRfq>,
    private readonly companiesService: CompaniesService,
    private readonly branchesService: BranchesService,
    private readonly purchaseRequestsService: PurchaseRequestsService,
    private readonly suppliersService: SuppliersService,
    private readonly productVariantsService: ProductVariantsService,
    private readonly transactionService: TransactionService,
  ) {}

  async findAll(
    companyId: string,
    query: ListPurchaseRfqsDto,
  ): Promise<PaginatedPurchaseRfqs> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const qb = this.purchaseRfqRepository
      .createQueryBuilder('rfq')
      .leftJoinAndSelect('rfq.items', 'items')
      .where('rfq.companyId = :companyId', { companyId });

    if (query.purchaseRequestId) {
      qb.andWhere('rfq.purchaseRequestId = :purchaseRequestId', {
        purchaseRequestId: query.purchaseRequestId,
      });
    }
    if (query.status) {
      qb.andWhere('rfq.status = :status', { status: query.status });
    }
    if (query.search) {
      qb.andWhere('(rfq.rfqNumber LIKE :search OR rfq.title LIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    qb.orderBy('rfq.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(id: string, companyId: string): Promise<PurchaseRfq> {
    const entity = await this.purchaseRfqRepository.findOne({
      where: { id, companyId },
      relations: { items: true },
    });
    if (!entity) {
      throw new AppException(ErrorCode.NotFound, 'Purchase RFQ not found');
    }
    return entity;
  }

  private async generateRfqNumber(
    companyId: string,
    year: number,
    manager: EntityManager,
  ): Promise<string> {
    await manager.query(
      'INSERT INTO `company_purchase_rfq_counters` (`id`, `company_id`, `year`, `last_sequence`) ' +
        'VALUES (?, ?, ?, 0) ' +
        'ON DUPLICATE KEY UPDATE `last_sequence` = `last_sequence`',
      [randomUUID(), companyId, year],
    );

    const counter = await manager
      .createQueryBuilder(CompanyPurchaseRfqCounter, 'counter')
      .where('counter.companyId = :companyId', { companyId })
      .andWhere('counter.year = :year', { year })
      .setLock('pessimistic_write')
      .getOneOrFail();

    const nextSequence = counter.lastSequence + 1;
    await manager.update(CompanyPurchaseRfqCounter, counter.id, {
      lastSequence: nextSequence,
    });
    return formatPurchaseRfqNumber(year, nextSequence);
  }

  async create(
    companyId: string,
    userId: string,
    dto: CreatePurchaseRfqDto,
  ): Promise<PurchaseRfq> {
    const company = await this.companiesService.findActiveByIdOrNull(companyId);
    if (!company) {
      throw new AppException(
        ErrorCode.ValidationError,
        'companyId does not reference an active company',
      );
    }

    if (dto.branchId) {
      const branch = await this.branchesService.findActiveByIdOrNull(
        dto.branchId,
      );
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

    if (dto.purchaseRequestId) {
      await this.purchaseRequestsService.findByIdInCompany(
        dto.purchaseRequestId,
        companyId,
      );
    }

    for (const supplierId of dto.invitedSupplierIds) {
      await this.suppliersService.findByIdInCompany(supplierId, companyId);
    }

    for (const item of dto.items) {
      await this.productVariantsService.findByIdInCompany(
        item.productVariantId,
        companyId,
      );
    }

    const requiredDate = new Date(dto.requiredDate);
    const year = requiredDate.getUTCFullYear();

    return this.transactionService.run(async (manager) => {
      const rfqNumber = await this.generateRfqNumber(companyId, year, manager);

      const rfq = manager.create(PurchaseRfq, {
        rfqNumber,
        companyId,
        branchId: dto.branchId ?? null,
        purchaseRequestId: dto.purchaseRequestId ?? null,
        title: dto.title.trim(),
        requiredDate,
        status: PurchaseRfqStatus.Draft,
        invitedSupplierIds: dto.invitedSupplierIds,
        notes: dto.notes?.trim() || null,
        createdBy: userId,
        updatedBy: userId,
      });
      const savedRfq = await manager.save(PurchaseRfq, rfq);

      for (const item of dto.items) {
        const variant = await manager.findOne(ProductVariant, {
          where: { id: item.productVariantId, companyId },
          relations: { product: true },
        });
        if (!variant?.product) {
          throw new AppException(
            ErrorCode.NotFound,
            'Product variant not found',
          );
        }
        const row = manager.create(PurchaseRfqItem, {
          purchaseRfqId: savedRfq.id,
          productVariantId: variant.id,
          quantity: item.quantity,
          reasonSnapshot: item.reason.trim(),
          productNameSnapshot: variant.product.name,
          skuSnapshot: variant.sku,
        });
        await manager.save(PurchaseRfqItem, row);
      }

      savedRfq.items = await manager.find(PurchaseRfqItem, {
        where: { purchaseRfqId: savedRfq.id },
      });
      return savedRfq;
    });
  }

  async updateStatus(
    id: string,
    companyId: string,
    userId: string,
    nextStatus: PurchaseRfqStatus,
  ): Promise<PurchaseRfq> {
    const rfq = await this.findByIdInCompany(id, companyId);
    const allowed = ALLOWED_TRANSITIONS[rfq.status] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw new AppException(
        ErrorCode.Conflict,
        `Cannot transition purchase RFQ from ${rfq.status} to ${nextStatus}`,
      );
    }
    rfq.status = nextStatus;
    rfq.updatedBy = userId;
    return this.purchaseRfqRepository.save(rfq);
  }
}
