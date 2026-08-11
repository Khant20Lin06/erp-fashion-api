import { Repository } from 'typeorm';
import { AuthorizationService } from './authorization.service';
import { UserRole } from '../entities/user-role.entity';
import { Role } from '../entities/role.entity';
import { RoleStatus } from '../entities/role-status.enum';
import { Permission } from '../entities/permission.entity';
import { RolePermission } from '../entities/role-permission.entity';

describe('AuthorizationService', () => {
  let service: AuthorizationService;
  let userRoleRepository: jest.Mocked<Pick<Repository<UserRole>, 'find'>>;

  const buildPermission = (code: string): Permission =>
    ({ id: code, code }) as Permission;

  const buildRolePermission = (code: string): RolePermission =>
    ({ permission: buildPermission(code) }) as RolePermission;

  const buildUserRole = (
    roleCode: string,
    permissionCodes: string[],
    status: RoleStatus = RoleStatus.Active,
  ): UserRole =>
    ({
      role: {
        code: roleCode,
        status,
        rolePermissions: permissionCodes.map(buildRolePermission),
      } as Role,
    }) as UserRole;

  beforeEach(() => {
    userRoleRepository = { find: jest.fn() };
    service = new AuthorizationService(
      userRoleRepository as unknown as Repository<UserRole>,
    );
  });

  describe('getEffectivePermissionCodes', () => {
    it('returns permissions from a single role', async () => {
      userRoleRepository.find.mockResolvedValue([
        buildUserRole('SALES_STAFF', ['sales.read', 'sales.create']),
      ]);

      const codes = await service.getEffectivePermissionCodes('user-1');

      expect(codes).toEqual(new Set(['sales.read', 'sales.create']));
    });

    it('unions permissions across multiple roles', async () => {
      userRoleRepository.find.mockResolvedValue([
        buildUserRole('SALES_STAFF', ['sales.read']),
        buildUserRole('INVENTORY_VIEWER', ['inventory.read']),
      ]);

      const codes = await service.getEffectivePermissionCodes('user-1');

      expect(codes).toEqual(new Set(['sales.read', 'inventory.read']));
    });

    it('deduplicates overlapping permissions across roles', async () => {
      userRoleRepository.find.mockResolvedValue([
        buildUserRole('ROLE_A', ['sales.read', 'sales.create']),
        buildUserRole('ROLE_B', ['sales.read']),
      ]);

      const codes = await service.getEffectivePermissionCodes('user-1');

      expect(codes).toEqual(new Set(['sales.read', 'sales.create']));
      expect(codes.size).toBe(2);
    });

    it('queries only active roles (repository is expected to filter by status)', async () => {
      userRoleRepository.find.mockResolvedValue([]);

      await service.getEffectivePermissionCodes('user-1');

      const callArgs = userRoleRepository.find.mock.calls[0][0] as {
        where: { userId: string; role: { status: RoleStatus } };
      };
      expect(callArgs.where.userId).toBe('user-1');
      expect(callArgs.where.role.status).toBe(RoleStatus.Active);
    });

    it('returns an empty set when the user has no roles', async () => {
      userRoleRepository.find.mockResolvedValue([]);

      const codes = await service.getEffectivePermissionCodes('user-1');

      expect(codes.size).toBe(0);
    });
  });

  describe('can / canAny / canAll', () => {
    beforeEach(() => {
      userRoleRepository.find.mockResolvedValue([
        buildUserRole('SALES_STAFF', ['sales.read', 'sales.create']),
      ]);
    });

    it('can() returns true for a granted permission', async () => {
      await expect(service.can('user-1', 'sales.read')).resolves.toBe(true);
    });

    it('can() returns false for a missing permission', async () => {
      await expect(service.can('user-1', 'sales.delete')).resolves.toBe(false);
    });

    it('canAny() returns true if at least one permission matches', async () => {
      await expect(
        service.canAny('user-1', ['sales.delete', 'sales.read']),
      ).resolves.toBe(true);
    });

    it('canAny() returns false if none match', async () => {
      await expect(
        service.canAny('user-1', ['sales.delete', 'sales.approve']),
      ).resolves.toBe(false);
    });

    it('canAll() returns true only when every permission is granted', async () => {
      await expect(
        service.canAll('user-1', ['sales.read', 'sales.create']),
      ).resolves.toBe(true);
      await expect(
        service.canAll('user-1', ['sales.read', 'sales.delete']),
      ).resolves.toBe(false);
    });
  });

  describe('getActiveRoleCodes', () => {
    it('returns the codes of the roles the repository returns', async () => {
      userRoleRepository.find.mockResolvedValue([
        buildUserRole('SALES_STAFF', []),
        buildUserRole('INVENTORY_VIEWER', []),
      ]);

      const codes = await service.getActiveRoleCodes('user-1');

      expect(codes).toEqual(new Set(['SALES_STAFF', 'INVENTORY_VIEWER']));
    });
  });
});
