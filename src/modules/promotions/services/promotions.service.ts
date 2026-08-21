import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, Repository } from 'typeorm';
import { Promotion } from '../entities/promotion.entity';
import { PromotionDiscountType } from '../entities/promotion-discount-type.enum';
import { PromotionStatus } from '../entities/promotion-status.enum';
import { CompaniesService } from '../../organization/services/companies.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';
import {
  CreatePromotionDto,
  ListPromotionsDto,
  UpdatePromotionDto,
} from '../dto/promotions.dto';

const SORTABLE_FIELDS = ['createdAt', 'name', 'code', 'startDate'] as const;

@Injectable()
export class PromotionsService {
  constructor(
    @InjectRepository(Promotion)
    private readonly promotionRepository: Repository<Promotion>,
    private readonly companiesService: CompaniesService,
  ) {}

  async findAll(
    companyId: string,
    query: ListPromotionsDto,
  ): Promise<{
    data: Promotion[];
    meta: { page: number; limit: number; total: number };
  }> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(
      query.sort,
      SORTABLE_FIELDS,
      'createdAt',
    );

    const qb = this.promotionRepository
      .createQueryBuilder('promotion')
      .where('promotion.companyId = :companyId', { companyId });

    if (query.status) {
      qb.andWhere('promotion.status = :status', { status: query.status });
    }
    if (query.search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('promotion.name LIKE :search', {
              search: `%${query.search}%`,
            })
            .orWhere('promotion.code LIKE :search', {
              search: `%${query.search}%`,
            });
        }),
      );
    }

    qb.orderBy(`promotion.${sortField}`, query.order ?? 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(id: string, companyId: string): Promise<Promotion> {
    const entity = await this.promotionRepository.findOne({
      where: { id, companyId },
    });
    if (!entity) {
      throw new AppException(ErrorCode.NotFound, 'Promotion not found');
    }
    return entity;
  }

  async create(
    companyId: string,
    userId: string,
    dto: CreatePromotionDto,
  ): Promise<Promotion> {
    const company = await this.companiesService.findActiveByIdOrNull(companyId);
    if (!company) {
      throw new AppException(
        ErrorCode.ValidationError,
        'companyId does not reference an active company',
      );
    }

    if (
      dto.endDate &&
      new Date(dto.endDate).getTime() < new Date(dto.startDate).getTime()
    ) {
      throw new AppException(
        ErrorCode.ValidationError,
        'endDate must be on or after startDate',
      );
    }
    if (
      dto.discountType === PromotionDiscountType.Percentage &&
      Number(dto.discountValue) > 100
    ) {
      throw new AppException(
        ErrorCode.ValidationError,
        'discountValue cannot exceed 100 for a PERCENTAGE promotion',
      );
    }

    const existing = await this.promotionRepository.findOne({
      where: { companyId, code: dto.code },
    });
    if (existing) {
      throw new AppException(
        ErrorCode.Conflict,
        'Promotion code already exists for this company',
      );
    }

    const entity = this.promotionRepository.create({
      companyId,
      code: dto.code,
      name: dto.name,
      description: dto.description ?? null,
      discountType: dto.discountType,
      discountValue: dto.discountValue,
      minimumPurchase: dto.minimumPurchase ?? '0.00',
      maximumDiscountAmount: dto.maximumDiscountAmount ?? null,
      startDate: dto.startDate.slice(0, 10),
      endDate: dto.endDate?.slice(0, 10) ?? null,
      usageLimit: dto.usageLimit ?? null,
      usageCount: 0,
      status: PromotionStatus.Active,
      createdBy: userId,
      updatedBy: userId,
    });
    return this.promotionRepository.save(entity);
  }

  async update(
    id: string,
    companyId: string,
    userId: string,
    dto: UpdatePromotionDto,
  ): Promise<Promotion> {
    const entity = await this.findByIdInCompany(id, companyId);

    if (dto.name !== undefined) entity.name = dto.name;
    if (dto.description !== undefined)
      entity.description = dto.description?.trim() || null;
    if (dto.minimumPurchase !== undefined)
      entity.minimumPurchase = dto.minimumPurchase;
    if (dto.maximumDiscountAmount !== undefined) {
      entity.maximumDiscountAmount = dto.maximumDiscountAmount;
    }
    if (dto.endDate !== undefined) {
      if (
        new Date(dto.endDate).getTime() < new Date(entity.startDate).getTime()
      ) {
        throw new AppException(
          ErrorCode.ValidationError,
          'endDate must be on or after startDate',
        );
      }
      entity.endDate = dto.endDate.slice(0, 10);
    }
    if (dto.usageLimit !== undefined) entity.usageLimit = dto.usageLimit;
    if (dto.status !== undefined) entity.status = dto.status;
    entity.updatedBy = userId;

    return this.promotionRepository.save(entity);
  }

  /**
   * Resolves a promotion code for use inside a Sale-creation transaction:
   * locks the row (pessimistic_write — usageCount is about to be
   * incremented), validates it is ACTIVE, within its date window, the
   * order subtotal meets minimumPurchase, and usageLimit has not been
   * reached. Called by SalesService.create() via the caller's own
   * EntityManager — never opens its own transaction, mirrors
   * AccountingPostingService's own EntityManager-only contract.
   */
  async resolveAndLockForUse(
    manager: EntityManager,
    companyId: string,
    code: string,
    orderSubtotal: number,
    asOfDate: Date,
  ): Promise<Promotion> {
    const promotion = await manager
      .createQueryBuilder(Promotion, 'promotion')
      .where('promotion.companyId = :companyId', { companyId })
      .andWhere('promotion.code = :code', { code })
      .setLock('pessimistic_write')
      .getOne();

    if (!promotion) {
      throw new AppException(
        ErrorCode.ValidationError,
        `Promotion code "${code}" does not exist for this company`,
      );
    }
    if (promotion.status !== PromotionStatus.Active) {
      throw new AppException(
        ErrorCode.ValidationError,
        `Promotion code "${code}" is not active`,
      );
    }
    const asOfDateOnly = asOfDate.toISOString().slice(0, 10);
    if (asOfDateOnly < promotion.startDate) {
      throw new AppException(
        ErrorCode.ValidationError,
        `Promotion code "${code}" is not yet valid`,
      );
    }
    if (promotion.endDate && asOfDateOnly > promotion.endDate) {
      throw new AppException(
        ErrorCode.ValidationError,
        `Promotion code "${code}" has expired`,
      );
    }
    if (orderSubtotal < Number(promotion.minimumPurchase)) {
      throw new AppException(
        ErrorCode.ValidationError,
        `Promotion code "${code}" requires a minimum purchase of ${promotion.minimumPurchase}`,
      );
    }
    if (
      promotion.usageLimit !== null &&
      promotion.usageCount >= promotion.usageLimit
    ) {
      throw new AppException(
        ErrorCode.ValidationError,
        `Promotion code "${code}" has reached its usage limit`,
      );
    }

    return promotion;
  }

  /** Increments usageCount inside the caller's transaction — called after the Sale is confirmed as using this promotion. */
  async incrementUsage(
    manager: EntityManager,
    promotionId: string,
  ): Promise<void> {
    await manager.increment(Promotion, { id: promotionId }, 'usageCount', 1);
  }

  /**
   * Computes the discount amount a promotion produces for a given order
   * subtotal — pure, deterministic, backend-only (never trusts a
   * client-supplied discount total). PERCENTAGE is capped by
   * maximumDiscountAmount if set; FIXED_AMOUNT is capped at the subtotal
   * itself (never a negative order total).
   */
  computeDiscountAmount(promotion: Promotion, orderSubtotal: number): number {
    let discount: number;
    if (promotion.discountType === PromotionDiscountType.Percentage) {
      discount = (orderSubtotal * Number(promotion.discountValue)) / 100;
      if (promotion.maximumDiscountAmount !== null) {
        discount = Math.min(discount, Number(promotion.maximumDiscountAmount));
      }
    } else {
      discount = Number(promotion.discountValue);
    }
    return Math.min(discount, orderSubtotal);
  }
}
