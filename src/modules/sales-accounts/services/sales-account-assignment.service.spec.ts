import { DataSource, EntityManager, Repository } from 'typeorm';
import { SalesAccountAssignmentService } from './sales-account-assignment.service';
import { SalesAccountAssignment } from '../entities/sales-account-assignment.entity';
import { SalesAccountAssignmentStatus } from '../entities/sales-account-assignment-status.enum';
import { SalesAccount } from '../entities/sales-account.entity';
import { SalesAccountStatus } from '../entities/sales-account-status.enum';
import { Employee } from '../../employees/entities/employee.entity';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('SalesAccountAssignmentService', () => {
  let service: SalesAccountAssignmentService;
  let assignmentRepository: jest.Mocked<
    Pick<Repository<SalesAccountAssignment>, 'find' | 'findOne' | 'save'>
  >;
  let salesAccountRepository: jest.Mocked<
    Pick<Repository<SalesAccount>, 'findOne'>
  >;
  let employeeRepository: jest.Mocked<Pick<Repository<Employee>, 'findOne'>>;
  let transactionService: TransactionService;
  let managerFindOne: jest.Mock;
  let managerCreate: jest.Mock;
  let managerSave: jest.Mock;

  const buildAccount = (overrides: Partial<SalesAccount> = {}): SalesAccount =>
    ({
      id: 'sa-1',
      companyId: 'company-a',
      branchId: 'branch-a1',
      status: SalesAccountStatus.Active,
      ...overrides,
    }) as SalesAccount;

  const buildEmployee = (overrides: Partial<Employee> = {}): Employee =>
    ({
      id: 'employee-1',
      companyId: 'company-a',
      branchId: 'branch-a1',
      userId: 'user-1',
      ...overrides,
    }) as Employee;

  beforeEach(() => {
    assignmentRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    salesAccountRepository = { findOne: jest.fn() };
    employeeRepository = { findOne: jest.fn() };

    managerFindOne = jest.fn();
    managerCreate = jest
      .fn()
      .mockImplementation((_entity: unknown, data: unknown) => data);
    managerSave = jest
      .fn()
      .mockImplementation((entity: unknown) => Promise.resolve(entity));

    const fakeManager = {
      findOne: managerFindOne,
      create: managerCreate,
      save: managerSave,
    } as unknown as EntityManager;

    transactionService = new TransactionService({
      transaction: (work: (manager: EntityManager) => Promise<unknown>) =>
        work(fakeManager),
    } as unknown as DataSource);

    service = new SalesAccountAssignmentService(
      assignmentRepository as unknown as Repository<SalesAccountAssignment>,
      salesAccountRepository as unknown as Repository<SalesAccount>,
      employeeRepository as unknown as Repository<Employee>,
      transactionService,
    );
  });

  describe('assign', () => {
    it('creates an assignment when account is active and employee/user/company/branch are all consistent', async () => {
      managerFindOne
        .mockResolvedValueOnce(buildAccount()) // active account lookup
        .mockResolvedValueOnce(buildEmployee()) // employee lookup
        .mockResolvedValueOnce(null); // no existing active assignment

      const result = await service.assign('sa-1', 'user-1', 'employee-1');

      expect(result).toMatchObject({
        userId: 'user-1',
        employeeId: 'employee-1',
        salesAccountId: 'sa-1',
        status: SalesAccountAssignmentStatus.Active,
      });
      expect(result.assignedAt).toBeInstanceOf(Date);
    });

    it('rejects when the sales account is not active (§39/§103/§137)', async () => {
      managerFindOne.mockResolvedValueOnce(null); // active-only lookup finds nothing

      await expect(
        service.assign('sa-1', 'user-1', 'employee-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects when employee belongs to a different company than the account (§56/§93)', async () => {
      managerFindOne
        .mockResolvedValueOnce(buildAccount({ companyId: 'company-a' }))
        .mockResolvedValueOnce(buildEmployee({ companyId: 'company-b' }));

      await expect(
        service.assign('sa-1', 'user-1', 'employee-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects when employee belongs to a different branch than the account (§94)', async () => {
      managerFindOne
        .mockResolvedValueOnce(buildAccount({ branchId: 'branch-a1' }))
        .mockResolvedValueOnce(buildEmployee({ branchId: 'branch-a2' }));

      await expect(
        service.assign('sa-1', 'user-1', 'employee-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it("rejects when the supplied userId does not match the employee's linked user (spoofing protection, §92)", async () => {
      managerFindOne
        .mockResolvedValueOnce(buildAccount())
        .mockResolvedValueOnce(buildEmployee({ userId: 'user-real-owner' }));

      await expect(
        service.assign('sa-1', 'user-attacker', 'employee-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a duplicate active assignment for the same user+account pair (409)', async () => {
      managerFindOne
        .mockResolvedValueOnce(buildAccount())
        .mockResolvedValueOnce(buildEmployee())
        .mockResolvedValueOnce({ id: 'existing-assignment' }); // existing active assignment

      await expect(
        service.assign('sa-1', 'user-1', 'employee-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });
  });

  describe('unassign', () => {
    it('sets INACTIVE and unassignedAt without deleting the row (history preserved, §97)', async () => {
      const assignment = {
        id: 'assignment-1',
        status: SalesAccountAssignmentStatus.Active,
        unassignedAt: null,
      } as SalesAccountAssignment;
      assignmentRepository.findOne.mockResolvedValue(assignment);
      assignmentRepository.save.mockImplementation((input) =>
        Promise.resolve(input as SalesAccountAssignment),
      );

      await service.unassign('assignment-1');

      expect(assignment.status).toBe(SalesAccountAssignmentStatus.Inactive);
      expect(assignment.unassignedAt).toBeInstanceOf(Date);
      expect(assignmentRepository.save).toHaveBeenCalledWith(assignment);
    });

    it('throws NotFound for a nonexistent assignment', async () => {
      assignmentRepository.findOne.mockResolvedValue(null);

      await expect(service.unassign('missing')).rejects.toMatchObject({
        errorCode: ErrorCode.NotFound,
      });
    });
  });
});
