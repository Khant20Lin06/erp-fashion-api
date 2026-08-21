import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, Repository } from 'typeorm';
import { EmployeePayrollComponent } from '../entities/employee-payroll-component.entity';
import { PayrollComponent } from '../entities/payroll-component.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { CreateEmployeePayrollComponentDto } from '../dto/employee-payroll-components.dto';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { validateDateRange } from '../../../shared/utils/validate-date-range';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';

@Injectable()
export class EmployeePayrollComponentsService {
  constructor(
    @InjectRepository(EmployeePayrollComponent)
    private readonly assignmentRepository: Repository<EmployeePayrollComponent>,
    private readonly transactionService: TransactionService,
  ) {}

  async findAllForEmployee(
    employeeId: string,
    companyId: string,
    page = DEFAULT_PAGE,
    limit = DEFAULT_LIMIT,
  ): Promise<{
    data: EmployeePayrollComponent[];
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
    dto: CreateEmployeePayrollComponentDto,
  ): Promise<EmployeePayrollComponent> {
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

      const component = await manager.findOne(PayrollComponent, {
        where: { id: dto.payrollComponentId, companyId },
      });
      if (!component) {
        throw new AppException(
          ErrorCode.ValidationError,
          'payrollComponentId does not reference a payroll component in the specified company',
        );
      }
      if (!component.isActive) {
        throw new AppException(
          ErrorCode.ValidationError,
          'Cannot assign an inactive payroll component',
        );
      }

      await this.assertNoOverlap(
        manager,
        employeeId,
        dto.payrollComponentId,
        dto.effectiveFrom,
        dto.effectiveTo,
      );

      const entity = manager.create(EmployeePayrollComponent, {
        employeeId,
        payrollComponentId: dto.payrollComponentId,
        amount: dto.amount ?? null,
        percentage: dto.percentage ?? null,
        effectiveFrom: dto.effectiveFrom.slice(0, 10),
        effectiveTo: dto.effectiveTo?.slice(0, 10) ?? null,
      });

      return manager.save(EmployeePayrollComponent, entity);
    });
  }

  /**
   * Resolves all component assignments effective as of a given date — used
   * by the payroll calculation engine to build each payslip's earning/
   * deduction lines against the state that was actually in force on that
   * date, not whatever is currently configured.
   */
  async findAllAsOfDate(
    manager: EntityManager,
    employeeId: string,
    asOfDate: string,
  ): Promise<EmployeePayrollComponent[]> {
    return manager
      .getRepository(EmployeePayrollComponent)
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
      .getMany();
  }

  private async assertNoOverlap(
    manager: EntityManager,
    employeeId: string,
    payrollComponentId: string,
    effectiveFrom: string,
    effectiveTo: string | null | undefined,
    ignoreId?: string,
  ): Promise<void> {
    const qb = manager
      .getRepository(EmployeePayrollComponent)
      .createQueryBuilder('assignment')
      .where('assignment.employeeId = :employeeId', { employeeId })
      .andWhere('assignment.payrollComponentId = :payrollComponentId', {
        payrollComponentId,
      })
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
        'Employee payroll component dates overlap with an existing assignment',
      );
    }
  }
}
