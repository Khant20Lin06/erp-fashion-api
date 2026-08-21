import { Repository, SelectQueryBuilder } from 'typeorm';
import { PayrollComponentsService } from './payroll-components.service';
import { PayrollComponent } from '../entities/payroll-component.entity';
import { EmployeePayrollComponent } from '../entities/employee-payroll-component.entity';
import { PayrollRunEmployeeItem } from '../entities/payroll-run-employee-item.entity';
import { PayrollComponentType } from '../entities/payroll-component-type.enum';
import { PayrollCalculationType } from '../entities/payroll-calculation-type.enum';
import { CompaniesService } from '../../organization/services/companies.service';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('PayrollComponentsService', () => {
  let service: PayrollComponentsService;
  let componentRepository: jest.Mocked<
    Pick<
      Repository<PayrollComponent>,
      'findOne' | 'create' | 'save' | 'softRemove' | 'createQueryBuilder'
    >
  >;
  let employeeComponentRepository: jest.Mocked<
    Pick<Repository<EmployeePayrollComponent>, 'count'>
  >;
  let runItemRepository: jest.Mocked<
    Pick<Repository<PayrollRunEmployeeItem>, 'count'>
  >;
  let companiesService: jest.Mocked<
    Pick<CompaniesService, 'findActiveByIdOrNull'>
  >;
  let queryBuilder: jest.Mocked<
    Pick<
      SelectQueryBuilder<PayrollComponent>,
      | 'where'
      | 'andWhere'
      | 'orderBy'
      | 'skip'
      | 'take'
      | 'getManyAndCount'
      | 'getOne'
    >
  >;

  const buildComponent = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'comp-1',
      companyId: 'company-a',
      name: 'Housing Allowance',
      code: 'HOUSING',
      type: PayrollComponentType.Earning,
      calculationType: PayrollCalculationType.FixedAmount,
      fixedAmount: '100.00',
      percentage: null,
      isTaxable: false,
      isActive: true,
      ...overrides,
    }) as PayrollComponent;

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getOne: jest.fn().mockResolvedValue(null),
    };
    componentRepository = {
      findOne: jest.fn(),
      create: jest.fn((data: unknown) => data as PayrollComponent) as never,
      save: jest.fn((data: unknown) =>
        Promise.resolve(data as PayrollComponent),
      ) as never,
      softRemove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    employeeComponentRepository = { count: jest.fn().mockResolvedValue(0) };
    runItemRepository = { count: jest.fn().mockResolvedValue(0) };
    companiesService = {
      findActiveByIdOrNull: jest.fn().mockResolvedValue({ id: 'company-a' }),
    };

    service = new PayrollComponentsService(
      componentRepository as unknown as Repository<PayrollComponent>,
      employeeComponentRepository as unknown as Repository<EmployeePayrollComponent>,
      runItemRepository as unknown as Repository<PayrollRunEmployeeItem>,
      companiesService as unknown as CompaniesService,
    );
  });

  describe('create — fixed vs percentage calculation validation', () => {
    it('accepts a FIXED_AMOUNT component with fixedAmount set and percentage omitted', async () => {
      componentRepository.findOne.mockResolvedValue(null);

      const result = await service.create('company-a', 'user-1', {
        companyId: 'company-a',
        name: 'Housing Allowance',
        code: 'HOUSING',
        type: PayrollComponentType.Earning,
        calculationType: PayrollCalculationType.FixedAmount,
        fixedAmount: '100.00',
      });

      expect(result.fixedAmount).toBe('100.00');
      expect(result.percentage).toBeNull();
    });

    it('accepts a PERCENTAGE_OF_BASE component with percentage set and fixedAmount omitted', async () => {
      componentRepository.findOne.mockResolvedValue(null);

      const result = await service.create('company-a', 'user-1', {
        companyId: 'company-a',
        name: 'Tax Deduction',
        code: 'TAX',
        type: PayrollComponentType.Deduction,
        calculationType: PayrollCalculationType.PercentageOfBase,
        percentage: '5.0000',
      });

      expect(result.percentage).toBe('5.0000');
      expect(result.fixedAmount).toBeNull();
    });

    it('rejects a FIXED_AMOUNT component missing fixedAmount', async () => {
      componentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create('company-a', 'user-1', {
          companyId: 'company-a',
          name: 'Housing Allowance',
          code: 'HOUSING',
          type: PayrollComponentType.Earning,
          calculationType: PayrollCalculationType.FixedAmount,
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a FIXED_AMOUNT component that also sets percentage', async () => {
      componentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create('company-a', 'user-1', {
          companyId: 'company-a',
          name: 'Housing Allowance',
          code: 'HOUSING',
          type: PayrollComponentType.Earning,
          calculationType: PayrollCalculationType.FixedAmount,
          fixedAmount: '100.00',
          percentage: '5.0000',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a PERCENTAGE_OF_BASE component missing percentage', async () => {
      componentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create('company-a', 'user-1', {
          companyId: 'company-a',
          name: 'Tax Deduction',
          code: 'TAX',
          type: PayrollComponentType.Deduction,
          calculationType: PayrollCalculationType.PercentageOfBase,
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });
  });

  describe('create — duplicate name/code', () => {
    it('rejects a duplicate code within the same company', async () => {
      componentRepository.findOne.mockResolvedValue(buildComponent());

      await expect(
        service.create('company-a', 'user-1', {
          companyId: 'company-a',
          name: 'New Name',
          code: 'HOUSING',
          type: PayrollComponentType.Earning,
          calculationType: PayrollCalculationType.FixedAmount,
          fixedAmount: '50.00',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });
  });

  describe('activate/deactivate — inactive-component behavior', () => {
    it('deactivate sets isActive to false', async () => {
      componentRepository.findOne.mockResolvedValue(buildComponent());

      const result = await service.deactivate('comp-1', 'company-a', 'user-1');

      expect(result.isActive).toBe(false);
    });

    it('activate sets isActive back to true', async () => {
      componentRepository.findOne.mockResolvedValue(
        buildComponent({ isActive: false }),
      );

      const result = await service.activate('comp-1', 'company-a', 'user-1');

      expect(result.isActive).toBe(true);
    });
  });

  describe('remove — referenced-by-history guard', () => {
    it('rejects deleting a component referenced by an employee assignment', async () => {
      componentRepository.findOne.mockResolvedValue(buildComponent());
      employeeComponentRepository.count.mockResolvedValue(1);

      await expect(service.remove('comp-1', 'company-a')).rejects.toMatchObject(
        { errorCode: ErrorCode.Conflict },
      );
    });

    it('rejects deleting a component referenced by payroll run history', async () => {
      componentRepository.findOne.mockResolvedValue(buildComponent());
      runItemRepository.count.mockResolvedValue(1);

      await expect(service.remove('comp-1', 'company-a')).rejects.toMatchObject(
        { errorCode: ErrorCode.Conflict },
      );
    });

    it('soft-deletes an unreferenced component', async () => {
      componentRepository.findOne.mockResolvedValue(buildComponent());

      await service.remove('comp-1', 'company-a');

      expect(componentRepository.softRemove).toHaveBeenCalled();
    });
  });

  describe('cross-company isolation', () => {
    it('findByIdInCompany throws NotFound for a component in a different company', async () => {
      componentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdInCompany('comp-1', 'company-b'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });
});
