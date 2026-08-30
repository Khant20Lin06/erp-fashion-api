import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  EntityManager,
  In,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { Employee } from '../entities/employee.entity';
import { EmployeeStatus } from '../entities/employee-status.enum';
import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { UpdateEmployeeDto } from '../dto/update-employee.dto';
import { ListEmployeesDto } from '../dto/list-employees.dto';
import { CompaniesService } from '../../organization/services/companies.service';
import { BranchesService } from '../../organization/services/branches.service';
import { User } from '../../users/entities/user.entity';
import { UserStatus } from '../../users/entities/user-status.enum';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';
import { EmployeeAssignment } from '../../hr/entities/employee-assignment.entity';
import { EmployeeAssignmentStatus } from '../../hr/entities/employee-assignment-status.enum';
import { Branch } from '../../organization/entities/branch.entity';
import { Department } from '../../hr/entities/department.entity';
import { Designation } from '../../hr/entities/designation.entity';
import { AttendanceRecord } from '../../hr/entities/attendance-record.entity';
import { LeaveRequest } from '../../hr/entities/leave-request.entity';
import { EmployeeCompensation } from '../../payroll/entities/employee-compensation.entity';
import { EmployeePayrollComponent } from '../../payroll/entities/employee-payroll-component.entity';
import { EmployeeShiftAssignment } from '../../payroll/entities/employee-shift-assignment.entity';
import { PayrollRunEmployee } from '../../payroll/entities/payroll-run-employee.entity';
import { SalesAccount } from '../../sales-accounts/entities/sales-account.entity';
import { SalesAccountAssignment } from '../../sales-accounts/entities/sales-account-assignment.entity';

export interface PaginatedEmployees {
  data: EmployeeWithCurrentAssignment[];
  meta: { page: number; limit: number; total: number };
}

export interface EmployeeScopeFilter {
  companyId?: string;
  branchId?: string;
  allowedBranchIds?: string[] | null;
  ownUserId?: string;
}

export interface EmployeeWithCurrentAssignment extends Employee {
  assignmentId?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  designationId?: string | null;
  designationName?: string | null;
  branchName?: string | null;
  assignmentEffectiveFrom?: string | null;
}

const SORTABLE_FIELDS = [
  'createdAt',
  'employeeCode',
  'displayName',
  'status',
] as const;

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(EmployeeAssignment)
    private readonly assignmentRepository: Repository<EmployeeAssignment>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    @InjectRepository(Designation)
    private readonly designationRepository: Repository<Designation>,
    private readonly companiesService: CompaniesService,
    private readonly branchesService: BranchesService,
    private readonly transactionService: TransactionService,
  ) {}

  async findAll(query: ListEmployeesDto): Promise<PaginatedEmployees> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(
      query.sort,
      SORTABLE_FIELDS,
      'createdAt',
    );

    const qb = this.employeeRepository.createQueryBuilder('employee');

    if (query.companyId) {
      qb.andWhere('employee.companyId = :companyId', {
        companyId: query.companyId,
      });
    }
    if (query.branchId) {
      qb.andWhere('employee.branchId = :branchId', {
        branchId: query.branchId,
      });
    }
    if (query.status) {
      qb.andWhere('employee.status = :status', { status: query.status });
    }
    if (query.search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('employee.employeeCode LIKE :search', {
              search: `%${query.search}%`,
            })
            .orWhere('employee.displayName LIKE :search', {
              search: `%${query.search}%`,
            });
        }),
      );
    }

    qb.orderBy(`employee.${sortField}`, query.order ?? 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, meta: { page, limit, total } };
  }

  async findAllInScope(
    query: ListEmployeesDto,
    scope: EmployeeScopeFilter,
  ): Promise<PaginatedEmployees> {
    const scopedQuery = { ...query };
    if (scope.companyId) {
      scopedQuery.companyId = scope.companyId;
    }
    if (scope.branchId) {
      scopedQuery.branchId = scope.branchId;
    }

    const page = scopedQuery.page ?? DEFAULT_PAGE;
    const limit = scopedQuery.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(
      scopedQuery.sort,
      SORTABLE_FIELDS,
      'createdAt',
    );

    const qb = this.employeeRepository.createQueryBuilder('employee');

    if (scope.ownUserId) {
      qb.andWhere('employee.userId = :userId', { userId: scope.ownUserId });
    }

    if (scopedQuery.companyId) {
      qb.andWhere('employee.companyId = :companyId', {
        companyId: scopedQuery.companyId,
      });
    }

    if (scope.allowedBranchIds) {
      qb.andWhere('employee.branchId IN (:...allowedBranchIds)', {
        allowedBranchIds: scope.allowedBranchIds,
      });
    } else if (scopedQuery.branchId) {
      qb.andWhere('employee.branchId = :branchId', {
        branchId: scopedQuery.branchId,
      });
    }

    if (scopedQuery.status) {
      qb.andWhere('employee.status = :status', { status: scopedQuery.status });
    }
    if (scopedQuery.search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('employee.employeeCode LIKE :search', {
              search: `%${scopedQuery.search}%`,
            })
            .orWhere('employee.displayName LIKE :search', {
              search: `%${scopedQuery.search}%`,
            });
        }),
      );
    }

    qb.orderBy(`employee.${sortField}`, scopedQuery.order ?? 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return {
      data: await this.enrichEmployees(data),
      meta: { page, limit, total },
    };
  }

  async findById(id: string): Promise<Employee> {
    const employee = await this.employeeRepository.findOne({ where: { id } });
    if (!employee) {
      throw new AppException(ErrorCode.NotFound, 'Employee not found');
    }
    return employee;
  }

  async findByUserId(userId: string): Promise<Employee> {
    const employee = await this.employeeRepository.findOne({
      where: { userId },
    });
    if (!employee) {
      throw new AppException(ErrorCode.NotFound, 'Employee not found');
    }
    return employee;
  }

  async findByIdInScope(
    id: string,
    scope: EmployeeScopeFilter,
  ): Promise<EmployeeWithCurrentAssignment> {
    const qb = this.employeeRepository
      .createQueryBuilder('employee')
      .where('employee.id = :id', { id });

    if (scope.ownUserId) {
      qb.andWhere('employee.userId = :userId', { userId: scope.ownUserId });
    }

    if (scope.companyId) {
      qb.andWhere('employee.companyId = :companyId', {
        companyId: scope.companyId,
      });
    }

    if (scope.allowedBranchIds) {
      qb.andWhere('employee.branchId IN (:...allowedBranchIds)', {
        allowedBranchIds: scope.allowedBranchIds,
      });
    } else if (scope.branchId) {
      qb.andWhere('employee.branchId = :branchId', {
        branchId: scope.branchId,
      });
    }

    const employee = await qb.getOne();
    if (!employee) {
      throw new AppException(ErrorCode.NotFound, 'Employee not found');
    }
    const [enriched] = await this.enrichEmployees([employee]);
    return enriched;
  }

  /**
   * Hierarchy validation on create (mirrors Phase 07's Branch/Warehouse
   * pattern): companyId must reference an active Company, branchId must
   * reference an active Branch, and that branch's companyId must match the
   * submitted companyId (Phase 08 §23, §54).
   */
  async create(dto: CreateEmployeeDto): Promise<Employee> {
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

    const existingCode = await this.employeeRepository.findOne({
      where: { companyId: dto.companyId, employeeCode: dto.employeeCode },
    });
    if (existingCode) {
      throw new AppException(
        ErrorCode.Conflict,
        'Employee code already exists for this company',
      );
    }

    const employee = this.employeeRepository.create({
      employeeCode: dto.employeeCode,
      firstName: dto.firstName,
      lastName: dto.lastName,
      displayName: dto.displayName ?? `${dto.firstName} ${dto.lastName}`,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      dateOfBirth: dto.dateOfBirth ?? null,
      address: dto.address ?? null,
      emergencyContactName: dto.emergencyContactName ?? null,
      emergencyContactPhone: dto.emergencyContactPhone ?? null,
      userId: null,
      companyId: dto.companyId,
      branchId: dto.branchId,
      status: EmployeeStatus.Active,
      joinedAt: new Date(),
      terminatedAt: null,
    });

    return this.employeeRepository.save(employee);
  }

  async update(id: string, dto: UpdateEmployeeDto): Promise<Employee> {
    const employee = await this.findById(id);

    if (dto.firstName !== undefined) employee.firstName = dto.firstName;
    if (dto.lastName !== undefined) employee.lastName = dto.lastName;
    if (dto.displayName !== undefined) employee.displayName = dto.displayName;
    if (dto.phone !== undefined) employee.phone = dto.phone;
    if (dto.email !== undefined) employee.email = dto.email;
    if (dto.dateOfBirth !== undefined) employee.dateOfBirth = dto.dateOfBirth;
    if (dto.address !== undefined) employee.address = dto.address;
    if (dto.emergencyContactName !== undefined) {
      employee.emergencyContactName = dto.emergencyContactName;
    }
    if (dto.emergencyContactPhone !== undefined) {
      employee.emergencyContactPhone = dto.emergencyContactPhone;
    }

    return this.employeeRepository.save(employee);
  }

  /**
   * Links an existing User to this Employee. Enforces one-user-per-employee
   * and one-employee-per-user (Phase 08 §24) — the unique index on
   * employees.user_id is the hard backstop; this check gives a clear 409.
   * Runs inside a transaction since it reads-then-writes across a uniqueness
   * invariant that a concurrent linkUser() call could otherwise race.
   */
  async linkUser(id: string, userId: string): Promise<Employee> {
    return this.transactionService.run(async (manager) => {
      const employee = await manager.findOne(Employee, { where: { id } });
      if (!employee) {
        throw new AppException(ErrorCode.NotFound, 'Employee not found');
      }

      if (employee.userId) {
        throw new AppException(
          ErrorCode.Conflict,
          'Employee is already linked to a user',
        );
      }

      const existingLink = await manager.findOne(Employee, {
        where: { userId },
      });
      if (existingLink) {
        throw new AppException(
          ErrorCode.Conflict,
          'User is already linked to another employee',
        );
      }

      employee.userId = userId;
      return manager.save(employee);
    });
  }

  /** Unlinking never deletes either record (Phase 08 §25) — removes the relationship only. */
  async unlinkUser(id: string): Promise<Employee> {
    const employee = await this.findById(id);
    employee.userId = null;
    return this.employeeRepository.save(employee);
  }

  /**
   * Terminates the employee and, only when their linked User exists solely
   * for this employment relationship, deactivates that User in the same
   * transaction (Phase 08 §26, §123 — an explicit, documented step rather
   * than an implicit cascade). Historical records are never removed.
   */
  async terminate(id: string): Promise<Employee> {
    return this.transactionService.run(async (manager) => {
      const employee = await manager.findOne(Employee, { where: { id } });
      if (!employee) {
        throw new AppException(ErrorCode.NotFound, 'Employee not found');
      }

      employee.status = EmployeeStatus.Terminated;
      employee.terminatedAt = new Date();
      await manager.save(employee);

      if (employee.userId) {
        const user = await manager.findOne(User, {
          where: { id: employee.userId },
        });
        if (user && user.status === UserStatus.Active) {
          user.status = UserStatus.Inactive;
          await manager.save(user);
        }
      }

      return employee;
    });
  }

  async activate(id: string): Promise<Employee> {
    const employee = await this.findById(id);
    employee.status = EmployeeStatus.Active;
    return this.employeeRepository.save(employee);
  }

  async deactivate(id: string): Promise<Employee> {
    const employee = await this.findById(id);
    employee.status = EmployeeStatus.Inactive;
    return this.employeeRepository.save(employee);
  }

  async deletePermanent(id: string): Promise<void> {
    await this.transactionService.run(async (manager) => {
      const employee = await manager.findOne(Employee, { where: { id } });
      if (!employee) {
        throw new AppException(ErrorCode.NotFound, 'Employee not found');
      }

      if (employee.status === EmployeeStatus.Active) {
        throw new AppException(
          ErrorCode.Conflict,
          'Active employees must be archived or terminated before permanent deletion',
        );
      }

      if (employee.userId) {
        throw new AppException(
          ErrorCode.Conflict,
          'Employee cannot be permanently deleted while a user account is linked',
        );
      }

      const guardedRelations = await this.collectDeleteGuardRelations(
        manager,
        employee.id,
      );

      if (guardedRelations.length > 0) {
        throw new AppException(
          ErrorCode.Conflict,
          `Employee cannot be permanently deleted because related records exist: ${guardedRelations.join(', ')}`,
        );
      }

      try {
        await manager.delete(Employee, { id: employee.id });
      } catch (error) {
        if (error instanceof QueryFailedError) {
          throw new AppException(
            ErrorCode.Conflict,
            'Employee cannot be permanently deleted because related records still exist. Refresh the list and try again.',
          );
        }
        throw error;
      }
    });
  }

  private latestAssignmentFor(
    employeeId: string,
    assignments: EmployeeAssignment[],
  ): EmployeeAssignment | undefined {
    const today = new Date().toISOString().slice(0, 10);
    const employeeAssignments = assignments
      .filter(
        (assignment) =>
          assignment.employeeId === employeeId &&
          assignment.status === EmployeeAssignmentStatus.Active,
      )
      .sort((left, right) => {
        const byEffectiveFrom = right.effectiveFrom.localeCompare(
          left.effectiveFrom,
        );
        if (byEffectiveFrom !== 0) {
          return byEffectiveFrom;
        }
        return right.createdAt.getTime() - left.createdAt.getTime();
      });

    return (
      employeeAssignments.find(
        (assignment) =>
          assignment.effectiveFrom <= today &&
          (!assignment.effectiveTo || assignment.effectiveTo >= today),
      ) ?? employeeAssignments[0]
    );
  }

  private async enrichEmployees(
    employees: Employee[],
  ): Promise<EmployeeWithCurrentAssignment[]> {
    if (employees.length === 0) {
      return [];
    }

    const employeeIds = employees.map((employee) => employee.id);
    const branchIds = Array.from(
      new Set(employees.map((employee) => employee.branchId)),
    );

    const [assignments, branches] = await Promise.all([
      this.assignmentRepository.find({
        where: {
          employeeId: In(employeeIds),
          status: EmployeeAssignmentStatus.Active,
        },
      }),
      this.branchRepository.find({
        where: { id: In(branchIds) },
      }),
    ]);

    const currentAssignments = employees
      .map((employee) => this.latestAssignmentFor(employee.id, assignments))
      .filter((assignment): assignment is EmployeeAssignment => !!assignment);

    const departmentIds = Array.from(
      new Set(
        currentAssignments
          .map((assignment) => assignment.departmentId)
          .filter((id): id is string => !!id),
      ),
    );
    const designationIds = Array.from(
      new Set(
        currentAssignments
          .map((assignment) => assignment.designationId)
          .filter((id): id is string => !!id),
      ),
    );

    const [departments, designations] = await Promise.all([
      departmentIds.length > 0
        ? this.departmentRepository.find({
            where: { id: In(departmentIds) },
          })
        : Promise.resolve([]),
      designationIds.length > 0
        ? this.designationRepository.find({
            where: { id: In(designationIds) },
          })
        : Promise.resolve([]),
    ]);

    const branchById = new Map(branches.map((branch) => [branch.id, branch]));
    const departmentById = new Map(
      departments.map((department) => [department.id, department]),
    );
    const designationById = new Map(
      designations.map((designation) => [designation.id, designation]),
    );

    return employees.map((employee) => {
      const assignment = this.latestAssignmentFor(employee.id, assignments);
      const department = assignment?.departmentId
        ? departmentById.get(assignment.departmentId)
        : undefined;
      const designation = assignment?.designationId
        ? designationById.get(assignment.designationId)
        : undefined;
      const branch = branchById.get(employee.branchId);

      return {
        ...employee,
        assignmentId: assignment?.id ?? null,
        departmentId: assignment?.departmentId ?? null,
        departmentName: department?.name ?? null,
        designationId: assignment?.designationId ?? null,
        designationName: designation?.name ?? null,
        branchName: branch?.name ?? null,
        assignmentEffectiveFrom: assignment?.effectiveFrom ?? null,
      };
    });
  }

  private async collectDeleteGuardRelations(
    manager: EntityManager,
    employeeId: string,
  ): Promise<string[]> {
    const [
      assignmentCount,
      attendanceCount,
      leaveCount,
      compensationCount,
      payrollComponentCount,
      shiftAssignmentCount,
      payrollHistoryCount,
      salesAccountCount,
      salesAccountAssignmentCount,
    ] = await Promise.all([
      manager.count(EmployeeAssignment, { where: { employeeId } }),
      manager.count(AttendanceRecord, { where: { employeeId } }),
      manager.count(LeaveRequest, { where: { employeeId } }),
      manager.count(EmployeeCompensation, { where: { employeeId } }),
      manager.count(EmployeePayrollComponent, { where: { employeeId } }),
      manager.count(EmployeeShiftAssignment, { where: { employeeId } }),
      manager.count(PayrollRunEmployee, { where: { employeeId } }),
      manager.count(SalesAccount, { where: { employeeId } }),
      manager.count(SalesAccountAssignment, { where: { employeeId } }),
    ]);

    return [
      assignmentCount > 0 ? 'employee assignments' : null,
      attendanceCount > 0 ? 'attendance records' : null,
      leaveCount > 0 ? 'leave requests' : null,
      compensationCount > 0 ? 'employee compensations' : null,
      payrollComponentCount > 0 ? 'employee payroll components' : null,
      shiftAssignmentCount > 0 ? 'employee shift assignments' : null,
      payrollHistoryCount > 0 ? 'payroll history' : null,
      salesAccountCount > 0 ? 'sales accounts' : null,
      salesAccountAssignmentCount > 0 ? 'sales account assignments' : null,
    ].filter((relation): relation is string => !!relation);
  }
}
