import { EntityManager, Repository } from 'typeorm';
import { PayrollRunsService } from './payroll-runs.service';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollRunStatus } from '../entities/payroll-run-status.enum';
import { PayrollRunEmployee } from '../entities/payroll-run-employee.entity';
import { PayrollRunEmployeeItem } from '../entities/payroll-run-employee-item.entity';
import { PayrollPeriod } from '../entities/payroll-period.entity';
import { PayrollPeriodStatus } from '../entities/payroll-period-status.enum';
import { PayrollComponent } from '../entities/payroll-component.entity';
import { PayrollComponentType } from '../entities/payroll-component-type.enum';
import { PayrollCalculationType } from '../entities/payroll-calculation-type.enum';
import { UnpaidLeaveCalculation } from '../entities/unpaid-leave-calculation.enum';
import { Employee } from '../../employees/entities/employee.entity';
import { EmployeeStatus } from '../../employees/entities/employee-status.enum';
import { EmployeeCompensationService } from './employee-compensation.service';
import { EmployeePayrollComponentsService } from './employee-payroll-components.service';
import { PayrollPeriodsService } from './payroll-periods.service';
import { PayrollConfigurationService } from './payroll-configuration.service';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('PayrollRunsService', () => {
  let service: PayrollRunsService;
  let runRepository: jest.Mocked<Pick<Repository<PayrollRun>, 'findOne'>>;
  let runEmployeeRepository: jest.Mocked<
    Pick<Repository<PayrollRunEmployee>, 'findOne' | 'findAndCount'>
  >;
  let runEmployeeItemRepository: jest.Mocked<
    Pick<Repository<PayrollRunEmployeeItem>, 'find'>
  >;
  let compensationService: jest.Mocked<
    Pick<EmployeeCompensationService, 'findAsOfDate'>
  >;
  let employeeComponentsService: jest.Mocked<
    Pick<EmployeePayrollComponentsService, 'findAllAsOfDate'>
  >;
  let periodsService: jest.Mocked<
    Pick<
      PayrollPeriodsService,
      'markProcessing' | 'markFinalized' | 'revertToOpen'
    >
  >;
  let configurationService: jest.Mocked<
    Pick<PayrollConfigurationService, 'getRequiredForCalculation'>
  >;
  let transactionService: jest.Mocked<Pick<TransactionService, 'run'>>;

  interface MockManager {
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    find: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    query: jest.Mock;
    createQueryBuilder: jest.Mock;
    getRepository: jest.Mock;
  }
  let manager: MockManager;
  let genericQueryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    setLock: jest.Mock;
    getOne: jest.Mock;
    getMany: jest.Mock;
    getOneOrFail: jest.Mock;
  };

  const buildRun = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'run-1',
      companyId: 'company-a',
      payrollPeriodId: 'period-1',
      runNumber: 'PR-2026-000001',
      status: PayrollRunStatus.Draft,
      employeeCount: 0,
      totalGrossPay: '0.00',
      totalDeductions: '0.00',
      totalNetPay: '0.00',
      startedAt: null,
      completedAt: null,
      finalizedAt: null,
      createdBy: 'user-1',
      finalizedBy: null,
      ...overrides,
    }) as PayrollRun;

  const buildPeriod = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'period-1',
      companyId: 'company-a',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      status: PayrollPeriodStatus.Open,
      ...overrides,
    }) as PayrollPeriod;

  const buildEmployee = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'employee-1',
      companyId: 'company-a',
      employeeCode: 'EMP001',
      displayName: 'Jane Doe',
      status: EmployeeStatus.Active,
      ...overrides,
    }) as Employee;

  const buildCompensation = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'comp-1',
      employeeId: 'employee-1',
      baseSalary: '1000.00',
      currency: 'USD',
      ...overrides,
    }) as never;

  beforeEach(() => {
    runRepository = { findOne: jest.fn() };
    runEmployeeRepository = {
      findOne: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    runEmployeeItemRepository = { find: jest.fn().mockResolvedValue([]) };
    compensationService = { findAsOfDate: jest.fn().mockResolvedValue(null) };
    employeeComponentsService = {
      findAllAsOfDate: jest.fn().mockResolvedValue([]),
    };
    periodsService = {
      markProcessing: jest.fn().mockResolvedValue(undefined),
      markFinalized: jest.fn().mockResolvedValue(undefined),
      revertToOpen: jest.fn().mockResolvedValue(undefined),
    };
    configurationService = {
      getRequiredForCalculation: jest.fn().mockResolvedValue({
        companyId: 'company-a',
        defaultCurrency: 'USD',
        unpaidLeaveCalculation: UnpaidLeaveCalculation.None,
        workingDaysPerMonth: null,
      }),
    };

    genericQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
      getMany: jest.fn().mockResolvedValue([]),
      getOneOrFail: jest
        .fn()
        .mockResolvedValue({ id: 'counter-1', lastSequence: 0 }),
    };

    manager = {
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((_entity: unknown, data: unknown) => data),
      save: jest.fn((_entity: unknown, data: unknown) => Promise.resolve(data)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      query: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue(genericQueryBuilder),
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(genericQueryBuilder),
      }),
    };

    transactionService = {
      run: jest
        .fn()
        .mockImplementation((work: (m: EntityManager) => Promise<unknown>) =>
          work(manager as unknown as EntityManager),
        ),
    };

    service = new PayrollRunsService(
      runRepository as unknown as Repository<PayrollRun>,
      runEmployeeRepository as unknown as Repository<PayrollRunEmployee>,
      runEmployeeItemRepository as unknown as Repository<PayrollRunEmployeeItem>,
      compensationService as unknown as EmployeeCompensationService,
      employeeComponentsService as unknown as EmployeePayrollComponentsService,
      periodsService as unknown as PayrollPeriodsService,
      configurationService as unknown as PayrollConfigurationService,
      transactionService as unknown as TransactionService,
    );

    manager.findOne.mockImplementation((entity: unknown) => {
      if (entity === PayrollPeriod) return Promise.resolve(buildPeriod());
      if (entity === PayrollRun) return Promise.resolve(buildRun());
      return Promise.resolve(null);
    });
    manager.findOneOrFail.mockImplementation((entity: unknown) => {
      if (entity === PayrollPeriod) return Promise.resolve(buildPeriod());
      return Promise.resolve(null);
    });
  });

  describe('create — duplicate active run prevention', () => {
    it('creates a run for an OPEN period with no existing active run', async () => {
      genericQueryBuilder.getOne.mockResolvedValue(null);

      const result = await service.create('company-a', 'user-1', {
        companyId: 'company-a',
        payrollPeriodId: 'period-1',
      });

      expect(result.runNumber).toMatch(/^PR-\d{4}-\d{6}$/);
      expect(result.status).toBe(PayrollRunStatus.Draft);
    });

    it('rejects creating a run when an active (non-CANCELLED) run already exists for the period', async () => {
      genericQueryBuilder.getOne.mockResolvedValue(
        buildRun({ id: 'existing-run', status: PayrollRunStatus.Calculated }),
      );

      await expect(
        service.create('company-a', 'user-1', {
          companyId: 'company-a',
          payrollPeriodId: 'period-1',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('rejects creating a run for a period that is not OPEN', async () => {
      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === PayrollPeriod)
          return Promise.resolve(
            buildPeriod({ status: PayrollPeriodStatus.Finalized }),
          );
        return Promise.resolve(null);
      });

      await expect(
        service.create('company-a', 'user-1', {
          companyId: 'company-a',
          payrollPeriodId: 'period-1',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.UnprocessableEntity });
    });
  });

  describe('calculate — status guard / double-calculation prevention', () => {
    it('rejects calculating a run that is not DRAFT (e.g. already CALCULATED)', async () => {
      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === PayrollRun)
          return Promise.resolve(
            buildRun({ status: PayrollRunStatus.Calculated }),
          );
        return Promise.resolve(null);
      });

      await expect(
        service.calculate('run-1', 'company-a'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.UnprocessableEntity });
    });

    it('rejects a concurrent second calculate call once status is PROCESSING', async () => {
      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === PayrollRun)
          return Promise.resolve(
            buildRun({ status: PayrollRunStatus.Processing }),
          );
        return Promise.resolve(null);
      });

      await expect(
        service.calculate('run-1', 'company-a'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.UnprocessableEntity });
    });

    it('throws NotFound for a nonexistent run', async () => {
      manager.findOne.mockResolvedValue(null);

      await expect(
        service.calculate('run-1', 'company-a'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });

  describe('calculate — gross/deductions/net computation', () => {
    it('computes gross = base + earnings, net = gross - deductions for one employee with one earning and one deduction component', async () => {
      manager.find.mockImplementation((entity: unknown) => {
        if (entity === Employee) return Promise.resolve([buildEmployee()]);
        return Promise.resolve([]);
      });
      compensationService.findAsOfDate.mockResolvedValue(buildCompensation());
      employeeComponentsService.findAllAsOfDate.mockResolvedValue([
        {
          payrollComponentId: 'earn-1',
          amount: null,
          percentage: null,
        } as never,
        {
          payrollComponentId: 'ded-1',
          amount: null,
          percentage: null,
        } as never,
      ]);
      manager.findOneOrFail.mockImplementation(
        (entity: unknown, opts: unknown) => {
          if (entity === PayrollPeriod) return Promise.resolve(buildPeriod());
          if (entity === PayrollComponent) {
            const where = (opts as { where: { id: string } }).where;
            if (where.id === 'earn-1') {
              return Promise.resolve({
                id: 'earn-1',
                name: 'Bonus',
                code: 'BONUS',
                type: PayrollComponentType.Earning,
                calculationType: PayrollCalculationType.FixedAmount,
                fixedAmount: '200.00',
                percentage: null,
                isActive: true,
              } as PayrollComponent);
            }
            return Promise.resolve({
              id: 'ded-1',
              name: 'Tax',
              code: 'TAX',
              type: PayrollComponentType.Deduction,
              calculationType: PayrollCalculationType.FixedAmount,
              fixedAmount: '50.00',
              percentage: null,
              isActive: true,
            } as PayrollComponent);
          }
          return Promise.resolve(null);
        },
      );
      manager.count.mockResolvedValue(1);

      const result = await service.calculate('run-1', 'company-a');

      // gross = 1000 (base) + 200 (earning) = 1200; net = 1200 - 50 = 1150
      expect(result.totalGrossPay).toBe('1200.00');
      expect(result.totalDeductions).toBe('50.00');
      expect(result.totalNetPay).toBe('1150.00');
      expect(result.status).toBe(PayrollRunStatus.Calculated);
    });

    it('excludes an employee with no compensation configured as of the period start', async () => {
      manager.find.mockImplementation((entity: unknown) => {
        if (entity === Employee) return Promise.resolve([buildEmployee()]);
        return Promise.resolve([]);
      });
      compensationService.findAsOfDate.mockResolvedValue(null);
      manager.count.mockResolvedValue(0);

      const result = await service.calculate('run-1', 'company-a');

      expect(result.employeeCount).toBe(0);
      expect(result.totalGrossPay).toBe('0.00');
    });
  });

  describe('finalize — CALCULATED -> FINALIZED, immutability, double-finalization prevention', () => {
    it('finalizes a CALCULATED run', async () => {
      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === PayrollRun)
          return Promise.resolve(
            buildRun({ status: PayrollRunStatus.Calculated }),
          );
        return Promise.resolve(null);
      });

      const result = await service.finalize('run-1', 'company-a', 'user-1');

      expect(result.status).toBe(PayrollRunStatus.Finalized);
      expect(result.finalizedBy).toBe('user-1');
    });

    it('rejects finalizing a DRAFT run', async () => {
      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === PayrollRun) return Promise.resolve(buildRun());
        return Promise.resolve(null);
      });

      await expect(
        service.finalize('run-1', 'company-a', 'user-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.UnprocessableEntity });
    });

    it('rejects re-finalizing an already-FINALIZED run (double-finalization protection)', async () => {
      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === PayrollRun)
          return Promise.resolve(
            buildRun({ status: PayrollRunStatus.Finalized }),
          );
        return Promise.resolve(null);
      });

      await expect(
        service.finalize('run-1', 'company-a', 'user-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.UnprocessableEntity });
    });
  });

  describe('cancel — allowed transitions and finalized immutability', () => {
    it('allows DRAFT -> CANCELLED', async () => {
      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === PayrollRun) return Promise.resolve(buildRun());
        return Promise.resolve(null);
      });

      const result = await service.cancel('run-1', 'company-a');
      expect(result.status).toBe(PayrollRunStatus.Cancelled);
    });

    it('allows CALCULATED -> CANCELLED and reverts the period to OPEN', async () => {
      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === PayrollRun)
          return Promise.resolve(
            buildRun({ status: PayrollRunStatus.Calculated }),
          );
        return Promise.resolve(null);
      });

      const result = await service.cancel('run-1', 'company-a');
      expect(result.status).toBe(PayrollRunStatus.Cancelled);
      expect(periodsService.revertToOpen).toHaveBeenCalled();
    });

    it('rejects cancelling a FINALIZED run (immutable)', async () => {
      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === PayrollRun)
          return Promise.resolve(
            buildRun({ status: PayrollRunStatus.Finalized }),
          );
        return Promise.resolve(null);
      });

      await expect(service.cancel('run-1', 'company-a')).rejects.toMatchObject({
        errorCode: ErrorCode.UnprocessableEntity,
      });
    });
  });

  describe('cross-company isolation', () => {
    it('findByIdInCompany throws NotFound for a run in a different company', async () => {
      runRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdInCompany('run-1', 'company-b'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });
});
