import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { PriceList } from '../entities/price-list.entity';
import { PriceListStatus } from '../entities/price-list-status.enum';
import { CreatePriceListDto } from '../dto/create-price-list.dto';
import { UpdatePriceListDto } from '../dto/update-price-list.dto';
import { ListPriceListsDto } from '../dto/list-price-lists.dto';
import { CompaniesService } from '../../organization/services/companies.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';

export interface PaginatedPriceLists {
  data: PriceList[];
  meta: { page: number; limit: number; total: number };
}

const SORTABLE_FIELDS = ['createdAt', 'name', 'code', 'status'] as const;

/**
 * PriceList/PriceListItem is included in Phase 10 (LOCKED — a deliberate
 * expansion of the approved analysis's smaller VariantPrice recommendation,
 * per this implementation's explicit instruction). No promotion/coupon/
 * campaign/tier-pricing engine exists here — this service only manages the
 * PriceList catalog record itself; effective-dated item pricing lives in
 * PriceListItemsService.
 */
@Injectable()
export class PriceListsService {
  constructor(
    @InjectRepository(PriceList)
    private readonly priceListRepository: Repository<PriceList>,
    private readonly companiesService: CompaniesService,
  ) {}

  async findAll(
    companyId: string,
    query: ListPriceListsDto,
  ): Promise<PaginatedPriceLists> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(
      query.sort,
      SORTABLE_FIELDS,
      'createdAt',
    );

    const qb = this.priceListRepository
      .createQueryBuilder('priceList')
      .where('priceList.companyId = :companyId', { companyId });

    if (query.status) {
      qb.andWhere('priceList.status = :status', { status: query.status });
    }
    if (query.search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('priceList.name LIKE :search', {
              search: `%${query.search}%`,
            })
            .orWhere('priceList.code LIKE :search', {
              search: `%${query.search}%`,
            });
        }),
      );
    }

    qb.orderBy(`priceList.${sortField}`, query.order ?? 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(id: string, companyId: string): Promise<PriceList> {
    const priceList = await this.priceListRepository.findOne({
      where: { id, companyId },
    });
    if (!priceList) {
      throw new AppException(ErrorCode.NotFound, 'Price list not found');
    }
    return priceList;
  }

  async create(companyId: string, dto: CreatePriceListDto): Promise<PriceList> {
    const company = await this.companiesService.findActiveByIdOrNull(companyId);
    if (!company) {
      throw new AppException(
        ErrorCode.ValidationError,
        'companyId does not reference an active company',
      );
    }

    const existing = await this.priceListRepository.findOne({
      where: { companyId, code: dto.code },
    });
    if (existing) {
      throw new AppException(
        ErrorCode.Conflict,
        'Price list code already exists for this company',
      );
    }

    const priceList = this.priceListRepository.create({
      companyId,
      code: dto.code,
      name: dto.name,
      description: dto.description ?? null,
      currency: dto.currency,
      status: PriceListStatus.Active,
    });

    return this.priceListRepository.save(priceList);
  }

  async update(
    id: string,
    companyId: string,
    dto: UpdatePriceListDto,
  ): Promise<PriceList> {
    const priceList = await this.findByIdInCompany(id, companyId);

    if (dto.name !== undefined) priceList.name = dto.name;
    if (dto.description !== undefined) priceList.description = dto.description;

    return this.priceListRepository.save(priceList);
  }

  async activate(id: string, companyId: string): Promise<PriceList> {
    const priceList = await this.findByIdInCompany(id, companyId);
    priceList.status = PriceListStatus.Active;
    return this.priceListRepository.save(priceList);
  }

  async deactivate(id: string, companyId: string): Promise<PriceList> {
    const priceList = await this.findByIdInCompany(id, companyId);
    priceList.status = PriceListStatus.Inactive;
    return this.priceListRepository.save(priceList);
  }

  async remove(id: string, companyId: string): Promise<void> {
    const priceList = await this.findByIdInCompany(id, companyId);
    await this.priceListRepository.softRemove(priceList);
  }
}
