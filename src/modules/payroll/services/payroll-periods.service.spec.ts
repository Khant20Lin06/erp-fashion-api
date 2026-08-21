import { EntityManager, Repository } from 'typeorm';
import { PayrollPeriodsService } from './payroll-periods.service';
import { PayrollPeriod } from '../entities/payroll-period.entity';
import { PayrollPeriodStatus } from '../entities/payroll-period-status.enum';
import { CompanyPayrollPeriodCounter } from '../entities/company-payroll-period-counter.entity';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollRunStatus } from '../entities/payroll-run-status.enum';
import { CompaniesService } from '../../organization/services/companies.service';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('PayrollPeriodsService', () => {
  let service: PayrollPeriodsService;
  let periodRepository: jest.Mocked<
    Pick<Repository<PayrollPeriod>, 'createQueryBuilder'>
  >;
  let companiesService: jest.Mocked<
    Pick<CompaniesService, 'findActiveByIdOrNull'>
  >;
  let transactionService: jest.Mocked<Pick<TransactionService, 'run'>>;

  interface MockManager {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    query: jest.Mock;
    createQueryBuilder: jest.Mock;
  }
  let manager: MockManager;
  let counterQueryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    setLock: jest.Mock;
    getOneOrFail: jest.Mock;
  };

  const buildPeriod = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'period-1',
      companyId: 'company-a',
      periodNumber: 'PP-2026-000001',
      name: 'August 2026',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      payDate: '2026-09-05',
      status: PayrollPeriodStatus.Open,
      createdBy: 'user-1',
      updatedBy: 'user-1',
      ...overrides,
    }) as PayrollPeriod;

  beforeEach(() => {
    periodRepository = {
      createQueryBuilder: jest.fn(),
    };
    companiesService = {
      findActiveByIdOrNull: jest.fn().mockResolvedValue({ id: 'company-a' }),
    };

    counterQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOneOrFail: jest
        .fn()
        .mockResolvedValue({ id: 'counter-1', lastSequence: 0 }),
    };

    manager = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((_entity: unknown, data: unknown) => data),
      save: jest.fn((_entity: unknown, data: unknown) => Promise.resolve(data)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      query: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockImplementation((entity: unknown) => {
        if (entity === CompanyPayrollPeriodCounter) return counterQueryBuilder;
        return counterQueryBuilder;
      }),
    };

    transactionService = {
      run: jest
        .fn()
        .mockImplementation((work: (m: EntityManager) => Promise<unknown>) =>
          work(manager as unknown as EntityManager),
        ),
    };

    service = new PayrollPeriodsService(
      periodRepository as unknown as Repository<PayrollPeriod>,
      companiesService as unknown as CompaniesService,
      transactionService as unknown as TransactionService,
    );
  });

  const baseDto = {
    companyId: 'company-a',
    name: 'August 2026',
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    payDate: '2026-09-05',
  };

  describe('create — date range validation', () => {
    it('accepts a valid date range', async () => {
      const result = await service.create('company-a', 'user-1', baseDto);
      expect(result.periodNumber).toMatch(/^PP-\d{4}-\d{6}$/);
    });

    it('rejects startDate after endDate', async () => {
      await expect(
        service.create('company-a', 'user-1', {
          ...baseDto,
          startDate: '2026-08-31',
          endDate: '2026-08-01',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects payDate before endDate', async () => {
      await expect(
        service.create('company-a', 'user-1', {
          ...baseDto,
          payDate: '2026-08-15',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });
  });

  describe('create — duplicate/overlap prevention', () => {
    it('rejects a period with an identical date range already existing (409)', async () => {
      manager.findOne.mockResolvedValue(buildPeriod());

      await expect(
        service.create('company-a', 'user-1', baseDto),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });
  });

  describe('cancel — state transitions', () => {
    it('allows OPEN -> CANCELLED', async () => {
      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === PayrollPeriod) return Promise.resolve(buildPeriod());
        if (entity === PayrollRun) return Promise.resolve(null);
        return Promise.resolve(null);
      });

      const result = await service.cancel('period-1', 'company-a', 'user-1');
      expect(result.status).toBe(PayrollPeriodStatus.Cancelled);
    });

    it('allows PROCESSING -> CANCELLED', async () => {
      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === PayrollPeriod)
          return Promise.resolve(
            buildPeriod({ status: PayrollPeriodStatus.Processing }),
          );
        if (entity === PayrollRun) return Promise.resolve(null);
        return Promise.resolve(null);
      });

      const result = await service.cancel('period-1', 'company-a', 'user-1');
      expect(result.status).toBe(PayrollPeriodStatus.Cancelled);
    });

    it('rejects cancelling a FINALIZED period (invalid transition)', async () => {
      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === PayrollPeriod)
          return Promise.resolve(
            buildPeriod({ status: PayrollPeriodStatus.Finalized }),
          );
        return Promise.resolve(null);
      });

      await expect(
        service.cancel('period-1', 'company-a', 'user-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.UnprocessableEntity });
    });

    it('rejects cancelling a period with a CALCULATED payroll run without cancelling the run first', async () => {
      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === PayrollPeriod)
          return Promise.resolve(
            buildPeriod({ status: PayrollPeriodStatus.Processing }),
          );
        if (entity === PayrollRun)
          return Promise.resolve({
            id: 'run-1',
            status: PayrollRunStatus.Calculated,
          });
        return Promise.resolve(null);
      });

      await expect(
        service.cancel('period-1', 'company-a', 'user-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });
  });
});
