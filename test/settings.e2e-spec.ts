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
import Redis from 'ioredis';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';
import { User } from '../src/modules/users/entities/user.entity';
import { UserStatus } from '../src/modules/users/entities/user-status.enum';
import { PasswordService } from '../src/modules/auth/services/password.service';
import { Role } from '../src/modules/rbac/entities/role.entity';
import { UserRole } from '../src/modules/rbac/entities/user-role.entity';
import { RoleStatus } from '../src/modules/rbac/entities/role-status.enum';
import { RoleResourceScope } from '../src/modules/rbac/entities/role-resource-scope.entity';
import { RolePermission } from '../src/modules/rbac/entities/role-permission.entity';
import { Permission } from '../src/modules/rbac/entities/permission.entity';
import { SystemRoleCode } from '../src/modules/rbac/entities/system-role-code';
import { DataScope } from '../src/modules/rbac/enums/data-scope.enum';
import { UserCompany } from '../src/modules/organization/entities/user-company.entity';
import { MembershipStatus } from '../src/modules/organization/entities/membership-status.enum';
import { REDIS_CLIENT } from '../src/modules/redis/redis-client.provider';

/**
 * Release-gate closure task, item 4 (Settings live verification, Phase 31).
 *
 * src/modules/settings/ has zero e2e coverage before this file. Verifies,
 * against the real running app + real MySQL + real Redis:
 *   - /settings/system, /settings/company/:id, /settings/branch/:id, /settings/me
 *   - scope authorization (system requires ALL scope; company/branch/user
 *     scoped access is validated against real membership, never trusted
 *     from the client)
 *   - setting definition allowlist + value-type validation
 *   - precedence: user > branch > company > system > default
 *   - cache hit / miss / invalidation-on-write (real Redis, not a mock)
 *   - Redis-unavailable fail-open behavior (settings reads must not 5xx
 *     when Redis is down — CacheService's own documented contract)
 *   - cross-company / cross-branch / cross-user isolation
 */
const dbEnvAvailable =
  !!process.env.DB_USERNAME &&
  !!process.env.DB_PASSWORD &&
  !!process.env.DB_DATABASE;

const describeIfDb = dbEnvAvailable ? describe : describe.skip;

interface IdBody {
  id: string;
}
interface SettingRow {
  key: string;
  category: string;
  dataType: string;
  value: unknown;
  sourceScope: string;
  sourceScopeId: string | null;
}
interface SettingsListBody {
  data: SettingRow[];
}

const SETTINGS_RESOURCES = [
  'settings_system',
  'settings_company',
  'settings_branch',
  'settings_user',
] as const;

const DASHBOARD_RANGE_KEY = 'reports.dashboard.default_range_days';
const LOCALE_KEY = 'user.preferences.locale';
const NOTIF_ENABLED_KEY = 'notifications.in_app.enabled';

describeIfDb('Settings — live verification (Phase 31) (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let passwordService: PasswordService;
  let redis: Redis;

  const password = 'correct-horse-battery-staple';
  const authCookieByEmail = new Map<string, string>();
  const prefix = 'SET-E2E';

  let superAdminUser: User;
  let companyA: IdBody;
  let branchA1: IdBody;
  let companyB: IdBody;

  let companyAdminA: User;
  let companyAdminB: User;
  let plainUser: User; // authenticated, but zero settings_* scope at all

  function rand(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  }
  function uniqueCode(tag: string): string {
    return `${prefix}-${tag}-${rand()}`;
  }

  async function loginAndGetCookie(email: string): Promise<string> {
    const cached = authCookieByEmail.get(email);
    if (cached) return cached;
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password });
    const setCookie = response.headers['set-cookie'] as
      string[] | string | undefined;
    const cookieSource = Array.isArray(setCookie)
      ? setCookie.join('; ')
      : String(setCookie);
    const match = cookieSource.match(/fashion_erp_access_token=([^;]+)/);
    const cookie = match ? `fashion_erp_access_token=${match[1]}` : '';
    if (cookie) authCookieByEmail.set(email, cookie);
    return cookie;
  }

  async function createUser(email: string): Promise<User> {
    const userRepository = dataSource.getRepository(User);
    return userRepository.save(
      userRepository.create({
        email,
        passwordHash: await passwordService.hash(password),
        firstName: 'Settings',
        lastName: 'E2E',
        displayName: 'Settings E2E User',
        status: UserStatus.Active,
        isEmailVerified: true,
        lastLoginAt: null,
        passwordChangedAt: null,
      }),
    );
  }

  async function createScopedRole(
    name: string,
    scope: DataScope,
    resources: readonly string[] = SETTINGS_RESOURCES,
  ): Promise<Role> {
    const roleRepository = dataSource.getRepository(Role);
    const permissionRepository = dataSource.getRepository(Permission);
    const rolePermissionRepository = dataSource.getRepository(RolePermission);
    const roleResourceScopeRepository =
      dataSource.getRepository(RoleResourceScope);

    const role = await roleRepository.save(
      roleRepository.create({
        code: `${prefix}-${name}-${rand()}`
          .toUpperCase()
          .replace(/[^A-Z0-9_-]/g, '_'),
        name: `${prefix} ${name}`,
        description: `Settings e2e scoped role (${scope})`,
        status: RoleStatus.Active,
        isSystemRole: false,
      }),
    );

    const permissions = await permissionRepository.find({
      where: resources.map((resource) => ({ resource })),
    });
    await rolePermissionRepository.save(
      permissions.map((permission) =>
        rolePermissionRepository.create({
          roleId: role.id,
          permissionId: permission.id,
        }),
      ),
    );
    await roleResourceScopeRepository.save(
      resources.map((resource) =>
        roleResourceScopeRepository.create({
          roleId: role.id,
          resource,
          scope,
          scopeValue: null,
        }),
      ),
    );
    return role;
  }

  async function assignRole(userId: string, roleId: string): Promise<void> {
    const userRoleRepository = dataSource.getRepository(UserRole);
    await userRoleRepository.save(
      userRoleRepository.create({ userId, roleId }),
    );
  }

  async function addCompanyMembership(userId: string, companyId: string) {
    const repo = dataSource.getRepository(UserCompany);
    await repo.save(
      repo.create({ userId, companyId, status: MembershipStatus.Active }),
    );
  }
  function findSetting(
    body: SettingsListBody,
    key: string,
  ): SettingRow | undefined {
    return body.data.find((s) => s.key === key);
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
    redis = moduleFixture.get(REDIS_CLIENT);

    const roleRepository = dataSource.getRepository(Role);
    const userRoleRepository = dataSource.getRepository(UserRole);

    superAdminUser = await createUser(
      `set-e2e-superadmin-${rand()}@example.com`,
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

    const superCookie = await loginAndGetCookie(superAdminUser.email);

    const companyARes = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Cookie', [superCookie])
      .send({
        code: uniqueCode('CO-A'),
        name: 'Settings E2E Company A',
        baseCurrency: 'USD',
        timezone: 'Asia/Yangon',
      });
    companyA = companyARes.body as IdBody;

    const branchA1Res = await request(app.getHttpServer())
      .post('/api/v1/branches')
      .set('Cookie', [superCookie])
      .send({
        companyId: companyA.id,
        code: uniqueCode('BR-A1'),
        name: 'Branch A1',
      });
    branchA1 = branchA1Res.body as IdBody;

    const companyBRes = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Cookie', [superCookie])
      .send({
        code: uniqueCode('CO-B'),
        name: 'Settings E2E Company B',
        baseCurrency: 'USD',
        timezone: 'Asia/Yangon',
      });
    companyB = companyBRes.body as IdBody;

    companyAdminA = await createUser(
      `set-e2e-companyadmin-a-${rand()}@example.com`,
    );
    const companyRoleA = await createScopedRole(
      'COMPANY_ADMIN_A',
      DataScope.Company,
    );
    await assignRole(companyAdminA.id, companyRoleA.id);
    await addCompanyMembership(companyAdminA.id, companyA.id);

    companyAdminB = await createUser(
      `set-e2e-companyadmin-b-${rand()}@example.com`,
    );
    const companyRoleB = await createScopedRole(
      'COMPANY_ADMIN_B',
      DataScope.Company,
    );
    await assignRole(companyAdminB.id, companyRoleB.id);
    await addCompanyMembership(companyAdminB.id, companyB.id);

    // A user granted only settings_user (OWN-shaped, via assertUserScope's
    // "any resolved scope at all" check) but explicitly NOT settings_system
    // / settings_company / settings_branch — proves system scope enforces
    // ALL specifically, not merely "some scope."
    plainUser = await createUser(`set-e2e-plain-${rand()}@example.com`);
    const userOnlyRole = await createScopedRole('USER_ONLY', DataScope.Own, [
      'settings_user',
    ]);
    await assignRole(plainUser.id, userOnlyRole.id);
  }, 60000);

  afterAll(async () => {
    const emails = [
      superAdminUser?.email,
      companyAdminA?.email,
      companyAdminB?.email,
      plainUser?.email,
    ].filter((e): e is string => !!e);

    if (dataSource?.isInitialized) {
      await dataSource.query(
        `DELETE FROM setting_values WHERE scope_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t) OR scope_id IN (SELECT id FROM (SELECT id FROM branches WHERE code LIKE '${prefix}%') t)`,
      );
      if (emails.length > 0) {
        const placeholders = emails.map(() => '?').join(',');
        await dataSource.query(
          `DELETE FROM setting_values WHERE scope_id IN (SELECT id FROM (SELECT id FROM users WHERE email IN (${placeholders})) t)`,
          emails,
        );
      }
      await dataSource.query(
        `DELETE FROM branches WHERE code LIKE '${prefix}%'`,
      );
      await dataSource.query(
        `DELETE FROM companies WHERE code LIKE '${prefix}%'`,
      );
      if (emails.length > 0) {
        const placeholders = emails.map(() => '?').join(',');
        await dataSource.query(
          `DELETE FROM user_branches WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email IN (${placeholders})) t)`,
          emails,
        );
        await dataSource.query(
          `DELETE FROM user_companies WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email IN (${placeholders})) t)`,
          emails,
        );
        await dataSource.query(
          `DELETE FROM user_roles WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email IN (${placeholders})) t)`,
          emails,
        );
        await dataSource.query(
          `DELETE FROM users WHERE email IN (${placeholders})`,
          emails,
        );
      }
      await dataSource.query(
        `DELETE FROM role_resource_scopes WHERE role_id IN (SELECT id FROM (SELECT id FROM roles WHERE code LIKE '${prefix}%') t)`,
      );
      await dataSource.query(
        `DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM (SELECT id FROM roles WHERE code LIKE '${prefix}%') t)`,
      );
      await dataSource.query(`DELETE FROM roles WHERE code LIKE '${prefix}%'`);
    }
    await app.close();
  });

  describe('Scope authorization', () => {
    it('unauthenticated request to /settings/system is rejected (401)', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/v1/settings/system',
      );
      expect(res.status).toBe(401);
    });

    it('SUPER_ADMIN (ALL scope) can read /settings/system', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const res = await request(app.getHttpServer())
        .get('/api/v1/settings/system')
        .set('Cookie', [cookie]);
      expect(res.status).toBe(200);
      expect(Array.isArray((res.body as SettingsListBody).data)).toBe(true);
    });

    it('a COMPANY-scoped user (not ALL) is rejected from /settings/system even with settings.system.read permission granted', async () => {
      const cookie = await loginAndGetCookie(companyAdminA.email);
      const res = await request(app.getHttpServer())
        .get('/api/v1/settings/system')
        .set('Cookie', [cookie]);
      expect(res.status).toBe(403);
    });

    it('COMPANY_ADMIN_A can read /settings/company/:companyA', async () => {
      const cookie = await loginAndGetCookie(companyAdminA.email);
      const res = await request(app.getHttpServer())
        .get(`/api/v1/settings/company/${companyA.id}`)
        .set('Cookie', [cookie]);
      expect(res.status).toBe(200);
    });

    it('COMPANY_ADMIN_A cannot read /settings/company/:companyB (cross-company isolation)', async () => {
      const cookie = await loginAndGetCookie(companyAdminA.email);
      const res = await request(app.getHttpServer())
        .get(`/api/v1/settings/company/${companyB.id}`)
        .set('Cookie', [cookie]);
      expect(res.status).toBe(403);
    });

    it('COMPANY_ADMIN_A cannot read /settings/branch/:branchA1 (no branch scope granted, only company)', async () => {
      const cookie = await loginAndGetCookie(companyAdminA.email);
      const res = await request(app.getHttpServer())
        .get(`/api/v1/settings/branch/${branchA1.id}?companyId=${companyA.id}`)
        .set('Cookie', [cookie]);
      expect(res.status).toBe(403);
    });

    it('a user with zero settings_company scope cannot read /settings/company/:id', async () => {
      const cookie = await loginAndGetCookie(plainUser.email);
      const res = await request(app.getHttpServer())
        .get(`/api/v1/settings/company/${companyA.id}`)
        .set('Cookie', [cookie]);
      expect(res.status).toBe(403);
    });
  });

  describe('Setting definition allowlist + value type validation', () => {
    it('rejects an update for an unknown setting key', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const res = await request(app.getHttpServer())
        .patch('/api/v1/settings/system/not.a.real.setting.key')
        .set('Cookie', [cookie])
        .send({ value: 'anything' });
      expect(res.status).toBe(400);
    });

    it("rejects a value that does not match the setting's declared data type (INTEGER expected, string given)", async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/settings/system/${DASHBOARD_RANGE_KEY}`)
        .set('Cookie', [cookie])
        .send({ value: 'not-an-integer' });
      expect(res.status).toBe(400);
    });

    it('rejects writing user.preferences.locale (USER/SYSTEM only) at COMPANY scope — allowedScopes enforcement', async () => {
      const cookie = await loginAndGetCookie(companyAdminA.email);
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/settings/company/${companyA.id}/${LOCALE_KEY}`)
        .set('Cookie', [cookie])
        .send({ value: 'fr' });
      expect(res.status).toBe(400);
    });

    it('accepts a valid INTEGER value at company scope', async () => {
      const cookie = await loginAndGetCookie(companyAdminA.email);
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/settings/company/${companyA.id}/${DASHBOARD_RANGE_KEY}`)
        .set('Cookie', [cookie])
        .send({ value: 45 });
      expect(res.status).toBe(200);
      expect((res.body as SettingsListBody).data[0].value).toBe(45);
    });
  });

  describe('Precedence: user > branch > company > system > default', () => {
    it('with nothing set, reading resolves to the definition default', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const res = await request(app.getHttpServer())
        .get(`/api/v1/settings/company/${companyB.id}`)
        .set('Cookie', [cookie]);
      const setting = findSetting(
        res.body as SettingsListBody,
        DASHBOARD_RANGE_KEY,
      );
      expect(setting?.sourceScope).toBe('DEFAULT');
      expect(setting?.value).toBe(30);
    });

    it('setting SYSTEM value changes the resolved value when no narrower override exists', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      await request(app.getHttpServer())
        .patch(`/api/v1/settings/system/${DASHBOARD_RANGE_KEY}`)
        .set('Cookie', [cookie])
        .send({ value: 60 });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/settings/company/${companyB.id}`)
        .set('Cookie', [cookie]);
      const setting = findSetting(
        res.body as SettingsListBody,
        DASHBOARD_RANGE_KEY,
      );
      expect(setting?.sourceScope).toBe('SYSTEM');
      expect(setting?.value).toBe(60);

      // Reset system default back so it doesn't leak into other suites
      // that may read the same shared setting_definitions row.
      await request(app.getHttpServer())
        .patch(`/api/v1/settings/system/${DASHBOARD_RANGE_KEY}`)
        .set('Cookie', [cookie])
        .send({ value: 30 });
    });

    it('a COMPANY-scoped override wins over SYSTEM for that company (company A already has 45 set above)', async () => {
      const cookie = await loginAndGetCookie(companyAdminA.email);
      const res = await request(app.getHttpServer())
        .get(`/api/v1/settings/company/${companyA.id}`)
        .set('Cookie', [cookie]);
      const setting = findSetting(
        res.body as SettingsListBody,
        DASHBOARD_RANGE_KEY,
      );
      expect(setting?.sourceScope).toBe('COMPANY');
      expect(setting?.value).toBe(45);
    });

    it('a BRANCH-scoped override wins over COMPANY for that branch', async () => {
      const superCookie = await loginAndGetCookie(superAdminUser.email);
      // Grant super admin implicit branch access is unnecessary — SUPER_ADMIN
      // already has ALL scope on settings_branch per rbac.seed.ts.
      await request(app.getHttpServer())
        .patch(
          `/api/v1/settings/branch/${branchA1.id}/${DASHBOARD_RANGE_KEY}?companyId=${companyA.id}`,
        )
        .set('Cookie', [superCookie])
        .send({ value: 7 });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/settings/branch/${branchA1.id}?companyId=${companyA.id}`)
        .set('Cookie', [superCookie]);
      const setting = findSetting(
        res.body as SettingsListBody,
        DASHBOARD_RANGE_KEY,
      );
      expect(setting?.sourceScope).toBe('BRANCH');
      expect(setting?.value).toBe(7);

      // The company-level value (45) must still be intact/unaffected.
      const companyRes = await request(app.getHttpServer())
        .get(`/api/v1/settings/company/${companyA.id}`)
        .set('Cookie', [superCookie]);
      const companySetting = findSetting(
        companyRes.body as SettingsListBody,
        DASHBOARD_RANGE_KEY,
      );
      expect(companySetting?.value).toBe(45);
    });

    it('a USER-scoped override wins over everything else for that user via /settings/me', async () => {
      const cookie = await loginAndGetCookie(companyAdminA.email);
      await request(app.getHttpServer())
        .patch(
          `/api/v1/settings/me/${DASHBOARD_RANGE_KEY}?companyId=${companyA.id}`,
        )
        .set('Cookie', [cookie])
        .send({ value: 3 });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/settings/me?companyId=${companyA.id}`)
        .set('Cookie', [cookie]);
      const setting = findSetting(
        res.body as SettingsListBody,
        DASHBOARD_RANGE_KEY,
      );
      expect(setting?.sourceScope).toBe('USER');
      expect(setting?.value).toBe(3);
    });
  });

  describe('Cache hit / miss / invalidation (real Redis)', () => {
    it('a fresh key is a cache miss then a cache hit on second read, and a write invalidates it', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const cacheKey = 'erp:cache:settings:system:SYSTEM:' + NOTIF_ENABLED_KEY;

      await redis.del(cacheKey);
      const beforeAny = await redis.get(cacheKey);
      expect(beforeAny).toBeNull();

      // First GET: cache miss, populates Redis.
      await request(app.getHttpServer())
        .get('/api/v1/settings/system')
        .set('Cookie', [cookie]);
      const afterFirstRead = await redis.get(cacheKey);
      expect(afterFirstRead).not.toBeNull();

      // Second GET: should be served from cache (value still present,
      // unchanged), proving the read-through path works on repeat reads.
      await request(app.getHttpServer())
        .get('/api/v1/settings/system')
        .set('Cookie', [cookie]);
      const afterSecondRead = await redis.get(cacheKey);
      expect(afterSecondRead).toBe(afterFirstRead);

      // Now update the value — this must invalidate (delete) the cache key.
      await request(app.getHttpServer())
        .patch(`/api/v1/settings/system/${NOTIF_ENABLED_KEY}`)
        .set('Cookie', [cookie])
        .send({ value: false });
      const afterWrite = await redis.get(cacheKey);
      expect(afterWrite).toBeNull();

      // Next read repopulates with the new value.
      const res = await request(app.getHttpServer())
        .get('/api/v1/settings/system')
        .set('Cookie', [cookie]);
      const setting = findSetting(
        res.body as SettingsListBody,
        NOTIF_ENABLED_KEY,
      );
      expect(setting?.value).toBe(false);

      // Restore default for other suites.
      await request(app.getHttpServer())
        .patch(`/api/v1/settings/system/${NOTIF_ENABLED_KEY}`)
        .set('Cookie', [cookie])
        .send({ value: true });
    });
  });

  describe('Redis-unavailable fail-open behavior', () => {
    it('settings reads still succeed (200, correct value from MySQL) when Redis is unreachable', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const isConnectedSpy = jest
        .spyOn(redis, 'get')
        .mockRejectedValue(new Error('simulated: Redis unreachable'));

      try {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/settings/company/${companyA.id}`)
          .set('Cookie', [cookie]);
        expect(res.status).toBe(200);
        const setting = findSetting(
          res.body as SettingsListBody,
          DASHBOARD_RANGE_KEY,
        );
        // Falls through to MySQL and returns the real persisted value (45),
        // not an error and not silently the default.
        expect(setting?.value).toBe(45);
      } finally {
        isConnectedSpy.mockRestore();
      }
    });

    it('settings writes still succeed when the cache invalidation call itself fails', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const delSpy = jest
        .spyOn(redis, 'del')
        .mockRejectedValue(new Error('simulated: Redis unreachable'));

      try {
        const res = await request(app.getHttpServer())
          .patch(
            `/api/v1/settings/company/${companyA.id}/${DASHBOARD_RANGE_KEY}`,
          )
          .set('Cookie', [cookie])
          .send({ value: 21 });
        expect(res.status).toBe(200);
      } finally {
        delSpy.mockRestore();
        // Restore known value for determinism of any later re-run.
        await request(app.getHttpServer())
          .patch(
            `/api/v1/settings/company/${companyA.id}/${DASHBOARD_RANGE_KEY}`,
          )
          .set('Cookie', [cookie])
          .send({ value: 45 });
      }
    });
  });

  describe('Secrets guardrail (architectural)', () => {
    it('no seeded setting definition category or key looks like a credential/secret store', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const res = await request(app.getHttpServer())
        .get('/api/v1/settings/system')
        .set('Cookie', [cookie]);
      const body = res.body as SettingsListBody;
      const suspicious = body.data.filter((s) =>
        /secret|password|token|credential|private[_-]?key|api[_-]?key/i.test(
          s.key,
        ),
      );
      expect(suspicious).toEqual([]);
    });
  });
});
