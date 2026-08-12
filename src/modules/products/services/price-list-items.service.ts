import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { PriceListItem } from '../entities/price-list-item.entity';
import { PriceListItemStatus } from '../entities/price-list-item-status.enum';
import { CreatePriceListItemDto } from '../dto/create-price-list-item.dto';
import { UpdatePriceListItemDto } from '../dto/update-price-list-item.dto';
import { ListPriceListItemsDto } from '../dto/list-price-list-items.dto';
import { PriceListsService } from './price-lists.service';
import { ProductVariantsService } from './product-variants.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';

export interface PaginatedPriceListItems {
  data: PriceListItem[];
  meta: { page: number; limit: number; total: number };
}

const SORTABLE_FIELDS = ['createdAt', 'validFrom', 'price', 'status'] as const;

/**
 * Effective-dated price rows for one ProductVariant within one PriceList
 * (Phase 10 §Price List Rules / §Price History, approved analysis §13).
 * Overlap prevention is service-level (MySQL cannot express range
 * exclusion natively) — rejects a new/updated row whose [validFrom,
 * validTo) window intersects an existing ACTIVE row for the same
 * (priceListId, productVariantId). No price-priority resolution engine is
 * built here (LOCKED) — this only establishes the data model; "current
 * price" resolution for a consumer is a simple point-in-time query,
 * documented but not exposed as a special endpoint in this phase.
 */
@Injectable()
export class PriceListItemsService {
  constructor(
    @InjectRepository(PriceListItem)
    private readonly priceListItemRepository: Repository<PriceListItem>,
    private readonly priceListsService: PriceListsService,
    private readonly productVariantsService: ProductVariantsService,
  ) {}

  async findAllForPriceList(
    priceListId: string,
    companyId: string,
    query: ListPriceListItemsDto,
  ): Promise<PaginatedPriceListItems> {
    await this.priceListsService.findByIdInCompany(priceListId, companyId);

    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(
      query.sort,
      SORTABLE_FIELDS,
      'validFrom',
    );

    const where: Record<string, unknown> = { priceListId, companyId };
    if (query.productVariantId) {
      where.productVariantId = query.productVariantId;
    }
    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await this.priceListItemRepository.findAndCount({
      where,
      order: { [sortField]: query.order ?? 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<PriceListItem> {
    const item = await this.priceListItemRepository.findOne({
      where: { id, companyId },
    });
    if (!item) {
      throw new AppException(ErrorCode.NotFound, 'Price list item not found');
    }
    return item;
  }

  private assertValidRange(validFrom: Date, validTo: Date | null): void {
    if (validTo && validTo <= validFrom) {
      throw new AppException(
        ErrorCode.ValidationError,
        'validTo must be after validFrom',
      );
    }
  }

  private assertPositivePrice(price: string): void {
    if (Number(price) <= 0) {
      throw new AppException(
        ErrorCode.ValidationError,
        'price must be a positive amount',
      );
    }
  }

  /**
   * Rejects a new/updated window that overlaps an existing ACTIVE row for
   * the same (priceListId, productVariantId). Open-ended existing rows
   * (validTo IS NULL) are treated as extending to +infinity.
   */
  private async assertNoOverlap(
    priceListId: string,
    productVariantId: string,
    validFrom: Date,
    validTo: Date | null,
    excludeId?: string,
  ): Promise<void> {
    const candidates = await this.priceListItemRepository.find({
      where: [
        {
          priceListId,
          productVariantId,
          status: PriceListItemStatus.Active,
          validTo: IsNull(),
        },
        {
          priceListId,
          productVariantId,
          status: PriceListItemStatus.Active,
          validTo: MoreThan(validFrom),
        },
      ],
    });

    const overlapping = candidates.find((row) => {
      if (excludeId && row.id === excludeId) return false;
      const rowStart = row.validFrom.getTime();
      const rowEnd = row.validTo ? row.validTo.getTime() : Infinity;
      const newStart = validFrom.getTime();
      const newEnd = validTo ? validTo.getTime() : Infinity;
      return rowStart < newEnd && newStart < rowEnd;
    });

    if (overlapping) {
      throw new AppException(
        ErrorCode.Conflict,
        'An active price already exists for this variant in this price list during the requested period',
      );
    }
  }

  async create(
    priceListId: string,
    companyId: string,
    dto: CreatePriceListItemDto,
  ): Promise<PriceListItem> {
    const priceList = await this.priceListsService.findByIdInCompany(
      priceListId,
      companyId,
    );

    // Variant must belong to the same company as the PriceList (Phase 10 §Price List Rules, LOCKED).
    await this.productVariantsService.findByIdInCompany(
      dto.productVariantId,
      companyId,
    );

    this.assertPositivePrice(dto.price);

    const validFrom = new Date(dto.validFrom);
    const validTo = dto.validTo ? new Date(dto.validTo) : null;
    this.assertValidRange(validFrom, validTo);

    await this.assertNoOverlap(
      priceListId,
      dto.productVariantId,
      validFrom,
      validTo,
    );

    const item = this.priceListItemRepository.create({
      priceListId,
      productVariantId: dto.productVariantId,
      companyId: priceList.companyId,
      price: dto.price,
      validFrom,
      validTo,
      status: PriceListItemStatus.Active,
    });

    return this.priceListItemRepository.save(item);
  }

  async update(
    id: string,
    companyId: string,
    dto: UpdatePriceListItemDto,
  ): Promise<PriceListItem> {
    const item = await this.findByIdInCompany(id, companyId);

    const nextPrice = dto.price ?? item.price;
    const nextValidTo =
      dto.validTo !== undefined ? new Date(dto.validTo) : item.validTo;

    this.assertPositivePrice(nextPrice);
    this.assertValidRange(item.validFrom, nextValidTo);

    if (dto.validTo !== undefined) {
      await this.assertNoOverlap(
        item.priceListId,
        item.productVariantId,
        item.validFrom,
        nextValidTo,
        id,
      );
    }

    item.price = nextPrice;
    if (dto.validTo !== undefined) item.validTo = nextValidTo;

    return this.priceListItemRepository.save(item);
  }

  async deactivate(id: string, companyId: string): Promise<PriceListItem> {
    const item = await this.findByIdInCompany(id, companyId);
    item.status = PriceListItemStatus.Inactive;
    return this.priceListItemRepository.save(item);
  }

  async remove(id: string, companyId: string): Promise<void> {
    const item = await this.findByIdInCompany(id, companyId);
    await this.priceListItemRepository.softRemove(item);
  }
}
