import { DataSource, EntityManager, Repository } from 'typeorm';
import { LeaveRequestsService } from './leave-requests.service';
import { LeaveRequest } from '../entities/leave-request.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { LeaveType } from '../entities/leave-type.entity';
import { LeaveTypeStatus } from '../entities/leave-type-status.enum';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { ErrorCode } from '../../../core/errors/error-codes';
import { LeaveRequestStatus } from '../entities/leave-request-status.enum';

describe('LeaveRequestsService', () => {
  let service: LeaveRequestsService;
  let leaveRequestRepository: jest.Mocked<
    Pick<Repository<LeaveRequest>, 'create' | 'save' | 'findOne'>
  >;
  let employeeRepository: jest.Mocked<Pick<Repository<Employee>, 'findOne'>>;
  let leaveTypeRepository: jest.Mocked<Pick<Repository<LeaveType>, 'findOne'>>;
  let managerFindOne: jest.Mock;
  let managerSave: jest.Mock;

  beforeEach(() => {
    leaveRequestRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };
    employeeRepository = {
      findOne: jest.fn(),
    };
    leaveTypeRepository = {
      findOne: jest.fn(),
    };

    managerFindOne = jest.fn();
    managerSave = jest
      .fn()
      .mockImplementation((target, entity) =>
        Promise.resolve(entity ?? target),
      );

    const transactionService = new TransactionService({
      transaction: (work: (manager: EntityManager) => Promise<unknown>) =>
        work({
          findOne: managerFindOne,
          save: managerSave,
        } as unknown as EntityManager),
    } as unknown as DataSource);

    service = new LeaveRequestsService(
      leaveRequestRepository as unknown as Repository<LeaveRequest>,
      employeeRepository as unknown as Repository<Employee>,
      leaveTypeRepository as unknown as Repository<LeaveType>,
      transactionService,
    );
  });

  it('allows own-scoped create only for the linked employee', async () => {
    employeeRepository.findOne.mockResolvedValue({
      id: 'emp-1',
      companyId: 'company-a',
      branchId: 'branch-a1',
      userId: 'user-1',
    } as Employee);
    leaveTypeRepository.findOne.mockResolvedValue({
      id: 'leave-type-1',
      companyId: 'company-a',
      status: LeaveTypeStatus.Active,
    } as LeaveType);
    leaveRequestRepository.create.mockReturnValue({
      id: 'leave-request-1',
      employeeId: 'emp-1',
      companyId: 'company-a',
      branchId: 'branch-a1',
      leaveTypeId: 'leave-type-1',
      fromDate: '2026-08-15',
      toDate: '2026-08-15',
      reason: null,
      status: LeaveRequestStatus.Pending,
    } as LeaveRequest);
    leaveRequestRepository.save.mockResolvedValue({
      id: 'leave-request-1',
      employeeId: 'emp-1',
      companyId: 'company-a',
      branchId: 'branch-a1',
      leaveTypeId: 'leave-type-1',
      fromDate: '2026-08-15',
      toDate: '2026-08-15',
      reason: null,
      status: LeaveRequestStatus.Pending,
    } as LeaveRequest);

    const result = await service.create(
      'user-1',
      undefined,
      {
        employeeId: 'emp-1',
        leaveTypeId: 'leave-type-1',
        fromDate: '2026-08-15',
        toDate: '2026-08-15',
      },
      true,
    );

    expect(result.companyId).toBe('company-a');
  });

  it('rejects approving your own leave request', async () => {
    managerFindOne
      .mockResolvedValueOnce({
        id: 'leave-request-1',
        employeeId: 'emp-1',
        companyId: 'company-a',
        status: LeaveRequestStatus.Pending,
      })
      .mockResolvedValueOnce({
        id: 'emp-1',
        userId: 'user-1',
      });

    await expect(
      service.approve('leave-request-1', 'user-1', 'company-a'),
    ).rejects.toMatchObject({
      errorCode: ErrorCode.Forbidden,
    });
  });

  it('cancels a pending leave request for the owning employee', async () => {
    managerFindOne
      .mockResolvedValueOnce({
        id: 'leave-request-1',
        employeeId: 'emp-1',
        companyId: 'company-a',
        status: LeaveRequestStatus.Pending,
        cancelledAt: null,
      })
      .mockResolvedValueOnce({
        id: 'emp-1',
        userId: 'user-1',
      });

    const result = await service.cancel(
      'leave-request-1',
      'user-1',
      'company-a',
    );

    expect(result.status).toBe(LeaveRequestStatus.Cancelled);
    expect(managerSave).toHaveBeenCalled();
  });
});
