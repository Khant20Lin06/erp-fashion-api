import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, Repository } from 'typeorm';
import { EmployeeCompensation } from '../entities/employee-compensation.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { CreateEmployeeCompensationDto } from '../dto/employee-compensation.dto';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { validateDateRange } from '../../../shared/utils/validate-date-range';
import { PayFrequency } from '../entities/pay-frequency.enum';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';

@Injectable()
export class EmployeeCompensationService {
  constructor(
    @InjectRepository(EmployeeCompensation)
    private readonly compensationRepository: Repository<EmployeeCompensation>,
    private readonly transactionService: TransactionService,
  ) {}

  async findAllForEmployee(
    employeeId: string,
    companyId: string,
    page = DEFAULT_PAGE,
    limit = DEFAULT_LIMIT,
  ): Promise<{
    data: EmployeeCompensation[];
    meta: { page: number; limit: number; total: number };
  }> {
    const [data, total] = await this.compensationRepository.findAndCount({
      where: { employeeId, companyId },
      order: { effectiveFrom: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, meta: { page, limit, total } };
  }

  async create(
    employeeId: string,
    companyId: string,
    userId: string,
    dto: CreateEmployeeCompensationDto,
  ): Promise<EmployeeCompensation> {
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

      await this.assertNoOverlap(
        manager,
        employeeId,
        dto.effectiveFrom,
        dto.effectiveTo,
      );

      const entity = manager.create(EmployeeCompensation, {
        companyId,
        employeeId,
        effectiveFrom: dto.effectiveFrom.slice(0, 10),
        effectiveTo: dto.effectiveTo?.slice(0, 10) ?? null,
        baseSalary: dto.baseSalary,
        currency: dto.currency,
        payFrequency: dto.payFrequency ?? PayFrequency.Monthly,
        createdBy: userId,
        updatedBy: userId,
      });

      return manager.save(EmployeeCompensation, entity);
    });
  }

  /**
   * Resolves the compensation row valid as of a given date — the payroll
   * calculation engine must always resolve against this, never against
   * "the employee's current compensation", so a finalized payroll run stays
   * historically reproducible even after later salary changes.
   */
  async findAsOfDate(
    manager: EntityManager,
    employeeId: string,
    asOfDate: string,
  ): Promise<EmployeeCompensation | null> {
    return manager
      .getRepository(EmployeeCompensation)
      .createQueryBuilder('compensation')
      .where('compensation.employeeId = :employeeId', { employeeId })
      .andWhere('compensation.effectiveFrom <= :asOfDate', { asOfDate })
      .andWhere(
        new Brackets((sub) => {
          sub
            .where('compensation.effectiveTo IS NULL')
            .orWhere('compensation.effectiveTo >= :asOfDate', { asOfDate });
        }),
      )
      .orderBy('compensation.effectiveFrom', 'DESC')
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
      .getRepository(EmployeeCompensation)
      .createQueryBuilder('compensation')
      .where('compensation.employeeId = :employeeId', { employeeId })
      .andWhere(
        new Brackets((sub) => {
          sub
            .where('compensation.effectiveTo IS NULL')
            .orWhere('compensation.effectiveTo >= :effectiveFrom', {
              effectiveFrom: effectiveFrom.slice(0, 10),
            });
        }),
      )
      .andWhere(
        new Brackets((sub) => {
          if (effectiveTo) {
            sub.where('compensation.effectiveFrom <= :effectiveTo', {
              effectiveTo: effectiveTo.slice(0, 10),
            });
          } else {
            sub.where('1 = 1');
          }
        }),
      );

    if (ignoreId) {
      qb.andWhere('compensation.id != :ignoreId', { ignoreId });
    }

    const existing = await qb.getOne();
    if (existing) {
      throw new AppException(
        ErrorCode.Conflict,
        'Employee compensation dates overlap with an existing record',
      );
    }
  }
}
