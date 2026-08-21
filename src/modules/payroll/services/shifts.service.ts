import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shift } from '../entities/shift.entity';
import { EmployeeShiftAssignment } from '../entities/employee-shift-assignment.entity';
import { CompaniesService } from '../../organization/services/companies.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';
import {
  CreateShiftDto,
  ListShiftsDto,
  UpdateShiftDto,
} from '../dto/shifts.dto';

const SORTABLE_FIELDS = ['createdAt', 'name', 'code'] as const;

@Injectable()
export class ShiftsService {
  constructor(
    @InjectRepository(Shift)
    private readonly shiftRepository: Repository<Shift>,
    @InjectRepository(EmployeeShiftAssignment)
    private readonly shiftAssignmentRepository: Repository<EmployeeShiftAssignment>,
    private readonly companiesService: CompaniesService,
  ) {}

  async findAll(
    companyId: string,
    query: ListShiftsDto,
    allowedBranchIds: string[] | null,
  ): Promise<{
    data: Shift[];
    meta: { page: number; limit: number; total: number };
  }> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(query.sort, SORTABLE_FIELDS, 'name');

    const qb = this.shiftRepository
      .createQueryBuilder('shift')
      .where('shift.companyId = :companyId', { companyId });

    if (query.branchId) {
      qb.andWhere('(shift.branchId = :branchId OR shift.branchId IS NULL)', {
        branchId: query.branchId,
      });
    } else if (allowedBranchIds) {
      qb.andWhere(
        '(shift.branchId IN (:...allowedBranchIds) OR shift.branchId IS NULL)',
        { allowedBranchIds },
      );
    }
    if (query.isActive !== undefined) {
      qb.andWhere('shift.isActive = :isActive', { isActive: query.isActive });
    }

    qb.orderBy(`shift.${sortField}`, query.order ?? 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(id: string, companyId: string): Promise<Shift> {
    const entity = await this.shiftRepository.findOne({
      where: { id, companyId },
    });
    if (!entity) {
      throw new AppException(ErrorCode.NotFound, 'Shift not found');
    }
    return entity;
  }

  async create(
    companyId: string,
    userId: string,
    dto: CreateShiftDto,
  ): Promise<Shift> {
    const company = await this.companiesService.findActiveByIdOrNull(companyId);
    if (!company) {
      throw new AppException(
        ErrorCode.ValidationError,
        'companyId does not reference an active company',
      );
    }

    const existing = await this.shiftRepository.findOne({
      where: { companyId, code: dto.code },
    });
    if (existing) {
      throw new AppException(
        ErrorCode.Conflict,
        'Shift code already exists for this company',
      );
    }

    const entity = this.shiftRepository.create({
      companyId,
      branchId: dto.branchId ?? null,
      name: dto.name,
      code: dto.code,
      startTime: dto.startTime,
      endTime: dto.endTime,
      breakMinutes: dto.breakMinutes ?? 0,
      graceMinutes: dto.graceMinutes ?? 0,
      isActive: true,
      createdBy: userId,
      updatedBy: userId,
    });
    return this.shiftRepository.save(entity);
  }

  async update(
    id: string,
    companyId: string,
    userId: string,
    dto: UpdateShiftDto,
  ): Promise<Shift> {
    const entity = await this.findByIdInCompany(id, companyId);

    if (dto.name !== undefined) entity.name = dto.name;
    if (dto.startTime !== undefined) entity.startTime = dto.startTime;
    if (dto.endTime !== undefined) entity.endTime = dto.endTime;
    if (dto.breakMinutes !== undefined) entity.breakMinutes = dto.breakMinutes;
    if (dto.graceMinutes !== undefined) entity.graceMinutes = dto.graceMinutes;
    if (dto.isActive !== undefined) entity.isActive = dto.isActive;
    entity.updatedBy = userId;

    return this.shiftRepository.save(entity);
  }

  /**
   * Soft delete only — a Shift referenced by historical
   * EmployeeShiftAssignment rows must never be hard deleted (the phase's
   * explicit rule). Blocked outright if any assignment (past or present)
   * references it, mirroring LeaveTypesService.remove()'s exact
   * "referenced by history => Conflict" precedent.
   */
  async remove(id: string, companyId: string): Promise<void> {
    const entity = await this.findByIdInCompany(id, companyId);
    const assignmentCount = await this.shiftAssignmentRepository.count({
      where: { shiftId: id },
    });
    if (assignmentCount > 0) {
      throw new AppException(
        ErrorCode.Conflict,
        'Shift is referenced by employee shift assignments and cannot be deleted',
      );
    }
    await this.shiftRepository.softRemove(entity);
  }
}
