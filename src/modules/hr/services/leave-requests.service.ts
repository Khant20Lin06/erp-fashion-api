import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaveRequest } from '../entities/leave-request.entity';
import {
  CreateLeaveRequestDto,
  ListLeaveRequestsDto,
  UpdateLeaveRequestDto,
} from '../dto/leave-requests.dto';
import { Employee } from '../../employees/entities/employee.entity';
import { LeaveType } from '../entities/leave-type.entity';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';
import { validateDateRange } from '../../../shared/utils/validate-date-range';
import { LeaveRequestStatus } from '../entities/leave-request-status.enum';
import { LeaveTypeStatus } from '../entities/leave-type-status.enum';
import { TransactionService } from '../../../core/transaction/transaction.service';

const SORTABLE_FIELDS = ['createdAt', 'fromDate', 'toDate', 'status'] as const;

@Injectable()
export class LeaveRequestsService {
  constructor(
    @InjectRepository(LeaveRequest)
    private readonly leaveRequestRepository: Repository<LeaveRequest>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(LeaveType)
    private readonly leaveTypeRepository: Repository<LeaveType>,
    private readonly transactionService: TransactionService,
  ) {}

  async findAll(
    userId: string,
    query: ListLeaveRequestsDto,
    scope: {
      companyId?: string;
      allowedBranchIds?: string[] | null;
      ownOnly?: boolean;
    },
  ): Promise<{
    data: LeaveRequest[];
    meta: { page: number; limit: number; total: number };
  }> {
    validateDateRange(query.fromDate, query.toDate);
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(
      query.sort,
      SORTABLE_FIELDS,
      'createdAt',
    );

    const qb = this.leaveRequestRepository
      .createQueryBuilder('leaveRequest')
      .innerJoin(Employee, 'employee', 'employee.id = leaveRequest.employeeId');

    if (scope.ownOnly) {
      qb.where('employee.userId = :userId', { userId });
    } else {
      qb.where('leaveRequest.companyId = :companyId', {
        companyId: scope.companyId,
      });
      if (scope.allowedBranchIds) {
        qb.andWhere('leaveRequest.branchId IN (:...allowedBranchIds)', {
          allowedBranchIds: scope.allowedBranchIds,
        });
      } else if (query.branchId) {
        qb.andWhere('leaveRequest.branchId = :branchId', {
          branchId: query.branchId,
        });
      }
    }

    if (query.employeeId) {
      qb.andWhere('leaveRequest.employeeId = :employeeId', {
        employeeId: query.employeeId,
      });
    }
    if (query.status) {
      qb.andWhere('leaveRequest.status = :status', { status: query.status });
    }
    if (query.fromDate) {
      qb.andWhere('leaveRequest.fromDate >= :fromDate', {
        fromDate: query.fromDate.slice(0, 10),
      });
    }
    if (query.toDate) {
      qb.andWhere('leaveRequest.toDate <= :toDate', {
        toDate: query.toDate.slice(0, 10),
      });
    }

    qb.orderBy(`leaveRequest.${sortField}`, query.order ?? 'DESC')
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
  ): Promise<LeaveRequest> {
    const qb = this.leaveRequestRepository
      .createQueryBuilder('leaveRequest')
      .innerJoin(Employee, 'employee', 'employee.id = leaveRequest.employeeId')
      .where('leaveRequest.id = :id', { id });

    if (scope.ownOnly) {
      qb.andWhere('employee.userId = :userId', { userId });
    } else {
      qb.andWhere('leaveRequest.companyId = :companyId', {
        companyId: scope.companyId,
      });
      if (scope.allowedBranchIds) {
        qb.andWhere('leaveRequest.branchId IN (:...allowedBranchIds)', {
          allowedBranchIds: scope.allowedBranchIds,
        });
      }
    }

    const entity = await qb.getOne();
    if (!entity) {
      throw new AppException(ErrorCode.NotFound, 'Leave request not found');
    }
    return entity;
  }

  async create(
    actorUserId: string,
    companyId: string | undefined,
    dto: CreateLeaveRequestDto,
    ownOnly: boolean,
  ): Promise<LeaveRequest> {
    validateDateRange(dto.fromDate, dto.toDate);

    const employee = ownOnly
      ? await this.employeeRepository.findOne({
          where: { id: dto.employeeId, userId: actorUserId },
        })
      : await this.employeeRepository.findOne({
          where: { id: dto.employeeId, companyId },
        });
    if (!employee) {
      throw new AppException(
        ErrorCode.ValidationError,
        ownOnly
          ? 'employeeId does not reference your employee record'
          : 'employeeId does not reference an employee in the specified company',
      );
    }
    if (ownOnly && employee.userId !== actorUserId) {
      throw new AppException(
        ErrorCode.Forbidden,
        'Own-scoped access can only create leave requests for the current employee',
      );
    }

    const leaveType = await this.leaveTypeRepository.findOne({
      where: {
        id: dto.leaveTypeId,
        companyId: employee.companyId,
        status: LeaveTypeStatus.Active,
      },
    });
    if (!leaveType) {
      throw new AppException(
        ErrorCode.ValidationError,
        'leaveTypeId does not reference an active leave type in this company',
      );
    }

    const entity = this.leaveRequestRepository.create({
      employeeId: employee.id,
      companyId: employee.companyId,
      branchId: employee.branchId,
      leaveTypeId: leaveType.id,
      fromDate: dto.fromDate.slice(0, 10),
      toDate: dto.toDate.slice(0, 10),
      reason: dto.reason ?? null,
      status: LeaveRequestStatus.Pending,
      approvedByUserId: null,
      rejectedByUserId: null,
      decisionAt: null,
      cancelledAt: null,
    });

    return this.leaveRequestRepository.save(entity);
  }

  async update(
    id: string,
    userId: string,
    companyId: string,
    dto: UpdateLeaveRequestDto,
    ownOnly: boolean,
  ): Promise<LeaveRequest> {
    const entity = await this.findById(id, userId, {
      companyId,
      ownOnly,
    });

    if (entity.status !== LeaveRequestStatus.Pending) {
      throw new AppException(
        ErrorCode.Conflict,
        'Only pending leave requests can be updated',
      );
    }

    const nextFromDate = dto.fromDate ?? entity.fromDate;
    const nextToDate = dto.toDate ?? entity.toDate;
    validateDateRange(nextFromDate, nextToDate);

    if (dto.fromDate !== undefined) entity.fromDate = dto.fromDate.slice(0, 10);
    if (dto.toDate !== undefined) entity.toDate = dto.toDate.slice(0, 10);
    if (dto.reason !== undefined) entity.reason = dto.reason?.trim() || null;

    return this.leaveRequestRepository.save(entity);
  }

  async approve(
    id: string,
    actorUserId: string,
    companyId: string,
  ): Promise<LeaveRequest> {
    return this.transition(
      id,
      actorUserId,
      companyId,
      LeaveRequestStatus.Approved,
    );
  }

  async reject(
    id: string,
    actorUserId: string,
    companyId: string,
  ): Promise<LeaveRequest> {
    return this.transition(
      id,
      actorUserId,
      companyId,
      LeaveRequestStatus.Rejected,
    );
  }

  async cancel(
    id: string,
    actorUserId: string,
    companyId: string,
  ): Promise<LeaveRequest> {
    return this.transactionService.run(async (manager) => {
      const entity = await manager.findOne(LeaveRequest, {
        where: { id, companyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!entity) {
        throw new AppException(ErrorCode.NotFound, 'Leave request not found');
      }

      const employee = await manager.findOne(Employee, {
        where: { id: entity.employeeId },
      });
      if (!employee || employee.userId !== actorUserId) {
        throw new AppException(
          ErrorCode.Forbidden,
          'Only the owning employee can cancel this leave request',
        );
      }
      if (entity.status !== LeaveRequestStatus.Pending) {
        throw new AppException(
          ErrorCode.Conflict,
          'Only pending leave requests can be cancelled',
        );
      }

      entity.status = LeaveRequestStatus.Cancelled;
      entity.cancelledAt = new Date();
      entity.decisionAt = new Date();
      return manager.save(LeaveRequest, entity);
    });
  }

  private async transition(
    id: string,
    actorUserId: string,
    companyId: string,
    status: LeaveRequestStatus.Approved | LeaveRequestStatus.Rejected,
  ): Promise<LeaveRequest> {
    return this.transactionService.run(async (manager) => {
      const entity = await manager.findOne(LeaveRequest, {
        where: { id, companyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!entity) {
        throw new AppException(ErrorCode.NotFound, 'Leave request not found');
      }

      const employee = await manager.findOne(Employee, {
        where: { id: entity.employeeId },
      });
      if (employee?.userId === actorUserId) {
        throw new AppException(
          ErrorCode.Forbidden,
          'Employees cannot approve or reject their own leave requests',
        );
      }
      if (entity.status !== LeaveRequestStatus.Pending) {
        throw new AppException(
          ErrorCode.Conflict,
          'Only pending leave requests can be approved or rejected',
        );
      }

      entity.status = status;
      entity.decisionAt = new Date();
      entity.cancelledAt = null;
      if (status === LeaveRequestStatus.Approved) {
        entity.approvedByUserId = actorUserId;
        entity.rejectedByUserId = null;
      } else {
        entity.rejectedByUserId = actorUserId;
        entity.approvedByUserId = null;
      }

      return manager.save(LeaveRequest, entity);
    });
  }
}
