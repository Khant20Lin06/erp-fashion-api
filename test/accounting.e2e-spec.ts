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
interface CustomerBody {
  id: string;
  companyId: string;
}
interface SupplierBody {
  id: string;
  companyId: string;
}
interface PaymentMethodBody {
  id: string;
  code: string;
}
interface AccountBody {
  id: string;
  code: string;
  accountType: string;
  parentId: string | null;
  isActive: boolean;
}
interface JournalEntryLineBody {
  id: string;
  accountId: string;
  debitAmount: string;
  creditAmount: string;
}
interface JournalEntryBody {
  id: string;
  journalNumber: string;
  status: string;
  sourceType: string | null;
  sourceId: string | null;
  totalDebit: string;
  totalCredit: string;
  lines?: JournalEntryLineBody[];
}
interface SaleBody {
  id: string;
  status: string;
  paidAmount: string;
}
interface PaymentBody {
  id: string;
  paymentNumber: string;
}

describeIfDb('Accounting (Phase 17) (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let passwordService: PasswordService;

  let superAdminUser: User;
  let plainUser: User;

  const password = 'correct-horse-battery-staple';
  const prefix = 'ACC-E2E';

  async function loginAndGetCookie(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password });
    const setCookie = response.headers['set-cookie'] as
      string[] | string | undefined;
    const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    return String(cookieHeader).split(';')[0];
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
        name: 'Accounting E2E Test Company',
        baseCurrency: 'USD',
        timezone: 'Asia/Yangon',
      });
    return response.body as CompanyBody;
  }

  async function createAccount(
    cookie: string,
    companyId: string,
    accountType: string,
    parentId?: string,
  ): Promise<AccountBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/accounts')
      .set('Cookie', [cookie])
      .send({
        companyId,
        code: uniqueCode('ACCT'),
        name: `Account ${accountType}`,
        accountType,
        ...(parentId ? { parentId } : {}),
      });
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
        name: 'Accounting E2E Customer',
        ...(receivableAccountId ? { receivableAccountId } : {}),
      });
    return response.body as CustomerBody;
  }

  async function createSupplier(
    cookie: string,
    companyId: string,
    payableAccountId?: string,
  ): Promise<SupplierBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/suppliers')
      .set('Cookie', [cookie])
      .send({
        companyId,
        supplierCode: uniqueCode('SUP'),
        name: 'Accounting E2E Supplier',
        ...(payableAccountId ? { payableAccountId } : {}),
      });
    return response.body as SupplierBody;
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

  /** Directly sets payment_methods.gl_account_id — no PATCH endpoint exists for PaymentMethod (D14, LOCKED minimal scope). */
  async function setPaymentMethodGlAccount(
    paymentMethodId: string,
    accountId: string | null,
  ): Promise<void> {
    await dataSource.query(
      'UPDATE payment_methods SET gl_account_id = ? WHERE id = ?',
      [accountId, paymentMethodId],
    );
  }

  async function createBranch(cookie: string, companyId: string) {
    const code = uniqueCode('BR');
    const response = await request(app.getHttpServer())
      .post('/api/v1/branches')
      .set('Cookie', [cookie])
      .send({ companyId, code, name: `Branch ${code}` });
    return response.body as { id: string; companyId: string };
  }

  async function createWarehouse(
    cookie: string,
    companyId: string,
    branchId: string,
  ) {
    const code = uniqueCode('WH');
    const response = await request(app.getHttpServer())
      .post('/api/v1/warehouses')
      .set('Cookie', [cookie])
      .send({ companyId, branchId, code, name: `Warehouse ${code}` });
    return response.body as { id: string; companyId: string; branchId: string };
  }

  async function createCategory(cookie: string, companyId: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Cookie', [cookie])
      .send({ companyId, code: uniqueCode('CAT'), name: 'T-Shirts' });
    return response.body as { id: string };
  }

  async function createBrand(cookie: string, companyId: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/brands')
      .set('Cookie', [cookie])
      .send({ companyId, code: uniqueCode('BRD'), name: 'Nike' });
    return response.body as { id: string };
  }

  async function createProductVariant(
    cookie: string,
    companyId: string,
    categoryId: string,
    brandId: string,
  ) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Cookie', [cookie])
      .send({
        companyId,
        code: uniqueCode('PROD'),
        name: 'Classic T-Shirt',
        categoryId,
        brandId,
        initialVariant: {
          sku: uniqueCode('SKU'),
          costPrice: '10.00',
          sellingPrice: '20.00',
          attributes: [],
        },
      });
    const productId = (response.body as { id: string }).id;
    const variantsResponse = await request(app.getHttpServer())
      .get(`/api/v1/products/${productId}/variants?companyId=${companyId}`)
      .set('Cookie', [cookie]);
    const variants = variantsResponse.body as {
      data: Array<{ id: string; sku: string }>;
    };
    return variants.data[0];
  }

  async function createPriceList(cookie: string, companyId: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/price-lists')
      .set('Cookie', [cookie])
      .send({
        companyId,
        code: uniqueCode('PL'),
        name: 'Retail Price List',
        currency: 'USD',
      });
    return response.body as { id: string };
  }

  async function seedOpeningStock(
    cookie: string,
    companyId: string,
    warehouseId: string,
    productVariantId: string,
    quantity: number,
  ): Promise<void> {
    await request(app.getHttpServer())
      .post('/api/v1/stock-adjustments')
      .set('Cookie', [cookie])
      .send({
        companyId,
        warehouseId,
        productVariantId,
        quantityChange: quantity,
        reason: 'OPENING_BALANCE',
      });
  }

  async function createAndConfirmSale(
    cookie: string,
    companyId: string,
    customerId: string,
    warehouseId: string,
    productVariantId: string,
    quantity: number,
  ): Promise<SaleBody> {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .set('Cookie', [cookie])
      .send({
        companyId,
        customerId,
        warehouseId,
        currency: 'USD',
        items: [{ productVariantId, quantity }],
      });
    const sale = createResponse.body as SaleBody & { id: string };
    const confirmResponse = await request(app.getHttpServer())
      .post(`/api/v1/sales/${sale.id}/confirm?companyId=${companyId}`)
      .set('Cookie', [cookie]);
    return confirmResponse.body as SaleBody;
  }

  /** Full setup: company + a receivable/payable/cash chart of accounts + customer/supplier/payment method all pre-wired for a real Payment->GL flow. */
  async function setupPaymentPostingFixture(cookie: string) {
    const company = await createCompany(cookie);
    const branch = await createBranch(cookie, company.id);
    const warehouse = await createWarehouse(cookie, company.id, branch.id);
    const category = await createCategory(cookie, company.id);
    const brand = await createBrand(cookie, company.id);
    const variant = await createProductVariant(
      cookie,
      company.id,
      category.id,
      brand.id,
    );
    const priceList = await createPriceList(cookie, company.id);
    await request(app.getHttpServer())
      .post(`/api/v1/price-lists/${priceList.id}/items?companyId=${company.id}`)
      .set('Cookie', [cookie])
      .send({
        productVariantId: variant.id,
        price: '100.00',
        validFrom: '2020-01-01T00:00:00Z',
      });
    await seedOpeningStock(cookie, company.id, warehouse.id, variant.id, 1000);

    const cashAccount = await createAccount(cookie, company.id, 'ASSET');
    const receivableAccount = await createAccount(cookie, company.id, 'ASSET');
    const payableAccount = await createAccount(cookie, company.id, 'LIABILITY');

    const customer = await createCustomer(
      cookie,
      company.id,
      receivableAccount.id,
    );
    const supplier = await createSupplier(
      cookie,
      company.id,
      payableAccount.id,
    );
    const paymentMethod = await createPaymentMethod(cookie, company.id);
    await setPaymentMethodGlAccount(paymentMethod.id, cashAccount.id);

    return {
      company,
      branch,
      warehouse,
      variant,
      cashAccount,
      receivableAccount,
      payableAccount,
      customer,
      supplier,
      paymentMethod,
    };
  }

  async function countRows(sql: string, params: unknown[]): Promise<number> {
    const rows: Array<{ c: number | string }> = await dataSource.query(
      sql,
      params,
    );
    return Number(rows[0].c);
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

    const cleanup = async () => {
      // Phase 18 addition: every real POST /payments call in this suite's
      // "Payment -> GL automatic posting" describe block now also creates
      // an outbox_events row (payment.confirmed, same transaction) — clean
      // those (and any processed_events rows a consumer may have recorded
      // for them) up before the companies rows outbox_events.company_id
      // FKs to.
      //
      // Phase 21 addition: NotificationsModule is wired into the same
      // AppModule this suite boots, so NotificationEventConsumer is also
      // live and creates `notifications` rows for these same payments
      // (it independently subscribes to erp.payment.events). Those rows FK
      // to companies too, so they must be deleted before the companies
      // delete below.
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
        `DELETE FROM goods_receipt_items WHERE goods_receipt_id IN (SELECT id FROM (SELECT id FROM goods_receipts WHERE purchase_order_id IN (SELECT id FROM (SELECT id FROM purchase_orders WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t2)) t)`,
      );
      await dataSource.query(
        `DELETE FROM goods_receipts WHERE purchase_order_id IN (SELECT id FROM (SELECT id FROM purchase_orders WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
      );
      await dataSource.query(
        `DELETE FROM company_goods_receipt_counters WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
      );
      await dataSource.query(
        `DELETE FROM purchase_order_items WHERE purchase_order_id IN (SELECT id FROM (SELECT id FROM purchase_orders WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
      );
      await dataSource.query(
        `DELETE FROM purchase_orders WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
      );
      await dataSource.query(
        `DELETE FROM company_purchase_counters WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
      );
      await dataSource.query(
        `DELETE FROM stock_adjustments WHERE warehouse_id IN (SELECT id FROM (SELECT id FROM warehouses WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
      );
      await dataSource.query(
        `DELETE FROM company_stock_adjustment_counters WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
      );
      await dataSource.query(
        `DELETE FROM stock_movements WHERE warehouse_id IN (SELECT id FROM (SELECT id FROM warehouses WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
      );
      await dataSource.query(
        `DELETE FROM warehouse_stock WHERE warehouse_id IN (SELECT id FROM (SELECT id FROM warehouses WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
      );
      await dataSource.query(
        `DELETE FROM customers WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
      );
      await dataSource.query(
        `DELETE FROM suppliers WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
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
      // Self-referencing accounts.parent_id must be cleared before deleting
      // accounts rows themselves — the same "clear self-referencing FK
      // before bulk delete" fix Phase 09 first found for
      // categories.parent_id (RESTRICT rejects the bulk delete otherwise
      // if a leftover parent/child pair exists from a previously
      // interrupted run). payment_methods.gl_account_id -> accounts is not
      // a concern here since payment_methods rows for this prefix are
      // already deleted above, before this point.
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
        `DELETE FROM user_roles WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE 'acc-e2e-%') t)`,
      );
      await dataSource.query("DELETE FROM users WHERE email LIKE 'acc-e2e-%'");
    };

    await cleanup();

    const userRepository = dataSource.getRepository(User);
    const roleRepository = dataSource.getRepository(Role);
    const userRoleRepository = dataSource.getRepository(UserRole);

    superAdminUser = await userRepository.save(
      userRepository.create({
        email: 'acc-e2e-superadmin@example.com',
        passwordHash: await passwordService.hash(password),
        firstName: 'Accounting',
        lastName: 'SuperAdmin',
        displayName: 'Accounting Super Admin',
        status: UserStatus.Active,
        isEmailVerified: true,
        lastLoginAt: null,
        passwordChangedAt: null,
      }),
    );

    plainUser = await userRepository.save(
      userRepository.create({
        email: 'acc-e2e-plain@example.com',
        passwordHash: await passwordService.hash(password),
        firstName: 'Accounting',
        lastName: 'Plain',
        displayName: 'Accounting Plain User',
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
      globalThis as unknown as { __accountingE2eCleanup: () => Promise<void> }
    ).__accountingE2eCleanup = cleanup;
  });

  afterAll(async () => {
    const cleanup = (
      globalThis as unknown as { __accountingE2eCleanup?: () => Promise<void> }
    ).__accountingE2eCleanup;
    if (cleanup) {
      await cleanup();
    }
    await app.close();
  });

  describe('authentication and permission boundaries', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/v1/accounts',
      );
      expect(response.status).toBe(401);
    });

    it('rejects an authenticated user with no accounts.read permission (403)', async () => {
      const cookie = await loginAndGetCookie(plainUser.email);
      const response = await request(app.getHttpServer())
        .get('/api/v1/accounts')
        .set('Cookie', [cookie]);
      expect(response.status).toBe(403);
    });
  });

  describe('Account API (D22, D4)', () => {
    it('creates a top-level account and a child account, listing/detailing both', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);

      const parent = await createAccount(cookie, company.id, 'ASSET');
      expect(parent.accountType).toBe('ASSET');

      const child = await createAccount(cookie, company.id, 'ASSET', parent.id);
      expect(child.parentId).toBe(parent.id);

      const listResponse = await request(app.getHttpServer())
        .get(`/api/v1/accounts?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      expect(listResponse.status).toBe(200);
      const list = listResponse.body as { data: AccountBody[] };
      expect(list.data.some((a) => a.id === parent.id)).toBe(true);
      expect(list.data.some((a) => a.id === child.id)).toBe(true);

      const detailResponse = await request(app.getHttpServer())
        .get(`/api/v1/accounts/${child.id}?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      expect(detailResponse.status).toBe(200);
    });

    it('rejects a duplicate account code within the same company (409)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const code = uniqueCode('DUP');

      await request(app.getHttpServer())
        .post('/api/v1/accounts')
        .set('Cookie', [cookie])
        .send({ companyId: company.id, code, name: 'A', accountType: 'ASSET' });

      const dupResponse = await request(app.getHttpServer())
        .post('/api/v1/accounts')
        .set('Cookie', [cookie])
        .send({ companyId: company.id, code, name: 'B', accountType: 'ASSET' });

      expect(dupResponse.status).toBe(409);
    });

    it('rejects circular account hierarchy via PATCH (A -> B -> C, then C -> A)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);

      const a = await createAccount(cookie, company.id, 'ASSET');
      const b = await createAccount(cookie, company.id, 'ASSET', a.id);
      const c = await createAccount(cookie, company.id, 'ASSET', b.id);

      const cycleResponse = await request(app.getHttpServer())
        .patch(`/api/v1/accounts/${a.id}?companyId=${company.id}`)
        .set('Cookie', [cookie])
        .send({ parentId: c.id });

      expect(cycleResponse.status).toBe(400);
    });

    it('cross-company account lookup returns 404 (IDOR-safe)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const companyA = await createCompany(cookie);
      const companyB = await createCompany(cookie);
      const account = await createAccount(cookie, companyA.id, 'ASSET');

      const response = await request(app.getHttpServer())
        .get(`/api/v1/accounts/${account.id}?companyId=${companyB.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(404);
    });

    it('deactivates an account via PATCH isActive (no delete endpoint exists)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const account = await createAccount(cookie, company.id, 'EXPENSE');

      const patchResponse = await request(app.getHttpServer())
        .patch(`/api/v1/accounts/${account.id}?companyId=${company.id}`)
        .set('Cookie', [cookie])
        .send({ isActive: false });

      expect(patchResponse.status).toBe(200);
      expect((patchResponse.body as AccountBody).isActive).toBe(false);

      const deleteResponse = await request(app.getHttpServer())
        .delete(`/api/v1/accounts/${account.id}?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      expect([404, 405]).toContain(deleteResponse.status);
    });
  });

  describe('Manual Journal Entry API (D12)', () => {
    it('creates a DRAFT journal entry, then posts it (DRAFT -> POSTED, balance validated)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const debitAccount = await createAccount(cookie, company.id, 'ASSET');
      const creditAccount = await createAccount(cookie, company.id, 'EQUITY');

      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/journal-entries')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          description: 'Manual opening entry',
          lines: [
            {
              accountId: debitAccount.id,
              debitAmount: '500.00',
              creditAmount: '0.00',
            },
            {
              accountId: creditAccount.id,
              debitAmount: '0.00',
              creditAmount: '500.00',
            },
          ],
        });

      expect(createResponse.status).toBe(201);
      const draft = createResponse.body as JournalEntryBody;
      expect(draft.status).toBe('DRAFT');
      expect(draft.sourceType).toBe('MANUAL');

      const postResponse = await request(app.getHttpServer())
        .post(
          `/api/v1/journal-entries/${draft.id}/post?companyId=${company.id}`,
        )
        .set('Cookie', [cookie]);

      expect(postResponse.status).toBe(200);
      const posted = postResponse.body as JournalEntryBody;
      expect(posted.status).toBe('POSTED');
      expect(posted.totalDebit).toBe('500.00');
      expect(posted.totalCredit).toBe('500.00');
    });

    it('rejects posting an unbalanced journal entry', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const debitAccount = await createAccount(cookie, company.id, 'ASSET');
      const creditAccount = await createAccount(cookie, company.id, 'EQUITY');

      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/journal-entries')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          description: 'Unbalanced entry',
          lines: [
            {
              accountId: debitAccount.id,
              debitAmount: '500.00',
              creditAmount: '0.00',
            },
            {
              accountId: creditAccount.id,
              debitAmount: '0.00',
              creditAmount: '499.00',
            },
          ],
        });
      const draft = createResponse.body as JournalEntryBody;

      const postResponse = await request(app.getHttpServer())
        .post(
          `/api/v1/journal-entries/${draft.id}/post?companyId=${company.id}`,
        )
        .set('Cookie', [cookie]);

      expect(postResponse.status).toBe(400);

      const detailResponse = await request(app.getHttpServer())
        .get(`/api/v1/journal-entries/${draft.id}?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      expect((detailResponse.body as JournalEntryBody).status).toBe('DRAFT');
    });

    it('rejects a line with both debitAmount and creditAmount non-zero', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const account = await createAccount(cookie, company.id, 'ASSET');
      const account2 = await createAccount(cookie, company.id, 'EQUITY');

      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/journal-entries')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          description: 'Bad line',
          lines: [
            {
              accountId: account.id,
              debitAmount: '100.00',
              creditAmount: '0.00',
            },
            {
              accountId: account2.id,
              debitAmount: '0.00',
              creditAmount: '100.00',
            },
          ],
        });
      const draft = createResponse.body as JournalEntryBody;

      // Directly force a both-non-zero line into the DB to exercise post()'s
      // own re-derivation guard — there is no update endpoint to submit such
      // a line through the API (create() validates shape but not balance;
      // a both-sided single line would need to violate the DTO's own
      // decimal-pattern-and-shape contract, so a real API 400 test for this
      // exact case is covered at the unit level; here we prove post() would
      // reject it even if such a row existed).
      await dataSource.query(
        'UPDATE journal_entry_lines SET credit_amount = ? WHERE journal_entry_id = ? AND account_id = ?',
        ['50.00', draft.id, account.id],
      );

      const postResponse = await request(app.getHttpServer())
        .post(
          `/api/v1/journal-entries/${draft.id}/post?companyId=${company.id}`,
        )
        .set('Cookie', [cookie]);

      expect(postResponse.status).toBe(400);
    });

    it('rejects posting a journal entry that is already POSTED (immutability, D3)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const debitAccount = await createAccount(cookie, company.id, 'ASSET');
      const creditAccount = await createAccount(cookie, company.id, 'EQUITY');

      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/journal-entries')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          description: 'Double-post attempt',
          lines: [
            {
              accountId: debitAccount.id,
              debitAmount: '10.00',
              creditAmount: '0.00',
            },
            {
              accountId: creditAccount.id,
              debitAmount: '0.00',
              creditAmount: '10.00',
            },
          ],
        });
      const draft = createResponse.body as JournalEntryBody;

      await request(app.getHttpServer())
        .post(
          `/api/v1/journal-entries/${draft.id}/post?companyId=${company.id}`,
        )
        .set('Cookie', [cookie]);

      const secondPostResponse = await request(app.getHttpServer())
        .post(
          `/api/v1/journal-entries/${draft.id}/post?companyId=${company.id}`,
        )
        .set('Cookie', [cookie]);

      expect(secondPostResponse.status).toBe(409);
    });

    it('cross-company journal entry lookup returns 404 (IDOR-safe)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const companyA = await createCompany(cookie);
      const companyB = await createCompany(cookie);
      const debitAccount = await createAccount(cookie, companyA.id, 'ASSET');
      const creditAccount = await createAccount(cookie, companyA.id, 'EQUITY');

      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/journal-entries')
        .set('Cookie', [cookie])
        .send({
          companyId: companyA.id,
          description: 'IDOR probe',
          lines: [
            {
              accountId: debitAccount.id,
              debitAmount: '10.00',
              creditAmount: '0.00',
            },
            {
              accountId: creditAccount.id,
              debitAmount: '0.00',
              creditAmount: '10.00',
            },
          ],
        });
      const draft = createResponse.body as JournalEntryBody;

      const crossCompanyGet = await request(app.getHttpServer())
        .get(`/api/v1/journal-entries/${draft.id}?companyId=${companyB.id}`)
        .set('Cookie', [cookie]);
      expect(crossCompanyGet.status).toBe(404);

      const crossCompanyPost = await request(app.getHttpServer())
        .post(
          `/api/v1/journal-entries/${draft.id}/post?companyId=${companyB.id}`,
        )
        .set('Cookie', [cookie]);
      expect(crossCompanyPost.status).toBe(404);
    });

    it('rejects an unknown/extra field on POST /journal-entries', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const account = await createAccount(cookie, company.id, 'ASSET');

      const response = await request(app.getHttpServer())
        .post('/api/v1/journal-entries')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          description: 'Bad field',
          status: 'POSTED',
          lines: [
            {
              accountId: account.id,
              debitAmount: '10.00',
              creditAmount: '0.00',
            },
          ],
        });

      expect(response.status).toBe(400);
    });

    it('no PATCH/DELETE endpoint exists for journal entries', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const patchResponse = await request(app.getHttpServer())
        .patch('/api/v1/journal-entries/00000000-0000-0000-0000-000000000000')
        .set('Cookie', [cookie])
        .send({ description: 'x' });
      expect([404, 405]).toContain(patchResponse.status);

      const deleteResponse = await request(app.getHttpServer())
        .delete('/api/v1/journal-entries/00000000-0000-0000-0000-000000000000')
        .set('Cookie', [cookie]);
      expect([404, 405]).toContain(deleteResponse.status);
    });
  });

  describe('locked accounting period rejection (D10)', () => {
    it('rejects posting into a LOCKED accounting period', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const debitAccount = await createAccount(cookie, company.id, 'ASSET');
      const creditAccount = await createAccount(cookie, company.id, 'EQUITY');

      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/journal-entries')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          entryDate: '2026-02-15T00:00:00Z',
          description: 'Locked period probe',
          lines: [
            {
              accountId: debitAccount.id,
              debitAmount: '10.00',
              creditAmount: '0.00',
            },
            {
              accountId: creditAccount.id,
              debitAmount: '0.00',
              creditAmount: '10.00',
            },
          ],
        });
      const draft = createResponse.body as JournalEntryBody;

      // Lock the lazily-created period this draft resolved into.
      const detailResponse = await request(app.getHttpServer())
        .get(`/api/v1/journal-entries/${draft.id}?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      const accountingPeriodId = (
        detailResponse.body as { accountingPeriodId: string }
      ).accountingPeriodId;
      await dataSource.query(
        'UPDATE accounting_periods SET status = ? WHERE id = ?',
        ['LOCKED', accountingPeriodId],
      );

      const postResponse = await request(app.getHttpServer())
        .post(
          `/api/v1/journal-entries/${draft.id}/post?companyId=${company.id}`,
        )
        .set('Cookie', [cookie]);

      expect(postResponse.status).toBe(409);
    });
  });

  describe('General Ledger and Trial Balance (D5, D20 — read-only projections)', () => {
    it('GL query returns only POSTED lines, and Trial Balance globally balances', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const debitAccount = await createAccount(cookie, company.id, 'ASSET');
      const creditAccount = await createAccount(cookie, company.id, 'EQUITY');

      // A DRAFT journal (never posted) must never appear in GL/Trial Balance.
      const draftOnlyResponse = await request(app.getHttpServer())
        .post('/api/v1/journal-entries')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          description: 'Draft only — should not appear in GL',
          lines: [
            {
              accountId: debitAccount.id,
              debitAmount: '999.00',
              creditAmount: '0.00',
            },
            {
              accountId: creditAccount.id,
              debitAmount: '0.00',
              creditAmount: '999.00',
            },
          ],
        });
      const draftOnly = draftOnlyResponse.body as JournalEntryBody;

      // A posted journal must appear.
      const postedSourceResponse = await request(app.getHttpServer())
        .post('/api/v1/journal-entries')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          description: 'Posted — should appear in GL',
          lines: [
            {
              accountId: debitAccount.id,
              debitAmount: '250.00',
              creditAmount: '0.00',
            },
            {
              accountId: creditAccount.id,
              debitAmount: '0.00',
              creditAmount: '250.00',
            },
          ],
        });
      const postedSource = postedSourceResponse.body as JournalEntryBody;
      await request(app.getHttpServer())
        .post(
          `/api/v1/journal-entries/${postedSource.id}/post?companyId=${company.id}`,
        )
        .set('Cookie', [cookie]);

      const glResponse = await request(app.getHttpServer())
        .get(`/api/v1/general-ledger?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      expect(glResponse.status).toBe(200);
      const glRows = (
        glResponse.body as { data: Array<{ journalEntryId: string }> }
      ).data;
      expect(glRows.some((r) => r.journalEntryId === postedSource.id)).toBe(
        true,
      );
      expect(glRows.some((r) => r.journalEntryId === draftOnly.id)).toBe(false);

      const tbResponse = await request(app.getHttpServer())
        .get(`/api/v1/trial-balance?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      expect(tbResponse.status).toBe(200);
      const trialBalance = tbResponse.body as {
        totalDebit: string;
        totalCredit: string;
      };
      expect(trialBalance.totalDebit).toBe(trialBalance.totalCredit);
      expect(trialBalance.totalDebit).toBe('250.00');
    });
  });

  describe('Payment -> GL automatic posting (D6/D7/D13 — the core cross-phase flow)', () => {
    it('posts a real RECEIPT Payment to the General Ledger synchronously, correct accounts, balanced', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const fixture = await setupPaymentPostingFixture(cookie);
      const sale = await createAndConfirmSale(
        cookie,
        fixture.company.id,
        fixture.customer.id,
        fixture.warehouse.id,
        fixture.variant.id,
        1,
      );

      const paymentResponse = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Cookie', [cookie])
        .send({
          companyId: fixture.company.id,
          direction: 'RECEIPT',
          customerId: fixture.customer.id,
          paymentMethodId: fixture.paymentMethod.id,
          amount: '100.00',
          currency: 'USD',
          allocations: [
            {
              referenceType: 'SALE',
              referenceId: sale.id,
              allocatedAmount: '100.00',
            },
          ],
        });
      expect(paymentResponse.status).toBe(201);
      const payment = paymentResponse.body as PaymentBody;

      const journalResponse = await request(app.getHttpServer())
        .get(
          `/api/v1/journal-entries?companyId=${fixture.company.id}&sourceType=PAYMENT&sourceId=${payment.id}`,
        )
        .set('Cookie', [cookie]);
      expect(journalResponse.status).toBe(200);
      const journals = (journalResponse.body as { data: JournalEntryBody[] })
        .data;
      expect(journals.length).toBe(1);
      const journal = journals[0];
      expect(journal.status).toBe('POSTED');
      expect(journal.sourceType).toBe('PAYMENT');
      expect(journal.sourceId).toBe(payment.id);
      expect(journal.totalDebit).toBe('100.00');
      expect(journal.totalCredit).toBe('100.00');
      expect(journal.totalDebit).toBe(journal.totalCredit);

      const detailResponse = await request(app.getHttpServer())
        .get(
          `/api/v1/journal-entries/${journal.id}?companyId=${fixture.company.id}`,
        )
        .set('Cookie', [cookie]);
      const lines = (detailResponse.body as JournalEntryBody).lines!;
      expect(lines).toHaveLength(2);
      const debitLine = lines.find((l) => Number(l.debitAmount) > 0)!;
      const creditLine = lines.find((l) => Number(l.creditAmount) > 0)!;
      // RECEIPT: Dr cash/bank / Cr receivable
      expect(debitLine.accountId).toBe(fixture.cashAccount.id);
      expect(creditLine.accountId).toBe(fixture.receivableAccount.id);
    });

    it('posts a real PAYMENT (supplier) to the General Ledger with the correct Dr payable / Cr cash/bank accounts', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const cashAccount = await createAccount(cookie, company.id, 'ASSET');
      const payableAccount = await createAccount(
        cookie,
        company.id,
        'LIABILITY',
      );
      const supplier = await createSupplier(
        cookie,
        company.id,
        payableAccount.id,
      );
      const paymentMethod = await createPaymentMethod(cookie, company.id);
      await setPaymentMethodGlAccount(paymentMethod.id, cashAccount.id);

      // Purchase orders need a real product variant line — build one via
      // the standard company/branch/category/brand/variant fixture chain,
      // mirroring payments.e2e-spec.ts's own PO fixture helper exactly.
      // (warehouseId is not required on PurchaseOrder itself, so the
      // warehouse is created only as a prerequisite step, not referenced
      // further.)
      const branch = await createBranch(cookie, company.id);
      await createWarehouse(cookie, company.id, branch.id);
      const category = await createCategory(cookie, company.id);
      const brand = await createBrand(cookie, company.id);
      const variant = await createProductVariant(
        cookie,
        company.id,
        category.id,
        brand.id,
      );

      const createPoResponse = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          supplierId: supplier.id,
          currency: 'USD',
          items: [
            { productVariantId: variant.id, quantity: 5, unitCost: '20.00' },
          ],
        });
      const po = createPoResponse.body as { id: string };
      await request(app.getHttpServer())
        .post(
          `/api/v1/purchase-orders/${po.id}/confirm?companyId=${company.id}`,
        )
        .set('Cookie', [cookie]);

      const paymentResponse = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          direction: 'PAYMENT',
          supplierId: supplier.id,
          paymentMethodId: paymentMethod.id,
          amount: '50.00',
          currency: 'USD',
          allocations: [
            {
              referenceType: 'PURCHASE_ORDER',
              referenceId: po.id,
              allocatedAmount: '50.00',
            },
          ],
        });
      expect(paymentResponse.status).toBe(201);
      const payment = paymentResponse.body as PaymentBody;

      const journalResponse = await request(app.getHttpServer())
        .get(
          `/api/v1/journal-entries?companyId=${company.id}&sourceType=PAYMENT&sourceId=${payment.id}`,
        )
        .set('Cookie', [cookie]);
      const journal = (journalResponse.body as { data: JournalEntryBody[] })
        .data[0];
      const detailResponse = await request(app.getHttpServer())
        .get(`/api/v1/journal-entries/${journal.id}?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      const lines = (detailResponse.body as JournalEntryBody).lines!;
      const debitLine = lines.find((l) => Number(l.debitAmount) > 0)!;
      const creditLine = lines.find((l) => Number(l.creditAmount) > 0)!;
      // PAYMENT: Dr payable / Cr cash/bank
      expect(debitLine.accountId).toBe(payableAccount.id);
      expect(creditLine.accountId).toBe(cashAccount.id);
    });

    describe('rollback safety — missing account mapping (fail-closed, LOCKED)', () => {
      it('rolls back the ENTIRE Payment transaction when PaymentMethod has no configured GL account', async () => {
        const cookie = await loginAndGetCookie(superAdminUser.email);
        const fixture = await setupPaymentPostingFixture(cookie);
        // Remove the GL account mapping we set up.
        await setPaymentMethodGlAccount(fixture.paymentMethod.id, null);

        const sale = await createAndConfirmSale(
          cookie,
          fixture.company.id,
          fixture.customer.id,
          fixture.warehouse.id,
          fixture.variant.id,
          1,
        );

        const paymentsBefore = await countRows(
          'SELECT COUNT(*) as c FROM payments WHERE company_id = ?',
          [fixture.company.id],
        );
        const allocationsBefore = await countRows(
          'SELECT COUNT(*) as c FROM payment_allocations pa INNER JOIN payments p ON pa.payment_id = p.id WHERE p.company_id = ?',
          [fixture.company.id],
        );
        const journalsBefore = await countRows(
          'SELECT COUNT(*) as c FROM journal_entries WHERE company_id = ?',
          [fixture.company.id],
        );

        const paymentResponse = await request(app.getHttpServer())
          .post('/api/v1/payments')
          .set('Cookie', [cookie])
          .send({
            companyId: fixture.company.id,
            direction: 'RECEIPT',
            customerId: fixture.customer.id,
            paymentMethodId: fixture.paymentMethod.id,
            amount: '100.00',
            currency: 'USD',
            allocations: [
              {
                referenceType: 'SALE',
                referenceId: sale.id,
                allocatedAmount: '100.00',
              },
            ],
          });

        expect(paymentResponse.status).toBe(400);

        const paymentsAfter = await countRows(
          'SELECT COUNT(*) as c FROM payments WHERE company_id = ?',
          [fixture.company.id],
        );
        const allocationsAfter = await countRows(
          'SELECT COUNT(*) as c FROM payment_allocations pa INNER JOIN payments p ON pa.payment_id = p.id WHERE p.company_id = ?',
          [fixture.company.id],
        );
        const journalsAfter = await countRows(
          'SELECT COUNT(*) as c FROM journal_entries WHERE company_id = ?',
          [fixture.company.id],
        );
        expect(paymentsAfter).toBe(paymentsBefore);
        expect(allocationsAfter).toBe(allocationsBefore);
        expect(journalsAfter).toBe(journalsBefore);

        // Sale's balance must be completely unchanged — applyPayment() ran
        // inside the same transaction and rolled back with everything else.
        const saleResponse = await request(app.getHttpServer())
          .get(`/api/v1/sales/${sale.id}?companyId=${fixture.company.id}`)
          .set('Cookie', [cookie]);
        expect((saleResponse.body as SaleBody).paidAmount).toBe('0.00');
      });

      it('rolls back the ENTIRE Payment transaction when Customer.receivableAccountId is null', async () => {
        const cookie = await loginAndGetCookie(superAdminUser.email);
        const company = await createCompany(cookie);
        const branch = await createBranch(cookie, company.id);
        const warehouse = await createWarehouse(cookie, company.id, branch.id);
        const category = await createCategory(cookie, company.id);
        const brand = await createBrand(cookie, company.id);
        const variant = await createProductVariant(
          cookie,
          company.id,
          category.id,
          brand.id,
        );
        const priceList = await createPriceList(cookie, company.id);
        await request(app.getHttpServer())
          .post(
            `/api/v1/price-lists/${priceList.id}/items?companyId=${company.id}`,
          )
          .set('Cookie', [cookie])
          .send({
            productVariantId: variant.id,
            price: '100.00',
            validFrom: '2020-01-01T00:00:00Z',
          });
        await seedOpeningStock(
          cookie,
          company.id,
          warehouse.id,
          variant.id,
          1000,
        );

        const cashAccount = await createAccount(cookie, company.id, 'ASSET');
        // Customer created WITHOUT a receivableAccountId.
        const customer = await createCustomer(cookie, company.id);
        const paymentMethod = await createPaymentMethod(cookie, company.id);
        await setPaymentMethodGlAccount(paymentMethod.id, cashAccount.id);

        const sale = await createAndConfirmSale(
          cookie,
          company.id,
          customer.id,
          warehouse.id,
          variant.id,
          1,
        );

        const paymentsBefore = await countRows(
          'SELECT COUNT(*) as c FROM payments WHERE company_id = ?',
          [company.id],
        );

        const paymentResponse = await request(app.getHttpServer())
          .post('/api/v1/payments')
          .set('Cookie', [cookie])
          .send({
            companyId: company.id,
            direction: 'RECEIPT',
            customerId: customer.id,
            paymentMethodId: paymentMethod.id,
            amount: '100.00',
            currency: 'USD',
            allocations: [
              {
                referenceType: 'SALE',
                referenceId: sale.id,
                allocatedAmount: '100.00',
              },
            ],
          });

        expect(paymentResponse.status).toBe(400);

        const paymentsAfter = await countRows(
          'SELECT COUNT(*) as c FROM payments WHERE company_id = ?',
          [company.id],
        );
        expect(paymentsAfter).toBe(paymentsBefore);

        const saleResponse = await request(app.getHttpServer())
          .get(`/api/v1/sales/${sale.id}?companyId=${company.id}`)
          .set('Cookie', [cookie]);
        expect((saleResponse.body as SaleBody).paidAmount).toBe('0.00');
      });
    });
  });

  describe('concurrency — real Promise.all() journal-numbering uniqueness (D-spec concurrency requirement)', () => {
    it('assigns unique journal numbers under 10-way real concurrent POST /journal-entries', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const debitAccount = await createAccount(cookie, company.id, 'ASSET');
      const creditAccount = await createAccount(cookie, company.id, 'EQUITY');

      const requests = Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .post('/api/v1/journal-entries')
          .set('Cookie', [cookie])
          .send({
            companyId: company.id,
            description: 'Concurrency probe',
            lines: [
              {
                accountId: debitAccount.id,
                debitAmount: '1.00',
                creditAmount: '0.00',
              },
              {
                accountId: creditAccount.id,
                debitAmount: '0.00',
                creditAmount: '1.00',
              },
            ],
          }),
      );

      const results = await Promise.all(requests);
      const succeeded = results.filter((r) => r.status === 201);
      expect(succeeded.length).toBe(10);

      const journalNumbers = succeeded.map(
        (r) => (r.body as JournalEntryBody).journalNumber,
      );
      const uniqueNumbers = new Set(journalNumbers);
      expect(uniqueNumbers.size).toBe(10);
    });
  });
});
