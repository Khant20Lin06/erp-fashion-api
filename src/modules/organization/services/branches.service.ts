import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from '../entities/branch.entity';
import { BranchStatus } from '../entities/branch-status.enum';
import { Warehouse } from '../entities/warehouse.entity';
import { CompaniesService } from './companies.service';
import { CreateBranchDto } from '../dto/create-branch.dto';
import { UpdateBranchDto } from '../dto/update-branch.dto';
import { ListBranchesDto } from '../dto/list-branches.dto';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';

export interface PaginatedBranches {
  data: Branch[];
  meta: { page: number; limit: number; total: number };
}

const SORTABLE_FIELDS = ['createdAt', 'name', 'code', 'status'] as const;

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    private readonly companiesService: CompaniesService,
  ) {}

  async findAll(query: ListBranchesDto): Promise<PaginatedBranches> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(
      query.sort,
      SORTABLE_FIELDS,
      'createdAt',
    );

    const [data, total] = await this.branchRepository.findAndCount({
      where: query.companyId ? { companyId: query.companyId } : {},
      order: { [sortField]: query.order ?? 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, meta: { page, limit, total } };
  }

  async findById(id: string): Promise<Branch> {
    const branch = await this.branchRepository.findOne({ where: { id } });
    if (!branch) {
      throw new AppException(ErrorCode.NotFound, 'Branch not found');
    }
    return branch;
  }

  /** Used by WarehousesService to validate a branch parent (Phase 07 §12, §29). */
  async findActiveByIdOrNull(id: string): Promise<Branch | null> {
    return this.branchRepository.findOne({
      where: { id, status: BranchStatus.Active },
    });
  }

  /**
   * Hierarchy validation on create (Phase 07 §29): companyId must reference
   * an existing, active Company. Never trusts the client beyond using the
   * id to look the row up server-side.
   */
  async create(dto: CreateBranchDto): Promise<Branch> {
    const company = await this.companiesService.findActiveByIdOrNull(
      dto.companyId,
    );
    if (!company) {
      throw new AppException(
        ErrorCode.ValidationError,
        'companyId does not reference an active company',
      );
    }

    const existing = await this.branchRepository.findOne({
      where: { companyId: dto.companyId, code: dto.code },
    });
    if (existing) {
      throw new AppException(
        ErrorCode.Conflict,
        'Branch code already exists for this company',
      );
    }

    const branch = this.branchRepository.create({
      companyId: dto.companyId,
      code: dto.code,
      name: dto.name,
      status: BranchStatus.Active,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      address: dto.address ?? null,
      timezone: dto.timezone ?? null,
    });

    return this.branchRepository.save(branch);
  }

  /** companyId is immutable after creation (Phase 07 §64) — not accepted here. */
  async update(id: string, dto: UpdateBranchDto): Promise<Branch> {
    const branch = await this.findById(id);

    if (dto.name !== undefined) branch.name = dto.name;
    if (dto.phone !== undefined) branch.phone = dto.phone;
    if (dto.email !== undefined) branch.email = dto.email;
    if (dto.address !== undefined) branch.address = dto.address;
    if (dto.timezone !== undefined) branch.timezone = dto.timezone;

    return this.branchRepository.save(branch);
  }

  async activate(id: string): Promise<Branch> {
    const branch = await this.findById(id);
    branch.status = BranchStatus.Active;
    return this.branchRepository.save(branch);
  }

  async deactivate(id: string): Promise<Branch> {
    const branch = await this.findById(id);
    branch.status = BranchStatus.Inactive;
    return this.branchRepository.save(branch);
  }

  /**
   * Soft delete only, blocked while active Warehouse children exist (Phase
   * 07 §31) — mirrors CompaniesService.remove()'s child-check pattern.
   */
  async remove(id: string): Promise<void> {
    const branch = await this.findById(id);

    const warehouseCount = await this.warehouseRepository.count({
      where: { branchId: id },
    });
    if (warehouseCount > 0) {
      throw new AppException(
        ErrorCode.Conflict,
        'Branch has existing warehouses and cannot be deleted',
      );
    }

    await this.branchRepository.softRemove(branch);
  }
}
