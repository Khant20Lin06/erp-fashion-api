import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { LeaveType } from '../entities/leave-type.entity';
import { CompaniesService } from '../../organization/services/companies.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';
import { LeaveTypeStatus } from '../entities/leave-type-status.enum';
import {
  CreateLeaveTypeDto,
  ListLeaveTypesDto,
  UpdateLeaveTypeDto,
} from '../dto/leave-types.dto';
import { LeaveRequest } from '../entities/leave-request.entity';

const SORTABLE_FIELDS = ['createdAt', 'name', 'code', 'status'] as const;

@Injectable()
export class LeaveTypesService {
  constructor(
    @InjectRepository(LeaveType)
    private readonly leaveTypeRepository: Repository<LeaveType>,
    @InjectRepository(LeaveRequest)
    private readonly leaveRequestRepository: Repository<LeaveRequest>,
    private readonly companiesService: CompaniesService,
  ) {}

  async findAll(
    companyId: string,
    query: ListLeaveTypesDto,
  ): Promise<{
    data: LeaveType[];
    meta: { page: number; limit: number; total: number };
  }> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(query.sort, SORTABLE_FIELDS, 'name');

    const qb = this.leaveTypeRepository
      .createQueryBuilder('leaveType')
      .where('leaveType.companyId = :companyId', { companyId });

    if (query.status) {
      qb.andWhere('leaveType.status = :status', { status: query.status });
    }
    if (query.search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('leaveType.name LIKE :search', {
              search: `%${query.search}%`,
            })
            .orWhere('leaveType.code LIKE :search', {
              search: `%${query.search}%`,
            });
        }),
      );
    }

    qb.orderBy(`leaveType.${sortField}`, query.order ?? 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(id: string, companyId: string): Promise<LeaveType> {
    const entity = await this.leaveTypeRepository.findOne({
      where: { id, companyId },
    });
    if (!entity) {
      throw new AppException(ErrorCode.NotFound, 'Leave type not found');
    }
    return entity;
  }

  async create(companyId: string, dto: CreateLeaveTypeDto): Promise<LeaveType> {
    const company = await this.companiesService.findActiveByIdOrNull(companyId);
    if (!company) {
      throw new AppException(
        ErrorCode.ValidationError,
        'companyId does not reference an active company',
      );
    }

    const existing = await this.leaveTypeRepository.findOne({
      where: [
        { companyId, name: dto.name },
        { companyId, code: dto.code },
      ],
    });
    if (existing) {
      throw new AppException(
        ErrorCode.Conflict,
        'Leave type name or code already exists for this company',
      );
    }

    const entity = this.leaveTypeRepository.create({
      companyId,
      name: dto.name,
      code: dto.code,
      description: dto.description ?? null,
      isPaid: dto.isPaid ?? false,
      defaultDays: dto.defaultDays ?? null,
      status: LeaveTypeStatus.Active,
    });
    return this.leaveTypeRepository.save(entity);
  }

  async update(
    id: string,
    companyId: string,
    dto: UpdateLeaveTypeDto,
  ): Promise<LeaveType> {
    const entity = await this.findByIdInCompany(id, companyId);

    const nextName = dto.name ?? entity.name;
    const nextCode = dto.code ?? entity.code;
    const existing = await this.leaveTypeRepository
      .createQueryBuilder('leaveType')
      .where('leaveType.companyId = :companyId', { companyId })
      .andWhere('(leaveType.name = :name OR leaveType.code = :code)', {
        name: nextName,
        code: nextCode,
      })
      .andWhere('leaveType.id != :id', { id })
      .getOne();
    if (existing) {
      throw new AppException(
        ErrorCode.Conflict,
        'Leave type name or code already exists for this company',
      );
    }

    if (dto.name !== undefined) entity.name = dto.name;
    if (dto.code !== undefined) entity.code = dto.code;
    if (dto.description !== undefined) {
      entity.description = dto.description?.trim() || null;
    }
    if (dto.isPaid !== undefined) entity.isPaid = dto.isPaid;
    if (dto.defaultDays !== undefined) entity.defaultDays = dto.defaultDays;

    return this.leaveTypeRepository.save(entity);
  }

  async activate(id: string, companyId: string): Promise<LeaveType> {
    const entity = await this.findByIdInCompany(id, companyId);
    entity.status = LeaveTypeStatus.Active;
    return this.leaveTypeRepository.save(entity);
  }

  async deactivate(id: string, companyId: string): Promise<LeaveType> {
    const entity = await this.findByIdInCompany(id, companyId);
    entity.status = LeaveTypeStatus.Inactive;
    return this.leaveTypeRepository.save(entity);
  }

  async remove(id: string, companyId: string): Promise<void> {
    const entity = await this.findByIdInCompany(id, companyId);
    const requestCount = await this.leaveRequestRepository.count({
      where: { leaveTypeId: id },
    });
    if (requestCount > 0) {
      throw new AppException(
        ErrorCode.Conflict,
        'Leave type is referenced by leave requests and cannot be deleted',
      );
    }
    await this.leaveTypeRepository.softRemove(entity);
  }
}
