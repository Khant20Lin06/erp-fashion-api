import { Repository } from 'typeorm';
import { SalesAccountAccessService } from './sales-account-access.service';
import { SalesAccountAssignment } from '../entities/sales-account-assignment.entity';
import { SalesAccountAssignmentStatus } from '../entities/sales-account-assignment-status.enum';

describe('SalesAccountAccessService', () => {
  let service: SalesAccountAccessService;
  let assignmentRepository: jest.Mocked<
    Pick<Repository<SalesAccountAssignment>, 'find' | 'findOne'>
  >;

  beforeEach(() => {
    assignmentRepository = { find: jest.fn(), findOne: jest.fn() };
    service = new SalesAccountAccessService(
      assignmentRepository as unknown as Repository<SalesAccountAssignment>,
    );
  });

  describe('getAllowedSalesAccountIds', () => {
    it('returns only the IDs of active assignments (§145)', async () => {
      assignmentRepository.find.mockResolvedValue([
        { salesAccountId: 'sa-001' } as SalesAccountAssignment,
        { salesAccountId: 'sa-003' } as SalesAccountAssignment,
      ]);

      const result = await service.getAllowedSalesAccountIds('user-1');

      expect(result).toEqual(['sa-001', 'sa-003']);
      expect(assignmentRepository.find).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          status: SalesAccountAssignmentStatus.Active,
        },
      });
    });

    it('returns an empty array when the user has no active assignments', async () => {
      assignmentRepository.find.mockResolvedValue([]);

      const result = await service.getAllowedSalesAccountIds('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('canAccessSalesAccount', () => {
    it('returns true when an active assignment exists (Sales Staff A -> Account A)', async () => {
      assignmentRepository.findOne.mockResolvedValue(
        {} as SalesAccountAssignment,
      );

      await expect(
        service.canAccessSalesAccount('user-a', 'sa-001'),
      ).resolves.toBe(true);
    });

    it('returns false for an unassigned account (Sales Staff A cannot see Account B, §128)', async () => {
      assignmentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.canAccessSalesAccount('user-a', 'sa-002'),
      ).resolves.toBe(false);
    });
  });
});
