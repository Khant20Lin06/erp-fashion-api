import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollRunStatus } from '../entities/payroll-run-status.enum';
import { PayrollRunEmployee } from '../entities/payroll-run-employee.entity';
import { PayrollRunEmployeeStatus } from '../entities/payroll-run-employee-status.enum';
import { PayrollRunEmployeeItem } from '../entities/payroll-run-employee-item.entity';
import { PayrollComponent } from '../entities/payroll-component.entity';
import { PayrollComponentType } from '../entities/payroll-component-type.enum';
import { PayrollCalculationType } from '../entities/payroll-calculation-type.enum';
import { PayrollPeriod } from '../entities/payroll-period.entity';
import { PayrollPeriodStatus } from '../entities/payroll-period-status.enum';
import { CompanyPayrollRunCounter } from '../entities/company-payroll-run-counter.entity';
import { UnpaidLeaveCalculation } from '../entities/unpaid-leave-calculation.enum';
import { Employee } from '../../employees/entities/employee.entity';
import { EmployeeStatus } from '../../employees/entities/employee-status.enum';
import { EmployeeAssignment } from '../../hr/entities/employee-assignment.entity';
import { Department } from '../../hr/entities/department.entity';
import { Designation } from '../../hr/entities/designation.entity';
import { LeaveRequest } from '../../hr/entities/leave-request.entity';
import { LeaveRequestStatus } from '../../hr/entities/leave-request-status.enum';
import { LeaveType } from '../../hr/entities/leave-type.entity';
import { EmployeeCompensationService } from './employee-compensation.service';
import { EmployeePayrollComponentsService } from './employee-payroll-components.service';
import { PayrollPeriodsService } from './payroll-periods.service';
import { PayrollConfigurationService } from './payroll-configuration.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { retryOnDuplicateEntry } from '../../inventory/utils/upsert-retry';
import { formatDocumentNumber } from '../../inventory/utils/document-number';
import {
  toCents,
  centsToDecimalString,
} from '../../accounting/utils/double-entry';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import {
  CreatePayrollRunDto,
  ListPayrollRunsDto,
} from '../dto/payroll-runs.dto';

@Injectable()
export class PayrollRunsService {
  constructor(
    @InjectRepository(PayrollRun)
    private readonly runRepository: Repository<PayrollRun>,
    @InjectRepository(PayrollRunEmployee)
    private readonly runEmployeeRepository: Repository<PayrollRunEmployee>,
    @InjectRepository(PayrollRunEmployeeItem)
    private readonly runEmployeeItemRepository: Repository<PayrollRunEmployeeItem>,
    private readonly compensationService: EmployeeCompensationService,
    private readonly employeeComponentsService: EmployeePayrollComponentsService,
    private readonly periodsService: PayrollPeriodsService,
    private readonly configurationService: PayrollConfigurationService,
    private readonly transactionService: TransactionService,
  ) {}

  async findAll(
    companyId: string,
    query: ListPayrollRunsDto,
  ): Promise<{
    data: PayrollRun[];
    meta: { page: number; limit: number; total: number };
  }> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const qb = this.runRepository
      .createQueryBuilder('run')
      .where('run.companyId = :companyId', { companyId });

    if (query.payrollPeriodId) {
      qb.andWhere('run.payrollPeriodId = :payrollPeriodId', {
        payrollPeriodId: query.payrollPeriodId,
      });
    }
    if (query.status) {
      qb.andWhere('run.status = :status', { status: query.status });
    }

    qb.orderBy('run.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(id: string, companyId: string): Promise<PayrollRun> {
    const entity = await this.runRepository.findOne({
      where: { id, companyId },
    });
    if (!entity) {
      throw new AppException(ErrorCode.NotFound, 'Payroll run not found');
    }
    return entity;
  }

  async findEmployeesForRun(
    payrollRunId: string,
    companyId: string,
    page = DEFAULT_PAGE,
    limit = DEFAULT_LIMIT,
  ): Promise<{
    data: PayrollRunEmployee[];
    meta: { page: number; limit: number; total: number };
  }> {
    await this.findByIdInCompany(payrollRunId, companyId);

    const [data, total] = await this.runEmployeeRepository.findAndCount({
      where: { payrollRunId },
      order: { employeeNameSnapshot: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, meta: { page, limit, total } };
  }

  async findEmployeeDetailForRun(
    payrollRunId: string,
    employeeId: string,
    companyId: string,
  ): Promise<{ payslip: PayrollRunEmployee; items: PayrollRunEmployeeItem[] }> {
    await this.findByIdInCompany(payrollRunId, companyId);

    const payslip = await this.runEmployeeRepository.findOne({
      where: { payrollRunId, employeeId },
    });
    if (!payslip) {
      throw new AppException(
        ErrorCode.NotFound,
        'Payslip not found for this employee in this payroll run',
      );
    }
    const items = await this.runEmployeeItemRepository.find({
      where: { payrollRunEmployeeId: payslip.id },
    });
    return { payslip, items };
  }

  async create(
    companyId: string,
    userId: string,
    dto: CreatePayrollRunDto,
  ): Promise<PayrollRun> {
    return this.transactionService.run(async (manager) => {
      const period = await manager.findOne(PayrollPeriod, {
        where: { id: dto.payrollPeriodId, companyId },
      });
      if (!period) {
        throw new AppException(
          ErrorCode.ValidationError,
          'payrollPeriodId does not reference a payroll period in the specified company',
        );
      }
      if (period.status !== PayrollPeriodStatus.Open) {
        throw new AppException(
          ErrorCode.UnprocessableEntity,
          `Cannot create a payroll run for a period in status ${period.status}`,
        );
      }

      // Application-layer duplicate-active-run guard (see PayrollRun's own
      // docblock for why this isn't a DB partial unique index): any
      // non-CANCELLED run already existing for this period blocks a new one.
      const existingActiveRun = await manager
        .createQueryBuilder(PayrollRun, 'run')
        .where('run.payrollPeriodId = :payrollPeriodId', {
          payrollPeriodId: dto.payrollPeriodId,
        })
        .andWhere('run.status != :cancelled', {
          cancelled: PayrollRunStatus.Cancelled,
        })
        .setLock('pessimistic_write')
        .getOne();
      if (existingActiveRun) {
        throw new AppException(
          ErrorCode.Conflict,
          'An active payroll run already exists for this payroll period',
        );
      }

      const year = new Date(period.startDate).getUTCFullYear();
      const runNumber = await this.generateRunNumber(companyId, year, manager);

      const entity = manager.create(PayrollRun, {
        companyId,
        payrollPeriodId: dto.payrollPeriodId,
        runNumber,
        status: PayrollRunStatus.Draft,
        employeeCount: 0,
        totalGrossPay: '0.00',
        totalDeductions: '0.00',
        totalNetPay: '0.00',
        startedAt: null,
        completedAt: null,
        finalizedAt: null,
        createdBy: userId,
        finalizedBy: null,
      });
      return manager.save(PayrollRun, entity);
    });
  }

  /**
   * The core calculation engine. Fully atomic: locks the PayrollRun row for
   * the duration, validates DRAFT status (rejecting a concurrent second
   * call), resolves every eligible employee's as-of-period-start
   * compensation/components/attendance/leave, persists snapshot rows, and
   * updates the run's totals/status — all inside one transaction, so a
   * failure anywhere rolls back the entire calculation rather than leaving
   * a partially-calculated run.
   */
  async calculate(id: string, companyId: string): Promise<PayrollRun> {
    return this.transactionService.run(async (manager) => {
      const run = await manager.findOne(PayrollRun, {
        where: { id, companyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!run) {
        throw new AppException(ErrorCode.NotFound, 'Payroll run not found');
      }
      if (run.status !== PayrollRunStatus.Draft) {
        throw new AppException(
          ErrorCode.UnprocessableEntity,
          `Cannot calculate a payroll run in status ${run.status}`,
        );
      }

      run.status = PayrollRunStatus.Processing;
      run.startedAt = new Date();
      await manager.save(PayrollRun, run);

      const period = await manager.findOneOrFail(PayrollPeriod, {
        where: { id: run.payrollPeriodId },
      });
      await this.periodsService.markProcessing(manager, period.id);

      const config = await this.configurationService.getRequiredForCalculation(
        manager,
        companyId,
      );

      const asOfDate = period.startDate;
      const employees = await manager.find(Employee, {
        where: { companyId, status: EmployeeStatus.Active },
      });

      // AttendanceRecord is intentionally NOT read here. It only carries a
      // status enum (PRESENT/ABSENT/LATE/LEAVE/HALF_DAY) with no hours-
      // worked/overtime/lateMinutes data, so there is no honest, non-
      // fabricated formula to turn attendance into a pay adjustment this
      // phase. Attendance-based calculation remains a documented gap (see
      // the Phase 16 report's Remaining Gaps section), not a silent
      // omission.

      let totalGrossCents = 0;
      let totalDeductionsCents = 0;
      let totalNetCents = 0;

      for (const employee of employees) {
        const compensation = await this.compensationService.findAsOfDate(
          manager,
          employee.id,
          asOfDate,
        );
        if (!compensation) {
          // No compensation configured as of the period start — this
          // employee is silently excluded from the run rather than
          // fabricating a zero/default salary.
          continue;
        }

        const assignment = await manager
          .getRepository(EmployeeAssignment)
          .createQueryBuilder('assignment')
          .where('assignment.employeeId = :employeeId', {
            employeeId: employee.id,
          })
          .andWhere('assignment.effectiveFrom <= :asOfDate', { asOfDate })
          .andWhere(
            '(assignment.effectiveTo IS NULL OR assignment.effectiveTo >= :asOfDate)',
            { asOfDate },
          )
          .orderBy('assignment.effectiveFrom', 'DESC')
          .getOne();

        const department = assignment?.departmentId
          ? await manager.findOne(Department, {
              where: { id: assignment.departmentId },
            })
          : null;
        const designation = assignment?.designationId
          ? await manager.findOne(Designation, {
              where: { id: assignment.designationId },
            })
          : null;

        const componentAssignments =
          await this.employeeComponentsService.findAllAsOfDate(
            manager,
            employee.id,
            asOfDate,
          );

        const itemsToCreate: Array<{
          payrollComponentId: string | null;
          componentNameSnapshot: string;
          componentCodeSnapshot: string;
          type: PayrollComponentType;
          calculationTypeSnapshot: PayrollCalculationType;
          amount: string;
        }> = [];

        let earningsCents = 0;
        let deductionsCents = 0;
        const baseSalaryCents = toCents(compensation.baseSalary);

        for (const assignment2 of componentAssignments) {
          const component = await manager.findOneOrFail(PayrollComponent, {
            where: { id: assignment2.payrollComponentId },
          });
          if (!component.isActive) {
            continue;
          }

          let amountCents: number;
          if (
            component.calculationType === PayrollCalculationType.FixedAmount
          ) {
            const overrideAmount = assignment2.amount;
            amountCents = toCents(
              overrideAmount ?? component.fixedAmount ?? '0',
            );
          } else {
            const overridePercentage = assignment2.percentage;
            const percentage = Number(
              overridePercentage ?? component.percentage ?? '0',
            );
            amountCents = Math.round((baseSalaryCents * percentage) / 100);
          }

          itemsToCreate.push({
            payrollComponentId: component.id,
            componentNameSnapshot: component.name,
            componentCodeSnapshot: component.code,
            type: component.type,
            calculationTypeSnapshot: component.calculationType,
            amount: centsToDecimalString(amountCents),
          });

          if (component.type === PayrollComponentType.Earning) {
            earningsCents += amountCents;
          } else if (component.type === PayrollComponentType.Deduction) {
            deductionsCents += amountCents;
          }
          // EmployerContribution is tracked as a line item but is not part
          // of the employee's gross/net pay (it is a cost to the employer,
          // not paid to or deducted from the employee) — matching the
          // phase's Gross = Base + Earnings / Net = Gross - Deductions
          // formula exactly.
        }

        // Unpaid-leave deduction: only applied if PayrollConfiguration
        // explicitly configures it, and only against APPROVED leave
        // requests whose LeaveType.isPaid is false, overlapping the
        // period's date range. Never a fabricated "salary/30" assumption.
        if (
          config.unpaidLeaveCalculation === UnpaidLeaveCalculation.DailyRate
        ) {
          const unpaidDays = await this.resolveUnpaidLeaveDays(
            manager,
            employee.id,
            period.startDate,
            period.endDate,
          );
          if (unpaidDays > 0 && config.workingDaysPerMonth) {
            const dailyRateCents = Math.round(
              baseSalaryCents / config.workingDaysPerMonth,
            );
            const unpaidDeductionCents = dailyRateCents * unpaidDays;
            itemsToCreate.push({
              payrollComponentId: null,
              componentNameSnapshot: 'Unpaid Leave Deduction',
              componentCodeSnapshot: 'UNPAID_LEAVE',
              type: PayrollComponentType.Deduction,
              calculationTypeSnapshot: PayrollCalculationType.FixedAmount,
              amount: centsToDecimalString(unpaidDeductionCents),
            });
            deductionsCents += unpaidDeductionCents;
          }
        }

        const grossCents = baseSalaryCents + earningsCents;
        const netCents = grossCents - deductionsCents;

        const payslip = manager.create(PayrollRunEmployee, {
          payrollRunId: run.id,
          employeeId: employee.id,
          employeeCodeSnapshot: employee.employeeCode,
          employeeNameSnapshot: employee.displayName,
          departmentSnapshot: department?.name ?? null,
          designationSnapshot: designation?.name ?? null,
          baseSalarySnapshot: compensation.baseSalary,
          grossPay: centsToDecimalString(grossCents),
          totalDeductions: centsToDecimalString(deductionsCents),
          netPay: centsToDecimalString(netCents),
          status: PayrollRunEmployeeStatus.Calculated,
        });
        const savedPayslip = await manager.save(PayrollRunEmployee, payslip);

        for (const item of itemsToCreate) {
          const itemRow = manager.create(PayrollRunEmployeeItem, {
            payrollRunEmployeeId: savedPayslip.id,
            ...item,
          });
          await manager.save(PayrollRunEmployeeItem, itemRow);
        }

        totalGrossCents += grossCents;
        totalDeductionsCents += deductionsCents;
        totalNetCents += netCents;
      }

      const employeeCount = await manager.count(PayrollRunEmployee, {
        where: { payrollRunId: run.id },
      });

      run.status = PayrollRunStatus.Calculated;
      run.employeeCount = employeeCount;
      run.totalGrossPay = centsToDecimalString(totalGrossCents);
      run.totalDeductions = centsToDecimalString(totalDeductionsCents);
      run.totalNetPay = centsToDecimalString(totalNetCents);
      run.completedAt = new Date();

      return manager.save(PayrollRun, run);
    });
  }

  /**
   * CALCULATED -> FINALIZED only. Immutable afterward: no code path ever
   * transitions a FINALIZED run or its PayrollRunEmployee/
   * PayrollRunEmployeeItem rows back to any other state or mutates their
   * values.
   */
  async finalize(
    id: string,
    companyId: string,
    userId: string,
  ): Promise<PayrollRun> {
    return this.transactionService.run(async (manager) => {
      const run = await manager.findOne(PayrollRun, {
        where: { id, companyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!run) {
        throw new AppException(ErrorCode.NotFound, 'Payroll run not found');
      }
      if (run.status !== PayrollRunStatus.Calculated) {
        throw new AppException(
          ErrorCode.UnprocessableEntity,
          `Cannot finalize a payroll run in status ${run.status}`,
        );
      }

      await manager.update(
        PayrollRunEmployee,
        { payrollRunId: run.id },
        { status: PayrollRunEmployeeStatus.Finalized },
      );

      run.status = PayrollRunStatus.Finalized;
      run.finalizedAt = new Date();
      run.finalizedBy = userId;
      await manager.save(PayrollRun, run);

      await this.periodsService.markFinalized(manager, run.payrollPeriodId);

      return run;
    });
  }

  /** DRAFT -> CANCELLED or CALCULATED -> CANCELLED only. FINALIZED is immutable. */
  async cancel(id: string, companyId: string): Promise<PayrollRun> {
    return this.transactionService.run(async (manager) => {
      const run = await manager.findOne(PayrollRun, {
        where: { id, companyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!run) {
        throw new AppException(ErrorCode.NotFound, 'Payroll run not found');
      }
      if (
        run.status !== PayrollRunStatus.Draft &&
        run.status !== PayrollRunStatus.Calculated
      ) {
        throw new AppException(
          ErrorCode.UnprocessableEntity,
          `Cannot cancel a payroll run in status ${run.status}`,
        );
      }

      const wasCalculated = run.status === PayrollRunStatus.Calculated;
      run.status = PayrollRunStatus.Cancelled;
      await manager.save(PayrollRun, run);

      if (wasCalculated) {
        await this.periodsService.revertToOpen(manager, run.payrollPeriodId);
      }

      return run;
    });
  }

  private async resolveUnpaidLeaveDays(
    manager: EntityManager,
    employeeId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<number> {
    const leaveRequests = await manager
      .getRepository(LeaveRequest)
      .createQueryBuilder('leave')
      .innerJoin(LeaveType, 'leaveType', 'leaveType.id = leave.leaveTypeId')
      .where('leave.employeeId = :employeeId', { employeeId })
      .andWhere('leave.status = :status', {
        status: LeaveRequestStatus.Approved,
      })
      .andWhere('leaveType.isPaid = false')
      .andWhere('leave.fromDate <= :periodEnd', { periodEnd })
      .andWhere('leave.toDate >= :periodStart', { periodStart })
      .getMany();

    let unpaidDays = 0;
    for (const leave of leaveRequests) {
      const overlapStart =
        leave.fromDate > periodStart ? leave.fromDate : periodStart;
      const overlapEnd = leave.toDate < periodEnd ? leave.toDate : periodEnd;
      const days =
        Math.round(
          (new Date(overlapEnd).getTime() - new Date(overlapStart).getTime()) /
            (24 * 60 * 60 * 1000),
        ) + 1;
      unpaidDays += Math.max(days, 0);
    }
    return unpaidDays;
  }

  private async generateRunNumber(
    companyId: string,
    year: number,
    manager: EntityManager,
  ): Promise<string> {
    await retryOnDuplicateEntry(() =>
      manager.query(
        'INSERT INTO `company_payroll_run_counters` (`id`, `company_id`, `year`, `last_sequence`) ' +
          'VALUES (?, ?, ?, 0) ' +
          'ON DUPLICATE KEY UPDATE `last_sequence` = `last_sequence`',
        [randomUUID(), companyId, year],
      ),
    );

    const counter = await manager
      .createQueryBuilder(CompanyPayrollRunCounter, 'counter')
      .where('counter.companyId = :companyId', { companyId })
      .andWhere('counter.year = :year', { year })
      .setLock('pessimistic_write')
      .getOneOrFail();

    const nextSequence = counter.lastSequence + 1;
    await manager.update(CompanyPayrollRunCounter, counter.id, {
      lastSequence: nextSequence,
    });
    return formatDocumentNumber('PR', year, nextSequence);
  }
}
