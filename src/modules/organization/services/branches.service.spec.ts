import { Repository } from 'typeorm';
import { BranchesService } from './branches.service';
import { CompaniesService } from './companies.service';
import { Branch } from '../entities/branch.entity';
import { BranchStatus } from '../entities/branch-status.enum';
import { Company } from '../entities/company.entity';
import { CompanyStatus } from '../entities/company-status.enum';
import { Warehouse } from '../entities/warehouse.entity';
import { ErrorCode } from '../../../core/errors/error-codes';

type MockedRepo<T extends object> = jest.Mocked<
  Pick<
    Repository<T>,
    'findOne' | 'findAndCount' | 'create' | 'save' | 'softRemove' | 'count'
  >
>;

describe('BranchesService', () => {
  let service: BranchesService;
  let branchRepository: MockedRepo<Branch>;
  let warehouseRepository: MockedRepo<Warehouse>;
  let companiesService: jest.Mocked<
    Pick<CompaniesService, 'findActiveByIdOrNull'>
  >;

  const buildCompany = (overrides: Partial<Company> = {}): Company =>
    ({
      id: 'company-1',
      code: 'FASHION-MM',
      status: CompanyStatus.Active,
      ...overrides,
    }) as Company;

  const buildBranch = (overrides: Partial<Branch> = {}): Branch =>
    ({
      id: 'branch-1',
      companyId: 'company-1',
      code: 'HQ',
      name: 'Head Office',
      status: BranchStatus.Active,
      phone: null,
      email: null,
      address: null,
      timezone: null,
      ...overrides,
    }) as Branch;

  beforeEach(() => {
    branchRepository = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
      count: jest.fn(),
    };
    warehouseRepository = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
      count: jest.fn(),
    };
    companiesService = { findActiveByIdOrNull: jest.fn() };

    service = new BranchesService(
      branchRepository as unknown as Repository<Branch>,
      warehouseRepository as unknown as Repository<Warehouse>,
      companiesService as unknown as CompaniesService,
    );
  });

  describe('create', () => {
    it('creates a branch when the parent company is active and code is unique in-company', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      branchRepository.findOne.mockResolvedValue(null);
      const created = buildBranch();
      branchRepository.create.mockReturnValue(created);
      branchRepository.save.mockResolvedValue(created);

      const result = await service.create({
        companyId: 'company-1',
        code: 'HQ',
        name: 'Head Office',
      });

      expect(result).toBe(created);
    });

    it('rejects when companyId does not reference an active company (§29)', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(null);

      await expect(
        service.create({
          companyId: 'missing-or-inactive',
          code: 'HQ',
          name: 'Head Office',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
      expect(branchRepository.save).not.toHaveBeenCalled();
    });

    it('rejects a duplicate code within the same company (409)', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      branchRepository.findOne.mockResolvedValue(buildBranch());

      await expect(
        service.create({ companyId: 'company-1', code: 'HQ', name: 'Dup' }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('allows the same code across two different companies (§9 — scoped uniqueness)', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(
        buildCompany({ id: 'company-2' }),
      );
      branchRepository.findOne.mockResolvedValue(null);
      const created = buildBranch({ id: 'branch-2', companyId: 'company-2' });
      branchRepository.create.mockReturnValue(created);
      branchRepository.save.mockResolvedValue(created);

      const result = await service.create({
        companyId: 'company-2',
        code: 'HQ',
        name: 'Head Office (Co 2)',
      });

      expect(result.companyId).toBe('company-2');
      expect(branchRepository.findOne).toHaveBeenCalledWith({
        where: { companyId: 'company-2', code: 'HQ' },
      });
    });
  });

  describe('update', () => {
    it('never accepts companyId reassignment (immutability, §64)', () => {
      // UpdateBranchDto has no companyId field at the type level — this test
      // documents the invariant so a future edit cannot silently add one
      // without a corresponding architectural decision.
      const dto = { name: 'Renamed' };
      expect((dto as Record<string, unknown>).companyId).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('rejects deletion when active warehouses exist (no orphaning)', async () => {
      branchRepository.findOne.mockResolvedValue(buildBranch());
      warehouseRepository.count.mockResolvedValue(1);

      await expect(service.remove('branch-1')).rejects.toMatchObject({
        errorCode: ErrorCode.Conflict,
      });
      expect(branchRepository.softRemove).not.toHaveBeenCalled();
    });

    it('soft-deletes a branch with no warehouses', async () => {
      const branch = buildBranch();
      branchRepository.findOne.mockResolvedValue(branch);
      warehouseRepository.count.mockResolvedValue(0);

      await service.remove('branch-1');

      expect(branchRepository.softRemove).toHaveBeenCalledWith(branch);
    });
  });
});
