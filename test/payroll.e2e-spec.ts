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

/**
 * Phase 16 — Payroll / HR Advanced live verification (e2e).
 *
 * End-to-end proof (real HTTP + real MySQL, not mocks) of the full golden
 * path: Shift -> EmployeeShiftAssignment -> EmployeeCompensation ->
 * PayrollComponent -> EmployeePayrollComponent -> PayrollPeriod ->
 * PayrollRun -> calculate -> finalize, plus the concurrency/immutability
 * guards (duplicate period, double-calculation, double-finalization,
 * finalized-run immutability) and cross-company isolation.
 *
 * Uses only the seeded SUPER_ADMIN role (ALL scope on every payroll
 * resource per rbac.seed.ts) — this suite exercises payroll domain
 * correctness, not the DataScope matrix (already proven generically by
 * test/hr-datascope.e2e-spec.ts for the sibling HR module).
 */
const dbEnvAvailable =
  !!process.env.DB_USERNAME &&
  !!process.env.DB_PASSWORD &&
  !!process.env.DB_DATABASE;

const describeIfDb = dbEnvAvailable ? describe : describe.skip;

interface IdBody {
  id: string;
  [key: string]: unknown;
}
interface ErrorBody {
  code?: string;
  message?: string;
}

describeIfDb('Payroll — live verification (Phase 16) (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let passwordService: PasswordService;

  const password = 'correct-horse-battery-staple';
  const prefix = 'PAYROLL-E2E';
  let superCookie: string;
  let otherCompanyCookie: string;

  let companyA: IdBody;
  let branchA: IdBody;
  let companyB: IdBody;

  function rand(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  }
  function uniqueCode(tag: string): string {
    return `${prefix}-${tag}-${rand()}`;
  }

  async function createUser(email: string): Promise<User> {
    const userRepository = dataSource.getRepository(User);
    return userRepository.save(
      userRepository.create({
        email,
        passwordHash: await passwordService.hash(password),
        firstName: 'Payroll',
        lastName: 'E2E',
        displayName: 'Payroll E2E User',
        status: UserStatus.Active,
        isEmailVerified: true,
        lastLoginAt: null,
        passwordChangedAt: null,
      }),
    );
  }

  async function loginAndGetCookie(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password });
    const setCookie = response.headers['set-cookie'] as
      string[] | string | undefined;
    const cookieSource = Array.isArray(setCookie)
      ? setCookie.join('; ')
      : String(setCookie);
    const match = cookieSource.match(/fashion_erp_access_token=([^;]+)/);
    return match ? `fashion_erp_access_token=${match[1]}` : '';
  }

  async function makeSuperAdmin(cookieEmail: string): Promise<string> {
    const user = await createUser(cookieEmail);
    const roleRepository = dataSource.getRepository(Role);
    const userRoleRepository = dataSource.getRepository(UserRole);
    const superAdminRole = await roleRepository.findOneOrFail({
      where: { code: SystemRoleCode.SuperAdmin },
    });
    await userRoleRepository.save(
      userRoleRepository.create({ userId: user.id, roleId: superAdminRole.id }),
    );
    return loginAndGetCookie(user.email);
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

    superCookie = await makeSuperAdmin(
      `payroll-e2e-superadmin-${rand()}@example.com`,
    );
    otherCompanyCookie = await makeSuperAdmin(
      `payroll-e2e-othercompany-${rand()}@example.com`,
    );

    const companyRes = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Cookie', [superCookie])
      .send({
        code: uniqueCode('CO'),
        name: 'Payroll E2E Company A',
        baseCurrency: 'USD',
        timezone: 'Asia/Yangon',
      });
    companyA = companyRes.body as IdBody;

    const branchRes = await request(app.getHttpServer())
      .post('/api/v1/branches')
      .set('Cookie', [superCookie])
      .send({
        companyId: companyA.id,
        code: uniqueCode('BR'),
        name: 'Payroll E2E Branch A',
      });
    branchA = branchRes.body as IdBody;

    const companyBRes = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Cookie', [otherCompanyCookie])
      .send({
        code: uniqueCode('CO-B'),
        name: 'Payroll E2E Company B',
        baseCurrency: 'USD',
        timezone: 'Asia/Yangon',
      });
    companyB = companyBRes.body as IdBody;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('unauthenticated request is rejected with 401', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/v1/payroll/periods',
    );
    expect(res.status).toBe(401);
  });

  describe('golden path: shift -> compensation -> components -> period -> run -> calculate -> finalize', () => {
    let employeeId: string;
    let shiftId: string;
    let periodId: string;
    let earningComponentId: string;
    let deductionComponentId: string;
    let runId: string;

    it('creates an employee', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set('Cookie', [superCookie])
        .send({
          companyId: companyA.id,
          branchId: branchA.id,
          employeeCode: uniqueCode('EMP'),
          firstName: 'Jane',
          lastName: 'Doe',
        });
      expect(res.status).toBe(201);
      employeeId = (res.body as IdBody).id;
    });

    it('creates an overnight shift (endTime < startTime)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/shifts')
        .set('Cookie', [superCookie])
        .send({
          companyId: companyA.id,
          name: 'Night Shift',
          code: uniqueCode('SHIFT'),
          startTime: '22:00',
          endTime: '06:00',
        });
      expect(res.status).toBe(201);
      shiftId = (res.body as IdBody).id;
      expect((res.body as { endTime: string }).endTime).toMatch(
        /^06:00(:00)?$/,
      );
    });

    it('assigns the shift to the employee', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/employees/${employeeId}/shifts`)
        .query({ companyId: companyA.id })
        .set('Cookie', [superCookie])
        .send({ shiftId, effectiveFrom: '2026-08-01' });
      expect(res.status).toBe(201);
    });

    it('creates an effective-dated compensation record', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/employees/${employeeId}/compensation`)
        .query({ companyId: companyA.id })
        .set('Cookie', [superCookie])
        .send({
          effectiveFrom: '2026-08-01',
          baseSalary: '1000.00',
          currency: 'USD',
        });
      expect(res.status).toBe(201);
    });

    it('rejects an overlapping compensation record', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/employees/${employeeId}/compensation`)
        .query({ companyId: companyA.id })
        .set('Cookie', [superCookie])
        .send({
          effectiveFrom: '2026-08-15',
          baseSalary: '1200.00',
          currency: 'USD',
        });
      expect(res.status).toBe(409);
    });

    it('creates a FIXED_AMOUNT earning payroll component', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payroll/components')
        .set('Cookie', [superCookie])
        .send({
          companyId: companyA.id,
          name: 'Bonus',
          code: uniqueCode('BONUS'),
          type: 'EARNING',
          calculationType: 'FIXED_AMOUNT',
          fixedAmount: '200.00',
        });
      expect(res.status).toBe(201);
      earningComponentId = (res.body as IdBody).id;
    });

    it('creates a FIXED_AMOUNT deduction payroll component', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payroll/components')
        .set('Cookie', [superCookie])
        .send({
          companyId: companyA.id,
          name: 'Tax',
          code: uniqueCode('TAX'),
          type: 'DEDUCTION',
          calculationType: 'FIXED_AMOUNT',
          fixedAmount: '50.00',
        });
      expect(res.status).toBe(201);
      deductionComponentId = (res.body as IdBody).id;
    });

    it('assigns both components to the employee', async () => {
      const earnRes = await request(app.getHttpServer())
        .post(`/api/v1/employees/${employeeId}/payroll-components`)
        .query({ companyId: companyA.id })
        .set('Cookie', [superCookie])
        .send({
          payrollComponentId: earningComponentId,
          effectiveFrom: '2026-08-01',
        });
      expect(earnRes.status).toBe(201);

      const dedRes = await request(app.getHttpServer())
        .post(`/api/v1/employees/${employeeId}/payroll-components`)
        .query({ companyId: companyA.id })
        .set('Cookie', [superCookie])
        .send({
          payrollComponentId: deductionComponentId,
          effectiveFrom: '2026-08-01',
        });
      expect(dedRes.status).toBe(201);
    });

    it('creates a payroll period', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payroll/periods')
        .set('Cookie', [superCookie])
        .send({
          companyId: companyA.id,
          name: 'Payroll E2E August 2026',
          startDate: '2026-08-01',
          endDate: '2026-08-31',
          payDate: '2026-09-05',
        });
      expect(res.status).toBe(201);
      periodId = (res.body as IdBody).id;
      expect((res.body as { periodNumber: string }).periodNumber).toMatch(
        /^PP-\d{4}-\d{6}$/,
      );
    });

    it('sets up payroll configuration for the company', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/payroll/configuration')
        .query({ companyId: companyA.id })
        .set('Cookie', [superCookie])
        .send({
          defaultCurrency: 'USD',
          unpaidLeaveCalculation: 'NONE',
        });
      expect(res.status).toBe(200);
    });

    it('rejects creating a duplicate period with the exact same date range', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payroll/periods')
        .set('Cookie', [superCookie])
        .send({
          companyId: companyA.id,
          name: 'Duplicate',
          startDate: '2026-08-01',
          endDate: '2026-08-31',
          payDate: '2026-09-05',
        });
      expect(res.status).toBe(409);
    });

    it('creates a payroll run for the period', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payroll/runs')
        .set('Cookie', [superCookie])
        .send({ companyId: companyA.id, payrollPeriodId: periodId });
      expect(res.status).toBe(201);
      runId = (res.body as IdBody).id;
      expect((res.body as { status: string }).status).toBe('DRAFT');
    });

    it('rejects creating a second active run for the same period', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payroll/runs')
        .set('Cookie', [superCookie])
        .send({ companyId: companyA.id, payrollPeriodId: periodId });
      expect(res.status).toBe(409);
    });

    it('calculates the payroll run and verifies gross/deductions/net totals', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/payroll/runs/${runId}/calculate`)
        .query({ companyId: companyA.id })
        .set('Cookie', [superCookie])
        .send();
      expect(res.status).toBe(200);
      const body = res.body as {
        status: string;
        totalGrossPay: string;
        totalDeductions: string;
        totalNetPay: string;
        employeeCount: number;
      };
      expect(body.status).toBe('CALCULATED');
      expect(body.employeeCount).toBeGreaterThanOrEqual(1);
      // 1000 base + 200 earning = 1200 gross; 1200 - 50 deduction = 1150 net
      expect(body.totalGrossPay).toBe('1200.00');
      expect(body.totalDeductions).toBe('50.00');
      expect(body.totalNetPay).toBe('1150.00');
    });

    it('rejects recalculating an already-CALCULATED run (double-calculation prevention)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/payroll/runs/${runId}/calculate`)
        .query({ companyId: companyA.id })
        .set('Cookie', [superCookie])
        .send();
      expect(res.status).toBe(422);
    });

    it('verifies the payslip snapshot for the employee', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/payroll/runs/${runId}/employees/${employeeId}`)
        .query({ companyId: companyA.id })
        .set('Cookie', [superCookie]);
      expect(res.status).toBe(200);
      const body = res.body as {
        baseSalarySnapshot: string;
        grossPay: string;
        netPay: string;
        items?: Array<{ componentCodeSnapshot: string; amount: string }>;
      };
      expect(body.baseSalarySnapshot).toBe('1000.00');
      expect(body.grossPay).toBe('1200.00');
      expect(body.netPay).toBe('1150.00');
      expect(body.items?.length).toBeGreaterThanOrEqual(2);
    });

    it('finalizes the calculated run', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/payroll/runs/${runId}/finalize`)
        .query({ companyId: companyA.id })
        .set('Cookie', [superCookie])
        .send();
      expect(res.status).toBe(200);
      expect((res.body as { status: string }).status).toBe('FINALIZED');
    });

    it('rejects recalculating a FINALIZED run', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/payroll/runs/${runId}/calculate`)
        .query({ companyId: companyA.id })
        .set('Cookie', [superCookie])
        .send();
      expect(res.status).toBe(422);
    });

    it('rejects re-finalizing an already-FINALIZED run (double-finalization prevention)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/payroll/runs/${runId}/finalize`)
        .query({ companyId: companyA.id })
        .set('Cookie', [superCookie])
        .send();
      expect(res.status).toBe(422);
    });

    it('rejects cancelling a FINALIZED run (immutability)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/payroll/runs/${runId}/cancel`)
        .query({ companyId: companyA.id })
        .set('Cookie', [superCookie])
        .send();
      expect(res.status).toBe(422);
    });

    it('cross-company isolation: a different company cannot read this payroll run', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/payroll/runs/${runId}`)
        .set('Cookie', [otherCompanyCookie])
        .query({ companyId: companyB.id });
      expect(res.status).toBe(404);
    });

    it('cross-company isolation: a different company cannot read this employee', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/employees/${employeeId}`)
        .set('Cookie', [otherCompanyCookie])
        .query({ companyId: companyB.id });
      expect(res.status).toBe(404);
    });
  });

  describe('RBAC — missing permission (403)', () => {
    it('a user with zero permissions cannot list payroll periods', async () => {
      const user = await createUser(
        `payroll-e2e-nopermission-${rand()}@example.com`,
      );
      const cookie = await loginAndGetCookie(user.email);

      const res = await request(app.getHttpServer())
        .get('/api/v1/payroll/periods')
        .set('Cookie', [cookie])
        .query({ companyId: companyA.id });

      expect(res.status).toBe(403);
      const body = res.body as ErrorBody;
      expect(body).toBeDefined();
    });
  });
});
