import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Warehouse } from '../entities/warehouse.entity';
import { WarehouseStatus } from '../entities/warehouse-status.enum';
import { WarehouseType } from '../entities/warehouse-type.enum';
import { CompaniesService } from './companies.service';
import { BranchesService } from './branches.service';
import { CreateWarehouseDto } from '../dto/create-warehouse.dto';
import { UpdateWarehouseDto } from '../dto/update-warehouse.dto';
import { ListWarehousesDto } from '../dto/list-warehouses.dto';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';

export interface PaginatedWarehouses {
  data: Warehouse[];
  meta: { page: number; limit: number; total: number };
}

const SORTABLE_FIELDS = [
  'createdAt',
  'name',
  'code',
  'status',
  'type',
] as const;

@Injectable()
export class WarehousesService {
  constructor(
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    private readonly companiesService: CompaniesService,
    private readonly branchesService: BranchesService,
  ) {}

  async findAll(
    companyId: string,
    query: ListWarehousesDto,
  ): Promise<PaginatedWarehouses> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(
      query.sort,
      SORTABLE_FIELDS,
      'createdAt',
    );

    const where: Record<string, unknown> = { companyId };
    if (query.branchId) where.branchId = query.branchId;
    if (query.status) where.status = query.status;

    const [data, total] = await this.warehouseRepository.findAndCount({
      where,
      order: { [sortField]: query.order ?? 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, meta: { page, limit, total } };
  }

  async findById(id: string): Promise<Warehouse> {
    const warehouse = await this.warehouseRepository.findOne({ where: { id } });
    if (!warehouse) {
      throw new AppException(ErrorCode.NotFound, 'Warehouse not found');
    }
    return warehouse;
  }

  async findByIdInCompany(id: string, companyId: string): Promise<Warehouse> {
    const warehouse = await this.warehouseRepository.findOne({
      where: { id, companyId },
    });
    if (!warehouse) {
      throw new AppException(ErrorCode.NotFound, 'Warehouse not found');
    }
    return warehouse;
  }

  /**
   * Hierarchy + cross-company integrity validation on create (Phase 07 §12,
   * §29 — the phase's own "critical integrity rule"): companyId must
   * reference an existing active Company, branchId must reference an
   * existing active Branch, and that branch's companyId must equal the
   * submitted companyId. Client-submitted companyId/branchId are never
   * trusted beyond using them to look the real rows up server-side.
   */
  async create(companyId: string, dto: CreateWarehouseDto): Promise<Warehouse> {
    const company = await this.companiesService.findActiveByIdOrNull(companyId);
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

    if (branch.companyId !== companyId) {
      throw new AppException(
        ErrorCode.ValidationError,
        'branchId does not belong to the specified companyId',
      );
    }

    const existing = await this.warehouseRepository.findOne({
      where: { companyId, code: dto.code },
    });
    if (existing) {
      throw new AppException(
        ErrorCode.Conflict,
        'Warehouse code already exists for this company',
      );
    }

    const warehouse = this.warehouseRepository.create({
      companyId,
      branchId: dto.branchId,
      code: dto.code,
      name: dto.name,
      type: dto.type ?? WarehouseType.Main,
      status: WarehouseStatus.Active,
      address: dto.address ?? null,
    });

    return this.warehouseRepository.save(warehouse);
  }

  /** companyId/branchId are immutable after creation (Phase 07 §64) — not accepted here. */
  async update(
    id: string,
    companyId: string,
    dto: UpdateWarehouseDto,
  ): Promise<Warehouse> {
    const warehouse = await this.findByIdInCompany(id, companyId);

    if (dto.name !== undefined) warehouse.name = dto.name;
    if (dto.type !== undefined) warehouse.type = dto.type;
    if (dto.address !== undefined) warehouse.address = dto.address;

    return this.warehouseRepository.save(warehouse);
  }

  async activate(id: string, companyId: string): Promise<Warehouse> {
    const warehouse = await this.findByIdInCompany(id, companyId);
    warehouse.status = WarehouseStatus.Active;
    return this.warehouseRepository.save(warehouse);
  }

  async deactivate(id: string, companyId: string): Promise<Warehouse> {
    const warehouse = await this.findByIdInCompany(id, companyId);
    warehouse.status = WarehouseStatus.Inactive;
    return this.warehouseRepository.save(warehouse);
  }

  /** Soft delete only (Phase 07 §31) — no business records exist yet to block on. */
  async remove(id: string, companyId: string): Promise<void> {
    const warehouse = await this.findByIdInCompany(id, companyId);
    await this.warehouseRepository.softRemove(warehouse);
  }
}
