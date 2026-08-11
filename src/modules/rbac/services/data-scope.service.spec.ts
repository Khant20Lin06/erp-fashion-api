import { Repository } from 'typeorm';
import { DataScopeService } from './data-scope.service';
import { UserRole } from '../entities/user-role.entity';
import { Role } from '../entities/role.entity';
import { RoleResourceScope } from '../entities/role-resource-scope.entity';
import { DataScope } from '../enums/data-scope.enum';

describe('DataScopeService', () => {
  let service: DataScopeService;
  let userRoleRepository: jest.Mocked<Pick<Repository<UserRole>, 'find'>>;

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
    service = new DataScopeService(
      userRoleRepository as unknown as Repository<UserRole>,
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
});
