import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { SupplierGroup } from '../entities/supplier-group.entity';
import { SupplierGroupStatus } from '../entities/supplier-group-status.enum';
import { Supplier } from '../entities/supplier.entity';
import { CreateSupplierGroupDto } from '../dto/create-supplier-group.dto';
import { UpdateSupplierGroupDto } from '../dto/update-supplier-group.dto';
import { ListSupplierGroupsDto } from '../dto/list-supplier-groups.dto';
import { CompaniesService } from '../../organization/services/companies.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';

export interface PaginatedSupplierGroups {
  data: SupplierGroup[];
  meta: { page: number; limit: number; total: number };
}

const SORTABLE_FIELDS = ['createdAt', 'name', 'code', 'status'] as const;

/** Mirrors CustomerGroupsService exactly (Phase 11 §8, LOCKED). */
@Injectable()
export class SupplierGroupsService {
  constructor(
    @InjectRepository(SupplierGroup)
    private readonly supplierGroupRepository: Repository<SupplierGroup>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    private readonly companiesService: CompaniesService,
  ) {}

  async findAll(
    companyId: string,
    query: ListSupplierGroupsDto,
  ): Promise<PaginatedSupplierGroups> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(
      query.sort,
      SORTABLE_FIELDS,
      'createdAt',
    );

    const qb = this.supplierGroupRepository
      .createQueryBuilder('supplierGroup')
      .where('supplierGroup.companyId = :companyId', { companyId });

    if (query.status) {
      qb.andWhere('supplierGroup.status = :status', { status: query.status });
    }
    if (query.search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('supplierGroup.name LIKE :search', {
              search: `%${query.search}%`,
            })
            .orWhere('supplierGroup.code LIKE :search', {
              search: `%${query.search}%`,
            });
        }),
      );
    }

    qb.orderBy(`supplierGroup.${sortField}`, query.order ?? 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<SupplierGroup> {
    const group = await this.supplierGroupRepository.findOne({
      where: { id, companyId },
    });
    if (!group) {
      throw new AppException(ErrorCode.NotFound, 'Supplier group not found');
    }
    return group;
  }

  async create(
    companyId: string,
    dto: CreateSupplierGroupDto,
  ): Promise<SupplierGroup> {
    const company = await this.companiesService.findActiveByIdOrNull(companyId);
    if (!company) {
      throw new AppException(
        ErrorCode.ValidationError,
        'companyId does not reference an active company',
      );
    }

    const existing = await this.supplierGroupRepository.findOne({
      where: { companyId, code: dto.code },
    });
    if (existing) {
      throw new AppException(
        ErrorCode.Conflict,
        'Supplier group code already exists for this company',
      );
    }

    const group = this.supplierGroupRepository.create({
      companyId,
      code: dto.code,
      name: dto.name,
      description: dto.description ?? null,
      status: SupplierGroupStatus.Active,
    });

    return this.supplierGroupRepository.save(group);
  }

  async update(
    id: string,
    companyId: string,
    dto: UpdateSupplierGroupDto,
  ): Promise<SupplierGroup> {
    const group = await this.findByIdInCompany(id, companyId);

    if (dto.name !== undefined) group.name = dto.name;
    if (dto.description !== undefined) group.description = dto.description;

    return this.supplierGroupRepository.save(group);
  }

  async activate(id: string, companyId: string): Promise<SupplierGroup> {
    const group = await this.findByIdInCompany(id, companyId);
    group.status = SupplierGroupStatus.Active;
    return this.supplierGroupRepository.save(group);
  }

  async deactivate(id: string, companyId: string): Promise<SupplierGroup> {
    const group = await this.findByIdInCompany(id, companyId);
    group.status = SupplierGroupStatus.Inactive;
    return this.supplierGroupRepository.save(group);
  }

  /** Soft delete, blocked (409) while any Supplier still references this group. */
  async remove(id: string, companyId: string): Promise<void> {
    const group = await this.findByIdInCompany(id, companyId);

    const referencedCount = await this.supplierRepository.count({
      where: { supplierGroupId: id },
    });
    if (referencedCount > 0) {
      throw new AppException(
        ErrorCode.Conflict,
        'Supplier group is still referenced by a supplier and cannot be deleted',
      );
    }

    await this.supplierGroupRepository.softRemove(group);
  }
}
