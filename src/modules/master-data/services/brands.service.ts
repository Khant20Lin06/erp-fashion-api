import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Brand } from '../entities/brand.entity';
import { BrandStatus } from '../entities/brand-status.enum';
import { CreateBrandDto } from '../dto/create-brand.dto';
import { UpdateBrandDto } from '../dto/update-brand.dto';
import { ListBrandsDto } from '../dto/list-brands.dto';
import { CompaniesService } from '../../organization/services/companies.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';

export interface PaginatedBrands {
  data: Brand[];
  meta: { page: number; limit: number; total: number };
}

const SORTABLE_FIELDS = ['createdAt', 'name', 'code', 'status'] as const;

@Injectable()
export class BrandsService {
  constructor(
    @InjectRepository(Brand)
    private readonly brandRepository: Repository<Brand>,
    private readonly companiesService: CompaniesService,
  ) {}

  async findAll(
    companyId: string,
    query: ListBrandsDto,
  ): Promise<PaginatedBrands> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(
      query.sort,
      SORTABLE_FIELDS,
      'createdAt',
    );

    const qb = this.brandRepository
      .createQueryBuilder('brand')
      .where('brand.companyId = :companyId', { companyId });

    if (query.status) {
      qb.andWhere('brand.status = :status', { status: query.status });
    }
    if (query.search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('brand.name LIKE :search', { search: `%${query.search}%` })
            .orWhere('brand.code LIKE :search', {
              search: `%${query.search}%`,
            });
        }),
      );
    }

    qb.orderBy(`brand.${sortField}`, query.order ?? 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(id: string, companyId: string): Promise<Brand> {
    const brand = await this.brandRepository.findOne({
      where: { id, companyId },
    });
    if (!brand) {
      throw new AppException(ErrorCode.NotFound, 'Brand not found');
    }
    return brand;
  }

  async create(companyId: string, dto: CreateBrandDto): Promise<Brand> {
    const company = await this.companiesService.findActiveByIdOrNull(companyId);
    if (!company) {
      throw new AppException(
        ErrorCode.ValidationError,
        'companyId does not reference an active company',
      );
    }

    const existing = await this.brandRepository.findOne({
      where: { companyId, code: dto.code },
    });
    if (existing) {
      throw new AppException(
        ErrorCode.Conflict,
        'Brand code already exists for this company',
      );
    }

    const brand = this.brandRepository.create({
      companyId,
      code: dto.code,
      name: dto.name,
      description: dto.description ?? null,
      country: dto.country ?? null,
      status: BrandStatus.Active,
    });

    return this.brandRepository.save(brand);
  }

  async update(
    id: string,
    companyId: string,
    dto: UpdateBrandDto,
  ): Promise<Brand> {
    const brand = await this.findByIdInCompany(id, companyId);

    if (dto.name !== undefined) brand.name = dto.name;
    if (dto.description !== undefined) brand.description = dto.description;
    if (dto.country !== undefined) brand.country = dto.country;

    return this.brandRepository.save(brand);
  }

  async activate(id: string, companyId: string): Promise<Brand> {
    const brand = await this.findByIdInCompany(id, companyId);
    brand.status = BrandStatus.Active;
    return this.brandRepository.save(brand);
  }

  async deactivate(id: string, companyId: string): Promise<Brand> {
    const brand = await this.findByIdInCompany(id, companyId);
    brand.status = BrandStatus.Inactive;
    return this.brandRepository.save(brand);
  }

  /** Soft delete only (no business records exist yet in this phase to block on). */
  async remove(id: string, companyId: string): Promise<void> {
    const brand = await this.findByIdInCompany(id, companyId);
    await this.brandRepository.softRemove(brand);
  }
}
