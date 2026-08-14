import { Repository } from 'typeorm';
import { DataScopeService } from './data-scope.service';
import { UserRole } from '../entities/user-role.entity';
import { Role } from '../entities/role.entity';
import { RoleResourceScope } from '../entities/role-resource-scope.entity';
import { DataScope } from '../enums/data-scope.enum';
import { UserCompany } from '../../organization/entities/user-company.entity';
import { UserBranch } from '../../organization/entities/user-branch.entity';
import { UserWarehouse } from '../../organization/entities/user-warehouse.entity';
import { MembershipStatus } from '../../organization/entities/membership-status.enum';

describe('DataScopeService', () => {
  let service: DataScopeService;
  let userRoleRepository: jest.Mocked<Pick<Repository<UserRole>, 'find'>>;
  let userCompanyRepository: jest.Mocked<Pick<Repository<UserCompany>, 'find'>>;
  let userBranchRepository: jest.Mocked<Pick<Repository<UserBranch>, 'find'>>;
  let userWarehouseRepository: jest.Mocked<
    Pick<Repository<UserWarehouse>, 'find'>
  >;

  const buildScope = (
    resource: string,
    scope: DataScope,
    scopeValue: string | null = null,
  ): RoleResourceScope =>
    ({ resource, scope, scopeValue }) as RoleResourceScope;

  const buildUserRole = (scopes: RoleResourceScope[]): UserRole =>
    ({ role: { resourceScopes: scopes } as Role }) as UserRole;

  beforeEach(() => {
    userRoleRepository = { find: jest.fn() };
    userCompanyRepository = { find: jest.fn() };
    userBranchRepository = { find: jest.fn() };
    userWarehouseRepository = { find: jest.fn() };
    service = new DataScopeService(
      userRoleRepository as unknown as Repository<UserRole>,
      userCompanyRepository as unknown as Repository<UserCompany>,
      userBranchRepository as unknown as Repository<UserBranch>,
      userWarehouseRepository as unknown as Repository<UserWarehouse>,
    );
  });

  it('returns null when no active role grants a scope for the resource', async () => {
    userRoleRepository.find.mockResolvedValue([
      buildUserRole([buildScope('inventory', DataScope.Warehouse)]),
    ]);

    const result = await service.resolveScope('user-1', 'sales');

    expect(result).toBeNull();
  });

  it('returns the single granted scope when only one role grants it', async () => {
    userRoleRepository.find.mockResolvedValue([
      buildUserRole([buildScope('sales', DataScope.Account)]),
    ]);

    const result = await service.resolveScope('user-1', 'sales');

    expect(result).toEqual({ scope: DataScope.Account, scopeValue: null });
  });

  it('returns the broadest scope when multiple roles grant different scopes for the same resource (union/most-permissive)', async () => {
    userRoleRepository.find.mockResolvedValue([
      buildUserRole([buildScope('sales', DataScope.Account)]),
      buildUserRole([buildScope('sales', DataScope.Branch)]),
    ]);

    const result = await service.resolveScope('user-1', 'sales');

    expect(result?.scope).toBe(DataScope.Branch);
  });

  it('never returns a narrower scope than any granted role (ALL beats everything)', async () => {
    userRoleRepository.find.mockResolvedValue([
      buildUserRole([buildScope('sales', DataScope.Own)]),
      buildUserRole([buildScope('sales', DataScope.All)]),
      buildUserRole([buildScope('sales', DataScope.Branch)]),
    ]);

    const result = await service.resolveScope('user-1', 'sales');

    expect(result?.scope).toBe(DataScope.All);
  });

  it('resolves scope independently per resource (resource-specific, not global)', async () => {
    userRoleRepository.find.mockResolvedValue([
      buildUserRole([
        buildScope('sales', DataScope.Account),
        buildScope('inventory', DataScope.Warehouse),
      ]),
    ]);

    const salesScope = await service.resolveScope('user-1', 'sales');
    const inventoryScope = await service.resolveScope('user-1', 'inventory');

    expect(salesScope?.scope).toBe(DataScope.Account);
    expect(inventoryScope?.scope).toBe(DataScope.Warehouse);
  });

  it('preserves scopeValue from the winning (broadest) scope row', async () => {
    userRoleRepository.find.mockResolvedValue([
      buildUserRole([buildScope('sales', DataScope.Account, 'account-123')]),
      buildUserRole([buildScope('sales', DataScope.Branch, 'branch-456')]),
    ]);

    const result = await service.resolveScope('user-1', 'sales');

    expect(result).toEqual({
      scope: DataScope.Branch,
      scopeValue: 'branch-456',
    });
  });

  describe('resolveAllowedOrganizationIds', () => {
    it('returns null for ALL scope (short-circuit, no membership query)', async () => {
      const result = await service.resolveAllowedOrganizationIds('user-1', {
        scope: DataScope.All,
        scopeValue: null,
      });

      expect(result).toBeNull();
      expect(userCompanyRepository.find).not.toHaveBeenCalled();
      expect(userBranchRepository.find).not.toHaveBeenCalled();
      expect(userWarehouseRepository.find).not.toHaveBeenCalled();
    });

    it("resolves COMPANY scope to the user's active company membership IDs", async () => {
      userCompanyRepository.find.mockResolvedValue([
        { companyId: 'company-a' } as UserCompany,
        { companyId: 'company-b' } as UserCompany,
      ]);

      const result = await service.resolveAllowedOrganizationIds('user-1', {
        scope: DataScope.Company,
        scopeValue: null,
      });

      expect(result).toEqual(['company-a', 'company-b']);
      expect(userCompanyRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: MembershipStatus.Active },
      });
    });

    it("resolves BRANCH scope to the user's active branch membership IDs", async () => {
      userBranchRepository.find.mockResolvedValue([
        { branchId: 'branch-a1' } as UserBranch,
      ]);

      const result = await service.resolveAllowedOrganizationIds('user-1', {
        scope: DataScope.Branch,
        scopeValue: null,
      });

      expect(result).toEqual(['branch-a1']);
    });

    it("resolves WAREHOUSE scope to the user's active warehouse membership IDs", async () => {
      userWarehouseRepository.find.mockResolvedValue([
        { warehouseId: 'warehouse-a1' } as UserWarehouse,
      ]);

      const result = await service.resolveAllowedOrganizationIds('user-1', {
        scope: DataScope.Warehouse,
        scopeValue: null,
      });

      expect(result).toEqual(['warehouse-a1']);
    });

    it('returns an empty array (safe default) for scope kinds it does not resolve', async () => {
      const result = await service.resolveAllowedOrganizationIds('user-1', {
        scope: DataScope.Own,
        scopeValue: null,
      });

      expect(result).toEqual([]);
    });

    it('only queries active memberships — inactive rows never appear in the result', async () => {
      userCompanyRepository.find.mockResolvedValue([]);

      const result = await service.resolveAllowedOrganizationIds('user-1', {
        scope: DataScope.Company,
        scopeValue: null,
      });

      expect(result).toEqual([]);
    });
  });

  describe('resolveAllowedCompanyIds', () => {
    it('returns null for ALL scope', async () => {
      const result = await service.resolveAllowedCompanyIds('user-1', {
        scope: DataScope.All,
        scopeValue: null,
      });

      expect(result).toBeNull();
    });

    it('returns active company membership ids for COMPANY scope', async () => {
      userCompanyRepository.find.mockResolvedValue([
        { companyId: 'company-a' } as UserCompany,
        { companyId: 'company-b' } as UserCompany,
      ]);

      const result = await service.resolveAllowedCompanyIds('user-1', {
        scope: DataScope.Company,
        scopeValue: null,
      });

      expect(result).toEqual(['company-a', 'company-b']);
    });

    it('normalizes BRANCH memberships back to unique company ids', async () => {
      userBranchRepository.find.mockResolvedValue([
        { branch: { companyId: 'company-a' } } as UserBranch,
        { branch: { companyId: 'company-a' } } as UserBranch,
        { branch: { companyId: 'company-b' } } as UserBranch,
      ]);

      const result = await service.resolveAllowedCompanyIds('user-1', {
        scope: DataScope.Branch,
        scopeValue: null,
      });

      expect(result).toEqual(['company-a', 'company-b']);
      expect(userBranchRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: MembershipStatus.Active },
        relations: { branch: true },
      });
    });

    it('normalizes WAREHOUSE memberships back to unique company ids', async () => {
      userWarehouseRepository.find.mockResolvedValue([
        { warehouse: { companyId: 'company-a' } } as UserWarehouse,
        { warehouse: { companyId: 'company-a' } } as UserWarehouse,
      ]);

      const result = await service.resolveAllowedCompanyIds('user-1', {
        scope: DataScope.Warehouse,
        scopeValue: null,
      });

      expect(result).toEqual(['company-a']);
      expect(userWarehouseRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: MembershipStatus.Active },
        relations: { warehouse: true },
      });
    });
  });

  describe('resolveAllowedBranchIds', () => {
    it('returns null for ALL and COMPANY scopes', async () => {
      await expect(
        service.resolveAllowedBranchIds('user-1', {
          scope: DataScope.All,
          scopeValue: null,
        }),
      ).resolves.toBeNull();

      await expect(
        service.resolveAllowedBranchIds('user-1', {
          scope: DataScope.Company,
          scopeValue: null,
        }),
      ).resolves.toBeNull();
    });

    it('returns active branch membership ids for BRANCH scope', async () => {
      userBranchRepository.find.mockResolvedValue([
        { branchId: 'branch-a' } as UserBranch,
        { branchId: 'branch-b' } as UserBranch,
      ]);

      const result = await service.resolveAllowedBranchIds('user-1', {
        scope: DataScope.Branch,
        scopeValue: null,
      });

      expect(result).toEqual(['branch-a', 'branch-b']);
    });

    it('returns an empty array for WAREHOUSE scope', async () => {
      const result = await service.resolveAllowedBranchIds('user-1', {
        scope: DataScope.Warehouse,
        scopeValue: null,
      });

      expect(result).toEqual([]);
    });
  });
});
