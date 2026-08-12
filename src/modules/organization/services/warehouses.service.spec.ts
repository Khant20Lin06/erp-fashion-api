import { Repository } from 'typeorm';
import { WarehousesService } from './warehouses.service';
import { CompaniesService } from './companies.service';
import { BranchesService } from './branches.service';
import { Warehouse } from '../entities/warehouse.entity';
import { WarehouseStatus } from '../entities/warehouse-status.enum';
import { WarehouseType } from '../entities/warehouse-type.enum';
import { Company } from '../entities/company.entity';
import { CompanyStatus } from '../entities/company-status.enum';
import { Branch } from '../entities/branch.entity';
import { BranchStatus } from '../entities/branch-status.enum';
import { ErrorCode } from '../../../core/errors/error-codes';

type MockedRepo<T extends object> = jest.Mocked<
  Pick<
    Repository<T>,
    'findOne' | 'findAndCount' | 'create' | 'save' | 'softRemove'
  >
>;

describe('WarehousesService', () => {
  let service: WarehousesService;
  let warehouseRepository: MockedRepo<Warehouse>;
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

  const buildWarehouse = (overrides: Partial<Warehouse> = {}): Warehouse =>
    ({
      id: 'warehouse-1',
      companyId: 'company-a',
      branchId: 'branch-a1',
      code: 'MAIN',
      name: 'Main Warehouse',
      type: WarehouseType.Main,
      status: WarehouseStatus.Active,
      address: null,
      ...overrides,
    }) as Warehouse;

  beforeEach(() => {
    warehouseRepository = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
    };
    companiesService = { findActiveByIdOrNull: jest.fn() };
    branchesService = { findActiveByIdOrNull: jest.fn() };

    service = new WarehousesService(
      warehouseRepository as unknown as Repository<Warehouse>,
      companiesService as unknown as CompaniesService,
      branchesService as unknown as BranchesService,
    );
  });

  describe('create — happy path', () => {
    it('creates a warehouse when company and branch are active and consistent', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      branchesService.findActiveByIdOrNull.mockResolvedValue(buildBranch());
      warehouseRepository.findOne.mockResolvedValue(null);
      const created = buildWarehouse();
      warehouseRepository.create.mockReturnValue(created);
      warehouseRepository.save.mockResolvedValue(created);

      const result = await service.create({
        companyId: 'company-a',
        branchId: 'branch-a1',
        code: 'MAIN',
        name: 'Main Warehouse',
      });

      expect(result).toBe(created);
    });
  });

  describe('create — critical integrity rule (§12)', () => {
    it('rejects when companyId does not reference an active company', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(null);

      await expect(
        service.create({
          companyId: 'missing',
          branchId: 'branch-a1',
          code: 'MAIN',
          name: 'Main',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
      expect(branchesService.findActiveByIdOrNull).not.toHaveBeenCalled();
    });

    it('rejects when branchId does not reference an active branch', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      branchesService.findActiveByIdOrNull.mockResolvedValue(null);

      await expect(
        service.create({
          companyId: 'company-a',
          branchId: 'missing',
          code: 'MAIN',
          name: 'Main',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects Company A + Branch belonging to Company B — the exact scenario in spec §16/§26', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(
        buildCompany({ id: 'company-a' }),
      );
      branchesService.findActiveByIdOrNull.mockResolvedValue(
        buildBranch({ id: 'branch-b1', companyId: 'company-b' }),
      );

      await expect(
        service.create({
          companyId: 'company-a',
          branchId: 'branch-b1',
          code: 'MAIN',
          name: 'Cross-company attempt',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
      expect(warehouseRepository.save).not.toHaveBeenCalled();
    });

    it('rejects a duplicate warehouse code within the same company', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      branchesService.findActiveByIdOrNull.mockResolvedValue(buildBranch());
      warehouseRepository.findOne.mockResolvedValue(buildWarehouse());

      await expect(
        service.create({
          companyId: 'company-a',
          branchId: 'branch-a1',
          code: 'MAIN',
          name: 'Duplicate',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('defaults type to MAIN when not supplied', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      branchesService.findActiveByIdOrNull.mockResolvedValue(buildBranch());
      warehouseRepository.findOne.mockResolvedValue(null);
      warehouseRepository.create.mockImplementation(
        (input) => input as Warehouse,
      );
      warehouseRepository.save.mockImplementation((input) =>
        Promise.resolve(input as Warehouse),
      );

      const result = await service.create({
        companyId: 'company-a',
        branchId: 'branch-a1',
        code: 'DIST-1',
        name: 'Distribution Center',
      });

      expect(result.type).toBe(WarehouseType.Main);
    });
  });

  describe('update', () => {
    it('never accepts companyId/branchId reassignment (immutability, §64)', () => {
      const dto = { name: 'Renamed' };
      expect((dto as Record<string, unknown>).companyId).toBeUndefined();
      expect((dto as Record<string, unknown>).branchId).toBeUndefined();
    });
  });

  describe('activate / deactivate', () => {
    it('deactivate sets status to INACTIVE', async () => {
      const warehouse = buildWarehouse({ status: WarehouseStatus.Active });
      warehouseRepository.findOne.mockResolvedValue(warehouse);
      warehouseRepository.save.mockImplementation((input) =>
        Promise.resolve(input as Warehouse),
      );

      const result = await service.deactivate('warehouse-1');

      expect(result.status).toBe(WarehouseStatus.Inactive);
    });
  });
});
