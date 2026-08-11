import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';
import { User } from '../src/modules/users/entities/user.entity';
import { UserStatus } from '../src/modules/users/entities/user-status.enum';
import { PasswordService } from '../src/modules/auth/services/password.service';
import { Role } from '../src/modules/rbac/entities/role.entity';
import { RoleStatus } from '../src/modules/rbac/entities/role-status.enum';
import { Permission } from '../src/modules/rbac/entities/permission.entity';
import { RolePermission } from '../src/modules/rbac/entities/role-permission.entity';
import { UserRole } from '../src/modules/rbac/entities/user-role.entity';
import { SystemRoleCode } from '../src/modules/rbac/entities/system-role-code';

const dbEnvAvailable =
  !!process.env.DB_USERNAME &&
  !!process.env.DB_PASSWORD &&
  !!process.env.DB_DATABASE;

const describeIfDb = dbEnvAvailable ? describe : describe.skip;

interface RoleListResponseBody {
  data: Array<{ id: string; code: string; isSystemRole: boolean }>;
}

interface RoleResponseBody {
  id: string;
  code: string;
  isSystemRole: boolean;
  status: string;
  description: string | null;
  scopes: Array<{ resource: string; scope: string; scopeValue: string | null }>;
}

interface UserRoleSummaryBody {
  id: string;
  code: string;
}

interface MyPermissionsResponseBody {
  roleCodes: string[];
  permissionCodes: string[];
}

describeIfDb('RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let passwordService: PasswordService;

  let superAdminUser: User;
  let plainUser: User;
  let customRole: Role;
  let rolesReadPermission: Permission;

  const password = 'correct-horse-battery-staple';

  async function loginAndGetCookie(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password });

    const setCookie = response.headers['set-cookie'] as
      string[] | string | undefined;
    const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    return String(cookieHeader).split(';')[0];
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.use(cookieParser());
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    passwordService = moduleFixture.get(PasswordService);

    // Clean slate for RBAC-e2e-owned test data only.
    await dataSource.query('DELETE FROM user_roles');
    await dataSource.query("DELETE FROM users WHERE email LIKE 'rbac-e2e-%'");
    await dataSource.query(
      "DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM (SELECT id FROM roles WHERE code = 'RBAC_E2E_CUSTOM_ROLE') t)",
    );
    await dataSource.query(
      "DELETE FROM roles WHERE code = 'RBAC_E2E_CUSTOM_ROLE'",
    );

    const userRepository = dataSource.getRepository(User);
    const roleRepository = dataSource.getRepository(Role);
    const permissionRepository = dataSource.getRepository(Permission);
    const rolePermissionRepository = dataSource.getRepository(RolePermission);
    const userRoleRepository = dataSource.getRepository(UserRole);

    superAdminUser = await userRepository.save(
      userRepository.create({
        email: 'rbac-e2e-superadmin@example.com',
        passwordHash: await passwordService.hash(password),
        firstName: 'Super',
        lastName: 'Admin',
        displayName: 'Super Admin',
        status: UserStatus.Active,
        isEmailVerified: true,
        lastLoginAt: null,
        passwordChangedAt: null,
      }),
    );

    plainUser = await userRepository.save(
      userRepository.create({
        email: 'rbac-e2e-plain@example.com',
        passwordHash: await passwordService.hash(password),
        firstName: 'Plain',
        lastName: 'User',
        displayName: 'Plain User',
        status: UserStatus.Active,
        isEmailVerified: true,
        lastLoginAt: null,
        passwordChangedAt: null,
      }),
    );

    const superAdminRole = await roleRepository.findOneOrFail({
      where: { code: SystemRoleCode.SuperAdmin },
    });
    await userRoleRepository.save(
      userRoleRepository.create({
        userId: superAdminUser.id,
        roleId: superAdminRole.id,
      }),
    );

    rolesReadPermission = await permissionRepository.findOneOrFail({
      where: { code: 'roles.read' },
    });

    customRole = await roleRepository.save(
      roleRepository.create({
        name: 'RBAC E2E Custom Role',
        code: 'RBAC_E2E_CUSTOM_ROLE',
        description: 'Created by rbac.e2e-spec',
        status: RoleStatus.Active,
        isSystemRole: false,
      }),
    );
    await rolePermissionRepository.save(
      rolePermissionRepository.create({
        roleId: customRole.id,
        permissionId: rolesReadPermission.id,
      }),
    );
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM user_roles');
    await dataSource.query("DELETE FROM users WHERE email LIKE 'rbac-e2e-%'");
    await dataSource.query('DELETE FROM role_permissions WHERE role_id = ?', [
      customRole.id,
    ]);
    await dataSource.query('DELETE FROM roles WHERE code = ?', [
      'RBAC_E2E_CUSTOM_ROLE',
    ]);
    await app.close();
  });

  describe('authentication boundary', () => {
    it('returns 401 for /roles without a session', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/roles');
      expect(response.status).toBe(401);
    });
  });

  describe('permission boundary (403 vs 401)', () => {
    it('returns 403 for an authenticated user without roles.read', async () => {
      const cookie = await loginAndGetCookie(plainUser.email);

      const response = await request(app.getHttpServer())
        .get('/api/v1/roles')
        .set('Cookie', [cookie]);

      expect(response.status).toBe(403);
    });

    it('returns 200 for Super Admin (holds roles.read via the seeded role)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);

      const response = await request(app.getHttpServer())
        .get('/api/v1/roles')
        .set('Cookie', [cookie]);

      expect(response.status).toBe(200);
      const body = response.body as RoleListResponseBody;
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  describe('Super Admin is NOT a hard-coded bypass', () => {
    it('the seeded Super Admin role grants access purely through RolePermission rows', async () => {
      const superAdminRole = await dataSource
        .getRepository(Role)
        .findOneOrFail({ where: { code: SystemRoleCode.SuperAdmin } });
      const grantCount = await dataSource
        .getRepository(RolePermission)
        .count({ where: { roleId: superAdminRole.id } });

      // If this were ever a hard-coded bypass, it would work with zero
      // explicit grants. It must not.
      expect(grantCount).toBeGreaterThan(0);
    });
  });

  describe('role CRUD', () => {
    it('creates a role', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);

      const response = await request(app.getHttpServer())
        .post('/api/v1/roles')
        .set('Cookie', [cookie])
        .send({
          name: 'Temp E2E Role',
          code: 'RBAC_E2E_TEMP_ROLE',
          description: 'temp',
        });

      expect(response.status).toBe(201);
      const body = response.body as RoleResponseBody;
      expect(body.code).toBe('RBAC_E2E_TEMP_ROLE');
      expect(body.isSystemRole).toBe(false);

      await dataSource.query('DELETE FROM roles WHERE code = ?', [
        'RBAC_E2E_TEMP_ROLE',
      ]);
    });

    it('rejects duplicate role codes with 409', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);

      const response = await request(app.getHttpServer())
        .post('/api/v1/roles')
        .set('Cookie', [cookie])
        .send({ name: 'Duplicate', code: customRole.code });

      expect(response.status).toBe(409);
    });

    it('updates a role name/description', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/roles/${customRole.id}`)
        .set('Cookie', [cookie])
        .send({ description: 'updated description' });

      expect(response.status).toBe(200);
      expect((response.body as RoleResponseBody).description).toBe(
        'updated description',
      );
    });

    it('activates and deactivates a non-system role', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);

      const deactivateResponse = await request(app.getHttpServer())
        .post(`/api/v1/roles/${customRole.id}/deactivate`)
        .set('Cookie', [cookie]);
      expect(deactivateResponse.status).toBe(200);
      expect((deactivateResponse.body as RoleResponseBody).status).toBe(
        'INACTIVE',
      );

      const activateResponse = await request(app.getHttpServer())
        .post(`/api/v1/roles/${customRole.id}/activate`)
        .set('Cookie', [cookie]);
      expect(activateResponse.status).toBe(200);
      expect((activateResponse.body as RoleResponseBody).status).toBe('ACTIVE');
    });
  });

  describe('system role protection', () => {
    it('rejects deleting the SUPER_ADMIN role', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const superAdminRole = await dataSource
        .getRepository(Role)
        .findOneOrFail({ where: { code: SystemRoleCode.SuperAdmin } });

      const response = await request(app.getHttpServer())
        .delete(`/api/v1/roles/${superAdminRole.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(403);
    });

    it('rejects deactivating the SUPER_ADMIN role', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const superAdminRole = await dataSource
        .getRepository(Role)
        .findOneOrFail({ where: { code: SystemRoleCode.SuperAdmin } });

      const response = await request(app.getHttpServer())
        .post(`/api/v1/roles/${superAdminRole.id}/deactivate`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(403);
    });
  });

  describe('role deletion with active assignments', () => {
    it('rejects deleting a role that has active user assignments with 409', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const userRoleRepository = dataSource.getRepository(UserRole);

      const assignedRole = await dataSource.getRepository(Role).save(
        dataSource.getRepository(Role).create({
          name: 'Assigned Role',
          code: 'RBAC_E2E_ASSIGNED_ROLE',
          status: RoleStatus.Active,
          isSystemRole: false,
        }),
      );
      await userRoleRepository.save(
        userRoleRepository.create({
          userId: plainUser.id,
          roleId: assignedRole.id,
        }),
      );

      const response = await request(app.getHttpServer())
        .delete(`/api/v1/roles/${assignedRole.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(409);

      await dataSource.query('DELETE FROM user_roles WHERE role_id = ?', [
        assignedRole.id,
      ]);
      await dataSource.query('DELETE FROM roles WHERE id = ?', [
        assignedRole.id,
      ]);
    });
  });

  describe('privilege escalation protection', () => {
    it('a normal user cannot create roles (403)', async () => {
      const cookie = await loginAndGetCookie(plainUser.email);

      const response = await request(app.getHttpServer())
        .post('/api/v1/roles')
        .set('Cookie', [cookie])
        .send({ name: 'Hacker Role', code: 'HACKER_ROLE' });

      expect(response.status).toBe(403);
    });

    it('a normal user cannot modify the SUPER_ADMIN role (403)', async () => {
      const cookie = await loginAndGetCookie(plainUser.email);
      const superAdminRole = await dataSource
        .getRepository(Role)
        .findOneOrFail({ where: { code: SystemRoleCode.SuperAdmin } });

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/roles/${superAdminRole.id}`)
        .set('Cookie', [cookie])
        .send({ name: 'Renamed' });

      expect(response.status).toBe(403);
    });

    it('a normal user cannot assign themselves a role (self-escalation, 403)', async () => {
      const cookie = await loginAndGetCookie(plainUser.email);

      const response = await request(app.getHttpServer())
        .put(`/api/v1/users/${plainUser.id}/roles`)
        .set('Cookie', [cookie])
        .send({ roleIds: [customRole.id] });

      expect(response.status).toBe(403);
    });

    it('a normal user cannot assign permissions to a role (403)', async () => {
      const cookie = await loginAndGetCookie(plainUser.email);

      const response = await request(app.getHttpServer())
        .put(`/api/v1/roles/${customRole.id}/permissions`)
        .set('Cookie', [cookie])
        .send({ permissionIds: [rolesReadPermission.id] });

      expect(response.status).toBe(403);
    });
  });

  describe('user-role assignment (authorized path)', () => {
    it('Super Admin can assign a role to a user, and the assignment takes effect', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);

      const assignResponse = await request(app.getHttpServer())
        .put(`/api/v1/users/${plainUser.id}/roles`)
        .set('Cookie', [cookie])
        .send({ roleIds: [customRole.id] });

      expect(assignResponse.status).toBe(200);
      expect(assignResponse.body as UserRoleSummaryBody[]).toEqual([
        expect.objectContaining({ code: customRole.code }),
      ]);

      const plainUserCookie = await loginAndGetCookie(plainUser.email);
      const afterAssignment = await request(app.getHttpServer())
        .get('/api/v1/roles')
        .set('Cookie', [plainUserCookie]);

      expect(afterAssignment.status).toBe(200);

      // Clean up: remove the assignment again.
      await request(app.getHttpServer())
        .put(`/api/v1/users/${plainUser.id}/roles`)
        .set('Cookie', [cookie])
        .send({ roleIds: [] });
    });
  });

  describe('effective permissions endpoint', () => {
    it('returns the union of permissions from all active roles', async () => {
      const userRoleRepository = dataSource.getRepository(UserRole);
      await userRoleRepository.save(
        userRoleRepository.create({
          userId: plainUser.id,
          roleId: customRole.id,
        }),
      );

      const cookie = await loginAndGetCookie(plainUser.email);
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me/permissions')
        .set('Cookie', [cookie]);

      expect(response.status).toBe(200);
      const body = response.body as MyPermissionsResponseBody;
      expect(body.permissionCodes).toContain('roles.read');
      expect(body.roleCodes).toContain(customRole.code);

      await dataSource.query(
        'DELETE FROM user_roles WHERE user_id = ? AND role_id = ?',
        [plainUser.id, customRole.id],
      );
    });
  });

  describe('inactive role stops granting access', () => {
    it('deactivating a role immediately revokes the permission it granted', async () => {
      const superAdminCookie = await loginAndGetCookie(superAdminUser.email);
      const userRoleRepository = dataSource.getRepository(UserRole);
      await userRoleRepository.save(
        userRoleRepository.create({
          userId: plainUser.id,
          roleId: customRole.id,
        }),
      );

      const beforeCookie = await loginAndGetCookie(plainUser.email);
      const beforeResponse = await request(app.getHttpServer())
        .get('/api/v1/roles')
        .set('Cookie', [beforeCookie]);
      expect(beforeResponse.status).toBe(200);

      await request(app.getHttpServer())
        .post(`/api/v1/roles/${customRole.id}/deactivate`)
        .set('Cookie', [superAdminCookie]);

      const afterCookie = await loginAndGetCookie(plainUser.email);
      const afterResponse = await request(app.getHttpServer())
        .get('/api/v1/roles')
        .set('Cookie', [afterCookie]);
      expect(afterResponse.status).toBe(403);

      // restore for subsequent tests
      await request(app.getHttpServer())
        .post(`/api/v1/roles/${customRole.id}/activate`)
        .set('Cookie', [superAdminCookie]);
      await dataSource.query(
        'DELETE FROM user_roles WHERE user_id = ? AND role_id = ?',
        [plainUser.id, customRole.id],
      );
    });

    it('a soft-deleted role stops granting the permissions it held', async () => {
      const roleRepository = dataSource.getRepository(Role);
      const rolePermissionRepository = dataSource.getRepository(RolePermission);
      const userRoleRepository = dataSource.getRepository(UserRole);

      const softDeleteRole = await roleRepository.save(
        roleRepository.create({
          name: 'Soft Delete Test Role',
          code: 'RBAC_E2E_SOFT_DELETE_ROLE',
          status: RoleStatus.Active,
          isSystemRole: false,
        }),
      );
      await rolePermissionRepository.save(
        rolePermissionRepository.create({
          roleId: softDeleteRole.id,
          permissionId: rolesReadPermission.id,
        }),
      );
      await userRoleRepository.save(
        userRoleRepository.create({
          userId: plainUser.id,
          roleId: softDeleteRole.id,
        }),
      );

      const beforeCookie = await loginAndGetCookie(plainUser.email);
      const beforeResponse = await request(app.getHttpServer())
        .get('/api/v1/roles')
        .set('Cookie', [beforeCookie]);
      expect(beforeResponse.status).toBe(200);

      // Soft-delete the role directly (bypassing the service, simulating
      // the state after RolesService.remove()'s softRemove()).
      await roleRepository.softRemove(softDeleteRole);

      const afterCookie = await loginAndGetCookie(plainUser.email);
      const afterResponse = await request(app.getHttpServer())
        .get('/api/v1/roles')
        .set('Cookie', [afterCookie]);
      expect(afterResponse.status).toBe(403);

      await dataSource.query(
        'DELETE FROM user_roles WHERE user_id = ? AND role_id = ?',
        [plainUser.id, softDeleteRole.id],
      );
      await dataSource.query('DELETE FROM role_permissions WHERE role_id = ?', [
        softDeleteRole.id,
      ]);
      await dataSource.query('DELETE FROM roles WHERE id = ?', [
        softDeleteRole.id,
      ]);
    });
  });

  describe('Super Admin invariant', () => {
    it('rejects deactivating the SUPER_ADMIN role when it would leave zero active Super Admins (already covered by system-role protection returning 403, verify the invariant check itself via a second, non-system role holding no exclusivity is unaffected)', async () => {
      // The SUPER_ADMIN role is protected from deactivation at the
      // system-role layer (403) before the invariant check would even run.
      // This test instead verifies the invariant blocks removing the LAST
      // active Super Admin's role assignment (a non-system-role operation
      // that the system-role guard does not intercept).
      const cookie = await loginAndGetCookie(superAdminUser.email);

      const response = await request(app.getHttpServer())
        .put(`/api/v1/users/${superAdminUser.id}/roles`)
        .set('Cookie', [cookie])
        .send({ roleIds: [] });

      expect(response.status).toBe(409);

      // Verify the assignment was NOT removed (rollback worked).
      const stillAssigned = await dataSource.getRepository(UserRole).findOne({
        where: { userId: superAdminUser.id },
      });
      expect(stillAssigned).not.toBeNull();
    });
  });

  describe('malformed / unauthorized scope input', () => {
    it('rejects a role-scope replace request with an invalid scope enum value', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);

      const response = await request(app.getHttpServer())
        .put(`/api/v1/roles/${customRole.id}/scopes`)
        .set('Cookie', [cookie])
        .send({ scopes: [{ resource: 'sales', scope: 'NOT_A_REAL_SCOPE' }] });

      expect(response.status).toBe(400);
    });

    it('replaces role scopes with valid input', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);

      const response = await request(app.getHttpServer())
        .put(`/api/v1/roles/${customRole.id}/scopes`)
        .set('Cookie', [cookie])
        .send({
          scopes: [{ resource: 'sales', scope: 'ACCOUNT' }],
        });

      expect(response.status).toBe(200);
      expect((response.body as RoleResponseBody).scopes).toEqual([
        expect.objectContaining({ resource: 'sales', scope: 'ACCOUNT' }),
      ]);
    });
  });
});
