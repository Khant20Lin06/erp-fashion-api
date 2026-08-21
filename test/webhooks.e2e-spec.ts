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
import { createServer, Server, IncomingMessage, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import { createHmac } from 'crypto';
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
import { WEBHOOK_DISPATCH_CONSUMER_NAME } from '../src/modules/webhooks/consumers/webhook-dispatch.consumer';

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
interface WebhookSubscriptionCreatedBody {
  id: string;
  secret: string;
  url: string;
  events: string[];
  isActive: boolean;
}
interface WebhookDeliveryRow {
  id: string;
  webhook_subscription_id: string;
  event_id: string;
  event_type: string;
  status: string;
  attempt: number;
  response_status: number | null;
}
interface ReceivedRequest {
  rawBody: string;
  signature: string | null;
  parsed: { id: string; type: string; companyId: string };
}

/**
 * A real local HTTP receiver (not a mock of fetch/axios) that the webhook
 * worker delivers to over an actual TCP connection on localhost. Lets the
 * test toggle between succeeding (200) and failing (500) responses to
 * exercise the retry/exhaustion path for real.
 */
class TestWebhookReceiver {
  private server: Server;
  private _port = 0;
  received: ReceivedRequest[] = [];
  respondWithStatus = 200;

  async start(): Promise<void> {
    this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString('utf8');
        let parsed: ReceivedRequest['parsed'];
        try {
          parsed = JSON.parse(rawBody) as ReceivedRequest['parsed'];
        } catch {
          parsed = { id: '', type: '', companyId: '' };
        }
        this.received.push({
          rawBody,
          signature: (req.headers['x-webhook-signature'] as string) ?? null,
          parsed,
        });
        res.writeHead(this.respondWithStatus, {
          'Content-Type': 'application/json',
        });
        res.end(JSON.stringify({ received: true }));
      });
    });
    await new Promise<void>((resolve) => {
      this.server.listen(0, '127.0.0.1', () => resolve());
    });
    this._port = (this.server.address() as AddressInfo).port;
  }

  get url(): string {
    return `http://127.0.0.1:${this._port}/receive`;
  }

  reset(): void {
    this.received = [];
    this.respondWithStatus = 200;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

describeIfDb('Webhooks (Phase 23) (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let passwordService: PasswordService;
  let outboxPublisher: OutboxPublisherService;
  let receiver: TestWebhookReceiver;

  let superAdminUser: User;
  let plainUser: User;

  const password = 'correct-horse-battery-staple';
  const authCookieByEmail = new Map<string, string>();
  const prefix = 'WH-E2E';

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
        name: 'Webhooks E2E Test Company',
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
        name: 'Webhooks E2E Customer',
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

  async function driveOutboxUntilPublished(aggregateId: string): Promise<void> {
    let published = false;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await outboxPublisher.tick();
      const rows: { status: string }[] = await dataSource.query(
        'SELECT status FROM outbox_events WHERE aggregate_id = ?',
        [aggregateId],
      );
      if (rows[0]?.status === 'PUBLISHED') {
        published = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    expect(published).toBe(true);
  }

  async function waitForDeliveries(
    subscriptionId: string,
    predicate: (rows: WebhookDeliveryRow[]) => boolean,
    attempts = 30,
    intervalMs = 500,
  ): Promise<WebhookDeliveryRow[]> {
    let rows: WebhookDeliveryRow[] = [];
    for (let i = 0; i < attempts; i += 1) {
      rows = await dataSource.query(
        'SELECT id, webhook_subscription_id, event_id, event_type, status, attempt, response_status FROM webhook_deliveries WHERE webhook_subscription_id = ?',
        [subscriptionId],
      );
      if (predicate(rows)) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    return rows;
  }

  const cleanup = async () => {
    await dataSource.query(
      `DELETE FROM webhook_deliveries WHERE webhook_subscription_id IN (SELECT id FROM (SELECT id FROM webhook_subscriptions WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
    );
    await dataSource.query(
      `DELETE FROM webhook_subscriptions WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    // NotificationEventConsumer (a separate, pre-existing consumer) also
    // subscribes to erp.payment.events and writes its own `notifications`
    // row for every payment.confirmed event this suite triggers — must be
    // cleaned up before companies are deleted or the FK blocks it.
    await dataSource.query(
      `DELETE FROM notifications WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM processed_events WHERE consumer_name = '${WEBHOOK_DISPATCH_CONSUMER_NAME}' AND event_id IN (SELECT event_id FROM (SELECT event_id FROM outbox_events WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
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
      `DELETE FROM user_roles WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE 'wh-e2e-%') t)`,
    );
    await dataSource.query("DELETE FROM users WHERE email LIKE 'wh-e2e-%'");
  };

  beforeAll(async () => {
    receiver = new TestWebhookReceiver();
    await receiver.start();

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
        email: 'wh-e2e-superadmin@example.com',
        passwordHash: await passwordService.hash(password),
        firstName: 'Webhook',
        lastName: 'SuperAdmin',
        displayName: 'Webhook Super Admin',
        status: UserStatus.Active,
        isEmailVerified: true,
        lastLoginAt: null,
        passwordChangedAt: null,
      }),
    );
    plainUser = await userRepository.save(
      userRepository.create({
        email: 'wh-e2e-plain@example.com',
        passwordHash: await passwordService.hash(password),
        firstName: 'Webhook',
        lastName: 'Plain',
        displayName: 'Webhook Plain User',
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
    await receiver.stop();
  });

  describe('subscription CRUD + authorization boundary', () => {
    it('rejects unauthenticated requests (401)', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/v1/webhooks',
      );
      expect(response.status).toBe(401);
    });

    it('rejects an authenticated user without webhooks.create (403)', async () => {
      const cookie = await loginAndGetCookie(plainUser.email);
      const response = await request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('Cookie', [cookie])
        .send({ url: receiver.url, events: ['payment.confirmed'] });
      expect(response.status).toBe(403);
    });

    it('creates a subscription, returns the secret exactly once, and never again on GET', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const fixture = await setupWorkingFixture(cookie);

      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('Cookie', [cookie])
        .send({
          companyId: fixture.company.id,
          url: receiver.url,
          description: 'E2E test subscription',
          events: ['payment.confirmed'],
        });
      expect(createResponse.status).toBe(201);
      const created = createResponse.body as WebhookSubscriptionCreatedBody;
      expect(created.secret).toMatch(/^[0-9a-f]{64}$/);

      const getResponse = await request(app.getHttpServer())
        .get(`/api/v1/webhooks/${created.id}?companyId=${fixture.company.id}`)
        .set('Cookie', [cookie]);
      expect(getResponse.status).toBe(200);
      expect(getResponse.body).not.toHaveProperty('secret');

      const listResponse = await request(app.getHttpServer())
        .get(`/api/v1/webhooks?companyId=${fixture.company.id}`)
        .set('Cookie', [cookie]);
      expect(listResponse.status).toBe(200);
      const listBody = listResponse.body as { data: Record<string, unknown>[] };
      for (const row of listBody.data) {
        expect(row).not.toHaveProperty('secret');
      }
    });

    it("denies cross-company access to another company's webhook subscription (404, not 403 — never leaks existence)", async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const fixtureA = await setupWorkingFixture(cookie);
      const fixtureB = await setupWorkingFixture(cookie);

      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('Cookie', [cookie])
        .send({
          companyId: fixtureA.company.id,
          url: receiver.url,
          events: ['payment.confirmed'],
        });
      const created = createResponse.body as WebhookSubscriptionCreatedBody;

      const crossCompanyGet = await request(app.getHttpServer())
        .get(`/api/v1/webhooks/${created.id}?companyId=${fixtureB.company.id}`)
        .set('Cookie', [cookie]);
      expect(crossCompanyGet.status).toBe(404);
    });
  });

  describe('test-delivery endpoint', () => {
    it('sends a real signed HTTP POST to the receiver, writes no WebhookDelivery row', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const fixture = await setupWorkingFixture(cookie);
      receiver.reset();

      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('Cookie', [cookie])
        .send({
          companyId: fixture.company.id,
          url: receiver.url,
          events: ['payment.confirmed'],
        });
      const created = createResponse.body as WebhookSubscriptionCreatedBody;

      const testResponse = await request(app.getHttpServer())
        .post(
          `/api/v1/webhooks/${created.id}/test?companyId=${fixture.company.id}`,
        )
        .set('Cookie', [cookie]);
      expect(testResponse.status).toBe(200);

      expect(receiver.received).toHaveLength(1);
      const received = receiver.received[0];
      expect(received.parsed.type).toBe('webhook.test');
      const expectedSignature = createHmac('sha256', created.secret)
        .update(received.rawBody)
        .digest('hex');
      expect(received.signature).toBe(expectedSignature);

      const deliveryRows: WebhookDeliveryRow[] = await dataSource.query(
        'SELECT id FROM webhook_deliveries WHERE webhook_subscription_id = ?',
        [created.id],
      );
      expect(deliveryRows).toHaveLength(0);
    });
  });

  describe('end-to-end delivery pipeline: Outbox -> Kafka -> WebhookDispatchConsumer -> BullMQ -> WebhookDeliveryWorker -> DELIVERED', () => {
    it('a confirmed Payment produces a real, signed, verifiable HTTP delivery derived from the real event', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const fixture = await setupWorkingFixture(cookie);
      const { warehouseId, variantId } = await createCategoryBrandVariant(
        cookie,
        fixture.company.id,
      );
      receiver.reset();

      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('Cookie', [cookie])
        .send({
          companyId: fixture.company.id,
          url: receiver.url,
          events: ['payment.confirmed'],
        });
      const subscription =
        createResponse.body as WebhookSubscriptionCreatedBody;

      const sale = await createAndConfirmSale(
        cookie,
        fixture.company.id,
        fixture.customer.id,
        warehouseId,
        variantId,
      );
      const payment = await createPayment(cookie, fixture, sale.id, '25.00');
      expect(payment.id).toBeDefined();

      await driveOutboxUntilPublished(payment.id);

      const rows = await waitForDeliveries(subscription.id, (r) =>
        r.some((row) => row.status === 'DELIVERED'),
      );
      const delivered = rows.find((row) => row.status === 'DELIVERED');
      expect(delivered).toBeDefined();
      expect(delivered!.event_type).toBe('payment.confirmed');
      expect(delivered!.response_status).toBe(200);

      // Real receiver actually got one signed POST whose companyId/eventId
      // matches the real Payment/OutboxEvent, not fabricated data.
      expect(receiver.received.length).toBeGreaterThanOrEqual(1);
      const httpReceived = receiver.received[receiver.received.length - 1];
      expect(httpReceived.parsed.type).toBe('payment.confirmed');
      expect(httpReceived.parsed.companyId).toBe(fixture.company.id);
      expect(httpReceived.parsed.id).toBe(delivered!.event_id);
      const expectedSignature = createHmac('sha256', subscription.secret)
        .update(httpReceived.rawBody)
        .digest('hex');
      expect(httpReceived.signature).toBe(expectedSignature);

      // Delivery history is exposed via the API, scoped to this subscription.
      const historyResponse = await request(app.getHttpServer())
        .get(
          `/api/v1/webhooks/${subscription.id}/deliveries?companyId=${fixture.company.id}`,
        )
        .set('Cookie', [cookie]);
      expect(historyResponse.status).toBe(200);
      const historyBody = historyResponse.body as {
        data: { id: string; status: string }[];
      };
      expect(
        historyBody.data.some(
          (d) => d.id === delivered!.id && d.status === 'DELIVERED',
        ),
      ).toBe(true);
    }, 60000);

    it('an inactive subscription receives nothing for a new event', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const fixture = await setupWorkingFixture(cookie);
      const { warehouseId, variantId } = await createCategoryBrandVariant(
        cookie,
        fixture.company.id,
      );
      receiver.reset();

      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('Cookie', [cookie])
        .send({
          companyId: fixture.company.id,
          url: receiver.url,
          events: ['payment.confirmed'],
        });
      const subscription =
        createResponse.body as WebhookSubscriptionCreatedBody;

      await request(app.getHttpServer())
        .patch(
          `/api/v1/webhooks/${subscription.id}?companyId=${fixture.company.id}`,
        )
        .set('Cookie', [cookie])
        .send({ isActive: false });

      const sale = await createAndConfirmSale(
        cookie,
        fixture.company.id,
        fixture.customer.id,
        warehouseId,
        variantId,
      );
      const payment = await createPayment(cookie, fixture, sale.id, '25.00');
      await driveOutboxUntilPublished(payment.id);

      // Give the consumer/worker a real window to (not) act.
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const deliveryRows: WebhookDeliveryRow[] = await dataSource.query(
        'SELECT id FROM webhook_deliveries WHERE webhook_subscription_id = ?',
        [subscription.id],
      );
      expect(deliveryRows).toHaveLength(0);
      expect(receiver.received).toHaveLength(0);
    }, 30000);

    it('retries on receiver failure (500) and eventually marks FAILED once retries are exhausted, without affecting the source Payment', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const fixture = await setupWorkingFixture(cookie);
      const { warehouseId, variantId } = await createCategoryBrandVariant(
        cookie,
        fixture.company.id,
      );
      receiver.reset();
      receiver.respondWithStatus = 500;

      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('Cookie', [cookie])
        .send({
          companyId: fixture.company.id,
          url: receiver.url,
          events: ['payment.confirmed'],
        });
      const subscription =
        createResponse.body as WebhookSubscriptionCreatedBody;

      const sale = await createAndConfirmSale(
        cookie,
        fixture.company.id,
        fixture.customer.id,
        warehouseId,
        variantId,
      );
      const payment = await createPayment(cookie, fixture, sale.id, '25.00');
      await driveOutboxUntilPublished(payment.id);

      // First attempt: verify it lands as PENDING (not FAILED) after a 500,
      // proving BullMQ scheduled a retry rather than giving up immediately.
      const afterFirstAttempt = await waitForDeliveries(
        subscription.id,
        (r) => r.length > 0 && r[0].attempt >= 1,
      );
      expect(afterFirstAttempt).toHaveLength(1);
      expect(afterFirstAttempt[0].status).toBe('PENDING');
      expect(afterFirstAttempt[0].response_status).toBe(500);

      // The originating Payment is completely unaffected by the downstream
      // webhook failure — still CONFIRMED, never rolled back.
      const paymentRows: { status: string }[] = await dataSource.query(
        'SELECT status FROM payments WHERE id = ?',
        [payment.id],
      );
      expect(paymentRows[0].status).toBe('CONFIRMED');

      // Wait for BullMQ's bounded 5-attempt exponential backoff (base
      // 2000ms) to exhaust and the row to reach its final FAILED state.
      const final = await waitForDeliveries(
        subscription.id,
        (r) => r.length > 0 && r[0].status === 'FAILED',
        40,
        1500,
      );
      expect(final[0].status).toBe('FAILED');
      expect(final[0].attempt).toBe(5);

      // Confirm the Payment is still untouched after retry exhaustion too.
      const paymentRowsAfter: { status: string }[] = await dataSource.query(
        'SELECT status FROM payments WHERE id = ?',
        [payment.id],
      );
      expect(paymentRowsAfter[0].status).toBe('CONFIRMED');
    }, 90000);
  });
});
