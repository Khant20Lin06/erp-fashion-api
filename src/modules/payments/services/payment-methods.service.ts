import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { PaymentMethod } from '../entities/payment-method.entity';
import { PaymentMethodStatus } from '../entities/payment-method-status.enum';
import { CreatePaymentMethodDto } from '../dto/create-payment-method.dto';
import { ListPaymentMethodsDto } from '../dto/list-payment-methods.dto';
import { CompaniesService } from '../../organization/services/companies.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';
import { CacheService } from '../../redis/cache.service';
import { CacheKeys, CacheTtl } from '../../redis/cache-keys';

export interface PaginatedPaymentMethods {
  data: PaymentMethod[];
  meta: { page: number; limit: number; total: number };
}

const SORTABLE_FIELDS = ['createdAt', 'name', 'code', 'status'] as const;

/**
 * PaymentMethod as company-scoped master data (D7, LOCKED) — read+create
 * only per the locked minimal scope (D14: "GET /payment-methods,
 * POST /payment-methods, mirroring Phase 09's simplest master-data
 * controller"). No update/deactivate/delete endpoint exists because the
 * locked spec's own API surface (D14) never lists one for PaymentMethod
 * beyond read+create — unlike Brand/Category (Phase 09), which got full
 * CRUD because Phase 09's own scope called for it. Deliberately mirrors
 * BrandsService's structure (findAll/findByIdInCompany/create) but stops
 * there.
 */

/**
 * Cache-eligible request shape (Phase 19 addition): only the plain,
 * unfiltered default "list all" request (default page/limit, no
 * status/search filter, no explicit sort) is cached — this is the
 * overwhelmingly common request shape for a small, rarely-changing
 * master-data list, and caching only it keeps the invalidation story
 * simple (a single key per company, deleted on every create()). Any
 * filtered/paginated/sorted request bypasses the cache entirely and goes
 * straight to MySQL, exactly as it did before this phase.
 */
function isDefaultListQuery(query: ListPaymentMethodsDto): boolean {
  return (
    (query.page ?? DEFAULT_PAGE) === DEFAULT_PAGE &&
    (query.limit ?? DEFAULT_LIMIT) === DEFAULT_LIMIT &&
    !query.status &&
    !query.search &&
    !query.sort &&
    !query.order
  );
}

@Injectable()
export class PaymentMethodsService {
  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
    private readonly companiesService: CompaniesService,
    private readonly cacheService: CacheService,
  ) {}

  async findAll(
    companyId: string,
    query: ListPaymentMethodsDto,
  ): Promise<PaginatedPaymentMethods> {
    const cacheable = isDefaultListQuery(query);
    const cacheKey = CacheKeys.paymentMethods(companyId);

    if (cacheable) {
      const cached =
        await this.cacheService.get<PaginatedPaymentMethods>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(
      query.sort,
      SORTABLE_FIELDS,
      'createdAt',
    );

    const qb = this.paymentMethodRepository
      .createQueryBuilder('paymentMethod')
      .where('paymentMethod.companyId = :companyId', { companyId });

    if (query.status) {
      qb.andWhere('paymentMethod.status = :status', { status: query.status });
    }
    if (query.search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('paymentMethod.name LIKE :search', {
              search: `%${query.search}%`,
            })
            .orWhere('paymentMethod.code LIKE :search', {
              search: `%${query.search}%`,
            });
        }),
      );
    }

    qb.orderBy(`paymentMethod.${sortField}`, query.order ?? 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    const result = { data, meta: { page, limit, total } };

    if (cacheable) {
      await this.cacheService.set(
        cacheKey,
        result,
        CacheTtl.PAYMENT_METHODS_SECONDS,
      );
    }

    return result;
  }

  async findByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<PaymentMethod> {
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id, companyId },
    });
    if (!paymentMethod) {
      throw new AppException(ErrorCode.NotFound, 'Payment method not found');
    }
    return paymentMethod;
  }

  async create(
    companyId: string,
    dto: CreatePaymentMethodDto,
  ): Promise<PaymentMethod> {
    const company = await this.companiesService.findActiveByIdOrNull(companyId);
    if (!company) {
      throw new AppException(
        ErrorCode.ValidationError,
        'companyId does not reference an active company',
      );
    }

    const existing = await this.paymentMethodRepository.findOne({
      where: { companyId, code: dto.code },
    });
    if (existing) {
      throw new AppException(
        ErrorCode.Conflict,
        'Payment method code already exists for this company',
      );
    }

    const paymentMethod = this.paymentMethodRepository.create({
      companyId,
      code: dto.code,
      name: dto.name,
      status: PaymentMethodStatus.Active,
    });

    const saved = await this.paymentMethodRepository.save(paymentMethod);

    // Cache-aside invalidation (LOCKED: delete AFTER the DB write commits,
    // never before) — the next default-list read repopulates the cache.
    await this.cacheService.delete(CacheKeys.paymentMethods(companyId));

    return saved;
  }
}
