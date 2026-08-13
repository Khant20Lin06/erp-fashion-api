import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { CustomerGroup } from '../entities/customer-group.entity';
import { CustomerGroupStatus } from '../entities/customer-group-status.enum';
import { Customer } from '../entities/customer.entity';
import { CreateCustomerGroupDto } from '../dto/create-customer-group.dto';
import { UpdateCustomerGroupDto } from '../dto/update-customer-group.dto';
import { ListCustomerGroupsDto } from '../dto/list-customer-groups.dto';
import { CompaniesService } from '../../organization/services/companies.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';

export interface PaginatedCustomerGroups {
  data: CustomerGroup[];
  meta: { page: number; limit: number; total: number };
}

const SORTABLE_FIELDS = ['createdAt', 'name', 'code', 'status'] as const;

/**
 * Real, persisted, configurable Customer classification (Phase 11 §7,
 * LOCKED — not hard-coded Retail/Wholesale/VIP). Mirrors BrandsService's
 * company-scoped CRUD pattern exactly. `remove()` is blocked (409) while
 * any Customer still references this group.
 */
@Injectable()
export class CustomerGroupsService {
  constructor(
    @InjectRepository(CustomerGroup)
    private readonly customerGroupRepository: Repository<CustomerGroup>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    private readonly companiesService: CompaniesService,
  ) {}

  async findAll(
    companyId: string,
    query: ListCustomerGroupsDto,
  ): Promise<PaginatedCustomerGroups> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(
      query.sort,
      SORTABLE_FIELDS,
      'createdAt',
    );

    const qb = this.customerGroupRepository
      .createQueryBuilder('customerGroup')
      .where('customerGroup.companyId = :companyId', { companyId });

    if (query.status) {
      qb.andWhere('customerGroup.status = :status', { status: query.status });
    }
    if (query.search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('customerGroup.name LIKE :search', {
              search: `%${query.search}%`,
            })
            .orWhere('customerGroup.code LIKE :search', {
              search: `%${query.search}%`,
            });
        }),
      );
    }

    qb.orderBy(`customerGroup.${sortField}`, query.order ?? 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<CustomerGroup> {
    const group = await this.customerGroupRepository.findOne({
      where: { id, companyId },
    });
    if (!group) {
      throw new AppException(ErrorCode.NotFound, 'Customer group not found');
    }
    return group;
  }

  async create(
    companyId: string,
    dto: CreateCustomerGroupDto,
  ): Promise<CustomerGroup> {
    const company = await this.companiesService.findActiveByIdOrNull(companyId);
    if (!company) {
      throw new AppException(
        ErrorCode.ValidationError,
        'companyId does not reference an active company',
      );
    }

    const existing = await this.customerGroupRepository.findOne({
      where: { companyId, code: dto.code },
    });
    if (existing) {
      throw new AppException(
        ErrorCode.Conflict,
        'Customer group code already exists for this company',
      );
    }

    const group = this.customerGroupRepository.create({
      companyId,
      code: dto.code,
      name: dto.name,
      description: dto.description ?? null,
      status: CustomerGroupStatus.Active,
    });

    return this.customerGroupRepository.save(group);
  }

  async update(
    id: string,
    companyId: string,
    dto: UpdateCustomerGroupDto,
  ): Promise<CustomerGroup> {
    const group = await this.findByIdInCompany(id, companyId);

    if (dto.name !== undefined) group.name = dto.name;
    if (dto.description !== undefined) group.description = dto.description;

    return this.customerGroupRepository.save(group);
  }

  async activate(id: string, companyId: string): Promise<CustomerGroup> {
    const group = await this.findByIdInCompany(id, companyId);
    group.status = CustomerGroupStatus.Active;
    return this.customerGroupRepository.save(group);
  }

  async deactivate(id: string, companyId: string): Promise<CustomerGroup> {
    const group = await this.findByIdInCompany(id, companyId);
    group.status = CustomerGroupStatus.Inactive;
    return this.customerGroupRepository.save(group);
  }

  /** Soft delete, blocked (409) while any Customer still references this group. */
  async remove(id: string, companyId: string): Promise<void> {
    const group = await this.findByIdInCompany(id, companyId);

    const referencedCount = await this.customerRepository.count({
      where: { customerGroupId: id },
    });
    if (referencedCount > 0) {
      throw new AppException(
        ErrorCode.Conflict,
        'Customer group is still referenced by a customer and cannot be deleted',
      );
    }

    await this.customerGroupRepository.softRemove(group);
  }
}
