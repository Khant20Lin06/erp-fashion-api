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

interface UserBody {
  id: string;
  email: string;
  status: string;
}

interface CompanyBody {
  id: string;
}

interface BranchBody {
  id: string;
  companyId: string;
}

interface WarehouseBody {
  id: string;
}

interface EmployeeBody {
  id: string;
  employeeCode: string;
  userId: string | null;
  companyId: string;
  branchId: string;
  status: string;
}

interface SalesAccountBody {
  id: string;
  code: string;
  companyId: string;
  branchId: string;
  employeeId: string | null;
  status: string;
}

interface SalesAccountAssignmentBody {
  id: string;
  userId: string;
  employeeId: string;
  salesAccountId: string;
  status: string;
}

describeIfDb('User / Employee / Account Management (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let passwordService: PasswordService;

  let superAdminUser: User;
  let plainUser: User;

  const password = 'correct-horse-battery-staple';
  const prefix = 'UEA-E2E';

  async function loginAndGetCookie(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password });

    const setCookie = response.headers['set-cookie'] as
      string[] | string | undefined;
    const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    return String(cookieHeader).split(';')[0];
  }

  async function createCompany(cookie: string): Promise<CompanyBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Cookie', [cookie])
      .send({
        code: `${prefix}-CO-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        name: 'UEA E2E Test Company',
        baseCurrency: 'MMK',
        timezone: 'Asia/Yangon',
      });
    return response.body as CompanyBody;
  }

  async function createBranch(
    cookie: string,
    companyId: string,
  ): Promise<BranchBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/branches')
      .set('Cookie', [cookie])
      .send({
        companyId,
        code: `${prefix}-BR-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        name: 'UEA E2E Test Branch',
      });
    return response.body as BranchBody;
  }

  async function createWarehouse(
    cookie: string,
    companyId: string,
    branchId: string,
  ): Promise<WarehouseBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/warehouses')
      .set('Cookie', [cookie])
      .send({
        companyId,
        branchId,
        code: `${prefix}-WH-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        name: 'UEA E2E Test Warehouse',
      });
    return response.body as WarehouseBody;
  }

  async function createUser(
    cookie: string,
    emailOverride?: string,
  ): Promise<UserBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Cookie', [cookie])
      .send({
        email:
          emailOverride ??
          `uea-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`,
        password: 'correct-horse-battery-staple',
        firstName: 'Test',
        lastName: 'User',
      });
    return response.body as UserBody;
  }

  async function createEmployee(
    cookie: string,
    companyId: string,
    branchId: string,
  ): Promise<EmployeeBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/employees')
      .set('Cookie', [cookie])
      .send({
        employeeCode: `${prefix}-EMP-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        firstName: 'Test',
        lastName: 'Employee',
        companyId,
        branchId,
      });
    return response.body as EmployeeBody;
  }

  async function createSalesAccount(
    cookie: string,
    companyId: string,
    branchId: string,
    employeeId?: string,
  ): Promise<SalesAccountBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/sales-accounts')
      .set('Cookie', [cookie])
      .send({
        code: `${prefix}-SA-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        name: 'UEA E2E Sales Account',
        companyId,
        branchId,
        employeeId,
      });
    return response.body as SalesAccountBody;
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

    // Clean slate for this suite's own data only.
    await dataSource.query(
      `DELETE FROM sales_account_assignments WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE 'uea-e2e-%') t)`,
    );
    await dataSource.query(
      `DELETE FROM sales_accounts WHERE code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM employees WHERE employee_code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM user_warehouses WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE 'uea-e2e-%') t)`,
    );
    await dataSource.query(
      `DELETE FROM user_branches WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE 'uea-e2e-%') t)`,
    );
    await dataSource.query(
      `DELETE FROM user_companies WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE 'uea-e2e-%') t)`,
    );
    await dataSource.query(
      `DELETE FROM warehouses WHERE code LIKE '${prefix}%'`,
    );
    await dataSource.query(`DELETE FROM branches WHERE code LIKE '${prefix}%'`);
    await dataSource.query(
      `DELETE FROM companies WHERE code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM user_roles WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE 'uea-e2e-%') t)`,
    );
    await dataSource.query("DELETE FROM users WHERE email LIKE 'uea-e2e-%'");

    const userRepository = dataSource.getRepository(User);
    const roleRepository = dataSource.getRepository(Role);
    const userRoleRepository = dataSource.getRepository(UserRole);

    superAdminUser = await userRepository.save(
      userRepository.create({
        email: 'uea-e2e-superadmin@example.com',
        passwordHash: await passwordService.hash(password),
        firstName: 'UEA',
        lastName: 'SuperAdmin',
        displayName: 'UEA Super Admin',
        status: UserStatus.Active,
        isEmailVerified: true,
        lastLoginAt: null,
        passwordChangedAt: null,
      }),
    );

    plainUser = await userRepository.save(
      userRepository.create({
        email: 'uea-e2e-plain@example.com',
        passwordHash: await passwordService.hash(password),
        firstName: 'UEA',
        lastName: 'Plain',
        displayName: 'UEA Plain User',
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
      `DELETE FROM sales_account_assignments WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE 'uea-e2e-%') t)`,
    );
    await dataSource.query(
      `DELETE FROM sales_accounts WHERE code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM employees WHERE employee_code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM user_warehouses WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE 'uea-e2e-%') t)`,
    );
    await dataSource.query(
      `DELETE FROM user_branches WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE 'uea-e2e-%') t)`,
    );
    await dataSource.query(
      `DELETE FROM user_companies WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE 'uea-e2e-%') t)`,
    );
    await dataSource.query(
      `DELETE FROM warehouses WHERE code LIKE '${prefix}%'`,
    );
    await dataSource.query(`DELETE FROM branches WHERE code LIKE '${prefix}%'`);
    await dataSource.query(
      `DELETE FROM companies WHERE code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM user_roles WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE 'uea-e2e-%') t)`,
    );
    await dataSource.query("DELETE FROM users WHERE email LIKE 'uea-e2e-%'");
    await app.close();
  });

  describe('authentication boundary', () => {
    it('returns 401 for /users, /employees, /sales-accounts without a session', async () => {
      const routes = [
        '/api/v1/users',
        '/api/v1/employees',
        '/api/v1/sales-accounts',
      ];
      for (const route of routes) {
        const response = await request(app.getHttpServer()).get(route);
        expect(response.status).toBe(401);
      }
    });
  });

  describe('permission boundary (403 for a plain authenticated user)', () => {
    it('rejects user creation without users.create', async () => {
      const cookie = await loginAndGetCookie(plainUser.email);

      const response = await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Cookie', [cookie])
        .send({
          email: 'uea-e2e-denied@example.com',
          password: 'correct-horse-battery-staple',
          firstName: 'Denied',
          lastName: 'User',
        });

      expect(response.status).toBe(403);
    });

    it('rejects membership assignment without user_organizations.assign', async () => {
      const cookie = await loginAndGetCookie(plainUser.email);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/users/${plainUser.id}/companies`)
        .set('Cookie', [cookie])
        .send({ companyId: '00000000-0000-0000-0000-000000000000' });

      expect(response.status).toBe(403);
    });
  });

  describe('User CRUD', () => {
    it('creates a user with default ACTIVE status, never returns passwordHash', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);

      const response = await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Cookie', [cookie])
        .send({
          email: `uea-e2e-crud-${Date.now()}@example.com`,
          password: 'correct-horse-battery-staple',
          firstName: 'CRUD',
          lastName: 'Test',
        });

      expect(response.status).toBe(201);
      const body = response.body as UserBody;
      expect(body.status).toBe('ACTIVE');
      expect(
        (response.body as Record<string, unknown>).passwordHash,
      ).toBeUndefined();
    });

    it('rejects a duplicate email with 409', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const email = `uea-e2e-dup-${Date.now()}@example.com`;

      await createUser(cookie, email);
      const response = await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Cookie', [cookie])
        .send({
          email,
          password: 'correct-horse-battery-staple',
          firstName: 'Dup',
          lastName: 'User',
        });

      expect(response.status).toBe(409);
    });

    it('locks and unlocks a user (LOCKED distinct from INACTIVE)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const user = await createUser(cookie);

      const lockResponse = await request(app.getHttpServer())
        .post(`/api/v1/users/${user.id}/lock`)
        .set('Cookie', [cookie]);
      expect(lockResponse.status).toBe(200);
      expect((lockResponse.body as UserBody).status).toBe('LOCKED');

      const unlockResponse = await request(app.getHttpServer())
        .post(`/api/v1/users/${user.id}/unlock`)
        .set('Cookie', [cookie]);
      expect(unlockResponse.status).toBe(200);
      expect((unlockResponse.body as UserBody).status).toBe('ACTIVE');
    });

    it('a locked user cannot authenticate (Phase 05 boundary unchanged)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const email = `uea-e2e-lockedlogin-${Date.now()}@example.com`;
      const user = await createUser(cookie, email);
      await request(app.getHttpServer())
        .post(`/api/v1/users/${user.id}/lock`)
        .set('Cookie', [cookie]);

      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'correct-horse-battery-staple' });

      expect(loginResponse.status).toBe(401);
    });
  });

  describe('Employee — hierarchy validation', () => {
    it('creates an employee under a valid company/branch', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const branch = await createBranch(cookie, company.id);

      const employee = await createEmployee(cookie, company.id, branch.id);

      expect(employee.companyId).toBe(company.id);
      expect(employee.branchId).toBe(branch.id);
      expect(employee.userId).toBeNull();
    });

    it('rejects a branch belonging to a different company (§23/§54)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const companyA = await createCompany(cookie);
      const companyB = await createCompany(cookie);
      const branchB = await createBranch(cookie, companyB.id);

      const response = await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set('Cookie', [cookie])
        .send({
          employeeCode: `${prefix}-EMP-CROSS-${Date.now()}`,
          firstName: 'Cross',
          lastName: 'Company',
          companyId: companyA.id,
          branchId: branchB.id,
        });

      expect(response.status).toBe(400);
    });

    it('links a user to an employee, rejects a second link to the same user', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const branch = await createBranch(cookie, company.id);
      const employee1 = await createEmployee(cookie, company.id, branch.id);
      const employee2 = await createEmployee(cookie, company.id, branch.id);
      const user = await createUser(cookie);

      const linkResponse = await request(app.getHttpServer())
        .post(`/api/v1/employees/${employee1.id}/user`)
        .set('Cookie', [cookie])
        .send({ userId: user.id });
      expect(linkResponse.status).toBe(201);
      expect((linkResponse.body as EmployeeBody).userId).toBe(user.id);

      const secondLinkResponse = await request(app.getHttpServer())
        .post(`/api/v1/employees/${employee2.id}/user`)
        .set('Cookie', [cookie])
        .send({ userId: user.id });
      expect(secondLinkResponse.status).toBe(409);
    });

    it('terminates an employee and deactivates the exclusively-linked user', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const branch = await createBranch(cookie, company.id);
      const employee = await createEmployee(cookie, company.id, branch.id);
      const user = await createUser(cookie);
      await request(app.getHttpServer())
        .post(`/api/v1/employees/${employee.id}/user`)
        .set('Cookie', [cookie])
        .send({ userId: user.id });

      const terminateResponse = await request(app.getHttpServer())
        .post(`/api/v1/employees/${employee.id}/terminate`)
        .set('Cookie', [cookie]);

      expect(terminateResponse.status).toBe(200);
      expect((terminateResponse.body as EmployeeBody).status).toBe(
        'TERMINATED',
      );

      const userResponse = await request(app.getHttpServer())
        .get(`/api/v1/users/${user.id}`)
        .set('Cookie', [cookie]);
      expect((userResponse.body as UserBody).status).toBe('INACTIVE');
    });
  });

  describe('Membership — company-before-branch rule (LOCKED §4)', () => {
    it('rejects branch assignment when the user has no company membership yet', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const branch = await createBranch(cookie, company.id);
      const user = await createUser(cookie);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/users/${user.id}/branches`)
        .set('Cookie', [cookie])
        .send({ branchId: branch.id });

      expect(response.status).toBe(400);
    });

    it('allows branch assignment after company membership is granted', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const branch = await createBranch(cookie, company.id);
      const user = await createUser(cookie);

      await request(app.getHttpServer())
        .post(`/api/v1/users/${user.id}/companies`)
        .set('Cookie', [cookie])
        .send({ companyId: company.id });

      const response = await request(app.getHttpServer())
        .post(`/api/v1/users/${user.id}/branches`)
        .set('Cookie', [cookie])
        .send({ branchId: branch.id });

      expect(response.status).toBe(201);
    });

    it('rejects a duplicate company membership', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const user = await createUser(cookie);

      await request(app.getHttpServer())
        .post(`/api/v1/users/${user.id}/companies`)
        .set('Cookie', [cookie])
        .send({ companyId: company.id });

      const response = await request(app.getHttpServer())
        .post(`/api/v1/users/${user.id}/companies`)
        .set('Cookie', [cookie])
        .send({ companyId: company.id });

      expect(response.status).toBe(409);
    });

    it('supports multi-membership: a user can belong to two different companies', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const companyA = await createCompany(cookie);
      const companyB = await createCompany(cookie);
      const user = await createUser(cookie);

      const first = await request(app.getHttpServer())
        .post(`/api/v1/users/${user.id}/companies`)
        .set('Cookie', [cookie])
        .send({ companyId: companyA.id });
      const second = await request(app.getHttpServer())
        .post(`/api/v1/users/${user.id}/companies`)
        .set('Cookie', [cookie])
        .send({ companyId: companyB.id });

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);

      const listResponse = await request(app.getHttpServer())
        .get(`/api/v1/users/${user.id}/companies`)
        .set('Cookie', [cookie]);
      expect((listResponse.body as unknown[]).length).toBe(2);
    });
  });

  describe('Membership — warehouse hierarchy integrity (LOCKED §5)', () => {
    it("rejects warehouse assignment when the user has no branch membership for that warehouse's branch", async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const branch = await createBranch(cookie, company.id);
      const warehouse = await createWarehouse(cookie, company.id, branch.id);
      const user = await createUser(cookie);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/users/${user.id}/warehouses`)
        .set('Cookie', [cookie])
        .send({ warehouseId: warehouse.id });

      expect(response.status).toBe(400);
    });

    it('REJECTS a spoofed hierarchy: User has Company A + Branch A but Warehouse actually belongs to Branch B', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const companyA = await createCompany(cookie);
      const branchA = await createBranch(cookie, companyA.id);
      const branchB = await createBranch(cookie, companyA.id);
      const warehouseOfB = await createWarehouse(
        cookie,
        companyA.id,
        branchB.id,
      );
      const user = await createUser(cookie);

      await request(app.getHttpServer())
        .post(`/api/v1/users/${user.id}/companies`)
        .set('Cookie', [cookie])
        .send({ companyId: companyA.id });
      await request(app.getHttpServer())
        .post(`/api/v1/users/${user.id}/branches`)
        .set('Cookie', [cookie])
        .send({ branchId: branchA.id });

      const response = await request(app.getHttpServer())
        .post(`/api/v1/users/${user.id}/warehouses`)
        .set('Cookie', [cookie])
        .send({ warehouseId: warehouseOfB.id });

      expect(response.status).toBe(400);
    });

    it('allows warehouse assignment after the correct branch membership is granted', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const branch = await createBranch(cookie, company.id);
      const warehouse = await createWarehouse(cookie, company.id, branch.id);
      const user = await createUser(cookie);

      await request(app.getHttpServer())
        .post(`/api/v1/users/${user.id}/companies`)
        .set('Cookie', [cookie])
        .send({ companyId: company.id });
      await request(app.getHttpServer())
        .post(`/api/v1/users/${user.id}/branches`)
        .set('Cookie', [cookie])
        .send({ branchId: branch.id });

      const response = await request(app.getHttpServer())
        .post(`/api/v1/users/${user.id}/warehouses`)
        .set('Cookie', [cookie])
        .send({ warehouseId: warehouse.id });

      expect(response.status).toBe(201);
    });
  });

  describe('Sales Account — ownership foundation', () => {
    it('creates a sales account under a valid company/branch, optionally linked to an employee', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const branch = await createBranch(cookie, company.id);
      const employee = await createEmployee(cookie, company.id, branch.id);

      const account = await createSalesAccount(
        cookie,
        company.id,
        branch.id,
        employee.id,
      );

      expect(account.companyId).toBe(company.id);
      expect(account.employeeId).toBe(employee.id);
    });

    it('rejects a duplicate sales account code within the same company', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const branch = await createBranch(cookie, company.id);
      const code = `${prefix}-SA-DUP-${Date.now()}`;

      await request(app.getHttpServer())
        .post('/api/v1/sales-accounts')
        .set('Cookie', [cookie])
        .send({
          code,
          name: 'First',
          companyId: company.id,
          branchId: branch.id,
        });

      const second = await request(app.getHttpServer())
        .post('/api/v1/sales-accounts')
        .set('Cookie', [cookie])
        .send({
          code,
          name: 'Second',
          companyId: company.id,
          branchId: branch.id,
        });

      expect(second.status).toBe(409);
    });

    it('rejects assignment to an inactive sales account (§39/§103/§137)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const branch = await createBranch(cookie, company.id);
      const account = await createSalesAccount(cookie, company.id, branch.id);
      await request(app.getHttpServer())
        .post(`/api/v1/sales-accounts/${account.id}/deactivate`)
        .set('Cookie', [cookie]);

      const employee = await createEmployee(cookie, company.id, branch.id);
      const user = await createUser(cookie);
      await request(app.getHttpServer())
        .post(`/api/v1/employees/${employee.id}/user`)
        .set('Cookie', [cookie])
        .send({ userId: user.id });

      const response = await request(app.getHttpServer())
        .post(`/api/v1/sales-accounts/${account.id}/assignments`)
        .set('Cookie', [cookie])
        .send({ userId: user.id, employeeId: employee.id });

      expect(response.status).toBe(400);
    });
  });

  describe('Sales Account Assignment — the critical visibility-foundation scenario (spec §128/§40)', () => {
    it('Sales Staff A is assigned SA-A, Sales Staff B is assigned SA-B — assignments never overlap', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const branch = await createBranch(cookie, company.id);

      const employeeA = await createEmployee(cookie, company.id, branch.id);
      const userA = await createUser(cookie);
      await request(app.getHttpServer())
        .post(`/api/v1/employees/${employeeA.id}/user`)
        .set('Cookie', [cookie])
        .send({ userId: userA.id });
      const accountA = await createSalesAccount(cookie, company.id, branch.id);

      const employeeB = await createEmployee(cookie, company.id, branch.id);
      const userB = await createUser(cookie);
      await request(app.getHttpServer())
        .post(`/api/v1/employees/${employeeB.id}/user`)
        .set('Cookie', [cookie])
        .send({ userId: userB.id });
      const accountB = await createSalesAccount(cookie, company.id, branch.id);

      const assignA = await request(app.getHttpServer())
        .post(`/api/v1/sales-accounts/${accountA.id}/assignments`)
        .set('Cookie', [cookie])
        .send({ userId: userA.id, employeeId: employeeA.id });
      const assignB = await request(app.getHttpServer())
        .post(`/api/v1/sales-accounts/${accountB.id}/assignments`)
        .set('Cookie', [cookie])
        .send({ userId: userB.id, employeeId: employeeB.id });

      expect(assignA.status).toBe(201);
      expect(assignB.status).toBe(201);

      const accountAAssignments = await request(app.getHttpServer())
        .get(`/api/v1/sales-accounts/${accountA.id}/assignments`)
        .set('Cookie', [cookie]);
      const assignments =
        accountAAssignments.body as SalesAccountAssignmentBody[];
      expect(assignments.every((a) => a.userId === userA.id)).toBe(true);
      expect(assignments.some((a) => a.userId === userB.id)).toBe(false);
    });

    it("rejects assignment when userId does not match the employee's linked user (spoofing, §92)", async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const branch = await createBranch(cookie, company.id);
      const employee = await createEmployee(cookie, company.id, branch.id);
      const realUser = await createUser(cookie);
      const attackerUser = await createUser(cookie);
      await request(app.getHttpServer())
        .post(`/api/v1/employees/${employee.id}/user`)
        .set('Cookie', [cookie])
        .send({ userId: realUser.id });
      const account = await createSalesAccount(cookie, company.id, branch.id);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/sales-accounts/${account.id}/assignments`)
        .set('Cookie', [cookie])
        .send({ userId: attackerUser.id, employeeId: employee.id });

      expect(response.status).toBe(400);
    });

    it('unassign preserves history (row remains, status INACTIVE) rather than deleting', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const branch = await createBranch(cookie, company.id);
      const employee = await createEmployee(cookie, company.id, branch.id);
      const user = await createUser(cookie);
      await request(app.getHttpServer())
        .post(`/api/v1/employees/${employee.id}/user`)
        .set('Cookie', [cookie])
        .send({ userId: user.id });
      const account = await createSalesAccount(cookie, company.id, branch.id);

      const assignment = await request(app.getHttpServer())
        .post(`/api/v1/sales-accounts/${account.id}/assignments`)
        .set('Cookie', [cookie])
        .send({ userId: user.id, employeeId: employee.id });
      const assignmentId = (assignment.body as SalesAccountAssignmentBody).id;

      const unassignResponse = await request(app.getHttpServer())
        .delete(
          `/api/v1/sales-accounts/${account.id}/assignments/${assignmentId}`,
        )
        .set('Cookie', [cookie]);
      expect(unassignResponse.status).toBe(204);

      const listResponse = await request(app.getHttpServer())
        .get(`/api/v1/sales-accounts/${account.id}/assignments`)
        .set('Cookie', [cookie]);
      const assignments = listResponse.body as SalesAccountAssignmentBody[];
      const found = assignments.find((a) => a.id === assignmentId);
      expect(found).toBeDefined();
      expect(found?.status).toBe('INACTIVE');
    });
  });

  describe('IDOR / cross-company isolation', () => {
    it('returns 404 for a nonexistent employee id', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);

      const response = await request(app.getHttpServer())
        .get('/api/v1/employees/00000000-0000-0000-0000-000000000000')
        .set('Cookie', [cookie]);

      expect(response.status).toBe(404);
    });

    it('returns 404 for a nonexistent sales account id', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);

      const response = await request(app.getHttpServer())
        .get('/api/v1/sales-accounts/00000000-0000-0000-0000-000000000000')
        .set('Cookie', [cookie]);

      expect(response.status).toBe(404);
    });
  });
});
