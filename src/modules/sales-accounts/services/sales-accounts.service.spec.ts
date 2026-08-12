import { Repository } from 'typeorm';
import { SalesAccountsService } from './sales-accounts.service';
import { SalesAccount } from '../entities/sales-account.entity';
import { SalesAccountStatus } from '../entities/sales-account-status.enum';
import { CompaniesService } from '../../organization/services/companies.service';
import { BranchesService } from '../../organization/services/branches.service';
import { Company } from '../../organization/entities/company.entity';
import { CompanyStatus } from '../../organization/entities/company-status.enum';
import { Branch } from '../../organization/entities/branch.entity';
import { BranchStatus } from '../../organization/entities/branch-status.enum';
import { Employee } from '../../employees/entities/employee.entity';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('SalesAccountsService', () => {
  let service: SalesAccountsService;
  let salesAccountRepository: jest.Mocked<
    Pick<
      Repository<SalesAccount>,
      'findOne' | 'findAndCount' | 'create' | 'save'
    >
  >;
  let employeeRepository: jest.Mocked<Pick<Repository<Employee>, 'findOne'>>;
  let companiesService: jest.Mocked<
    Pick<CompaniesService, 'findActiveByIdOrNull'>
  >;
  let branchesService: jest.Mocked<
    Pick<BranchesService, 'findActiveByIdOrNull'>
  >;

  const buildCompany = (overrides: Partial<Company> = {}): Company =>
    ({
      id: 'company-a',
      status: CompanyStatus.Active,
      ...overrides,
    }) as Company;

  const buildBranch = (overrides: Partial<Branch> = {}): Branch =>
    ({
      id: 'branch-a1',
      companyId: 'company-a',
      status: BranchStatus.Active,
      ...overrides,
    }) as Branch;

  const buildAccount = (overrides: Partial<SalesAccount> = {}): SalesAccount =>
    ({
      id: 'sa-1',
      code: 'SA-001',
      name: 'Bangkok Retail Sales',
      companyId: 'company-a',
      branchId: 'branch-a1',
      employeeId: null,
      status: SalesAccountStatus.Active,
      ...overrides,
    }) as SalesAccount;

  beforeEach(() => {
    salesAccountRepository = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    employeeRepository = { findOne: jest.fn() };
    companiesService = { findActiveByIdOrNull: jest.fn() };
    branchesService = { findActiveByIdOrNull: jest.fn() };

    service = new SalesAccountsService(
      salesAccountRepository as unknown as Repository<SalesAccount>,
      employeeRepository as unknown as Repository<Employee>,
      companiesService as unknown as CompaniesService,
      branchesService as unknown as BranchesService,
    );
  });

  describe('create', () => {
    it('creates a sales account when company/branch are active and consistent', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      branchesService.findActiveByIdOrNull.mockResolvedValue(buildBranch());
      salesAccountRepository.findOne.mockResolvedValue(null);
      const created = buildAccount();
      salesAccountRepository.create.mockReturnValue(created);
      salesAccountRepository.save.mockResolvedValue(created);

      const result = await service.create({
        code: 'SA-001',
        name: 'Bangkok Retail Sales',
        companyId: 'company-a',
        branchId: 'branch-a1',
      });

      expect(result).toBe(created);
    });

    it('rejects Branch belonging to a different Company (§37/§55)', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(
        buildCompany({ id: 'company-a' }),
      );
      branchesService.findActiveByIdOrNull.mockResolvedValue(
        buildBranch({ id: 'branch-b1', companyId: 'company-b' }),
      );

      await expect(
        service.create({
          code: 'SA-002',
          name: 'Cross Company',
          companyId: 'company-a',
          branchId: 'branch-b1',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects an employeeId belonging to a different company (§56)', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      branchesService.findActiveByIdOrNull.mockResolvedValue(buildBranch());
      employeeRepository.findOne.mockResolvedValue({
        id: 'employee-1',
        companyId: 'company-b',
      } as Employee);

      await expect(
        service.create({
          code: 'SA-003',
          name: 'Wrong Employee Company',
          companyId: 'company-a',
          branchId: 'branch-a1',
          employeeId: 'employee-1',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a duplicate code within the same company', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      branchesService.findActiveByIdOrNull.mockResolvedValue(buildBranch());
      salesAccountRepository.findOne.mockResolvedValue(buildAccount());

      await expect(
        service.create({
          code: 'SA-001',
          name: 'Duplicate',
          companyId: 'company-a',
          branchId: 'branch-a1',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });
  });

  describe('deactivate', () => {
    it('sets status to INACTIVE', async () => {
      salesAccountRepository.findOne.mockResolvedValue(buildAccount());
      salesAccountRepository.save.mockImplementation((input) =>
        Promise.resolve(input as SalesAccount),
      );

      const result = await service.deactivate('sa-1');

      expect(result.status).toBe(SalesAccountStatus.Inactive);
    });
  });
});
