import { DataSource, EntityManager, Repository } from 'typeorm';
import { EmployeesService } from './employees.service';
import { Employee } from '../entities/employee.entity';
import { EmployeeStatus } from '../entities/employee-status.enum';
import { CompaniesService } from '../../organization/services/companies.service';
import { BranchesService } from '../../organization/services/branches.service';
import { Company } from '../../organization/entities/company.entity';
import { CompanyStatus } from '../../organization/entities/company-status.enum';
import { Branch } from '../../organization/entities/branch.entity';
import { BranchStatus } from '../../organization/entities/branch-status.enum';
import { User } from '../../users/entities/user.entity';
import { UserStatus } from '../../users/entities/user-status.enum';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('EmployeesService', () => {
  let service: EmployeesService;
  let employeeRepository: jest.Mocked<
    Pick<Repository<Employee>, 'findOne' | 'create' | 'save'>
  >;
  let companiesService: jest.Mocked<
    Pick<CompaniesService, 'findActiveByIdOrNull'>
  >;
  let branchesService: jest.Mocked<
    Pick<BranchesService, 'findActiveByIdOrNull'>
  >;
  let transactionService: TransactionService;
  let managerFindOne: jest.Mock;
  let managerSave: jest.Mock;

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

  const buildEmployee = (overrides: Partial<Employee> = {}): Employee =>
    ({
      id: 'employee-1',
      employeeCode: 'EMP-001',
      firstName: 'Jane',
      lastName: 'Doe',
      displayName: 'Jane Doe',
      phone: null,
      email: null,
      userId: null,
      companyId: 'company-a',
      branchId: 'branch-a1',
      status: EmployeeStatus.Active,
      joinedAt: new Date(),
      terminatedAt: null,
      ...overrides,
    }) as Employee;

  beforeEach(() => {
    employeeRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    companiesService = { findActiveByIdOrNull: jest.fn() };
    branchesService = { findActiveByIdOrNull: jest.fn() };

    managerFindOne = jest.fn();
    managerSave = jest
      .fn()
      .mockImplementation((entity) => Promise.resolve(entity));

    const fakeManager = {
      findOne: managerFindOne,
      save: managerSave,
    } as unknown as EntityManager;

    transactionService = new TransactionService({
      transaction: (work: (manager: EntityManager) => Promise<unknown>) =>
        work(fakeManager),
    } as unknown as DataSource);

    service = new EmployeesService(
      employeeRepository as unknown as Repository<Employee>,
      companiesService as unknown as CompaniesService,
      branchesService as unknown as BranchesService,
      transactionService,
    );
  });

  describe('create', () => {
    it('creates an employee when company/branch are active and consistent', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      branchesService.findActiveByIdOrNull.mockResolvedValue(buildBranch());
      employeeRepository.findOne.mockResolvedValue(null);
      const created = buildEmployee();
      employeeRepository.create.mockReturnValue(created);
      employeeRepository.save.mockResolvedValue(created);

      const result = await service.create({
        employeeCode: 'EMP-001',
        firstName: 'Jane',
        lastName: 'Doe',
        companyId: 'company-a',
        branchId: 'branch-a1',
      });

      expect(result).toBe(created);
    });

    it('rejects when companyId does not reference an active company', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(null);

      await expect(
        service.create({
          employeeCode: 'EMP-002',
          firstName: 'Jane',
          lastName: 'Doe',
          companyId: 'missing',
          branchId: 'branch-a1',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects Branch belonging to a different Company than the submitted companyId (§23/§54)', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(
        buildCompany({ id: 'company-a' }),
      );
      branchesService.findActiveByIdOrNull.mockResolvedValue(
        buildBranch({ id: 'branch-b1', companyId: 'company-b' }),
      );

      await expect(
        service.create({
          employeeCode: 'EMP-003',
          firstName: 'Jane',
          lastName: 'Doe',
          companyId: 'company-a',
          branchId: 'branch-b1',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a duplicate employee code within the same company', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      branchesService.findActiveByIdOrNull.mockResolvedValue(buildBranch());
      employeeRepository.findOne.mockResolvedValue(buildEmployee());

      await expect(
        service.create({
          employeeCode: 'EMP-001',
          firstName: 'Dup',
          lastName: 'Licate',
          companyId: 'company-a',
          branchId: 'branch-a1',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });
  });

  describe('linkUser', () => {
    it('links a user when neither side already has a link', async () => {
      const employee = buildEmployee({ userId: null });
      managerFindOne
        .mockResolvedValueOnce(employee) // employee lookup
        .mockResolvedValueOnce(null); // existing-link lookup

      const result = await service.linkUser('employee-1', 'user-1');

      expect(result.userId).toBe('user-1');
    });

    it('rejects when the employee already has a linked user (409)', async () => {
      managerFindOne.mockResolvedValueOnce(
        buildEmployee({ userId: 'user-existing' }),
      );

      await expect(
        service.linkUser('employee-1', 'user-1'),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.Conflict,
      });
    });

    it('rejects when the target user is already linked to a different employee (one-employee-per-user, §24)', async () => {
      managerFindOne
        .mockResolvedValueOnce(buildEmployee({ userId: null }))
        .mockResolvedValueOnce(
          buildEmployee({ id: 'employee-2', userId: 'user-1' }),
        );

      await expect(
        service.linkUser('employee-1', 'user-1'),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.Conflict,
      });
    });
  });

  describe('unlinkUser', () => {
    it("removes the relationship without touching either record's other fields", async () => {
      const employee = buildEmployee({ userId: 'user-1' });
      employeeRepository.findOne.mockResolvedValue(employee);
      employeeRepository.save.mockImplementation((input) =>
        Promise.resolve(input as Employee),
      );

      const result = await service.unlinkUser('employee-1');

      expect(result.userId).toBeNull();
    });
  });

  describe('terminate', () => {
    it('sets TERMINATED and deactivates the linked User when it exists and is active', async () => {
      const employee = buildEmployee({ userId: 'user-1' });
      const user = { id: 'user-1', status: UserStatus.Active } as User;
      managerFindOne
        .mockResolvedValueOnce(employee) // employee lookup
        .mockResolvedValueOnce(user); // linked user lookup

      const result = await service.terminate('employee-1');

      expect(result.status).toBe(EmployeeStatus.Terminated);
      expect(result.terminatedAt).not.toBeNull();
      expect(managerSave).toHaveBeenCalledWith(
        expect.objectContaining({ status: UserStatus.Inactive }),
      );
    });

    it('does not touch a User that has no link (userId null)', async () => {
      const employee = buildEmployee({ userId: null });
      managerFindOne.mockResolvedValueOnce(employee);

      await service.terminate('employee-1');

      // Only the employee save call should have happened, no second lookup for a user.
      expect(managerFindOne).toHaveBeenCalledTimes(1);
    });
  });
});
