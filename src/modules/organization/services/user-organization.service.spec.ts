import { DataSource, EntityManager, Repository } from 'typeorm';
import { UserOrganizationService } from './user-organization.service';
import { UserCompany } from '../entities/user-company.entity';
import { UserBranch } from '../entities/user-branch.entity';
import { UserWarehouse } from '../entities/user-warehouse.entity';
import { MembershipStatus } from '../entities/membership-status.enum';
import { CompaniesService } from './companies.service';
import { BranchesService } from './branches.service';
import { WarehousesService } from './warehouses.service';
import { Company } from '../entities/company.entity';
import { CompanyStatus } from '../entities/company-status.enum';
import { Branch } from '../entities/branch.entity';
import { BranchStatus } from '../entities/branch-status.enum';
import { Warehouse } from '../entities/warehouse.entity';
import { WarehouseStatus } from '../entities/warehouse-status.enum';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('UserOrganizationService', () => {
  let service: UserOrganizationService;
  let userCompanyRepository: jest.Mocked<
    Pick<
      Repository<UserCompany>,
      'find' | 'findOne' | 'create' | 'save' | 'softRemove'
    >
  >;
  let userBranchRepository: jest.Mocked<
    Pick<
      Repository<UserBranch>,
      'find' | 'findOne' | 'create' | 'save' | 'softRemove'
    >
  >;
  let userWarehouseRepository: jest.Mocked<
    Pick<
      Repository<UserWarehouse>,
      'find' | 'findOne' | 'create' | 'save' | 'softRemove'
    >
  >;
  let companiesService: jest.Mocked<
    Pick<CompaniesService, 'findActiveByIdOrNull'>
  >;
  let branchesService: jest.Mocked<
    Pick<BranchesService, 'findActiveByIdOrNull'>
  >;
  let warehousesService: jest.Mocked<Pick<WarehousesService, 'findById'>>;
  let transactionService: TransactionService;
  let managerFindOne: jest.Mock;
  let managerCreate: jest.Mock;
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

  const buildWarehouse = (overrides: Partial<Warehouse> = {}): Warehouse =>
    ({
      id: 'warehouse-a1',
      companyId: 'company-a',
      branchId: 'branch-a1',
      status: WarehouseStatus.Active,
      ...overrides,
    }) as Warehouse;

  beforeEach(() => {
    userCompanyRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
    };
    userBranchRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
    };
    userWarehouseRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
    };
    companiesService = { findActiveByIdOrNull: jest.fn() };
    branchesService = { findActiveByIdOrNull: jest.fn() };
    warehousesService = { findById: jest.fn() };

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

    service = new UserOrganizationService(
      userCompanyRepository as unknown as Repository<UserCompany>,
      userBranchRepository as unknown as Repository<UserBranch>,
      userWarehouseRepository as unknown as Repository<UserWarehouse>,
      companiesService as unknown as CompaniesService,
      branchesService as unknown as BranchesService,
      warehousesService as unknown as WarehousesService,
      transactionService,
    );
  });

  describe('assignCompany', () => {
    it('assigns when the company is active and no existing membership', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      userCompanyRepository.findOne.mockResolvedValue(null);
      const created = {
        userId: 'user-1',
        companyId: 'company-a',
      } as UserCompany;
      userCompanyRepository.create.mockReturnValue(created);
      userCompanyRepository.save.mockResolvedValue(created);

      const result = await service.assignCompany('user-1', 'company-a');

      expect(result).toBe(created);
    });

    it('rejects when companyId does not reference an active company', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(null);

      await expect(
        service.assignCompany('user-1', 'missing'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a duplicate membership (409)', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      userCompanyRepository.findOne.mockResolvedValue({} as UserCompany);

      await expect(
        service.assignCompany('user-1', 'company-a'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });
  });

  describe('assignBranch — company-before-branch rule (LOCKED §4)', () => {
    it("assigns when the user already has active company membership for the branch's company", async () => {
      branchesService.findActiveByIdOrNull.mockResolvedValue(buildBranch());
      managerFindOne
        .mockResolvedValueOnce({ status: MembershipStatus.Active }) // company membership check
        .mockResolvedValueOnce(null); // no existing branch membership

      const result = await service.assignBranch('user-1', 'branch-a1');

      expect(result).toMatchObject({ userId: 'user-1', branchId: 'branch-a1' });
    });

    it("REJECTS branch assignment when the user has no active membership in the branch's company", async () => {
      branchesService.findActiveByIdOrNull.mockResolvedValue(buildBranch());
      managerFindOne.mockResolvedValueOnce(null); // no company membership

      await expect(
        service.assignBranch('user-1', 'branch-a1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects when branchId does not reference an active branch', async () => {
      branchesService.findActiveByIdOrNull.mockResolvedValue(null);

      await expect(
        service.assignBranch('user-1', 'missing'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a duplicate branch membership (409)', async () => {
      branchesService.findActiveByIdOrNull.mockResolvedValue(buildBranch());
      managerFindOne
        .mockResolvedValueOnce({ status: MembershipStatus.Active })
        .mockResolvedValueOnce({}); // existing branch membership

      await expect(
        service.assignBranch('user-1', 'branch-a1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });
  });

  describe('assignWarehouse — warehouse hierarchy integrity (LOCKED §5)', () => {
    it("assigns when the user has active branch membership for the warehouse's branch", async () => {
      warehousesService.findById.mockResolvedValue(buildWarehouse());
      managerFindOne
        .mockResolvedValueOnce({ status: MembershipStatus.Active }) // branch membership check
        .mockResolvedValueOnce(null); // no existing warehouse membership

      const result = await service.assignWarehouse('user-1', 'warehouse-a1');

      expect(result).toMatchObject({
        userId: 'user-1',
        warehouseId: 'warehouse-a1',
      });
    });

    it('REJECTS Company A + Branch A + Warehouse belonging to Branch B (spoofed hierarchy)', async () => {
      // Warehouse's real branchId is branch-b1 (belongs to a different branch
      // than the one the user has membership in) — the service must resolve
      // the warehouse's REAL branch from the database, never trust a client
      // assumption that warehouse-a1 belongs to branch-a1.
      warehousesService.findById.mockResolvedValue(
        buildWarehouse({ branchId: 'branch-b1' }),
      );
      managerFindOne.mockResolvedValueOnce(null); // no membership in branch-b1

      await expect(
        service.assignWarehouse('user-1', 'warehouse-a1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a duplicate warehouse membership (409)', async () => {
      warehousesService.findById.mockResolvedValue(buildWarehouse());
      managerFindOne
        .mockResolvedValueOnce({ status: MembershipStatus.Active })
        .mockResolvedValueOnce({});

      await expect(
        service.assignWarehouse('user-1', 'warehouse-a1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });
  });

  describe('removal', () => {
    it('removeCompanyMembership soft-removes an existing row', async () => {
      const membership = {} as UserCompany;
      userCompanyRepository.findOne.mockResolvedValue(membership);

      await service.removeCompanyMembership('user-1', 'company-a');

      expect(userCompanyRepository.softRemove).toHaveBeenCalledWith(membership);
    });

    it('removeCompanyMembership throws NotFound when no membership exists', async () => {
      userCompanyRepository.findOne.mockResolvedValue(null);

      await expect(
        service.removeCompanyMembership('user-1', 'company-a'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });
});
