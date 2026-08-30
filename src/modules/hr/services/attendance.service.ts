import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceRecord } from '../entities/attendance-record.entity';
import {
  CreateAttendanceRecordDto,
  ListAttendanceRecordsDto,
  UpdateAttendanceRecordDto,
} from '../dto/attendance.dto';
import { Employee } from '../../employees/entities/employee.entity';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';
import { validateDateRange } from '../../../shared/utils/validate-date-range';

const SORTABLE_FIELDS = ['createdAt', 'attendanceDate', 'status'] as const;

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceRecord)
    private readonly attendanceRepository: Repository<AttendanceRecord>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
  ) {}

  async findAll(
    userId: string,
    query: ListAttendanceRecordsDto,
    scope: {
      companyId?: string;
      allowedBranchIds?: string[] | null;
      ownOnly?: boolean;
    },
  ): Promise<{
    data: AttendanceRecord[];
    meta: { page: number; limit: number; total: number };
  }> {
    validateDateRange(query.attendanceDateFrom, query.attendanceDateTo);
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(
      query.sort,
      SORTABLE_FIELDS,
      'attendanceDate',
    );

    const qb = this.attendanceRepository
      .createQueryBuilder('attendance')
      .innerJoinAndSelect('attendance.employee', 'employee');

    if (scope.ownOnly) {
      qb.where('employee.userId = :userId', { userId });
    } else {
      qb.where('attendance.companyId = :companyId', {
        companyId: scope.companyId,
      });
      if (scope.allowedBranchIds) {
        qb.andWhere('attendance.branchId IN (:...allowedBranchIds)', {
          allowedBranchIds: scope.allowedBranchIds,
        });
      } else if (query.branchId) {
        qb.andWhere('attendance.branchId = :branchId', {
          branchId: query.branchId,
        });
      }
    }

    if (query.employeeId) {
      qb.andWhere('attendance.employeeId = :employeeId', {
        employeeId: query.employeeId,
      });
    }
    if (query.status) {
      qb.andWhere('attendance.status = :status', { status: query.status });
    }
    if (query.attendanceDateFrom) {
      qb.andWhere('attendance.attendanceDate >= :fromDate', {
        fromDate: query.attendanceDateFrom.slice(0, 10),
      });
    }
    if (query.attendanceDateTo) {
      qb.andWhere('attendance.attendanceDate <= :toDate', {
        toDate: query.attendanceDateTo.slice(0, 10),
      });
    }

    qb.orderBy(`attendance.${sortField}`, query.order ?? 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total } };
  }

  async findById(
    id: string,
    userId: string,
    scope: {
      companyId?: string;
      allowedBranchIds?: string[] | null;
      ownOnly?: boolean;
    },
  ): Promise<AttendanceRecord> {
    const qb = this.attendanceRepository
      .createQueryBuilder('attendance')
      .innerJoinAndSelect('attendance.employee', 'employee')
      .where('attendance.id = :id', { id });

    if (scope.ownOnly) {
      qb.andWhere('employee.userId = :userId', { userId });
    } else {
      qb.andWhere('attendance.companyId = :companyId', {
        companyId: scope.companyId,
      });
      if (scope.allowedBranchIds) {
        qb.andWhere('attendance.branchId IN (:...allowedBranchIds)', {
          allowedBranchIds: scope.allowedBranchIds,
        });
      }
    }

    const entity = await qb.getOne();
    if (!entity) {
      throw new AppException(ErrorCode.NotFound, 'Attendance record not found');
    }
    return entity;
  }

  async create(
    companyId: string,
    dto: CreateAttendanceRecordDto,
  ): Promise<AttendanceRecord> {
    const employee = await this.employeeRepository.findOne({
      where: { id: dto.employeeId, companyId },
    });
    if (!employee) {
      throw new AppException(
        ErrorCode.ValidationError,
        'employeeId does not reference an employee in the specified company',
      );
    }

    const existing = await this.attendanceRepository.findOne({
      where: {
        employeeId: dto.employeeId,
        attendanceDate: dto.attendanceDate.slice(0, 10),
      },
    });
    if (existing) {
      throw new AppException(
        ErrorCode.Conflict,
        'Attendance already exists for this employee and date',
      );
    }

    const entity = this.attendanceRepository.create({
      employeeId: dto.employeeId,
      companyId,
      branchId: employee.branchId,
      attendanceDate: dto.attendanceDate.slice(0, 10),
      status: dto.status,
      checkInAt: dto.checkInAt ? new Date(dto.checkInAt) : null,
      checkOutAt: dto.checkOutAt ? new Date(dto.checkOutAt) : null,
      note: dto.note ?? null,
    });
    this.assertCheckInOut(entity.checkInAt, entity.checkOutAt);
    const saved = await this.attendanceRepository.save(entity);
    return Object.assign(saved, { employee });
  }

  async update(
    id: string,
    companyId: string,
    dto: UpdateAttendanceRecordDto,
  ): Promise<AttendanceRecord> {
    const entity = await this.attendanceRepository.findOne({
      where: { id, companyId },
    });
    if (!entity) {
      throw new AppException(ErrorCode.NotFound, 'Attendance record not found');
    }

    if (dto.status !== undefined) entity.status = dto.status;
    if (dto.checkInAt !== undefined) {
      entity.checkInAt = dto.checkInAt ? new Date(dto.checkInAt) : null;
    }
    if (dto.checkOutAt !== undefined) {
      entity.checkOutAt = dto.checkOutAt ? new Date(dto.checkOutAt) : null;
    }
    if (dto.note !== undefined) {
      entity.note = dto.note?.trim() || null;
    }
    this.assertCheckInOut(entity.checkInAt, entity.checkOutAt);
    const saved = await this.attendanceRepository.save(entity);
    const employee = await this.employeeRepository.findOne({
      where: { id: saved.employeeId, companyId },
    });
    return Object.assign(saved, { employee: employee ?? undefined });
  }

  private assertCheckInOut(
    checkInAt: Date | null,
    checkOutAt: Date | null,
  ): void {
    if (checkInAt && checkOutAt && checkOutAt.getTime() < checkInAt.getTime()) {
      throw new AppException(
        ErrorCode.ValidationError,
        'checkOutAt must be greater than or equal to checkInAt',
      );
    }
  }
}
