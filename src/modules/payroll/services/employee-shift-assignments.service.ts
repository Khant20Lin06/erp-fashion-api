import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, Repository } from 'typeorm';
import { EmployeeShiftAssignment } from '../entities/employee-shift-assignment.entity';
import { Shift } from '../entities/shift.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { CreateEmployeeShiftAssignmentDto } from '../dto/employee-shift-assignments.dto';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { validateDateRange } from '../../../shared/utils/validate-date-range';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';

@Injectable()
export class EmployeeShiftAssignmentsService {
  constructor(
    @InjectRepository(EmployeeShiftAssignment)
    private readonly assignmentRepository: Repository<EmployeeShiftAssignment>,
    private readonly transactionService: TransactionService,
  ) {}

  async findAllForEmployee(
    employeeId: string,
    companyId: string,
    page = DEFAULT_PAGE,
    limit = DEFAULT_LIMIT,
  ): Promise<{
    data: EmployeeShiftAssignment[];
    meta: { page: number; limit: number; total: number };
  }> {
    const qb = this.assignmentRepository
      .createQueryBuilder('assignment')
      .innerJoin(Employee, 'employee', 'employee.id = assignment.employeeId')
      .where('assignment.employeeId = :employeeId', { employeeId })
      .andWhere('employee.companyId = :companyId', { companyId })
      .orderBy('assignment.effectiveFrom', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total } };
  }

  async create(
    employeeId: string,
    companyId: string,
    dto: CreateEmployeeShiftAssignmentDto,
  ): Promise<EmployeeShiftAssignment> {
    validateDateRange(dto.effectiveFrom, dto.effectiveTo);

    return this.transactionService.run(async (manager) => {
      const employee = await manager.findOne(Employee, {
        where: { id: employeeId, companyId },
      });
      if (!employee) {
        throw new AppException(
          ErrorCode.ValidationError,
          'employeeId does not reference an employee in the specified company',
        );
      }

      const shift = await manager.findOne(Shift, {
        where: { id: dto.shiftId, companyId },
      });
      if (!shift) {
        throw new AppException(
          ErrorCode.ValidationError,
          'shiftId does not reference a shift in the specified company',
        );
      }

      await this.assertNoOverlap(
        manager,
        employeeId,
        dto.effectiveFrom,
        dto.effectiveTo,
      );

      const entity = manager.create(EmployeeShiftAssignment, {
        employeeId,
        shiftId: dto.shiftId,
        effectiveFrom: dto.effectiveFrom.slice(0, 10),
        effectiveTo: dto.effectiveTo?.slice(0, 10) ?? null,
      });

      return manager.save(EmployeeShiftAssignment, entity);
    });
  }

  /**
   * Resolves the shift assignment valid as of a given date — used by
   * PayrollRunsService's calculation engine so historical payroll always
   * reflects the shift in force at the time, never the employee's current
   * shift.
   */
  async findAsOfDate(
    manager: EntityManager,
    employeeId: string,
    asOfDate: string,
  ): Promise<EmployeeShiftAssignment | null> {
    return manager
      .getRepository(EmployeeShiftAssignment)
      .createQueryBuilder('assignment')
      .where('assignment.employeeId = :employeeId', { employeeId })
      .andWhere('assignment.effectiveFrom <= :asOfDate', { asOfDate })
      .andWhere(
        new Brackets((sub) => {
          sub
            .where('assignment.effectiveTo IS NULL')
            .orWhere('assignment.effectiveTo >= :asOfDate', { asOfDate });
        }),
      )
      .orderBy('assignment.effectiveFrom', 'DESC')
      .getOne();
  }

  private async assertNoOverlap(
    manager: EntityManager,
    employeeId: string,
    effectiveFrom: string,
    effectiveTo: string | null | undefined,
    ignoreId?: string,
  ): Promise<void> {
    const qb = manager
      .getRepository(EmployeeShiftAssignment)
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
        'Employee shift assignment dates overlap with an existing assignment',
      );
    }
  }
}
