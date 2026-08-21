import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PayrollPeriod } from '../entities/payroll-period.entity';
import { PayrollPeriodStatus } from '../entities/payroll-period-status.enum';
import { CompanyPayrollPeriodCounter } from '../entities/company-payroll-period-counter.entity';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollRunStatus } from '../entities/payroll-run-status.enum';
import { CompaniesService } from '../../organization/services/companies.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { retryOnDuplicateEntry } from '../../inventory/utils/upsert-retry';
import { formatDocumentNumber } from '../../inventory/utils/document-number';
import { validateDateRange } from '../../../shared/utils/validate-date-range';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import {
  CreatePayrollPeriodDto,
  ListPayrollPeriodsDto,
} from '../dto/payroll-periods.dto';

@Injectable()
export class PayrollPeriodsService {
  constructor(
    @InjectRepository(PayrollPeriod)
    private readonly periodRepository: Repository<PayrollPeriod>,
    private readonly companiesService: CompaniesService,
    private readonly transactionService: TransactionService,
  ) {}

  async findAll(
    companyId: string,
    query: ListPayrollPeriodsDto,
  ): Promise<{
    data: PayrollPeriod[];
    meta: { page: number; limit: number; total: number };
  }> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const qb = this.periodRepository
      .createQueryBuilder('period')
      .where('period.companyId = :companyId', { companyId });

    if (query.status) {
      qb.andWhere('period.status = :status', { status: query.status });
    }

    qb.orderBy('period.startDate', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<PayrollPeriod> {
    const entity = await this.periodRepository.findOne({
      where: { id, companyId },
    });
    if (!entity) {
      throw new AppException(ErrorCode.NotFound, 'Payroll period not found');
    }
    return entity;
  }

  async create(
    companyId: string,
    userId: string,
    dto: CreatePayrollPeriodDto,
  ): Promise<PayrollPeriod> {
    validateDateRange(dto.startDate, dto.endDate);
    if (new Date(dto.payDate).getTime() < new Date(dto.endDate).getTime()) {
      throw new AppException(
        ErrorCode.ValidationError,
        'payDate must be on or after endDate',
      );
    }

    const company = await this.companiesService.findActiveByIdOrNull(companyId);
    if (!company) {
      throw new AppException(
        ErrorCode.ValidationError,
        'companyId does not reference an active company',
      );
    }

    return this.transactionService.run(async (manager) => {
      // DB-level UNIQUE(company_id, start_date, end_date) is the real
      // backstop against a duplicate-period race; this pre-check just
      // gives a clean 409 instead of surfacing a raw DB constraint error
      // on the common (non-racing) path.
      const existing = await manager.findOne(PayrollPeriod, {
        where: {
          companyId,
          startDate: dto.startDate.slice(0, 10),
          endDate: dto.endDate.slice(0, 10),
        },
      });
      if (existing) {
        throw new AppException(
          ErrorCode.Conflict,
          'A payroll period with this exact date range already exists for this company',
        );
      }

      const year = new Date(dto.startDate).getUTCFullYear();
      const periodNumber = await this.generatePeriodNumber(
        companyId,
        year,
        manager,
      );

      const entity = manager.create(PayrollPeriod, {
        companyId,
        periodNumber,
        name: dto.name,
        startDate: dto.startDate.slice(0, 10),
        endDate: dto.endDate.slice(0, 10),
        payDate: dto.payDate.slice(0, 10),
        status: PayrollPeriodStatus.Open,
        createdBy: userId,
        updatedBy: userId,
      });

      return manager.save(PayrollPeriod, entity);
    });
  }

  /**
   * OPEN -> CANCELLED and PROCESSING -> CANCELLED only. FINALIZED is
   * terminal (a finalized period's payroll has already been calculated and
   * approved — cancelling it would silently orphan real payslip history,
   * so it is explicitly rejected).
   */
  async cancel(
    id: string,
    companyId: string,
    userId: string,
  ): Promise<PayrollPeriod> {
    return this.transactionService.run(async (manager) => {
      const entity = await manager.findOne(PayrollPeriod, {
        where: { id, companyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!entity) {
        throw new AppException(ErrorCode.NotFound, 'Payroll period not found');
      }
      if (
        entity.status !== PayrollPeriodStatus.Open &&
        entity.status !== PayrollPeriodStatus.Processing
      ) {
        throw new AppException(
          ErrorCode.UnprocessableEntity,
          `Cannot cancel a payroll period in status ${entity.status}`,
        );
      }

      const activeRun = await manager.findOne(PayrollRun, {
        where: { payrollPeriodId: id },
      });
      if (
        activeRun &&
        activeRun.status !== PayrollRunStatus.Cancelled &&
        activeRun.status !== PayrollRunStatus.Draft
      ) {
        throw new AppException(
          ErrorCode.Conflict,
          'Cannot cancel a payroll period with a calculated or finalized payroll run; cancel the run first',
        );
      }

      entity.status = PayrollPeriodStatus.Cancelled;
      entity.updatedBy = userId;
      return manager.save(PayrollPeriod, entity);
    });
  }

  /** Transitions OPEN -> PROCESSING; called by PayrollRunsService.calculate(). */
  async markProcessing(
    manager: EntityManager,
    id: string,
  ): Promise<PayrollPeriod> {
    const entity = await manager.findOne(PayrollPeriod, { where: { id } });
    if (!entity) {
      throw new AppException(ErrorCode.NotFound, 'Payroll period not found');
    }
    if (entity.status !== PayrollPeriodStatus.Open) {
      throw new AppException(
        ErrorCode.UnprocessableEntity,
        `Cannot start processing a payroll period in status ${entity.status}`,
      );
    }
    entity.status = PayrollPeriodStatus.Processing;
    return manager.save(PayrollPeriod, entity);
  }

  /** Transitions PROCESSING -> FINALIZED; called by PayrollRunsService.finalize(). */
  async markFinalized(
    manager: EntityManager,
    id: string,
  ): Promise<PayrollPeriod> {
    const entity = await manager.findOne(PayrollPeriod, { where: { id } });
    if (!entity) {
      throw new AppException(ErrorCode.NotFound, 'Payroll period not found');
    }
    if (entity.status !== PayrollPeriodStatus.Processing) {
      throw new AppException(
        ErrorCode.UnprocessableEntity,
        `Cannot finalize a payroll period in status ${entity.status}`,
      );
    }
    entity.status = PayrollPeriodStatus.Finalized;
    return manager.save(PayrollPeriod, entity);
  }

  /** Reverts PROCESSING -> OPEN; called by PayrollRunsService.cancel() on a CALCULATED run. */
  async revertToOpen(
    manager: EntityManager,
    id: string,
  ): Promise<PayrollPeriod> {
    const entity = await manager.findOne(PayrollPeriod, { where: { id } });
    if (!entity) {
      throw new AppException(ErrorCode.NotFound, 'Payroll period not found');
    }
    if (entity.status !== PayrollPeriodStatus.Processing) {
      return entity;
    }
    entity.status = PayrollPeriodStatus.Open;
    return manager.save(PayrollPeriod, entity);
  }

  private async generatePeriodNumber(
    companyId: string,
    year: number,
    manager: EntityManager,
  ): Promise<string> {
    await retryOnDuplicateEntry(() =>
      manager.query(
        'INSERT INTO `company_payroll_period_counters` (`id`, `company_id`, `year`, `last_sequence`) ' +
          'VALUES (?, ?, ?, 0) ' +
          'ON DUPLICATE KEY UPDATE `last_sequence` = `last_sequence`',
        [randomUUID(), companyId, year],
      ),
    );

    const counter = await manager
      .createQueryBuilder(CompanyPayrollPeriodCounter, 'counter')
      .where('counter.companyId = :companyId', { companyId })
      .andWhere('counter.year = :year', { year })
      .setLock('pessimistic_write')
      .getOneOrFail();

    const nextSequence = counter.lastSequence + 1;
    await manager.update(CompanyPayrollPeriodCounter, counter.id, {
      lastSequence: nextSequence,
    });
    return formatDocumentNumber('PP', year, nextSequence);
  }
}
