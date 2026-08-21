import { Repository, SelectQueryBuilder } from 'typeorm';
import { ShiftsService } from './shifts.service';
import { Shift } from '../entities/shift.entity';
import { EmployeeShiftAssignment } from '../entities/employee-shift-assignment.entity';
import { CompaniesService } from '../../organization/services/companies.service';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('ShiftsService', () => {
  let service: ShiftsService;
  let shiftRepository: jest.Mocked<
    Pick<
      Repository<Shift>,
      'findOne' | 'create' | 'save' | 'softRemove' | 'createQueryBuilder'
    >
  >;
  let shiftAssignmentRepository: jest.Mocked<
    Pick<Repository<EmployeeShiftAssignment>, 'count'>
  >;
  let companiesService: jest.Mocked<
    Pick<CompaniesService, 'findActiveByIdOrNull'>
  >;
  let queryBuilder: jest.Mocked<
    Pick<
      SelectQueryBuilder<Shift>,
      'where' | 'andWhere' | 'orderBy' | 'skip' | 'take' | 'getManyAndCount'
    >
  >;

  const buildShift = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'shift-1',
      companyId: 'company-a',
      branchId: null,
      name: 'Night Shift',
      code: 'NIGHT',
      startTime: '22:00',
      endTime: '06:00',
      breakMinutes: 30,
      graceMinutes: 10,
      isActive: true,
      ...overrides,
    }) as Shift;

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    shiftRepository = {
      findOne: jest.fn(),
      create: jest.fn((data: unknown) => data as Shift) as never,
      save: jest.fn((data: unknown) => Promise.resolve(data as Shift)) as never,
      softRemove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    shiftAssignmentRepository = { count: jest.fn().mockResolvedValue(0) };
    companiesService = {
      findActiveByIdOrNull: jest.fn().mockResolvedValue({ id: 'company-a' }),
    };

    service = new ShiftsService(
      shiftRepository as unknown as Repository<Shift>,
      shiftAssignmentRepository as unknown as Repository<EmployeeShiftAssignment>,
      companiesService as unknown as CompaniesService,
    );
  });

  describe('create — overnight shift support', () => {
    it('accepts endTime < startTime as a valid overnight shift', async () => {
      shiftRepository.findOne.mockResolvedValue(null);

      const result = await service.create('company-a', 'user-1', {
        companyId: 'company-a',
        name: 'Night Shift',
        code: 'NIGHT',
        startTime: '22:00',
        endTime: '06:00',
      });

      expect(result.startTime).toBe('22:00');
      expect(result.endTime).toBe('06:00');
    });

    it('accepts a normal same-day shift where endTime > startTime', async () => {
      shiftRepository.findOne.mockResolvedValue(null);

      const result = await service.create('company-a', 'user-1', {
        companyId: 'company-a',
        name: 'Day Shift',
        code: 'DAY',
        startTime: '09:00',
        endTime: '17:00',
      });

      expect(result.startTime).toBe('09:00');
      expect(result.endTime).toBe('17:00');
    });
  });

  describe('create — duplicate code prevention', () => {
    it('rejects a duplicate shift code within the same company', async () => {
      shiftRepository.findOne.mockResolvedValue(buildShift());

      await expect(
        service.create('company-a', 'user-1', {
          companyId: 'company-a',
          name: 'Another Shift',
          code: 'NIGHT',
          startTime: '08:00',
          endTime: '16:00',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('rejects an inactive/nonexistent company', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(null);

      await expect(
        service.create('company-a', 'user-1', {
          companyId: 'company-a',
          name: 'Night Shift',
          code: 'NIGHT',
          startTime: '22:00',
          endTime: '06:00',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });
  });

  describe('remove — soft delete and referenced-shift guard', () => {
    it('rejects deleting a shift referenced by an employee shift assignment', async () => {
      shiftRepository.findOne.mockResolvedValue(buildShift());
      shiftAssignmentRepository.count.mockResolvedValue(1);

      await expect(
        service.remove('shift-1', 'company-a'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('soft-deletes an unreferenced shift', async () => {
      shiftRepository.findOne.mockResolvedValue(buildShift());

      await service.remove('shift-1', 'company-a');

      expect(shiftRepository.softRemove).toHaveBeenCalled();
    });
  });

  describe('cross-company isolation', () => {
    it('findByIdInCompany throws NotFound for a shift in a different company', async () => {
      shiftRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdInCompany('shift-1', 'company-b'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });
});
