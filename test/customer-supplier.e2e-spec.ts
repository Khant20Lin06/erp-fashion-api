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
}
interface BranchBody {
  id: string;
  companyId: string;
}
interface PaymentTermBody {
  id: string;
  companyId: string;
  code: string;
  dueDays: number;
  status: string;
}
interface CustomerGroupBody {
  id: string;
  companyId: string;
  code: string;
  status: string;
}
interface SupplierGroupBody {
  id: string;
  companyId: string;
  code: string;
  status: string;
}
interface CustomerBody {
  id: string;
  companyId: string;
  branchId: string | null;
  customerCode: string;
  creditLimit: string;
  creditDays: number;
  openingBalanceAmount: string;
  receivableAccountId: string | null;
  status: string;
}
interface SupplierBody {
  id: string;
  companyId: string;
  supplierCode: string;
  creditDays: number;
  openingBalanceAmount: string;
  payableAccountId: string | null;
  status: string;
}
interface AddressBody {
  id: string;
  ownerId: string;
  isPrimary: boolean;
}
interface ContactBody {
  id: string;
  ownerId: string;
  isPrimary: boolean;
}

describeIfDb('Customer / Supplier (Phase 11) (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let passwordService: PasswordService;

  let superAdminUser: User;
  let plainUser: User;

  const password = 'correct-horse-battery-staple';
  const prefix = 'CS-E2E';

  async function loginAndGetCookie(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password });
    const setCookie = response.headers['set-cookie'] as
      string[] | string | undefined;
    const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    return String(cookieHeader).split(';')[0];
  }

  function uniqueCode(tag: string): string {
    return `${prefix}-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  }

  async function createCompany(cookie: string): Promise<CompanyBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Cookie', [cookie])
      .send({
        code: uniqueCode('CO'),
        name: 'CS E2E Test Company',
        baseCurrency: 'MMK',
        timezone: 'Asia/Yangon',
      });
    return response.body as CompanyBody;
  }

  async function createBranch(
    cookie: string,
    companyId: string,
  ): Promise<BranchBody> {
    const code = uniqueCode('BR');
    const response = await request(app.getHttpServer())
      .post('/api/v1/branches')
      .set('Cookie', [cookie])
      .send({ companyId, code, name: `Branch ${code}` });
    return response.body as BranchBody;
  }

  async function createPaymentTerm(
    cookie: string,
    companyId: string,
    overrides: Partial<{ code: string; dueDays: number }> = {},
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .post('/api/v1/payment-terms')
      .set('Cookie', [cookie])
      .send({
        companyId,
        code: overrides.code ?? uniqueCode('PT'),
        name: 'Net 30',
        dueDays: overrides.dueDays ?? 30,
      });
  }

  async function createCustomerGroup(
    cookie: string,
    companyId: string,
    overrides: Partial<{ code: string }> = {},
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .post('/api/v1/customer-groups')
      .set('Cookie', [cookie])
      .send({
        companyId,
        code: overrides.code ?? uniqueCode('CG'),
        name: 'VIP',
      });
  }

  async function createSupplierGroup(
    cookie: string,
    companyId: string,
    overrides: Partial<{ code: string }> = {},
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .post('/api/v1/supplier-groups')
      .set('Cookie', [cookie])
      .send({
        companyId,
        code: overrides.code ?? uniqueCode('SG'),
        name: 'Import Supplier',
      });
  }

  async function createCustomer(
    cookie: string,
    companyId: string,
    overrides: Partial<{
      customerCode: string;
      branchId: string;
      customerGroupId: string;
      paymentTermId: string;
      creditLimit: string;
      creditDays: number;
      openingBalanceAmount: string;
      receivableAccountId: string;
    }> = {},
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Cookie', [cookie])
      .send({
        companyId,
        customerCode: overrides.customerCode ?? uniqueCode('CUST'),
        name: 'Acme Retail',
        branchId: overrides.branchId,
        customerGroupId: overrides.customerGroupId,
        paymentTermId: overrides.paymentTermId,
        creditLimit: overrides.creditLimit,
        creditDays: overrides.creditDays,
        openingBalanceAmount: overrides.openingBalanceAmount,
        receivableAccountId: overrides.receivableAccountId,
      });
  }

  async function createSupplier(
    cookie: string,
    companyId: string,
    overrides: Partial<{
      supplierCode: string;
      branchId: string;
      supplierGroupId: string;
      paymentTermId: string;
      creditDays: number;
      openingBalanceAmount: string;
      payableAccountId: string;
    }> = {},
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .post('/api/v1/suppliers')
      .set('Cookie', [cookie])
      .send({
        companyId,
        supplierCode: overrides.supplierCode ?? uniqueCode('SUPP'),
        name: 'Fabric Co',
        branchId: overrides.branchId,
        supplierGroupId: overrides.supplierGroupId,
        paymentTermId: overrides.paymentTermId,
        creditDays: overrides.creditDays,
        openingBalanceAmount: overrides.openingBalanceAmount,
        payableAccountId: overrides.payableAccountId,
      });
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

    // Clean slate for this suite's own data only, respecting FK order
    // (children before parents) — mirrors the Phase 09/10 cleanup
    // convention (scope-to-own-prefix, never an unscoped DELETE).
    await dataSource.query(
      `DELETE FROM customer_addresses WHERE customer_id IN (SELECT id FROM (SELECT id FROM customers WHERE customer_code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM customer_contacts WHERE customer_id IN (SELECT id FROM (SELECT id FROM customers WHERE customer_code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM supplier_addresses WHERE supplier_id IN (SELECT id FROM (SELECT id FROM suppliers WHERE supplier_code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM supplier_contacts WHERE supplier_id IN (SELECT id FROM (SELECT id FROM suppliers WHERE supplier_code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM customers WHERE customer_code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM suppliers WHERE supplier_code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM customer_groups WHERE code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM supplier_groups WHERE code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM payment_terms WHERE code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM branches WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM companies WHERE code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM user_roles WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE 'cs-e2e-%') t)`,
    );
    await dataSource.query("DELETE FROM users WHERE email LIKE 'cs-e2e-%'");

    const userRepository = dataSource.getRepository(User);
    const roleRepository = dataSource.getRepository(Role);
    const userRoleRepository = dataSource.getRepository(UserRole);

    superAdminUser = await userRepository.save(
      userRepository.create({
        email: 'cs-e2e-superadmin@example.com',
        passwordHash: await passwordService.hash(password),
        firstName: 'CS',
        lastName: 'SuperAdmin',
        displayName: 'CS Super Admin',
        status: UserStatus.Active,
        isEmailVerified: true,
        lastLoginAt: null,
        passwordChangedAt: null,
      }),
    );

    plainUser = await userRepository.save(
      userRepository.create({
        email: 'cs-e2e-plain@example.com',
        passwordHash: await passwordService.hash(password),
        firstName: 'CS',
        lastName: 'Plain',
        displayName: 'CS Plain User',
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
      `DELETE FROM customer_addresses WHERE customer_id IN (SELECT id FROM (SELECT id FROM customers WHERE customer_code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM customer_contacts WHERE customer_id IN (SELECT id FROM (SELECT id FROM customers WHERE customer_code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM supplier_addresses WHERE supplier_id IN (SELECT id FROM (SELECT id FROM suppliers WHERE supplier_code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM supplier_contacts WHERE supplier_id IN (SELECT id FROM (SELECT id FROM suppliers WHERE supplier_code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM customers WHERE customer_code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM suppliers WHERE supplier_code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM customer_groups WHERE code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM supplier_groups WHERE code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM payment_terms WHERE code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM branches WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM companies WHERE code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM user_roles WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE 'cs-e2e-%') t)`,
    );
    await dataSource.query("DELETE FROM users WHERE email LIKE 'cs-e2e-%'");
    await app.close();
  });

  describe('authentication boundary', () => {
    it('returns 401 for all Phase 11 resources without a session', async () => {
      const routes = [
        '/api/v1/customers',
        '/api/v1/suppliers',
        '/api/v1/customer-groups',
        '/api/v1/supplier-groups',
        '/api/v1/payment-terms',
      ];
      for (const route of routes) {
        const response = await request(app.getHttpServer()).get(route);
        expect(response.status).toBe(401);
      }
    });
  });

  describe('permission boundary (403 for a plain authenticated user)', () => {
    it('rejects customer listing without customers.read', async () => {
      const cookie = await loginAndGetCookie(plainUser.email);
      const response = await request(app.getHttpServer())
        .get('/api/v1/customers')
        .set('Cookie', [cookie]);
      expect(response.status).toBe(403);
    });

    it('rejects supplier creation without suppliers.create', async () => {
      const adminCookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(adminCookie);
      const cookie = await loginAndGetCookie(plainUser.email);

      const response = await createSupplier(cookie, company.id);
      expect(response.status).toBe(403);
    });
  });

  describe('Payment Terms CRUD + validation + isolation', () => {
    it('creates a payment term', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);

      const response = await createPaymentTerm(cookie, company.id);

      expect(response.status).toBe(201);
      const body = response.body as PaymentTermBody;
      expect(body.companyId).toBe(company.id);
      expect(body.status).toBe('ACTIVE');
    });

    it('rejects a duplicate code within the same company (409)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const code = uniqueCode('PT-DUP');

      await createPaymentTerm(cookie, company.id, { code });
      const second = await createPaymentTerm(cookie, company.id, { code });

      expect(second.status).toBe(409);
    });

    it('rejects negative dueDays (400)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);

      const response = await request(app.getHttpServer())
        .post('/api/v1/payment-terms')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          code: uniqueCode('PT'),
          name: 'Bad',
          dueDays: -5,
        });

      expect(response.status).toBe(400);
    });

    it('returns 404 for a payment term in a different company (IDOR-safe)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const companyA = await createCompany(cookie);
      const companyB = await createCompany(cookie);
      const term = (await createPaymentTerm(cookie, companyA.id))
        .body as PaymentTermBody;

      const response = await request(app.getHttpServer())
        .get(`/api/v1/payment-terms/${term.id}?companyId=${companyB.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(404);
    });

    it('blocks deletion while a customer still references the term (409)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const term = (await createPaymentTerm(cookie, company.id))
        .body as PaymentTermBody;
      await createCustomer(cookie, company.id, { paymentTermId: term.id });

      const response = await request(app.getHttpServer())
        .delete(`/api/v1/payment-terms/${term.id}?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(409);
    });
  });

  describe('Customer Group CRUD + duplicate + isolation', () => {
    it('creates a customer group', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);

      const response = await createCustomerGroup(cookie, company.id);

      expect(response.status).toBe(201);
      expect((response.body as CustomerGroupBody).status).toBe('ACTIVE');
    });

    it('rejects a duplicate code within the same company (409)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const code = uniqueCode('CG-DUP');

      await createCustomerGroup(cookie, company.id, { code });
      const second = await createCustomerGroup(cookie, company.id, { code });

      expect(second.status).toBe(409);
    });

    it('allows the same code across two different companies', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const companyA = await createCompany(cookie);
      const companyB = await createCompany(cookie);
      const code = uniqueCode('CG-SHARED');

      const first = await createCustomerGroup(cookie, companyA.id, { code });
      const second = await createCustomerGroup(cookie, companyB.id, { code });

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
    });
  });

  describe('Supplier Group CRUD + duplicate + isolation', () => {
    it('creates a supplier group', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);

      const response = await createSupplierGroup(cookie, company.id);

      expect(response.status).toBe(201);
      expect((response.body as SupplierGroupBody).status).toBe('ACTIVE');
    });

    it('rejects a duplicate code within the same company (409)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const code = uniqueCode('SG-DUP');

      await createSupplierGroup(cookie, company.id, { code });
      const second = await createSupplierGroup(cookie, company.id, { code });

      expect(second.status).toBe(409);
    });
  });

  describe('Customer CRUD + lifecycle + credit + opening balance', () => {
    it('creates a customer with default credit/opening-balance values', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);

      const response = await createCustomer(cookie, company.id);

      expect(response.status).toBe(201);
      const body = response.body as CustomerBody;
      expect(body.creditLimit).toBe('0.00');
      expect(body.creditDays).toBe(0);
      expect(body.openingBalanceAmount).toBe('0.00');
      expect(body.status).toBe('ACTIVE');
    });

    it('persists an explicit openingBalanceAmount as master data only (no balance semantics)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);

      const response = await createCustomer(cookie, company.id, {
        openingBalanceAmount: '2500.00',
        creditLimit: '10000.00',
        creditDays: 45,
      });

      expect(response.status).toBe(201);
      const body = response.body as CustomerBody;
      expect(body.openingBalanceAmount).toBe('2500.00');
      expect(body.creditLimit).toBe('10000.00');
      expect(body.creditDays).toBe(45);
    });

    it('persists a receivableAccountId placeholder verbatim with no FK validation error', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const fakeAccountId = 'a1b2c3d4-e5f6-4789-a123-456789abcdef';

      const response = await createCustomer(cookie, company.id, {
        receivableAccountId: fakeAccountId,
      });

      expect(response.status).toBe(201);
      expect((response.body as CustomerBody).receivableAccountId).toBe(
        fakeAccountId,
      );
    });

    it('rejects negative creditLimit (400)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);

      const response = await request(app.getHttpServer())
        .post('/api/v1/customers')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          customerCode: uniqueCode('CUST'),
          name: 'Bad Credit',
          creditLimit: '-100.00',
        });

      expect(response.status).toBe(400);
    });

    it('rejects a duplicate customerCode within the same company (409)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const customerCode = uniqueCode('CUST-DUP');

      await createCustomer(cookie, company.id, { customerCode });
      const second = await createCustomer(cookie, company.id, { customerCode });

      expect(second.status).toBe(409);
    });

    it('accepts a branchId belonging to the same company', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const branch = await createBranch(cookie, company.id);

      const response = await createCustomer(cookie, company.id, {
        branchId: branch.id,
      });

      expect(response.status).toBe(201);
      expect((response.body as CustomerBody).branchId).toBe(branch.id);
    });

    it('rejects a branchId belonging to a different company (400, cross-company integrity)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const companyA = await createCompany(cookie);
      const companyB = await createCompany(cookie);
      const branchOfB = await createBranch(cookie, companyB.id);

      const response = await createCustomer(cookie, companyA.id, {
        branchId: branchOfB.id,
      });

      expect(response.status).toBe(400);
    });

    it('rejects a cross-company customerGroupId (404 via findByIdInCompany)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const companyA = await createCompany(cookie);
      const companyB = await createCompany(cookie);
      const groupOfB = (await createCustomerGroup(cookie, companyB.id))
        .body as CustomerGroupBody;

      const response = await createCustomer(cookie, companyA.id, {
        customerGroupId: groupOfB.id,
      });

      expect([400, 404]).toContain(response.status);
    });

    it('lists, updates, activates, deactivates, and blocks a customer', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const customer = (await createCustomer(cookie, company.id))
        .body as CustomerBody;

      const list = await request(app.getHttpServer())
        .get(`/api/v1/customers?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      expect(list.status).toBe(200);

      const update = await request(app.getHttpServer())
        .patch(`/api/v1/customers/${customer.id}?companyId=${company.id}`)
        .set('Cookie', [cookie])
        .send({ notes: 'VIP customer' });
      expect(update.status).toBe(200);

      const deactivate = await request(app.getHttpServer())
        .post(
          `/api/v1/customers/${customer.id}/deactivate?companyId=${company.id}`,
        )
        .set('Cookie', [cookie]);
      expect((deactivate.body as CustomerBody).status).toBe('INACTIVE');

      const block = await request(app.getHttpServer())
        .post(`/api/v1/customers/${customer.id}/block?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      expect((block.body as CustomerBody).status).toBe('BLOCKED');

      const activate = await request(app.getHttpServer())
        .post(
          `/api/v1/customers/${customer.id}/activate?companyId=${company.id}`,
        )
        .set('Cookie', [cookie]);
      expect((activate.body as CustomerBody).status).toBe('ACTIVE');
    });

    it('soft-deletes a customer (historical integrity — no hard delete)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const customer = (await createCustomer(cookie, company.id))
        .body as CustomerBody;

      const del = await request(app.getHttpServer())
        .delete(`/api/v1/customers/${customer.id}?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      expect(del.status).toBe(204);

      const rows: Array<{ deleted_at: Date | null }> = await dataSource.query(
        `SELECT deleted_at FROM customers WHERE id = ?`,
        [customer.id],
      );
      expect(rows[0].deleted_at).not.toBeNull();
    });

    it('returns 404 for a customer in a different company (IDOR-safe, never 403)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const companyA = await createCompany(cookie);
      const companyB = await createCompany(cookie);
      const customerInA = (await createCustomer(cookie, companyA.id))
        .body as CustomerBody;

      const response = await request(app.getHttpServer())
        .get(`/api/v1/customers/${customerInA.id}?companyId=${companyB.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(404);
    });

    it('rejects unknown/extra fields (400, forbidNonWhitelisted)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);

      const response = await request(app.getHttpServer())
        .post('/api/v1/customers')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          customerCode: uniqueCode('CUST'),
          name: 'Acme',
          currentBalance: '99999.00',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Supplier CRUD + lifecycle + credit terms', () => {
    it('creates a supplier with default credit/opening-balance values', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);

      const response = await createSupplier(cookie, company.id);

      expect(response.status).toBe(201);
      const body = response.body as SupplierBody;
      expect(body.creditDays).toBe(0);
      expect(body.openingBalanceAmount).toBe('0.00');
      expect(body.status).toBe('ACTIVE');
    });

    it('rejects a duplicate supplierCode within the same company (409)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const supplierCode = uniqueCode('SUPP-DUP');

      await createSupplier(cookie, company.id, { supplierCode });
      const second = await createSupplier(cookie, company.id, { supplierCode });

      expect(second.status).toBe(409);
    });

    it('persists a payableAccountId placeholder verbatim', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const fakeAccountId = 'b2c3d4e5-f6a7-4890-b234-56789abcdef0';

      const response = await createSupplier(cookie, company.id, {
        payableAccountId: fakeAccountId,
      });

      expect(response.status).toBe(201);
      expect((response.body as SupplierBody).payableAccountId).toBe(
        fakeAccountId,
      );
    });

    it('blocks and reactivates a supplier', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const supplier = (await createSupplier(cookie, company.id))
        .body as SupplierBody;

      const block = await request(app.getHttpServer())
        .post(`/api/v1/suppliers/${supplier.id}/block?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      expect((block.body as SupplierBody).status).toBe('BLOCKED');

      const activate = await request(app.getHttpServer())
        .post(
          `/api/v1/suppliers/${supplier.id}/activate?companyId=${company.id}`,
        )
        .set('Cookie', [cookie]);
      expect((activate.body as SupplierBody).status).toBe('ACTIVE');
    });

    it('returns 404 for a supplier in a different company (IDOR-safe)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const companyA = await createCompany(cookie);
      const companyB = await createCompany(cookie);
      const supplierInA = (await createSupplier(cookie, companyA.id))
        .body as SupplierBody;

      const response = await request(app.getHttpServer())
        .get(`/api/v1/suppliers/${supplierInA.id}?companyId=${companyB.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(404);
    });
  });

  describe('Customer Address CRUD + owner isolation + primary behavior', () => {
    it('creates, lists, and marks an address primary (unsetting the previous primary)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const customer = (await createCustomer(cookie, company.id))
        .body as CustomerBody;

      const first = await request(app.getHttpServer())
        .post(
          `/api/v1/customers/${customer.id}/addresses?companyId=${company.id}`,
        )
        .set('Cookie', [cookie])
        .send({ addressLine1: '1 First St', isPrimary: true });
      expect(first.status).toBe(201);
      expect((first.body as AddressBody).isPrimary).toBe(true);

      const second = await request(app.getHttpServer())
        .post(
          `/api/v1/customers/${customer.id}/addresses?companyId=${company.id}`,
        )
        .set('Cookie', [cookie])
        .send({ addressLine1: '2 Second St', isPrimary: true });
      expect(second.status).toBe(201);
      expect((second.body as AddressBody).isPrimary).toBe(true);

      const list = await request(app.getHttpServer())
        .get(
          `/api/v1/customers/${customer.id}/addresses?companyId=${company.id}`,
        )
        .set('Cookie', [cookie]);
      const addresses = list.body as AddressBody[];
      const primaryCount = addresses.filter((a) => a.isPrimary).length;
      expect(primaryCount).toBe(1);
    });

    it('rejects creating an address under a customer in a different company (404, IDOR-safe)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const companyA = await createCompany(cookie);
      const companyB = await createCompany(cookie);
      const customerInA = (await createCustomer(cookie, companyA.id))
        .body as CustomerBody;

      const response = await request(app.getHttpServer())
        .post(
          `/api/v1/customers/${customerInA.id}/addresses?companyId=${companyB.id}`,
        )
        .set('Cookie', [cookie])
        .send({ addressLine1: 'Should not be created' });

      expect(response.status).toBe(404);
    });

    it('updates and deletes an address via the flat route', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const customer = (await createCustomer(cookie, company.id))
        .body as CustomerBody;
      const created = (
        await request(app.getHttpServer())
          .post(
            `/api/v1/customers/${customer.id}/addresses?companyId=${company.id}`,
          )
          .set('Cookie', [cookie])
          .send({ addressLine1: '1 First St' })
      ).body as AddressBody;

      const update = await request(app.getHttpServer())
        .patch(
          `/api/v1/customer-addresses/${created.id}?companyId=${company.id}`,
        )
        .set('Cookie', [cookie])
        .send({ city: 'Yangon' });
      expect(update.status).toBe(200);

      const del = await request(app.getHttpServer())
        .delete(
          `/api/v1/customer-addresses/${created.id}?companyId=${company.id}`,
        )
        .set('Cookie', [cookie]);
      expect(del.status).toBe(204);
    });
  });

  describe('Supplier Contact CRUD + owner isolation + primary behavior', () => {
    it('creates a contact and enforces single-primary-per-supplier', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const supplier = (await createSupplier(cookie, company.id))
        .body as SupplierBody;

      const first = await request(app.getHttpServer())
        .post(
          `/api/v1/suppliers/${supplier.id}/contacts?companyId=${company.id}`,
        )
        .set('Cookie', [cookie])
        .send({ name: 'Contact One', isPrimary: true });
      expect(first.status).toBe(201);

      const second = await request(app.getHttpServer())
        .post(
          `/api/v1/suppliers/${supplier.id}/contacts?companyId=${company.id}`,
        )
        .set('Cookie', [cookie])
        .send({ name: 'Contact Two', isPrimary: true });
      expect(second.status).toBe(201);

      const list = await request(app.getHttpServer())
        .get(
          `/api/v1/suppliers/${supplier.id}/contacts?companyId=${company.id}`,
        )
        .set('Cookie', [cookie]);
      const contacts = list.body as ContactBody[];
      expect(contacts.filter((c) => c.isPrimary).length).toBe(1);
    });

    it('rejects creating a contact under a supplier in a different company (404, IDOR-safe)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const companyA = await createCompany(cookie);
      const companyB = await createCompany(cookie);
      const supplierInA = (await createSupplier(cookie, companyA.id))
        .body as SupplierBody;

      const response = await request(app.getHttpServer())
        .post(
          `/api/v1/suppliers/${supplierInA.id}/contacts?companyId=${companyB.id}`,
        )
        .set('Cookie', [cookie])
        .send({ name: 'Should not be created' });

      expect(response.status).toBe(404);
    });
  });

  describe('opening balance persistence-without-balance-semantics', () => {
    it('never exposes a currentBalance/outstandingBalance/accountBalance field anywhere in the response', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const customer = (
        await createCustomer(cookie, company.id, {
          openingBalanceAmount: '750.00',
        })
      ).body as Record<string, unknown>;

      expect(customer).not.toHaveProperty('currentBalance');
      expect(customer).not.toHaveProperty('outstandingBalance');
      expect(customer).not.toHaveProperty('accountBalance');
      expect(customer).not.toHaveProperty('balance');
      expect(customer.openingBalanceAmount).toBe('750.00');
    });

    it('leaves openingBalanceAmount untouched by activate/deactivate/block status changes', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const customer = (
        await createCustomer(cookie, company.id, {
          openingBalanceAmount: '999.99',
        })
      ).body as CustomerBody;

      await request(app.getHttpServer())
        .post(
          `/api/v1/customers/${customer.id}/deactivate?companyId=${company.id}`,
        )
        .set('Cookie', [cookie]);
      const afterDeactivate = await request(app.getHttpServer())
        .get(`/api/v1/customers/${customer.id}?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      expect((afterDeactivate.body as CustomerBody).openingBalanceAmount).toBe(
        '999.99',
      );
    });
  });

  describe('no GL Account table / no SalesAccount assignment created in this phase', () => {
    /**
     * Updated for Phase 17 (Accounting / General Ledger): `accounts` is now
     * a real, legitimate table (Phase 17's Chart of Accounts, D4) —
     * `Customer.receivableAccountId`/`Supplier.payableAccountId` finally
     * have a real FK target to point at, per this Phase 11 file's own
     * "Accounting Mapping Placeholders" section anticipating exactly this.
     * `gl_accounts`/`chart_of_accounts` (the two speculative alternate
     * names this test originally guarded against) and
     * `customer_sales_account_assignments` (a Customer-side permanent
     * SalesAccount assignment table, explicitly never built by any phase —
     * see this file's "SalesAccount / DataScope.ACCOUNT Deferral" section)
     * still correctly do not exist. This is a narrow, direct update to a
     * single stale assertion whose premise Phase 17 legitimately changed —
     * not a re-opening of any other Phase 11 boundary.
     */
    it('confirms gl_accounts/chart_of_accounts/customer_sales_account_assignments do not exist (accounts now exists — Phase 17)', async () => {
      const tables: Array<{ TABLE_NAME: string }> = await dataSource.query(
        `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('gl_accounts', 'chart_of_accounts', 'customer_sales_account_assignments')`,
      );

      expect(tables.length).toBe(0);

      const accountsTable: Array<{ TABLE_NAME: string }> =
        await dataSource.query(
          `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accounts'`,
        );
      expect(accountsTable.length).toBe(1);
    });
  });
});
