import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesAccount } from '../entities/sales-account.entity';
import { SalesAccountStatus } from '../entities/sales-account-status.enum';
import { CreateSalesAccountDto } from '../dto/create-sales-account.dto';
import { UpdateSalesAccountDto } from '../dto/update-sales-account.dto';
import { ListSalesAccountsDto } from '../dto/list-sales-accounts.dto';
import { CompaniesService } from '../../organization/services/companies.service';
import { BranchesService } from '../../organization/services/branches.service';
import { Employee } from '../../employees/entities/employee.entity';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';

export interface PaginatedSalesAccounts {
  data: SalesAccount[];
  meta: { page: number; limit: number; total: number };
}

const SORTABLE_FIELDS = ['createdAt', 'name', 'code', 'status'] as const;

/**
 * Sales ownership/portfolio identity — NOT the Accounting GL Account
 * (Phase 08 §27-31, §104-105). Never implements Sales transaction logic;
 * only the ownership foundation Phase 12 will consume.
 */
@Injectable()
export class SalesAccountsService {
  constructor(
    @InjectRepository(SalesAccount)
    private readonly salesAccountRepository: Repository<SalesAccount>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    private readonly companiesService: CompaniesService,
    private readonly branchesService: BranchesService,
  ) {}

  async findAll(query: ListSalesAccountsDto): Promise<PaginatedSalesAccounts> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(
      query.sort,
      SORTABLE_FIELDS,
      'createdAt',
    );

    const where: Record<string, unknown> = {};
    if (query.companyId) where.companyId = query.companyId;
    if (query.branchId) where.branchId = query.branchId;
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.status) where.status = query.status;

    const [data, total] = await this.salesAccountRepository.findAndCount({
      where,
      order: { [sortField]: query.order ?? 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, meta: { page, limit, total } };
  }

  async findById(id: string): Promise<SalesAccount> {
    const account = await this.salesAccountRepository.findOne({
      where: { id },
    });
    if (!account) {
      throw new AppException(ErrorCode.NotFound, 'Sales account not found');
    }
    return account;
  }

  /** Used by SalesAccountAssignmentService to validate an active account before assignment. */
  async findActiveByIdOrNull(id: string): Promise<SalesAccount | null> {
    return this.salesAccountRepository.findOne({
      where: { id, status: SalesAccountStatus.Active },
    });
  }

  /**
   * Hierarchy validation on create (Phase 08 §37, §55, mirroring Phase 07's
   * own Warehouse pattern): companyId must reference an active Company,
   * branchId must reference an active Branch whose companyId matches, and
   * an optional employeeId must reference a real Employee belonging to the
   * same company (§56).
   */
  async create(dto: CreateSalesAccountDto): Promise<SalesAccount> {
    const company = await this.companiesService.findActiveByIdOrNull(
      dto.companyId,
    );
    if (!company) {
      throw new AppException(
        ErrorCode.ValidationError,
        'companyId does not reference an active company',
      );
    }

    const branch = await this.branchesService.findActiveByIdOrNull(
      dto.branchId,
    );
    if (!branch) {
      throw new AppException(
        ErrorCode.ValidationError,
        'branchId does not reference an active branch',
      );
    }

    if (branch.companyId !== dto.companyId) {
      throw new AppException(
        ErrorCode.ValidationError,
        'branchId does not belong to the specified companyId',
      );
    }

    let employeeId: string | null = null;
    if (dto.employeeId) {
      const employee = await this.employeeRepository.findOne({
        where: { id: dto.employeeId },
      });
      if (!employee) {
        throw new AppException(
          ErrorCode.ValidationError,
          'employeeId does not reference an existing employee',
        );
      }
      if (employee.companyId !== dto.companyId) {
        throw new AppException(
          ErrorCode.ValidationError,
          'employeeId does not belong to the specified companyId',
        );
      }
      employeeId = employee.id;
    }

    const existing = await this.salesAccountRepository.findOne({
      where: { companyId: dto.companyId, code: dto.code },
    });
    if (existing) {
      throw new AppException(
        ErrorCode.Conflict,
        'Sales account code already exists for this company',
      );
    }

    const account = this.salesAccountRepository.create({
      code: dto.code,
      name: dto.name,
      companyId: dto.companyId,
      branchId: dto.branchId,
      employeeId,
      status: SalesAccountStatus.Active,
    });

    return this.salesAccountRepository.save(account);
  }

  async update(id: string, dto: UpdateSalesAccountDto): Promise<SalesAccount> {
    const account = await this.findById(id);

    if (dto.name !== undefined) account.name = dto.name;

    return this.salesAccountRepository.save(account);
  }

  async activate(id: string): Promise<SalesAccount> {
    const account = await this.findById(id);
    account.status = SalesAccountStatus.Active;
    return this.salesAccountRepository.save(account);
  }

  /** Inactive accounts cannot receive new assignments (Phase 08 §39, §103) — enforced in SalesAccountAssignmentService. */
  async deactivate(id: string): Promise<SalesAccount> {
    const account = await this.findById(id);
    account.status = SalesAccountStatus.Inactive;
    return this.salesAccountRepository.save(account);
  }
}
