import { DataSource } from 'typeorm';
import { SuperAdminInvariantService } from './super-admin-invariant.service';
import { AppException } from '../../../core/errors/app.exception';
import { buildDataSourceOptions } from '../../../database/typeorm.options';
import { User } from '../../users/entities/user.entity';
import { UserStatus } from '../../users/entities/user-status.enum';
import { Role } from '../entities/role.entity';
import { RoleStatus } from '../entities/role-status.enum';
import { UserRole } from '../entities/user-role.entity';
import { SystemRoleCode } from '../entities/system-role-code';

const dbEnvAvailable =
  !!process.env.DB_USERNAME &&
  !!process.env.DB_PASSWORD &&
  !!process.env.DB_DATABASE;

const describeIfDb = dbEnvAvailable ? describe : describe.skip;

describeIfDb('SuperAdminInvariantService (integration)', () => {
  let dataSource: DataSource;
  let service: SuperAdminInvariantService;

  beforeAll(async () => {
    dataSource = new DataSource(
      buildDataSourceOptions({
        host: process.env.DB_HOST ?? 'localhost',
        port: parseInt(process.env.DB_PORT ?? '3306', 10),
        username: process.env.DB_USERNAME!,
        password: process.env.DB_PASSWORD!,
        database: process.env.DB_DATABASE!,
        poolSize: 5,
        logging: false,
      }),
    );
    await dataSource.initialize();
    service = new SuperAdminInvariantService();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  async function createUser(status: UserStatus): Promise<User> {
    const userRepository = dataSource.getRepository(User);
    return userRepository.save(
      userRepository.create({
        email: `invariant-test-${Date.now()}-${Math.random()}@example.com`,
        passwordHash: 'irrelevant-for-this-test',
        firstName: 'Invariant',
        lastName: 'Test',
        displayName: 'Invariant Test',
        status,
        isEmailVerified: true,
        lastLoginAt: null,
        passwordChangedAt: null,
      }),
    );
  }

  async function getOrCreateSuperAdminRole(status: RoleStatus): Promise<Role> {
    const roleRepository = dataSource.getRepository(Role);
    let role = await roleRepository.findOne({
      where: { code: SystemRoleCode.SuperAdmin },
    });
    if (!role) {
      role = await roleRepository.save(
        roleRepository.create({
          name: 'Super Admin',
          code: SystemRoleCode.SuperAdmin,
          description: null,
          status,
          isSystemRole: true,
        }),
      );
    } else if (role.status !== status) {
      role.status = status;
      role = await roleRepository.save(role);
    }
    return role;
  }

  afterEach(async () => {
    await dataSource.query('DELETE FROM user_roles');
    await dataSource.query(
      "DELETE FROM users WHERE email LIKE 'invariant-test-%'",
    );
  });

  it('passes when at least one active user holds the active SUPER_ADMIN role', async () => {
    const role = await getOrCreateSuperAdminRole(RoleStatus.Active);
    const user = await createUser(UserStatus.Active);
    const userRoleRepository = dataSource.getRepository(UserRole);
    await userRoleRepository.save(
      userRoleRepository.create({ userId: user.id, roleId: role.id }),
    );

    await expect(
      dataSource.transaction((manager) =>
        service.assertAtLeastOneActiveSuperAdminRemains(manager),
      ),
    ).resolves.toBeUndefined();
  });

  it('throws when no user holds the SUPER_ADMIN role', async () => {
    await getOrCreateSuperAdminRole(RoleStatus.Active);
    await dataSource.query('DELETE FROM user_roles');

    await expect(
      dataSource.transaction((manager) =>
        service.assertAtLeastOneActiveSuperAdminRemains(manager),
      ),
    ).rejects.toThrow(AppException);
  });

  it('throws when the only Super Admin user is inactive', async () => {
    const role = await getOrCreateSuperAdminRole(RoleStatus.Active);
    const user = await createUser(UserStatus.Inactive);
    const userRoleRepository = dataSource.getRepository(UserRole);
    await userRoleRepository.save(
      userRoleRepository.create({ userId: user.id, roleId: role.id }),
    );

    await expect(
      dataSource.transaction((manager) =>
        service.assertAtLeastOneActiveSuperAdminRemains(manager),
      ),
    ).rejects.toThrow(AppException);
  });

  it('throws when the SUPER_ADMIN role itself is inactive', async () => {
    const user = await createUser(UserStatus.Active);
    const role = await getOrCreateSuperAdminRole(RoleStatus.Inactive);
    const userRoleRepository = dataSource.getRepository(UserRole);
    await userRoleRepository.save(
      userRoleRepository.create({ userId: user.id, roleId: role.id }),
    );

    await expect(
      dataSource.transaction((manager) =>
        service.assertAtLeastOneActiveSuperAdminRemains(manager),
      ),
    ).rejects.toThrow(AppException);

    // restore for subsequent tests in this file
    await getOrCreateSuperAdminRole(RoleStatus.Active);
  });

  it('passes when at least one of two Super Admins remains active', async () => {
    const role = await getOrCreateSuperAdminRole(RoleStatus.Active);
    const userA = await createUser(UserStatus.Active);
    const userB = await createUser(UserStatus.Active);
    const userRoleRepository = dataSource.getRepository(UserRole);
    await userRoleRepository.save([
      userRoleRepository.create({ userId: userA.id, roleId: role.id }),
      userRoleRepository.create({ userId: userB.id, roleId: role.id }),
    ]);

    await expect(
      dataSource.transaction((manager) =>
        service.assertAtLeastOneActiveSuperAdminRemains(manager),
      ),
    ).resolves.toBeUndefined();
  });
});
