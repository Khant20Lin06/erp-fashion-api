import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, Repository } from 'typeorm';
import { EmployeeAssignment } from '../entities/employee-assignment.entity';
import {
  CreateEmployeeAssignmentDto,
  ListEmployeeAssignmentsDto,
  UpdateEmployeeAssignmentDto,
} from '../dto/employee-assignments.dto';
import { Employee } from '../../employees/entities/employee.entity';
import { Department } from '../entities/department.entity';
import { Designation } from '../entities/designation.entity';
import { Warehouse } from '../../organization/entities/warehouse.entity';
import { Branch } from '../../organization/entities/branch.entity';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';
import { EmployeeAssignmentStatus } from '../entities/employee-assignment-status.enum';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { validateDateRange } from '../../../shared/utils/validate-date-range';

const SORTABLE_FIELDS = ['createdAt', 'effectiveFrom', 'status'] as const;

@Injectable()
export class EmployeeAssignmentsService {
  constructor(
    @InjectRepository(EmployeeAssignment)
    private readonly assignmentRepository: Repository<EmployeeAssignment>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    @InjectRepository(Designation)
    private readonly designationRepository: Repository<Designation>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    private readonly transactionService: TransactionService,
  ) {}

  async findAll(
    companyId: string,
    query: ListEmployeeAssignmentsDto,
    allowedBranchIds: string[] | null,
  ): Promise<{
    data: EmployeeAssignment[];
    meta: { page: number; limit: number; total: number };
  }> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(
      query.sort,
      SORTABLE_FIELDS,
      'effectiveFrom',
    );

    const qb = this.assignmentRepository
      .createQueryBuilder('assignment')
      .where('assignment.companyId = :companyId', { companyId });

    if (query.employeeId) {
      qb.andWhere('assignment.employeeId = :employeeId', {
        employeeId: query.employeeId,
      });
    }
    if (query.branchId) {
      qb.andWhere('assignment.branchId = :branchId', {
        branchId: query.branchId,
      });
    }
    if (allowedBranchIds) {
      qb.andWhere('assignment.branchId IN (:...allowedBranchIds)', {
        allowedBranchIds,
      });
    }
    if (query.status) {
      qb.andWhere('assignment.status = :status', { status: query.status });
    }

    qb.orderBy(`assignment.${sortField}`, query.order ?? 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total } };
  }

  async findByIdInScope(
    id: string,
    companyId: string,
    allowedBranchIds: string[] | null,
  ): Promise<EmployeeAssignment> {
    const qb = this.assignmentRepository
      .createQueryBuilder('assignment')
      .where('assignment.id = :id', { id })
      .andWhere('assignment.companyId = :companyId', { companyId });

    if (allowedBranchIds) {
      qb.andWhere('assignment.branchId IN (:...allowedBranchIds)', {
        allowedBranchIds,
      });
    }

    const entity = await qb.getOne();
    if (!entity) {
      throw new AppException(
        ErrorCode.NotFound,
        'Employee assignment not found',
      );
    }
    return entity;
  }

  async create(dto: CreateEmployeeAssignmentDto): Promise<EmployeeAssignment> {
    validateDateRange(dto.effectiveFrom, dto.effectiveTo);

    return this.transactionService.run(async (manager) => {
      await this.assertValidRelations(manager, dto);
      await this.assertNoOverlap(
        manager,
        dto.employeeId,
        dto.effectiveFrom,
        dto.effectiveTo,
      );

      const entity = manager.create(EmployeeAssignment, {
        employeeId: dto.employeeId,
        companyId: dto.companyId,
        branchId: dto.branchId,
        departmentId: dto.departmentId ?? null,
        designationId: dto.designationId ?? null,
        warehouseId: dto.warehouseId ?? null,
        effectiveFrom: dto.effectiveFrom.slice(0, 10),
        effectiveTo: dto.effectiveTo?.slice(0, 10) ?? null,
        status: EmployeeAssignmentStatus.Active,
      });

      return manager.save(EmployeeAssignment, entity);
    });
  }

  async update(
    id: string,
    companyId: string,
    dto: UpdateEmployeeAssignmentDto,
  ): Promise<EmployeeAssignment> {
    return this.transactionService.run(async (manager) => {
      const entity = await manager.findOne(EmployeeAssignment, {
        where: { id, companyId },
      });
      if (!entity) {
        throw new AppException(
          ErrorCode.NotFound,
          'Employee assignment not found',
        );
      }

      const next = {
        employeeId: entity.employeeId,
        companyId: entity.companyId,
        branchId: entity.branchId,
        departmentId:
          dto.departmentId === undefined
            ? entity.departmentId
            : dto.departmentId,
        designationId:
          dto.designationId === undefined
            ? entity.designationId
            : dto.designationId,
        warehouseId:
          dto.warehouseId === undefined ? entity.warehouseId : dto.warehouseId,
        effectiveFrom: dto.effectiveFrom ?? entity.effectiveFrom,
        effectiveTo:
          dto.effectiveTo === undefined ? entity.effectiveTo : dto.effectiveTo,
      };
      validateDateRange(next.effectiveFrom, next.effectiveTo ?? undefined);
      await this.assertValidRelations(manager, next);
      await this.assertNoOverlap(
        manager,
        entity.employeeId,
        next.effectiveFrom,
        next.effectiveTo,
        id,
      );

      entity.departmentId = next.departmentId ?? null;
      entity.designationId = next.designationId ?? null;
      entity.warehouseId = next.warehouseId ?? null;
      entity.effectiveFrom = next.effectiveFrom.slice(0, 10);
      entity.effectiveTo = next.effectiveTo?.slice(0, 10) ?? null;
      if (dto.status !== undefined) {
        entity.status = dto.status;
      }

      return manager.save(EmployeeAssignment, entity);
    });
  }

  private async assertValidRelations(
    manager: EntityManager,
    input: {
      employeeId: string;
      companyId: string;
      branchId: string;
      departmentId?: string | null;
      designationId?: string | null;
      warehouseId?: string | null;
    },
  ): Promise<void> {
    const employee = await manager.findOne(Employee, {
      where: { id: input.employeeId, companyId: input.companyId },
    });
    if (!employee) {
      throw new AppException(
        ErrorCode.ValidationError,
        'employeeId does not reference an employee in the specified company',
      );
    }
    if (employee.branchId !== input.branchId) {
      throw new AppException(
        ErrorCode.ValidationError,
        'branchId must match the employee branch assignment',
      );
    }

    const branch = await manager.findOne(Branch, {
      where: { id: input.branchId, companyId: input.companyId },
    });
    if (!branch) {
      throw new AppException(
        ErrorCode.ValidationError,
        'branchId does not reference a branch in the specified company',
      );
    }

    if (input.departmentId) {
      const department = await manager.findOne(Department, {
        where: { id: input.departmentId, companyId: input.companyId },
      });
      if (!department) {
        throw new AppException(
          ErrorCode.ValidationError,
          'departmentId does not reference a department in the specified company',
        );
      }
    }

    if (input.designationId) {
      const designation = await manager.findOne(Designation, {
        where: { id: input.designationId, companyId: input.companyId },
      });
      if (!designation) {
        throw new AppException(
          ErrorCode.ValidationError,
          'designationId does not reference a designation in the specified company',
        );
      }
    }

    if (input.warehouseId) {
      const warehouse = await manager.findOne(Warehouse, {
        where: { id: input.warehouseId, companyId: input.companyId },
      });
      if (!warehouse) {
        throw new AppException(
          ErrorCode.ValidationError,
          'warehouseId does not reference a warehouse in the specified company',
        );
      }
      if (warehouse.branchId !== input.branchId) {
        throw new AppException(
          ErrorCode.ValidationError,
          'warehouseId does not belong to the specified branchId',
        );
      }
    }
  }

  private async assertNoOverlap(
    manager: EntityManager,
    employeeId: string,
    effectiveFrom: string,
    effectiveTo: string | null | undefined,
    ignoreId?: string,
  ): Promise<void> {
    const qb = manager
      .getRepository(EmployeeAssignment)
      .createQueryBuilder('assignment')
      .where('assignment.employeeId = :employeeId', { employeeId })
      .andWhere(
        new Brackets((sub) => {
          sub
            .where('assignment.effectiveTo IS NULL')
            .orWhere('assignment.effectiveTo >= :effectiveFrom', {
              effectiveFrom: effectiveFrom.slice(0, 10),
            });
        }),
      )
      .andWhere(
        new Brackets((sub) => {
          if (effectiveTo) {
            sub.where('assignment.effectiveFrom <= :effectiveTo', {
              effectiveTo: effectiveTo.slice(0, 10),
            });
          } else {
            sub.where('1 = 1');
          }
        }),
      );

    if (ignoreId) {
      qb.andWhere('assignment.id != :ignoreId', { ignoreId });
    }

    const existing = await qb.getOne();
    if (existing) {
      throw new AppException(
        ErrorCode.Conflict,
        'Employee assignment dates overlap with an existing assignment',
      );
    }
  }
}
