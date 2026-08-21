import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
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

export interface PaginatedEmployees {
  data: Employee[];
  meta: { page: number; limit: number; total: number };
}

export interface EmployeeScopeFilter {
  companyId?: string;
  branchId?: string;
  allowedBranchIds?: string[] | null;
  ownUserId?: string;
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
    return { data, meta: { page, limit, total } };
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
  ): Promise<Employee> {
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
    return employee;
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
}
