import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { PurchaseRequest } from '../entities/purchase-request.entity';
import { PurchaseRequestItem } from '../entities/purchase-request-item.entity';
import { CompanyPurchaseRequestCounter } from '../entities/company-purchase-request-counter.entity';
import { CreatePurchaseRequestDto } from '../dto/create-purchase-request.dto';
import { ListPurchaseRequestsDto } from '../dto/list-purchase-requests.dto';
import { PurchaseRequestStatus } from '../entities/purchase-request-status.enum';
import { ProductVariantsService } from '../../products/services/product-variants.service';
import { ProductVariant } from '../../products/entities/product-variant.entity';
import { BranchesService } from '../../organization/services/branches.service';
import { CompaniesService } from '../../organization/services/companies.service';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { formatPurchaseRequestNumber } from '../utils/purchase-request-number';

export interface PaginatedPurchaseRequests {
  data: PurchaseRequest[];
  meta: { page: number; limit: number; total: number };
}

const ALLOWED_TRANSITIONS: Record<
  PurchaseRequestStatus,
  PurchaseRequestStatus[]
> = {
  [PurchaseRequestStatus.Draft]: [PurchaseRequestStatus.Submitted],
  [PurchaseRequestStatus.Submitted]: [
    PurchaseRequestStatus.Approved,
    PurchaseRequestStatus.Rejected,
  ],
  [PurchaseRequestStatus.Approved]: [PurchaseRequestStatus.Converted],
  [PurchaseRequestStatus.Rejected]: [PurchaseRequestStatus.Submitted],
  [PurchaseRequestStatus.Converted]: [],
};

@Injectable()
export class PurchaseRequestsService {
  constructor(
    @InjectRepository(PurchaseRequest)
    private readonly purchaseRequestRepository: Repository<PurchaseRequest>,
    private readonly productVariantsService: ProductVariantsService,
    private readonly branchesService: BranchesService,
    private readonly companiesService: CompaniesService,
    private readonly transactionService: TransactionService,
  ) {}

  async findAll(
    companyId: string,
    query: ListPurchaseRequestsDto,
  ): Promise<PaginatedPurchaseRequests> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const qb = this.purchaseRequestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.items', 'items')
      .where('request.companyId = :companyId', { companyId });

    if (query.status) {
      qb.andWhere('request.status = :status', { status: query.status });
    }

    qb.orderBy('request.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<PurchaseRequest> {
    const entity = await this.purchaseRequestRepository.findOne({
      where: { id, companyId },
      relations: { items: true },
    });
    if (!entity) {
      throw new AppException(ErrorCode.NotFound, 'Purchase request not found');
    }
    return entity;
  }

  private async generateRequestNumber(
    companyId: string,
    year: number,
    manager: EntityManager,
  ): Promise<string> {
    await manager.query(
      'INSERT INTO `company_purchase_request_counters` (`id`, `company_id`, `year`, `last_sequence`) ' +
        'VALUES (?, ?, ?, 0) ' +
        'ON DUPLICATE KEY UPDATE `last_sequence` = `last_sequence`',
      [randomUUID(), companyId, year],
    );

    const counter = await manager
      .createQueryBuilder(CompanyPurchaseRequestCounter, 'counter')
      .where('counter.companyId = :companyId', { companyId })
      .andWhere('counter.year = :year', { year })
      .setLock('pessimistic_write')
      .getOneOrFail();

    const nextSequence = counter.lastSequence + 1;
    await manager.update(CompanyPurchaseRequestCounter, counter.id, {
      lastSequence: nextSequence,
    });
    return formatPurchaseRequestNumber(year, nextSequence);
  }

  async create(
    companyId: string,
    userId: string,
    dto: CreatePurchaseRequestDto,
  ): Promise<PurchaseRequest> {
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

    const requiredDate = new Date(dto.requiredDate);
    const year = requiredDate.getUTCFullYear();

    return this.transactionService.run(async (manager) => {
      const requestNumber = await this.generateRequestNumber(
        companyId,
        year,
        manager,
      );

      const request = manager.create(PurchaseRequest, {
        requestNumber,
        companyId,
        branchId: dto.branchId ?? null,
        department: dto.department.trim(),
        requesterName: dto.requesterName.trim(),
        requiredDate,
        status: PurchaseRequestStatus.Draft,
        notes: dto.notes?.trim() || null,
        createdBy: userId,
        updatedBy: userId,
      });
      const savedRequest = await manager.save(PurchaseRequest, request);

      for (const item of dto.items) {
        await this.productVariantsService.findByIdInCompany(
          item.productVariantId,
          companyId,
        );
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
        const row = manager.create(PurchaseRequestItem, {
          purchaseRequestId: savedRequest.id,
          productVariantId: variant.id,
          quantity: item.quantity,
          reason: item.reason.trim(),
          productNameSnapshot: variant.product.name,
          skuSnapshot: variant.sku,
        });
        await manager.save(PurchaseRequestItem, row);
      }

      savedRequest.items = await manager.find(PurchaseRequestItem, {
        where: { purchaseRequestId: savedRequest.id },
      });
      return savedRequest;
    });
  }

  async updateStatus(
    id: string,
    companyId: string,
    userId: string,
    nextStatus: PurchaseRequestStatus,
  ): Promise<PurchaseRequest> {
    const request = await this.findByIdInCompany(id, companyId);
    const allowed = ALLOWED_TRANSITIONS[request.status] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw new AppException(
        ErrorCode.Conflict,
        `Cannot transition purchase request from ${request.status} to ${nextStatus}`,
      );
    }
    request.status = nextStatus;
    request.updatedBy = userId;
    return this.purchaseRequestRepository.save(request);
  }
}
