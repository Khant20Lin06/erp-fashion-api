import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Uom } from '../entities/uom.entity';
import { CreateUomDto } from '../dto/create-uom.dto';
import { UpdateUomDto } from '../dto/update-uom.dto';
import { ListUomsDto } from '../dto/list-uoms.dto';
import { CompaniesService } from '../../organization/services/companies.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';
import { ProductVariant } from '../../products/entities/product-variant.entity';
import { ProductVariantUom } from '../../products/entities/product-variant-uom.entity';
import { PriceListItem } from '../../products/entities/price-list-item.entity';

const SORTABLE_FIELDS = [
  'createdAt',
  'code',
  'name',
  'category',
  'decimalPlaces',
  'isActive',
] as const;

@Injectable()
export class UomsService {
  constructor(
    @InjectRepository(Uom)
    private readonly uomRepository: Repository<Uom>,
    @InjectRepository(ProductVariant)
    private readonly variantRepository: Repository<ProductVariant>,
    @InjectRepository(ProductVariantUom)
    private readonly variantUomRepository: Repository<ProductVariantUom>,
    @InjectRepository(PriceListItem)
    private readonly priceListItemRepository: Repository<PriceListItem>,
    private readonly companiesService: CompaniesService,
  ) {}

  async findAll(
    companyId: string,
    query: ListUomsDto,
  ): Promise<{ data: Uom[]; meta: { page: number; limit: number; total: number } }> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(query.sort, SORTABLE_FIELDS, 'name');

    const qb = this.uomRepository
      .createQueryBuilder('uom')
      .where('uom.companyId = :companyId', { companyId });

    if (query.category) {
      qb.andWhere('uom.category = :category', { category: query.category });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('uom.isActive = :isActive', {
        isActive: query.isActive === 'true',
      });
    }
    if (query.search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('uom.code LIKE :search', { search: `%${query.search}%` })
            .orWhere('uom.name LIKE :search', { search: `%${query.search}%` })
            .orWhere('uom.symbol LIKE :search', {
              search: `%${query.search}%`,
            });
        }),
      );
    }

    qb.orderBy(`uom.${sortField}`, query.order ?? 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(id: string, companyId: string): Promise<Uom> {
    const uom = await this.uomRepository.findOne({
      where: { id, companyId },
    });
    if (!uom) {
      throw new AppException(ErrorCode.NotFound, 'UOM not found');
    }
    return uom;
  }

  async create(
    companyId: string,
    _userId: string,
    dto: CreateUomDto,
  ): Promise<Uom> {
    await this.assertActiveCompany(companyId);
    await this.assertUnique(companyId, dto.code, dto.name);

    const entity = this.uomRepository.create({
      companyId,
      code: dto.code,
      name: dto.name,
      symbol: dto.symbol?.trim() || null,
      category: dto.category,
      decimalPlaces: dto.decimalPlaces,
      isActive: true,
    });

    return this.uomRepository.save(entity);
  }

  async update(
    id: string,
    companyId: string,
    _userId: string,
    dto: UpdateUomDto,
  ): Promise<Uom> {
    const uom = await this.findByIdInCompany(id, companyId);
    const nextCode = dto.code ?? uom.code;
    const nextName = dto.name ?? uom.name;

    await this.assertUnique(companyId, nextCode, nextName, id);

    if (dto.code !== undefined) uom.code = dto.code;
    if (dto.name !== undefined) uom.name = dto.name;
    if (dto.symbol !== undefined) uom.symbol = dto.symbol?.trim() || null;
    if (dto.category !== undefined) uom.category = dto.category;
    if (dto.decimalPlaces !== undefined) {
      uom.decimalPlaces = dto.decimalPlaces;
    }

    return this.uomRepository.save(uom);
  }

  async activate(
    id: string,
    companyId: string,
    _userId: string,
  ): Promise<Uom> {
    const uom = await this.findByIdInCompany(id, companyId);
    uom.isActive = true;
    return this.uomRepository.save(uom);
  }

  async deactivate(
    id: string,
    companyId: string,
    _userId: string,
  ): Promise<Uom> {
    const uom = await this.findByIdInCompany(id, companyId);
    uom.isActive = false;
    return this.uomRepository.save(uom);
  }

  async remove(id: string, companyId: string): Promise<void> {
    const uom = await this.findByIdInCompany(id, companyId);

    const [baseVariantCount, variantMappingCount, priceRowCount] =
      await Promise.all([
        this.variantRepository.count({ where: { companyId, baseUomId: id } }),
        this.variantUomRepository.count({ where: { companyId, uomId: id } }),
        this.priceListItemRepository.count({ where: { companyId, uomId: id } }),
      ]);

    if (baseVariantCount > 0) {
      throw new AppException(
        ErrorCode.Conflict,
        'UOM is configured as a variant base UOM and cannot be deleted',
      );
    }
    if (variantMappingCount > 0) {
      throw new AppException(
        ErrorCode.Conflict,
        'UOM is referenced by variant UOM mappings and cannot be deleted',
      );
    }
    if (priceRowCount > 0) {
      throw new AppException(
        ErrorCode.Conflict,
        'UOM is referenced by price list items and cannot be deleted',
      );
    }

    await this.uomRepository.softRemove(uom);
  }

  private async assertActiveCompany(companyId: string): Promise<void> {
    const company = await this.companiesService.findActiveByIdOrNull(companyId);
    if (!company) {
      throw new AppException(
        ErrorCode.ValidationError,
        'companyId does not reference an active company',
      );
    }
  }

  private async assertUnique(
    companyId: string,
    code: string,
    name: string,
    ignoreId?: string,
  ): Promise<void> {
    const qb = this.uomRepository
      .createQueryBuilder('uom')
      .where('uom.companyId = :companyId', { companyId })
      .andWhere('(uom.code = :code OR uom.name = :name)', { code, name });

    if (ignoreId) {
      qb.andWhere('uom.id != :ignoreId', { ignoreId });
    }

    const existing = await qb.getOne();
    if (existing) {
      throw new AppException(
        ErrorCode.Conflict,
        'UOM code or name already exists for this company',
      );
    }
  }
}
