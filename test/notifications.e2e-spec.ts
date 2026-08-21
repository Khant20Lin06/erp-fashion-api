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
import {
  OutboxPublisherService,
  OUTBOX_PUBLISHER_INTERVAL_NAME,
} from '../src/modules/outbox/services/outbox-publisher.service';
import { SchedulerRegistry } from '@nestjs/schedule';
import { KafkaProducerService } from '../src/modules/kafka/kafka-producer.service';
import { NOTIFICATION_CONSUMER_NAME } from '../src/modules/notifications/consumers/notification-event.consumer';
import { execSync } from 'child_process';

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
}
interface CustomerBody {
  id: string;
}
interface PaymentMethodBody {
  id: string;
}
interface AccountBody {
  id: string;
}
interface PaymentBody {
  id: string;
}
interface NotificationRow {
  id: string;
  company_id: string;
  status: string;
  source_event_id: string;
  event_type: string;
}

describeIfDb('Notifications (Phase 21) (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let passwordService: PasswordService;
  let outboxPublisher: OutboxPublisherService;
  let kafkaProducerService: KafkaProducerService;

  let superAdminUser: User;

  const password = 'correct-horse-battery-staple';
  const authCookieByEmail = new Map<string, string>();
  const prefix = 'NOTIF-E2E';

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
        name: 'Notifications E2E Test Company',
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
        name: 'Notifications E2E Customer',
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

  async function createPayment(
    cookie: string,
    fixture: Awaited<ReturnType<typeof setupWorkingFixture>>,
    saleId: string,
    amount: string,
  ): Promise<PaymentBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Cookie', [cookie])
      .send({
        companyId: fixture.company.id,
        branchId: fixture.branch.id,
        direction: 'RECEIPT',
        customerId: fixture.customer.id,
        paymentMethodId: fixture.paymentMethod.id,
        amount,
        currency: 'USD',
        allocations: [
          {
            referenceType: 'SALE',
            referenceId: saleId,
            allocatedAmount: amount,
          },
        ],
      });
    return response.body as PaymentBody;
  }

  async function countRows(sql: string, params: unknown[]): Promise<number> {
    const rows: Array<{ c: number | string }> = await dataSource.query(
      sql,
      params,
    );
    return Number(rows[0].c);
  }

  async function getNotificationsForCompany(
    companyId: string,
  ): Promise<NotificationRow[]> {
    return dataSource.query(
      'SELECT id, company_id, status, source_event_id, event_type FROM notifications WHERE company_id = ?',
      [companyId],
    );
  }

  const cleanup = async () => {
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
    await dataSource.query(`DELETE FROM products WHERE code LIKE '${prefix}%'`);
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
      `DELETE FROM user_roles WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE 'notif-e2e-%') t)`,
    );
    await dataSource.query("DELETE FROM users WHERE email LIKE 'notif-e2e-%'");
  };

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

    const schedulerRegistry = moduleFixture.get(SchedulerRegistry);
    schedulerRegistry.deleteInterval(OUTBOX_PUBLISHER_INTERVAL_NAME);

    await Promise.all(
      Array.from({ length: 10 }, () => dataSource.query('SELECT 1')),
    );

    await cleanup();

    const userRepository = dataSource.getRepository(User);
    const roleRepository = dataSource.getRepository(Role);
    const userRoleRepository = dataSource.getRepository(UserRole);

    superAdminUser = await userRepository.save(
      userRepository.create({
        email: 'notif-e2e-superadmin@example.com',
        passwordHash: await passwordService.hash(password),
        firstName: 'Notif',
        lastName: 'SuperAdmin',
        displayName: 'Notif Super Admin',
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
    await cleanup();
    await app.close();
  });

  describe('end-to-end pipeline: Kafka -> NotificationEventConsumer -> Notification row -> BullMQ -> NotificationWorker -> SENT', () => {
    it('a confirmed Payment eventually produces a SENT Notification row, and the API surfaces it', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const fixture = await setupWorkingFixture(cookie);
      const { warehouseId, variantId } = await createCategoryBrandVariant(
        cookie,
        fixture.company.id,
      );
      const sale = await createAndConfirmSale(
        cookie,
        fixture.company.id,
        fixture.customer.id,
        warehouseId,
        variantId,
      );
      const payment = await createPayment(cookie, fixture, sale.id, '25.00');
      expect(payment.id).toBeDefined();

      // Drive the outbox publisher explicitly (same pattern as
      // outbox.e2e-spec.ts) so the payment.confirmed event reaches Kafka
      // deterministically rather than waiting on the background timer.
      let published = false;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await outboxPublisher.tick();
        const rows: { status: string }[] = await dataSource.query(
          'SELECT status FROM outbox_events WHERE aggregate_id = ?',
          [payment.id],
        );
        if (rows[0]?.status === 'PUBLISHED') {
          published = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      expect(published).toBe(true);

      // Poll for the NotificationEventConsumer to create the row and the
      // NotificationWorker to process it through to SENT.
      let notification: NotificationRow | undefined;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const rows = await getNotificationsForCompany(fixture.company.id);
        notification = rows.find((r) => r.event_type === 'payment.confirmed');
        if (notification && notification.status === 'SENT') {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      expect(notification).toBeDefined();
      expect(notification!.status).toBe('SENT');

      // processed_events proves the notification consumer's own
      // idempotency bookkeeping ran, independent of the audit consumer's.
      const processedCount = await countRows(
        'SELECT COUNT(*) AS c FROM processed_events WHERE consumer_name = ? AND event_id = ?',
        [NOTIFICATION_CONSUMER_NAME, notification!.source_event_id],
      );
      expect(processedCount).toBe(1);

      // The read API surfaces it, DataScope-enforced, company-scoped.
      const listResponse = await request(app.getHttpServer())
        .get(`/api/v1/notifications?companyId=${fixture.company.id}`)
        .set('Cookie', [cookie]);
      expect(listResponse.status).toBe(200);
      const listBody = listResponse.body as {
        data: { id: string; status: string; readAt: string | null }[];
      };
      const found = listBody.data.find((n) => n.id === notification!.id);
      expect(found).toBeDefined();
      expect(found!.status).toBe('SENT');
      expect(found!.readAt).toBeNull();

      // PATCH :id/read sets readAt.
      const readResponse = await request(app.getHttpServer())
        .patch(
          `/api/v1/notifications/${notification!.id}/read?companyId=${fixture.company.id}`,
        )
        .set('Cookie', [cookie]);
      expect(readResponse.status).toBe(200);
      expect(
        (readResponse.body as { readAt: string | null }).readAt,
      ).not.toBeNull();
    }, 45000);
  });

  describe('API surface', () => {
    it('GET /notifications/:id returns 404 for a nonexistent id (never leaks existence across companies)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const fixture = await setupWorkingFixture(cookie);

      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/notifications/00000000-0000-0000-0000-000000000000?companyId=${fixture.company.id}`,
        )
        .set('Cookie', [cookie]);

      expect(response.status).toBe(404);
    });

    it('rejects unauthenticated requests', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/v1/notifications',
      );
      expect(response.status).toBe(401);
    });
  });

  describe('critical invariant: Payment creation is fully independent of Kafka/Redis/BullMQ availability', () => {
    /**
     * What this test actually does (documented per the task's explicit
     * instruction to document the exact simulation approach used):
     *
     *   - Kafka: simulated via jest.spyOn on the SINGLE SHARED
     *     KafkaProducerService instance this Nest test process holds
     *     (publish() rejects, isConnected() returns false). This is
     *     equivalent to Kafka being unreachable from this process's point
     *     of view without actually stopping the `kafka` docker container —
     *     stopping it would also break the already-joined consumer groups
     *     (PaymentEventConsumer, NotificationEventConsumer) for every OTHER
     *     currently-running e2e suite in this same `--runInBand` process,
     *     which is unsafe. Spying on the shared producer achieves the same
     *     "publish fails, connectivity probe reports down" condition this
     *     process would observe during a real outage.
     *   - Redis: the ACTUAL `fashion-erp-backend-redis-1` docker container
     *     is stopped for the duration of this one test via `docker stop`/
     *     `docker start` (shelled out via execSync), then restarted in a
     *     `finally` block. This is safe to do for real (unlike Kafka) because
     *     CacheService/QueueService both already degrade gracefully per
     *     Phase 19/20's own contract, and no other currently-running suite
     *     in this file depends on Redis being up mid-test. This is the
     *     REAL, not mocked, Redis-outage proof.
     *   - BullMQ: shares the same Redis instance (Phase 20 locked decision),
     *     so stopping Redis also makes BullMQ genuinely unreachable for the
     *     same window — no separate simulation needed.
     */
    it('a real Payment is created successfully (201) even when Kafka, Redis, and BullMQ are all unavailable', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const fixture = await setupWorkingFixture(cookie);
      const { warehouseId, variantId } = await createCategoryBrandVariant(
        cookie,
        fixture.company.id,
      );
      const sale = await createAndConfirmSale(
        cookie,
        fixture.company.id,
        fixture.customer.id,
        warehouseId,
        variantId,
      );

      const publishSpy = jest
        .spyOn(kafkaProducerService, 'publish')
        .mockRejectedValue(new Error('simulated: Kafka fully unreachable'));
      const isConnectedSpy = jest
        .spyOn(kafkaProducerService, 'isConnected')
        .mockResolvedValue(false);

      execSync('docker stop fashion-erp-backend-redis-1', {
        stdio: 'ignore',
      });

      try {
        // Give ioredis's own client a brief moment to notice the dropped
        // connection so the subsequent request genuinely exercises the
        // fail-fast/fallback path rather than racing a still-open socket.
        await new Promise((resolve) => setTimeout(resolve, 500));

        const response = await request(app.getHttpServer())
          .post('/api/v1/payments')
          .set('Cookie', [cookie])
          .send({
            companyId: fixture.company.id,
            branchId: fixture.branch.id,
            direction: 'RECEIPT',
            customerId: fixture.customer.id,
            paymentMethodId: fixture.paymentMethod.id,
            amount: '10.00',
            currency: 'USD',
            allocations: [
              {
                referenceType: 'SALE',
                referenceId: sale.id,
                allocatedAmount: '10.00',
              },
            ],
          });

        // The single most important assertion in this phase: Payment
        // creation succeeds normally regardless of Kafka/Redis/BullMQ
        // availability — Payment's own transaction has zero dependency on
        // any of Phase 19-21's infrastructure.
        expect(response.status).toBe(201);
        const payment = response.body as PaymentBody;
        expect(payment.id).toBeDefined();

        const paymentExists = await countRows(
          'SELECT COUNT(*) AS c FROM payments WHERE id = ? AND status = ?',
          [payment.id, 'CONFIRMED'],
        );
        expect(paymentExists).toBe(1);

        // The health endpoint reflects both as down without failing the
        // overall status — the "down must never fail a business operation"
        // contract holds at the health-check layer too, for real infra.
        const healthResponse = await request(app.getHttpServer()).get(
          '/api/v1/health',
        );
        expect(healthResponse.status).toBe(200);
        expect((healthResponse.body as { status: string }).status).toBe('ok');
        expect((healthResponse.body as { kafka: string }).kafka).toBe('down');
        expect((healthResponse.body as { redis: string }).redis).toBe('down');

        // Reading payment methods (a Phase 19 cached read) must also still
        // work correctly by falling through to MySQL — a Redis outage must
        // only make it slower, never fail it.
        const pmResponse = await request(app.getHttpServer())
          .get(`/api/v1/payment-methods?companyId=${fixture.company.id}`)
          .set('Cookie', [cookie]);
        expect(pmResponse.status).toBe(200);
      } finally {
        execSync('docker start fashion-erp-backend-redis-1', {
          stdio: 'ignore',
        });
        publishSpy.mockRestore();
        isConnectedSpy.mockRestore();
        // Give Redis a moment to come back up and this process's ioredis
        // client to reconnect before any subsequent test in this file runs.
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }, 45000);
  });
});
