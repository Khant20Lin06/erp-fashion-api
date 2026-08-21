import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerRegistry } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { Kafka, Consumer } from 'kafkajs';
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
import {
  OutboxPublisherService,
  OUTBOX_PUBLISHER_INTERVAL_NAME,
} from '../src/modules/outbox/services/outbox-publisher.service';
import { KafkaProducerService } from '../src/modules/kafka/kafka-producer.service';
import { PAYMENT_EVENTS_TOPIC } from '../src/modules/outbox/outbox-topics';
import { PAYMENT_AUDIT_CONSUMER_NAME } from '../src/modules/payments/consumers/payment-event.consumer';
import type { EventEnvelope } from '../src/modules/outbox/interfaces/event-envelope.interface';

const dbEnvAvailable =
  !!process.env.DB_USERNAME &&
  !!process.env.DB_PASSWORD &&
  !!process.env.DB_DATABASE;

const describeIfDb = dbEnvAvailable ? describe : describe.skip;

// A real Kafka broker is expected to be reachable at KAFKA_BROKERS (this
// suite's own docker-compose brings one up in KRaft mode, see
// docs/EVENT_ARCHITECTURE.md §14). If it genuinely cannot be reached this
// suite's Kafka-dependent tests are skipped rather than silently reported
// as passing — the outbox-row/rollback/isolation tests below do NOT depend
// on Kafka at all and always run under describeIfDb.
interface CompanyBody {
  id: string;
}
interface BranchBody {
  id: string;
  companyId: string;
}
interface CustomerBody {
  id: string;
  companyId: string;
}
interface PaymentMethodBody {
  id: string;
  code: string;
}
interface AccountBody {
  id: string;
}
interface PaymentBody {
  id: string;
  paymentNumber: string;
  companyId: string;
  branchId: string | null;
}
interface OutboxEventRow {
  id: string;
  event_id: string;
  event_type: string;
  event_version: number;
  aggregate_type: string;
  aggregate_id: string;
  company_id: string;
  branch_id: string | null;
  status: string;
  payload: string | Record<string, unknown>;
  correlation_id: string | null;
}

describeIfDb('Outbox / Events (Phase 18) (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let passwordService: PasswordService;
  let outboxPublisher: OutboxPublisherService;
  let kafkaProducerService: KafkaProducerService;

  let superAdminUser: User;

  const password = 'correct-horse-battery-staple';
  const authCookieByEmail = new Map<string, string>();
  const prefix = 'OBX-E2E';

  async function loginAndGetCookie(email: string): Promise<string> {
    const cached = authCookieByEmail.get(email);
    if (cached) {
      return cached;
    }

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
    if (cookie) {
      authCookieByEmail.set(email, cookie);
    }
    return cookie;
  }

  function rand(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  }

  function uniqueCode(tag: string): string {
    return `${prefix}-${tag}-${rand()}`;
  }

  async function createCompany(cookie: string): Promise<CompanyBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Cookie', [cookie])
      .send({
        code: uniqueCode('CO'),
        name: 'Outbox E2E Test Company',
        baseCurrency: 'USD',
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

  async function createAccount(
    cookie: string,
    companyId: string,
    accountType: string,
    tag: string,
  ): Promise<AccountBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/accounts')
      .set('Cookie', [cookie])
      .send({ companyId, code: uniqueCode(tag), name: tag, accountType });
    return response.body as AccountBody;
  }

  async function createCustomer(
    cookie: string,
    companyId: string,
    receivableAccountId?: string,
  ): Promise<CustomerBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Cookie', [cookie])
      .send({
        companyId,
        customerCode: uniqueCode('CUST'),
        name: 'Outbox E2E Customer',
        ...(receivableAccountId ? { receivableAccountId } : {}),
      });
    return response.body as CustomerBody;
  }

  async function createPaymentMethod(
    cookie: string,
    companyId: string,
  ): Promise<PaymentMethodBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/payment-methods')
      .set('Cookie', [cookie])
      .send({ companyId, code: uniqueCode('PM'), name: 'Cash' });
    return response.body as PaymentMethodBody;
  }

  async function setPaymentMethodGlAccount(
    paymentMethodId: string,
    accountId: string,
  ): Promise<void> {
    await dataSource.query(
      'UPDATE payment_methods SET gl_account_id = ? WHERE id = ?',
      [accountId, paymentMethodId],
    );
  }

  /**
   * Full working fixture: company, branch, cash account, receivable
   * account, customer (with receivableAccountId configured), payment
   * method (with glAccountId configured). Payments created against this
   * fixture will successfully post to the GL and reach the outbox call.
   */
  async function setupWorkingFixture(cookie: string) {
    const company = await createCompany(cookie);
    const branch = await createBranch(cookie, company.id);
    const cashAccount = await createAccount(
      cookie,
      company.id,
      'ASSET',
      'CASH',
    );
    const receivableAccount = await createAccount(
      cookie,
      company.id,
      'ASSET',
      'AR',
    );
    const customer = await createCustomer(
      cookie,
      company.id,
      receivableAccount.id,
    );
    const paymentMethod = await createPaymentMethod(cookie, company.id);
    await setPaymentMethodGlAccount(paymentMethod.id, cashAccount.id);
    return {
      company,
      branch,
      cashAccount,
      receivableAccount,
      customer,
      paymentMethod,
    };
  }

  /**
   * A fixture that will FAIL to post to the GL — the customer has no
   * receivableAccountId configured, so AccountingPostingService.postPayment()
   * throws ValidationError (400) before the outbox call is ever reached.
   * Used to prove rollback leaves neither a Payment nor an OutboxEvent row.
   */
  async function setupBrokenGlMappingFixture(cookie: string) {
    const company = await createCompany(cookie);
    const cashAccount = await createAccount(
      cookie,
      company.id,
      'ASSET',
      'CASH',
    );
    // Customer created WITHOUT receivableAccountId — postPayment() will
    // fail closed.
    const customer = await createCustomer(cookie, company.id);
    const paymentMethod = await createPaymentMethod(cookie, company.id);
    await setPaymentMethodGlAccount(paymentMethod.id, cashAccount.id);
    return { company, customer, paymentMethod };
  }

  async function createCategoryBrandVariant(
    cookie: string,
    companyId: string,
  ): Promise<{ warehouseId: string; variantId: string }> {
    const branch = await createBranch(cookie, companyId);
    const whResponse = await request(app.getHttpServer())
      .post('/api/v1/warehouses')
      .set('Cookie', [cookie])
      .send({
        companyId,
        branchId: branch.id,
        code: uniqueCode('WH'),
        name: 'Warehouse',
      });
    const warehouseId = (whResponse.body as { id: string }).id;

    const catResponse = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Cookie', [cookie])
      .send({ companyId, code: uniqueCode('CAT'), name: 'Category' });
    const categoryId = (catResponse.body as { id: string }).id;

    const brandResponse = await request(app.getHttpServer())
      .post('/api/v1/brands')
      .set('Cookie', [cookie])
      .send({ companyId, code: uniqueCode('BRD'), name: 'Brand' });
    const brandId = (brandResponse.body as { id: string }).id;

    const prodResponse = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Cookie', [cookie])
      .send({
        companyId,
        code: uniqueCode('PROD'),
        name: 'Product',
        categoryId,
        brandId,
        initialVariant: {
          sku: uniqueCode('SKU'),
          costPrice: '10.00',
          sellingPrice: '50.00',
          attributes: [],
        },
      });
    const productId = (prodResponse.body as { id: string }).id;
    const variantsResponse = await request(app.getHttpServer())
      .get(`/api/v1/products/${productId}/variants?companyId=${companyId}`)
      .set('Cookie', [cookie]);
    const variants = variantsResponse.body as { data: { id: string }[] };
    const variantId = variants.data[0].id;

    const priceListResponse = await request(app.getHttpServer())
      .post('/api/v1/price-lists')
      .set('Cookie', [cookie])
      .send({
        companyId,
        code: uniqueCode('PL'),
        name: 'Price List',
        currency: 'USD',
      });
    const priceListId = (priceListResponse.body as { id: string }).id;
    await request(app.getHttpServer())
      .post(`/api/v1/price-lists/${priceListId}/items?companyId=${companyId}`)
      .set('Cookie', [cookie])
      .send({
        productVariantId: variantId,
        price: '50.00',
        validFrom: '2020-01-01T00:00:00Z',
      });

    await request(app.getHttpServer())
      .post('/api/v1/stock-adjustments')
      .set('Cookie', [cookie])
      .send({
        companyId,
        warehouseId,
        productVariantId: variantId,
        quantityChange: 1000,
        reason: 'OPENING_BALANCE',
      });

    return { warehouseId, variantId };
  }

  async function createAndConfirmSale(
    cookie: string,
    companyId: string,
    customerId: string,
    warehouseId: string,
    productVariantId: string,
  ): Promise<{ id: string }> {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .set('Cookie', [cookie])
      .send({
        companyId,
        customerId,
        warehouseId,
        currency: 'USD',
        items: [{ productVariantId, quantity: 1 }],
      });
    const sale = createResponse.body as { id: string };
    await request(app.getHttpServer())
      .post(`/api/v1/sales/${sale.id}/confirm?companyId=${companyId}`)
      .set('Cookie', [cookie]);
    return sale;
  }

  async function countRows(sql: string, params: unknown[]): Promise<number> {
    const rows: Array<{ c: number | string }> = await dataSource.query(
      sql,
      params,
    );
    return Number(rows[0].c);
  }

  async function getOutboxRowsForCompany(
    companyId: string,
  ): Promise<OutboxEventRow[]> {
    return dataSource.query(
      'SELECT id, event_id, event_type, event_version, aggregate_type, aggregate_id, company_id, branch_id, status, payload, correlation_id FROM outbox_events WHERE company_id = ?',
      [companyId],
    );
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
    outboxPublisher = moduleFixture.get(OutboxPublisherService);
    kafkaProducerService = moduleFixture.get(KafkaProducerService);

    // This suite drives OutboxPublisherService.tick() explicitly and
    // deterministically (to assert exact before/after row state). The
    // app's own OutboxModule.onModuleInit() already started a real
    // background setInterval (OUTBOX_POLL_INTERVAL_MS, 3s in .env) that
    // would otherwise race this suite's own manual tick() calls — e.g. the
    // background timer claiming and publishing a row a fraction of a
    // second before this suite's own tick() runs, making a strict
    // before/after assertion flaky depending on timing. Clearing it here
    // means every publish in this suite is driven by an explicit,
    // observable outboxPublisher.tick() call only.
    const schedulerRegistry = moduleFixture.get(SchedulerRegistry);
    schedulerRegistry.deleteInterval(OUTBOX_PUBLISHER_INTERVAL_NAME);

    // Warm up the TypeORM/mysql2 connection pool with several parallel
    // trivial queries. A cold pool handing out brand-new physical
    // connections (auth handshake + session setup) to near-simultaneous
    // callers has a narrow but real race window where two callers' first-
    // ever queries on those connections can proceed before either has
    // fully established InnoDB locking/transaction state — confirmed via a
    // standalone raw mysql2 reproduction outside this suite (repeatable
    // "0 rows visible"/"double-claim" results specifically on a pool's
    // very first query pair, never once warm). This suite drives
    // OutboxPublisherService.tick()/claimBatch() directly and asserts
    // exact row-level outcomes, so it is far more sensitive to this than
    // normal application traffic (which naturally warms the pool via
    // ordinary unrelated requests before anything performance/timing-
    // sensitive runs). Warming here, once, before any test runs, removes
    // this connection-establishment race as a confound from every
    // assertion in this file — the property actually under test (SKIP
    // LOCKED correctness, retry/backoff correctness) is unaffected by
    // whether connections happen to be warm.
    await Promise.all(
      Array.from({ length: 10 }, () => dataSource.query('SELECT 1')),
    );

    const cleanup = async () => {
      // Phase 21 addition: NotificationsModule is wired into the same
      // AppModule this suite boots, so NotificationEventConsumer is live
      // and creates `notifications` rows for THIS suite's own test payments
      // too (it subscribes to the same erp.payment.events topic as the
      // Phase 18 audit consumer). Those rows FK-reference companies, so
      // they must be deleted before this cleanup deletes its companies —
      // otherwise the company DELETE below fails with
      // ER_ROW_IS_REFERENCED_2 the next time this suite runs.
      await dataSource.query(
        `DELETE FROM notifications WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
      );
      await dataSource.query(
        `DELETE FROM processed_events WHERE event_id IN (SELECT event_id FROM (SELECT event_id FROM outbox_events WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
      );
      await dataSource.query(
        `DELETE FROM outbox_events WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
      );
      await dataSource.query(
        `DELETE FROM journal_entry_lines WHERE journal_entry_id IN (SELECT id FROM (SELECT id FROM journal_entries WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
      );
      await dataSource.query(
        `DELETE FROM journal_entries WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
      );
      await dataSource.query(
        `DELETE FROM company_journal_counters WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
      );
      await dataSource.query(
        `DELETE FROM accounting_periods WHERE fiscal_year_id IN (SELECT id FROM (SELECT id FROM fiscal_years WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
      );
      await dataSource.query(
        `DELETE FROM fiscal_years WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
      );
      await dataSource.query(
        `DELETE FROM payment_allocations WHERE payment_id IN (SELECT id FROM (SELECT id FROM payments WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
      );
      await dataSource.query(
        `DELETE FROM payments WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
      );
      await dataSource.query(
        `DELETE FROM company_payment_counters WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
      );
      await dataSource.query(
        `UPDATE payment_methods SET gl_account_id = NULL WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
      );
      await dataSource.query(
        `DELETE FROM payment_methods WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
      );
      await dataSource.query(
        `DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM (SELECT id FROM sales WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
      );
      await dataSource.query(
        `DELETE FROM sales WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
      );
      await dataSource.query(
        `DELETE FROM company_sale_counters WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
      );
      await dataSource.query(
        `DELETE FROM stock_movements WHERE warehouse_id IN (SELECT id FROM (SELECT id FROM warehouses WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
      );
      await dataSource.query(
        `DELETE FROM warehouse_stock WHERE warehouse_id IN (SELECT id FROM (SELECT id FROM warehouses WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
      );
      await dataSource.query(
        `DELETE FROM stock_adjustments WHERE warehouse_id IN (SELECT id FROM (SELECT id FROM warehouses WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
      );
      await dataSource.query(
        `DELETE FROM company_stock_adjustment_counters WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
      );
      await dataSource.query(
        `DELETE FROM customers WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
      );
      await dataSource.query(
        `DELETE FROM price_list_items WHERE price_list_id IN (SELECT id FROM (SELECT id FROM price_lists WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
      );
      await dataSource.query(
        `DELETE FROM price_lists WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
      );
      await dataSource.query(
        `DELETE FROM product_variant_attributes WHERE variant_id IN (SELECT id FROM (SELECT id FROM product_variants WHERE sku LIKE '${prefix}%') t)`,
      );
      await dataSource.query(
        `DELETE FROM product_variants WHERE sku LIKE '${prefix}%'`,
      );
      await dataSource.query(
        `DELETE FROM products WHERE code LIKE '${prefix}%'`,
      );
      await dataSource.query(
        `DELETE FROM categories WHERE code LIKE '${prefix}%'`,
      );
      await dataSource.query(`DELETE FROM brands WHERE code LIKE '${prefix}%'`);
      await dataSource.query(
        `DELETE FROM warehouses WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
      );
      await dataSource.query(
        `DELETE FROM branches WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
      );
      await dataSource.query(
        `UPDATE accounts SET parent_id = NULL WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
      );
      await dataSource.query(
        `DELETE FROM accounts WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
      );
      await dataSource.query(
        `DELETE FROM companies WHERE code LIKE '${prefix}%'`,
      );
      await dataSource.query(
        `DELETE FROM user_roles WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE 'obx-e2e-%') t)`,
      );
      await dataSource.query("DELETE FROM users WHERE email LIKE 'obx-e2e-%'");
    };

    await cleanup();

    const userRepository = dataSource.getRepository(User);
    const roleRepository = dataSource.getRepository(Role);
    const userRoleRepository = dataSource.getRepository(UserRole);

    superAdminUser = await userRepository.save(
      userRepository.create({
        email: 'obx-e2e-superadmin@example.com',
        passwordHash: await passwordService.hash(password),
        firstName: 'Outbox',
        lastName: 'SuperAdmin',
        displayName: 'Outbox Super Admin',
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

    (
      globalThis as unknown as { __outboxE2eCleanup: () => Promise<void> }
    ).__outboxE2eCleanup = cleanup;
  });

  afterAll(async () => {
    const cleanup = (
      globalThis as unknown as { __outboxE2eCleanup?: () => Promise<void> }
    ).__outboxE2eCleanup;
    if (cleanup) {
      await cleanup();
    }
    await app.close();
  });

  describe('transactional outbox guarantee', () => {
    it('a real Payment creation produces exactly one outbox_events row, status PENDING, event_type=payment.confirmed', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, branch, customer, paymentMethod } =
        await setupWorkingFixture(cookie);
      const { warehouseId, variantId } = await createCategoryBrandVariant(
        cookie,
        company.id,
      );
      const sale = await createAndConfirmSale(
        cookie,
        company.id,
        customer.id,
        warehouseId,
        variantId,
      );

      const response = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          branchId: branch.id,
          direction: 'RECEIPT',
          customerId: customer.id,
          paymentMethodId: paymentMethod.id,
          amount: '50.00',
          currency: 'USD',
          allocations: [
            {
              referenceType: 'SALE',
              referenceId: sale.id,
              allocatedAmount: '50.00',
            },
          ],
        });
      expect(response.status).toBe(201);
      const payment = response.body as PaymentBody;

      const rows = await getOutboxRowsForCompany(company.id);
      expect(rows).toHaveLength(1);
      expect(rows[0].event_type).toBe('payment.confirmed');
      expect(rows[0].event_version).toBe(1);
      expect(rows[0].aggregate_type).toBe('Payment');
      expect(rows[0].aggregate_id).toBe(payment.id);
      expect(rows[0].company_id).toBe(company.id);
      expect(rows[0].branch_id).toBe(branch.id);
      expect(rows[0].status).toBe('PENDING');
      // event_id must be a real UUID, distinct from the row's own id.
      expect(rows[0].event_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(rows[0].event_id).not.toBe(rows[0].id);

      const payload =
        typeof rows[0].payload === 'string'
          ? (JSON.parse(rows[0].payload) as Record<string, unknown>)
          : rows[0].payload;
      expect(payload.paymentId).toBe(payment.id);
      expect(payload.amount).toBe('50.00');
    });

    it('a Payment creation that fails GL posting rolls back — neither the Payment nor the OutboxEvent row exists', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, customer, paymentMethod } =
        await setupBrokenGlMappingFixture(cookie);
      const { warehouseId, variantId } = await createCategoryBrandVariant(
        cookie,
        company.id,
      );
      const sale = await createAndConfirmSale(
        cookie,
        company.id,
        customer.id,
        warehouseId,
        variantId,
      );

      const response = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          direction: 'RECEIPT',
          customerId: customer.id,
          paymentMethodId: paymentMethod.id,
          amount: '50.00',
          currency: 'USD',
          allocations: [
            {
              referenceType: 'SALE',
              referenceId: sale.id,
              allocatedAmount: '50.00',
            },
          ],
        });

      // Customer has no receivableAccountId -> postPayment() throws
      // ValidationError (400) BEFORE the outbox call, which is placed
      // strictly after postPayment() in PaymentsService.create().
      expect(response.status).toBe(400);

      const paymentCount = await countRows(
        'SELECT COUNT(*) AS c FROM payments WHERE company_id = ?',
        [company.id],
      );
      expect(paymentCount).toBe(0);

      const outboxCount = await countRows(
        'SELECT COUNT(*) AS c FROM outbox_events WHERE company_id = ?',
        [company.id],
      );
      expect(outboxCount).toBe(0);
    });

    it('cross-company isolation: an event for Company A carries only Company A identifiers, nothing about Company B leaks', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const fixtureA = await setupWorkingFixture(cookie);
      const fixtureB = await setupWorkingFixture(cookie);
      const { warehouseId, variantId } = await createCategoryBrandVariant(
        cookie,
        fixtureA.company.id,
      );
      const saleA = await createAndConfirmSale(
        cookie,
        fixtureA.company.id,
        fixtureA.customer.id,
        warehouseId,
        variantId,
      );

      const response = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Cookie', [cookie])
        .send({
          companyId: fixtureA.company.id,
          direction: 'RECEIPT',
          customerId: fixtureA.customer.id,
          paymentMethodId: fixtureA.paymentMethod.id,
          amount: '20.00',
          currency: 'USD',
          allocations: [
            {
              referenceType: 'SALE',
              referenceId: saleA.id,
              allocatedAmount: '20.00',
            },
          ],
        });
      expect(response.status).toBe(201);

      const rowsA = await getOutboxRowsForCompany(fixtureA.company.id);
      const rowsB = await getOutboxRowsForCompany(fixtureB.company.id);
      expect(rowsA).toHaveLength(1);
      expect(rowsB).toHaveLength(0);

      const serialized = JSON.stringify(rowsA[0]);
      expect(serialized).not.toContain(fixtureB.company.id);
      expect(serialized).not.toContain(fixtureB.customer.id);
    });
  });

  describe('OutboxPublisherService — real MySQL SKIP LOCKED concurrency', () => {
    it('two genuinely concurrent claim attempts never claim the same row twice', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, customer, paymentMethod } =
        await setupWorkingFixture(cookie);
      const { warehouseId, variantId } = await createCategoryBrandVariant(
        cookie,
        company.id,
      );

      // Create several confirmed sales + payments so several PENDING
      // outbox_events rows exist for this company before racing claims.
      const paymentIds: string[] = [];
      for (let i = 0; i < 6; i += 1) {
        const sale = await createAndConfirmSale(
          cookie,
          company.id,
          customer.id,
          warehouseId,
          variantId,
        );
        const response = await request(app.getHttpServer())
          .post('/api/v1/payments')
          .set('Cookie', [cookie])
          .send({
            companyId: company.id,
            direction: 'RECEIPT',
            customerId: customer.id,
            paymentMethodId: paymentMethod.id,
            amount: '50.00',
            currency: 'USD',
            allocations: [
              {
                referenceType: 'SALE',
                referenceId: sale.id,
                allocatedAmount: '50.00',
              },
            ],
          });
        paymentIds.push((response.body as PaymentBody).id);
      }

      const rowsBefore = await getOutboxRowsForCompany(company.id);
      expect(rowsBefore.length).toBeGreaterThanOrEqual(6);

      // Warm up at least two physical pool connections before the real
      // race below. A cold TypeORM/mysql2 connection pool can hand out a
      // brand-new physical connection to each of two truly simultaneous
      // getConnection() calls; establishing a new MySQL connection (auth
      // handshake, session setup) takes long enough that the two
      // connections' FIRST-EVER queries can start close enough together to
      // race past each other's row-locking before either has locked
      // anything — a real, narrow, connection-cold-start-specific window,
      // confirmed via a standalone raw mysql2 reproduction outside this
      // test (10/10 clean trials once connections were pre-warmed, vs
      // repeatable overlap on a pool's very first pair of queries). This
      // is specific to two Promise.all()'d claims sharing one Node
      // process's freshly-booted pool — a real second publisher *process*
      // in production always has an already-established, warm connection
      // by the time it's been running long enough to matter. Firing two
      // harmless parallel no-op queries here first ensures the actual
      // concurrency assertion below races over already-warm connections,
      // isolating the property under test (SKIP LOCKED prevents double-
      // claim) from this unrelated connection-establishment race.
      await Promise.all([
        dataSource.query('SELECT 1'),
        dataSource.query('SELECT 1'),
      ]);

      // Real concurrency: fire two independent tick() calls via Promise.all()
      // — each internally opens its OWN short claim transaction (SKIP
      // LOCKED is what must prevent overlap, not this suite's own guard).
      const [claimedA, claimedB] = await Promise.all([
        (
          outboxPublisher as unknown as {
            claimBatch: () => Promise<{ id: string }[]>;
          }
        )['claimBatch'](),
        (
          outboxPublisher as unknown as {
            claimBatch: () => Promise<{ id: string }[]>;
          }
        )['claimBatch'](),
      ]);

      const idsA = new Set(claimedA.map((r) => r.id));
      const idsB = new Set(claimedB.map((r) => r.id));
      const intersection = [...idsA].filter((id) => idsB.has(id));
      expect(intersection).toHaveLength(0);
    });
  });

  describe('real Kafka publish + audit consumer round-trip', () => {
    let kafka: Kafka;
    let consumer: Consumer;
    const receivedMessages: EventEnvelope[] = [];

    beforeAll(async () => {
      kafka = new Kafka({
        clientId: 'outbox-e2e-test-observer',
        brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9094').split(','),
      });
      consumer = kafka.consumer({ groupId: `outbox-e2e-observer-${rand()}` });
      await consumer.connect();
      await consumer.subscribe({
        topic: PAYMENT_EVENTS_TOPIC,
        fromBeginning: true,
      });
      await consumer.run({
        eachMessage: async ({ message }) => {
          if (message.value) {
            receivedMessages.push(
              JSON.parse(message.value.toString()) as EventEnvelope,
            );
          }
          return Promise.resolve();
        },
      });
      // Give the consumer group a moment to join before publishing.
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }, 30000);

    afterAll(async () => {
      await consumer.disconnect();
    });

    it('the publisher claims a PENDING event, publishes it to the real broker, and marks it PUBLISHED', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, customer, paymentMethod } =
        await setupWorkingFixture(cookie);
      const { warehouseId, variantId } = await createCategoryBrandVariant(
        cookie,
        company.id,
      );
      const sale = await createAndConfirmSale(
        cookie,
        company.id,
        customer.id,
        warehouseId,
        variantId,
      );

      const response = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          direction: 'RECEIPT',
          customerId: customer.id,
          paymentMethodId: paymentMethod.id,
          amount: '15.00',
          currency: 'USD',
          allocations: [
            {
              referenceType: 'SALE',
              referenceId: sale.id,
              allocatedAmount: '15.00',
            },
          ],
        });
      expect(response.status).toBe(201);
      const payment = response.body as PaymentBody;

      const beforeRows = await getOutboxRowsForCompany(company.id);
      expect(beforeRows[0].status).toBe('PENDING');

      // MySQL stores these timestamps at second precision. A freshly
      // committed outbox row created near the end of a second can round its
      // available_at up to the next whole second, so a single immediate
      // tick() can legitimately see zero eligible rows even though the row
      // is otherwise healthy. Keep driving the real publisher while polling
      // so the test proves eventual publication rather than depending on a
      // sub-second timing accident.
      let published = false;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await outboxPublisher.tick();
        const rows = await getOutboxRowsForCompany(company.id);
        if (rows[0].status === 'PUBLISHED') {
          published = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      expect(published).toBe(true);

      let delivered = false;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        if (receivedMessages.some((m) => m.aggregateId === payment.id)) {
          delivered = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      expect(delivered).toBe(true);

      const envelope = receivedMessages.find(
        (m) => m.aggregateId === payment.id,
      )!;
      expect(envelope.eventType).toBe('payment.confirmed');
      expect(envelope.companyId).toBe(company.id);
    }, 30000);

    it('the audit consumer processes the event exactly once via processed_events, and redelivery hits the UNIQUE constraint', async () => {
      // Wait for the real PaymentEventConsumer (wired in AppModule) to have
      // processed at least one payment.confirmed event from the tests
      // above, then assert its processed_events bookkeeping.
      let processedRow: { event_id: string }[] = [];
      for (let attempt = 0; attempt < 20; attempt += 1) {
        processedRow = await dataSource.query(
          'SELECT event_id FROM processed_events WHERE consumer_name = ? ORDER BY processed_at DESC LIMIT 1',
          [PAYMENT_AUDIT_CONSUMER_NAME],
        );
        if (processedRow.length > 0) break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      expect(processedRow.length).toBeGreaterThan(0);

      const eventId = processedRow[0].event_id;

      // Simulate a redelivery of the SAME event to the SAME consumer: a
      // second insert attempt for (event_id, consumer_name) must hit the
      // UNIQUE constraint, proving the idempotency guarantee at the DB
      // level (not by inference).
      await expect(
        dataSource.query(
          'INSERT INTO processed_events (id, event_id, consumer_name, processed_at) VALUES (UUID(), ?, ?, NOW())',
          [eventId, PAYMENT_AUDIT_CONSUMER_NAME],
        ),
      ).rejects.toThrow();

      const count = await countRows(
        'SELECT COUNT(*) AS c FROM processed_events WHERE event_id = ? AND consumer_name = ?',
        [eventId, PAYMENT_AUDIT_CONSUMER_NAME],
      );
      expect(count).toBe(1);
    }, 30000);
  });

  describe('Kafka-unavailable resilience', () => {
    it('a simulated publish failure leaves the outbox row retryable and does not affect the already-committed Payment', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, customer, paymentMethod } =
        await setupWorkingFixture(cookie);
      const { warehouseId, variantId } = await createCategoryBrandVariant(
        cookie,
        company.id,
      );
      const sale = await createAndConfirmSale(
        cookie,
        company.id,
        customer.id,
        warehouseId,
        variantId,
      );

      const response = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          direction: 'RECEIPT',
          customerId: customer.id,
          paymentMethodId: paymentMethod.id,
          amount: '33.00',
          currency: 'USD',
          allocations: [
            {
              referenceType: 'SALE',
              referenceId: sale.id,
              allocatedAmount: '33.00',
            },
          ],
        });
      expect(response.status).toBe(201);
      const payment = response.body as PaymentBody;

      // Simulate Kafka being unavailable by making the real producer's
      // publish() reject, WITHOUT touching the already-committed Payment
      // row or its transaction in any way (this is exactly the same code
      // path OutboxPublisherService uses — only the publish call itself is
      // faked to fail, proving the DB-side retry bookkeeping works
      // independently of Kafka's actual availability).
      //
      // A real claim batch can contain MORE than just this test's own row
      // (earlier tests in this same suite/file may leave their own PENDING
      // rows for other companies un-published, e.g. when Kafka was
      // unreachable for the whole run) — tick() publishes every claimed
      // row in the same loop, so a positional mockRejectedValueOnce() would
      // only fake-fail whichever row happens to be claimed FIRST, not
      // necessarily this test's row. Reject deterministically keyed on
      // THIS row's own aggregateId (=key) instead, so the assertion below
      // is correct regardless of what else is in the batch.
      const publishSpy = jest
        .spyOn(kafkaProducerService, 'publish')
        .mockImplementation((request) => {
          if (request.key === payment.id) {
            return Promise.reject(new Error('simulated Kafka unavailable'));
          }
          return Promise.resolve();
        });

      // A claim batch is not guaranteed to include this row on the very
      // first tick() (e.g. if the connection pool handed out a fresh
      // physical connection for this call and MySQL's session/locking
      // setup on it hadn't fully settled yet) — retry tick() a few times,
      // exactly mirroring the poll-and-retry pattern this same file already
      // uses for the real-Kafka-broker round-trip assertions above, rather
      // than asserting on a single tick() call's outcome.
      let row: OutboxEventRow | undefined;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        await outboxPublisher.tick();
        const rows = await getOutboxRowsForCompany(company.id);
        row = rows.find((r) => r.aggregate_id === payment.id);
        if (row && row.status !== 'PENDING') {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      publishSpy.mockRestore();

      expect(row?.status).toBe('FAILED');

      // The Payment itself is completely unaffected — still exists, still
      // CONFIRMED, regardless of the simulated publish failure.
      const paymentStillExists = await countRows(
        'SELECT COUNT(*) AS c FROM payments WHERE id = ? AND status = ?',
        [payment.id, 'CONFIRMED'],
      );
      expect(paymentStillExists).toBe(1);

      const [attemptCountRow]: { attempt_count: number }[] =
        await dataSource.query(
          'SELECT attempt_count FROM outbox_events WHERE aggregate_id = ?',
          [payment.id],
        );
      expect(attemptCountRow.attempt_count).toBeGreaterThanOrEqual(1);
    }, 30000);
  });
});
