import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { AttributeOption } from '../entities/attribute-option.entity';
import { AttributeOptionStatus } from '../entities/attribute-option-status.enum';
import { AttributeKind } from '../entities/attribute-kind.enum';
import { CreateAttributeOptionDto } from '../dto/create-attribute-option.dto';
import { UpdateAttributeOptionDto } from '../dto/update-attribute-option.dto';
import { ListAttributeOptionsDto } from '../dto/list-attribute-options.dto';
import { CompaniesService } from '../../organization/services/companies.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';

export interface PaginatedAttributeOptions {
  data: AttributeOption[];
  meta: { page: number; limit: number; total: number };
}

const SORTABLE_FIELDS = [
  'createdAt',
  'value',
  'code',
  'status',
  'sortOrder',
] as const;

/**
 * One unified service for Color/Size/Style/Material (Phase 09 §8, LOCKED)
 * — kind-scoped uniqueness means SIZE+"M" and COLOR+"M" never collide
 * (§9). swatch is only meaningful for kind=COLOR; rejected for other
 * kinds at create/update time since MySQL cannot express a conditional
 * column requirement as a constraint.
 */
@Injectable()
export class AttributeOptionsService {
  constructor(
    @InjectRepository(AttributeOption)
    private readonly attributeOptionRepository: Repository<AttributeOption>,
    private readonly companiesService: CompaniesService,
  ) {}

  async findAll(
    companyId: string,
    query: ListAttributeOptionsDto,
  ): Promise<PaginatedAttributeOptions> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(
      query.sort,
      SORTABLE_FIELDS,
      'sortOrder',
    );

    const qb = this.attributeOptionRepository
      .createQueryBuilder('option')
      .where('option.companyId = :companyId', { companyId });

    if (query.kind) {
      qb.andWhere('option.kind = :kind', { kind: query.kind });
    }
    if (query.status) {
      qb.andWhere('option.status = :status', { status: query.status });
    }
    if (query.search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('option.value LIKE :search', { search: `%${query.search}%` })
            .orWhere('option.code LIKE :search', {
              search: `%${query.search}%`,
            });
        }),
      );
    }

    qb.orderBy(`option.${sortField}`, query.order ?? 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<AttributeOption> {
    const option = await this.attributeOptionRepository.findOne({
      where: { id, companyId },
    });
    if (!option) {
      throw new AppException(ErrorCode.NotFound, 'Attribute option not found');
    }
    return option;
  }

  async create(
    companyId: string,
    dto: CreateAttributeOptionDto,
  ): Promise<AttributeOption> {
    const company = await this.companiesService.findActiveByIdOrNull(companyId);
    if (!company) {
      throw new AppException(
        ErrorCode.ValidationError,
        'companyId does not reference an active company',
      );
    }

    if (dto.swatch && dto.kind !== AttributeKind.Color) {
      throw new AppException(
        ErrorCode.ValidationError,
        'swatch is only applicable when kind is COLOR',
      );
    }

    const existing = await this.attributeOptionRepository.findOne({
      where: { companyId, kind: dto.kind, code: dto.code },
    });
    if (existing) {
      throw new AppException(
        ErrorCode.Conflict,
        'An attribute option with this code already exists for this kind in this company',
      );
    }

    const option = this.attributeOptionRepository.create({
      companyId,
      kind: dto.kind,
      code: dto.code,
      value: dto.value,
      swatch: dto.swatch ?? null,
      sortOrder: dto.sortOrder ?? 0,
      status: AttributeOptionStatus.Active,
    });

    return this.attributeOptionRepository.save(option);
  }

  async update(
    id: string,
    companyId: string,
    dto: UpdateAttributeOptionDto,
  ): Promise<AttributeOption> {
    const option = await this.findByIdInCompany(id, companyId);

    if (dto.swatch && option.kind !== AttributeKind.Color) {
      throw new AppException(
        ErrorCode.ValidationError,
        'swatch is only applicable when kind is COLOR',
      );
    }

    if (dto.value !== undefined) option.value = dto.value;
    if (dto.swatch !== undefined) option.swatch = dto.swatch;
    if (dto.sortOrder !== undefined) option.sortOrder = dto.sortOrder;

    return this.attributeOptionRepository.save(option);
  }

  async activate(id: string, companyId: string): Promise<AttributeOption> {
    const option = await this.findByIdInCompany(id, companyId);
    option.status = AttributeOptionStatus.Active;
    return this.attributeOptionRepository.save(option);
  }

  async deactivate(id: string, companyId: string): Promise<AttributeOption> {
    const option = await this.findByIdInCompany(id, companyId);
    option.status = AttributeOptionStatus.Inactive;
    return this.attributeOptionRepository.save(option);
  }

  async remove(id: string, companyId: string): Promise<void> {
    const option = await this.findByIdInCompany(id, companyId);
    await this.attributeOptionRepository.softRemove(option);
  }
}
