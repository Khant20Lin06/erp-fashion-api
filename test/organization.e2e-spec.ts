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
import { UserRole } from '../src/modules/rbac/entities/user-role.entity';
import { SystemRoleCode } from '../src/modules/rbac/entities/system-role-code';

const dbEnvAvailable =
  !!process.env.DB_USERNAME &&
  !!process.env.DB_PASSWORD &&
  !!process.env.DB_DATABASE;

const describeIfDb = dbEnvAvailable ? describe : describe.skip;

interface CompanyBody {
  id: string;
  code: string;
  name: string;
  status: string;
}

interface BranchBody {
  id: string;
  companyId: string;
  code: string;
  status: string;
}

interface WarehouseBody {
  id: string;
  companyId: string;
  branchId: string;
  code: string;
  status: string;
  type: string;
}

interface ErrorBody {
  code?: string;
  message?: string;
}

describeIfDb('Organization — Company/Branch/Warehouse (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let passwordService: PasswordService;

  let superAdminUser: User;
  let plainUser: User;

  const password = 'correct-horse-battery-staple';
  const codePrefix = 'ORG-E2E';

  async function loginAndGetCookie(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password });

    const setCookie = response.headers['set-cookie'] as
      string[] | string | undefined;
    const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    return String(cookieHeader).split(';')[0];
  }

  async function createCompany(
    cookie: string,
    overrides: Partial<{ code: string; name: string }> = {},
  ): Promise<CompanyBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Cookie', [cookie])
      .send({
        code:
          overrides.code ??
          `${codePrefix}-CO-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        name: overrides.name ?? 'ORG E2E Test Company',
        baseCurrency: 'MMK',
        timezone: 'Asia/Yangon',
      });
    return response.body as CompanyBody;
  }

  async function createBranch(
    cookie: string,
    companyId: string,
    code: string,
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .post('/api/v1/branches')
      .set('Cookie', [cookie])
      .send({ companyId, code, name: `Branch ${code}` });
  }

  async function createWarehouse(
    cookie: string,
    companyId: string,
    branchId: string,
    code: string,
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .post('/api/v1/warehouses')
      .set('Cookie', [cookie])
      .send({ companyId, branchId, code, name: `Warehouse ${code}` });
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

    // Clean slate for this suite's own data only — never an unscoped DELETE
    // (Phase 06 already hit this bug once when suites shared tables).
    await dataSource.query(
      `DELETE FROM warehouses WHERE code LIKE '${codePrefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM branches WHERE code LIKE '${codePrefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM companies WHERE code LIKE '${codePrefix}%'`,
    );
    await dataSource.query(
      "DELETE FROM user_roles WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE 'org-e2e-%') t)",
    );
    await dataSource.query("DELETE FROM users WHERE email LIKE 'org-e2e-%'");

    const userRepository = dataSource.getRepository(User);
    const roleRepository = dataSource.getRepository(Role);
    const userRoleRepository = dataSource.getRepository(UserRole);

    superAdminUser = await userRepository.save(
      userRepository.create({
        email: 'org-e2e-superadmin@example.com',
        passwordHash: await passwordService.hash(password),
        firstName: 'Org',
        lastName: 'SuperAdmin',
        displayName: 'Org Super Admin',
        status: UserStatus.Active,
        isEmailVerified: true,
        lastLoginAt: null,
        passwordChangedAt: null,
      }),
    );

    plainUser = await userRepository.save(
      userRepository.create({
        email: 'org-e2e-plain@example.com',
        passwordHash: await passwordService.hash(password),
        firstName: 'Org',
        lastName: 'Plain',
        displayName: 'Org Plain User',
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
  });

  afterAll(async () => {
    await dataSource.query(
      `DELETE FROM warehouses WHERE code LIKE '${codePrefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM branches WHERE code LIKE '${codePrefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM companies WHERE code LIKE '${codePrefix}%'`,
    );
    await dataSource.query(
      "DELETE FROM user_roles WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE 'org-e2e-%') t)",
    );
    await dataSource.query("DELETE FROM users WHERE email LIKE 'org-e2e-%'");
    await app.close();
  });

  describe('authentication boundary', () => {
    it('returns 401 for /companies without a session', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/v1/companies',
      );
      expect(response.status).toBe(401);
    });

    it('returns 401 for /branches without a session', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/v1/branches',
      );
      expect(response.status).toBe(401);
    });

    it('returns 401 for /warehouses without a session', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/v1/warehouses',
      );
      expect(response.status).toBe(401);
    });
  });

  describe('permission boundary (403 for a plain authenticated user)', () => {
    it('rejects company creation without companies.create', async () => {
      const cookie = await loginAndGetCookie(plainUser.email);

      const response = await request(app.getHttpServer())
        .post('/api/v1/companies')
        .set('Cookie', [cookie])
        .send({
          code: `${codePrefix}-DENIED`,
          name: 'Should be denied',
          baseCurrency: 'USD',
          timezone: 'UTC',
        });

      expect(response.status).toBe(403);
    });

    it('rejects company listing without companies.read', async () => {
      const cookie = await loginAndGetCookie(plainUser.email);

      const response = await request(app.getHttpServer())
        .get('/api/v1/companies')
        .set('Cookie', [cookie]);

      expect(response.status).toBe(403);
    });
  });

  describe('Company CRUD', () => {
    it('creates a company', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const code = `${codePrefix}-CO-CRUD-${Date.now()}`;

      const response = await request(app.getHttpServer())
        .post('/api/v1/companies')
        .set('Cookie', [cookie])
        .send({
          code,
          name: 'ORG E2E CRUD Company',
          baseCurrency: 'MMK',
          timezone: 'Asia/Yangon',
        });

      expect(response.status).toBe(201);
      const body = response.body as CompanyBody;
      expect(body.code).toBe(code);
      expect(body.status).toBe('ACTIVE');
    });

    it('rejects a duplicate company code with 409', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const code = `${codePrefix}-CO-DUP-${Date.now()}`;

      await request(app.getHttpServer())
        .post('/api/v1/companies')
        .set('Cookie', [cookie])
        .send({
          code,
          name: 'First',
          baseCurrency: 'MMK',
          timezone: 'Asia/Yangon',
        });

      const response = await request(app.getHttpServer())
        .post('/api/v1/companies')
        .set('Cookie', [cookie])
        .send({
          code,
          name: 'Second',
          baseCurrency: 'MMK',
          timezone: 'Asia/Yangon',
        });

      expect(response.status).toBe(409);
    });

    it('rejects invalid input (missing required fields) with 400', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);

      const response = await request(app.getHttpServer())
        .post('/api/v1/companies')
        .set('Cookie', [cookie])
        .send({ code: `${codePrefix}-INVALID` });

      expect(response.status).toBe(400);
    });

    it('returns 404 for a nonexistent company id', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);

      const response = await request(app.getHttpServer())
        .get('/api/v1/companies/00000000-0000-0000-0000-000000000000')
        .set('Cookie', [cookie]);

      expect(response.status).toBe(404);
    });

    it('updates a company', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/companies/${company.id}`)
        .set('Cookie', [cookie])
        .send({ name: 'Renamed Company' });

      expect(response.status).toBe(200);
      expect((response.body as CompanyBody).name).toBe('Renamed Company');
    });

    it('activates and deactivates a company', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);

      const deactivate = await request(app.getHttpServer())
        .post(`/api/v1/companies/${company.id}/deactivate`)
        .set('Cookie', [cookie]);
      expect(deactivate.status).toBe(200);
      expect((deactivate.body as CompanyBody).status).toBe('INACTIVE');

      const activate = await request(app.getHttpServer())
        .post(`/api/v1/companies/${company.id}/activate`)
        .set('Cookie', [cookie]);
      expect(activate.status).toBe(200);
      expect((activate.body as CompanyBody).status).toBe('ACTIVE');
    });
  });

  describe('Branch — parent hierarchy validation', () => {
    it('creates a branch under a valid active company', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const code = `${codePrefix}-BR-${Date.now()}`;

      const response = await createBranch(cookie, company.id, code);

      expect(response.status).toBe(201);
      const body = response.body as BranchBody;
      expect(body.companyId).toBe(company.id);
    });

    it('rejects a branch under a nonexistent company (§29) with 400', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);

      const response = await createBranch(
        cookie,
        '00000000-0000-0000-0000-000000000000',
        `${codePrefix}-BR-ORPHAN`,
      );

      expect(response.status).toBe(400);
    });

    it('rejects a branch under an inactive company (§29)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      await request(app.getHttpServer())
        .post(`/api/v1/companies/${company.id}/deactivate`)
        .set('Cookie', [cookie]);

      const response = await createBranch(
        cookie,
        company.id,
        `${codePrefix}-BR-INACTIVE-PARENT`,
      );

      expect(response.status).toBe(400);
    });

    it('rejects a duplicate branch code within the same company (409)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const code = `${codePrefix}-BR-DUP-${Date.now()}`;

      await createBranch(cookie, company.id, code);
      const second = await createBranch(cookie, company.id, code);

      expect(second.status).toBe(409);
    });

    it('allows the same branch code across two different companies (§9)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const companyA = await createCompany(cookie);
      const companyB = await createCompany(cookie);
      const code = `${codePrefix}-BR-SHARED-${Date.now()}`;

      const first = await createBranch(cookie, companyA.id, code);
      const second = await createBranch(cookie, companyB.id, code);

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
    });
  });

  describe('Warehouse — critical cross-company integrity rule (§12, §16, §26)', () => {
    it('creates a warehouse under a matching company + branch', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const branchResponse = await createBranch(
        cookie,
        company.id,
        `${codePrefix}-BR-WH-OK-${Date.now()}`,
      );
      const branch = branchResponse.body as BranchBody;

      const response = await createWarehouse(
        cookie,
        company.id,
        branch.id,
        `${codePrefix}-WH-${Date.now()}`,
      );

      expect(response.status).toBe(201);
      const body = response.body as WarehouseBody;
      expect(body.companyId).toBe(company.id);
      expect(body.branchId).toBe(branch.id);
    });

    it('REJECTS Warehouse.branchId belonging to a different company than Warehouse.companyId', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);

      const companyA = await createCompany(cookie);
      const companyB = await createCompany(cookie);
      const branchBResponse = await createBranch(
        cookie,
        companyB.id,
        `${codePrefix}-BR-B1-${Date.now()}`,
      );
      const branchB = branchBResponse.body as BranchBody;

      // Attempt: Warehouse under Company A but pointing at Company B's branch.
      const response = await createWarehouse(
        cookie,
        companyA.id,
        branchB.id,
        `${codePrefix}-WH-CROSS-${Date.now()}`,
      );

      expect(response.status).toBe(400);
      expect((response.body as ErrorBody).message).toMatch(/companyId/i);
    });

    it('rejects a warehouse under a nonexistent branch', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);

      const response = await createWarehouse(
        cookie,
        company.id,
        '00000000-0000-0000-0000-000000000000',
        `${codePrefix}-WH-ORPHAN`,
      );

      expect(response.status).toBe(400);
    });

    it('rejects a warehouse under an inactive branch', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const branchResponse = await createBranch(
        cookie,
        company.id,
        `${codePrefix}-BR-INACTIVE-${Date.now()}`,
      );
      const branch = branchResponse.body as BranchBody;
      await request(app.getHttpServer())
        .post(`/api/v1/branches/${branch.id}/deactivate`)
        .set('Cookie', [cookie]);

      const response = await createWarehouse(
        cookie,
        company.id,
        branch.id,
        `${codePrefix}-WH-INACTIVE-PARENT`,
      );

      expect(response.status).toBe(400);
    });

    it('rejects a duplicate warehouse code within the same company', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const branchResponse = await createBranch(
        cookie,
        company.id,
        `${codePrefix}-BR-DUPWH-${Date.now()}`,
      );
      const branch = branchResponse.body as BranchBody;
      const code = `${codePrefix}-WH-DUP-${Date.now()}`;

      await createWarehouse(cookie, company.id, branch.id, code);
      const second = await createWarehouse(cookie, company.id, branch.id, code);

      expect(second.status).toBe(409);
    });
  });

  describe('Full hierarchy isolation — Company A/Branch A1/Warehouse A1 vs Company B/Branch B1/Warehouse B1', () => {
    it("lists warehouses filtered by companyId without leaking another company's warehouse", async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);

      const companyA = await createCompany(cookie);
      const branchA1 = (
        await createBranch(
          cookie,
          companyA.id,
          `${codePrefix}-A1-${Date.now()}`,
        )
      ).body as BranchBody;
      const warehouseA1 = (
        await createWarehouse(
          cookie,
          companyA.id,
          branchA1.id,
          `${codePrefix}-WHA1-${Date.now()}`,
        )
      ).body as WarehouseBody;

      const companyB = await createCompany(cookie);
      const branchB1 = (
        await createBranch(
          cookie,
          companyB.id,
          `${codePrefix}-B1-${Date.now()}`,
        )
      ).body as BranchBody;
      await createWarehouse(
        cookie,
        companyB.id,
        branchB1.id,
        `${codePrefix}-WHB1-${Date.now()}`,
      );

      const response = await request(app.getHttpServer())
        .get(`/api/v1/warehouses?companyId=${companyA.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(200);
      const ids = (response.body as { data: WarehouseBody[] }).data.map(
        (w) => w.id,
      );
      expect(ids).toContain(warehouseA1.id);
      // Company B's warehouse must never appear in a Company A-filtered list.
      const leaked = (response.body as { data: WarehouseBody[] }).data.some(
        (w) => w.companyId === companyB.id,
      );
      expect(leaked).toBe(false);
    });
  });

  describe('Deletion / lifecycle safety (no orphaning, §31)', () => {
    it('rejects deleting a company that has branches', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      await createBranch(
        cookie,
        company.id,
        `${codePrefix}-BR-BLOCK-${Date.now()}`,
      );

      const response = await request(app.getHttpServer())
        .delete(`/api/v1/companies/${company.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(409);
    });

    it('rejects deleting a branch that has warehouses', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const branch = (
        await createBranch(
          cookie,
          company.id,
          `${codePrefix}-BR-WHBLOCK-${Date.now()}`,
        )
      ).body as BranchBody;
      await createWarehouse(
        cookie,
        company.id,
        branch.id,
        `${codePrefix}-WH-BLOCK-${Date.now()}`,
      );

      const response = await request(app.getHttpServer())
        .delete(`/api/v1/branches/${branch.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(409);
    });
  });

  describe('Unknown/extra fields rejected (existing global ValidationPipe)', () => {
    it('rejects an unexpected field on company create', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);

      const response = await request(app.getHttpServer())
        .post('/api/v1/companies')
        .set('Cookie', [cookie])
        .send({
          code: `${codePrefix}-EXTRA-${Date.now()}`,
          name: 'Extra field test',
          baseCurrency: 'MMK',
          timezone: 'Asia/Yangon',
          parentId: 'should-not-be-accepted',
        });

      expect(response.status).toBe(400);
    });
  });
});
