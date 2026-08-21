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
interface WarehouseBody {
  id: string;
  companyId: string;
  branchId: string;
}
interface CategoryBody {
  id: string;
}
interface BrandBody {
  id: string;
}
interface ProductVariantBody {
  id: string;
  sku: string;
}
interface PriceListBody {
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
interface SaleBody {
  id: string;
  status: string;
  grandTotal: string;
  paidAmount: string;
  balanceAmount: string;
}
interface PurchaseOrderBody {
  id: string;
  status: string;
  grandTotal: string;
  paidAmount: string;
  balanceAmount: string;
}
interface PaymentMethodBody {
  id: string;
  code: string;
}
interface PaymentBody {
  id: string;
  paymentNumber: string;
  direction: string;
  status: string;
  amount: string;
  allocations?: Array<{
    id: string;
    referenceType: string;
    referenceId: string;
    allocatedAmount: string;
  }>;
}

describeIfDb('Payments (Phase 16) (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let passwordService: PasswordService;

  let superAdminUser: User;
  let plainUser: User;

  const password = 'correct-horse-battery-staple';
  const authCookieByEmail = new Map<string, string>();
  const prefix = 'PMT-E2E';

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
        name: 'Payments E2E Test Company',
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

  async function createWarehouse(
    cookie: string,
    companyId: string,
    branchId: string,
  ): Promise<WarehouseBody> {
    const code = uniqueCode('WH');
    const response = await request(app.getHttpServer())
      .post('/api/v1/warehouses')
      .set('Cookie', [cookie])
      .send({ companyId, branchId, code, name: `Warehouse ${code}` });
    return response.body as WarehouseBody;
  }

  async function createCategory(
    cookie: string,
    companyId: string,
  ): Promise<CategoryBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Cookie', [cookie])
      .send({ companyId, code: uniqueCode('CAT'), name: 'T-Shirts' });
    return response.body as CategoryBody;
  }

  async function createBrand(
    cookie: string,
    companyId: string,
  ): Promise<BrandBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/brands')
      .set('Cookie', [cookie])
      .send({ companyId, code: uniqueCode('BRD'), name: 'Nike' });
    return response.body as BrandBody;
  }

  async function createProductVariant(
    cookie: string,
    companyId: string,
    categoryId: string,
    brandId: string,
  ): Promise<ProductVariantBody> {
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
    const variants = variantsResponse.body as { data: ProductVariantBody[] };
    return variants.data[0];
  }

  async function createPriceList(
    cookie: string,
    companyId: string,
  ): Promise<PriceListBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/price-lists')
      .set('Cookie', [cookie])
      .send({
        companyId,
        code: uniqueCode('PL'),
        name: 'Retail Price List',
        currency: 'USD',
      });
    return response.body as PriceListBody;
  }

  async function createActivePriceListItem(
    cookie: string,
    companyId: string,
    priceListId: string,
    productVariantId: string,
    price: string,
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .post(`/api/v1/price-lists/${priceListId}/items?companyId=${companyId}`)
      .set('Cookie', [cookie])
      .send({
        productVariantId,
        price,
        validFrom: '2020-01-01T00:00:00Z',
      });
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
        name: 'Payments E2E Customer',
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
        name: 'Payments E2E Supplier',
        ...(payableAccountId ? { payableAccountId } : {}),
      });
    return response.body as SupplierBody;
  }

  /**
   * Phase 17 addition: creates a minimal chart of accounts (cash, AR, AP)
   * for a company — needed because every real POST /payments call now
   * synchronously posts to the General Ledger (Phase 17 D6/D7), which
   * fails closed (400) if PaymentMethod.glAccountId /
   * Customer.receivableAccountId / Supplier.payableAccountId are
   * unconfigured. This suite's own fixtures must supply real account
   * mappings for the pre-existing Phase 16 Payment flows to keep working
   * exactly as before — this is a test-fixture update reflecting a real,
   * intended new precondition, not a change to Payment's own logic
   * (PaymentsService/PaymentAllocation/etc. are untouched, see the Phase
   * 17 implementation report's diff evidence).
   */
  async function createChartOfAccountsFixture(
    cookie: string,
    companyId: string,
  ): Promise<{
    cashAccountId: string;
    receivableAccountId: string;
    payableAccountId: string;
  }> {
    const cash = await request(app.getHttpServer())
      .post('/api/v1/accounts')
      .set('Cookie', [cookie])
      .send({
        companyId,
        code: uniqueCode('CASH'),
        name: 'Cash',
        accountType: 'ASSET',
      });
    const receivable = await request(app.getHttpServer())
      .post('/api/v1/accounts')
      .set('Cookie', [cookie])
      .send({
        companyId,
        code: uniqueCode('AR'),
        name: 'Accounts Receivable',
        accountType: 'ASSET',
      });
    const payable = await request(app.getHttpServer())
      .post('/api/v1/accounts')
      .set('Cookie', [cookie])
      .send({
        companyId,
        code: uniqueCode('AP'),
        name: 'Accounts Payable',
        accountType: 'LIABILITY',
      });
    return {
      cashAccountId: (cash.body as { id: string }).id,
      receivableAccountId: (receivable.body as { id: string }).id,
      payableAccountId: (payable.body as { id: string }).id,
    };
  }

  /** No PATCH endpoint exists for PaymentMethod (D14, LOCKED minimal scope) — set gl_account_id directly, mirroring accounting.e2e-spec.ts's own helper. */
  async function setPaymentMethodGlAccount(
    paymentMethodId: string,
    accountId: string,
  ): Promise<void> {
    await dataSource.query(
      'UPDATE payment_methods SET gl_account_id = ? WHERE id = ?',
      [accountId, paymentMethodId],
    );
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
    const sale = createResponse.body as SaleBody;
    const confirmResponse = await request(app.getHttpServer())
      .post(`/api/v1/sales/${sale.id}/confirm?companyId=${companyId}`)
      .set('Cookie', [cookie]);
    return confirmResponse.body as SaleBody;
  }

  async function createAndConfirmPurchaseOrder(
    cookie: string,
    companyId: string,
    supplierId: string,
    productVariantId: string,
    quantity: number,
    unitCost: string,
  ): Promise<PurchaseOrderBody> {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/purchase-orders')
      .set('Cookie', [cookie])
      .send({
        companyId,
        supplierId,
        currency: 'USD',
        items: [{ productVariantId, quantity, unitCost }],
      });
    const po = createResponse.body as PurchaseOrderBody;
    const confirmResponse = await request(app.getHttpServer())
      .post(`/api/v1/purchase-orders/${po.id}/confirm?companyId=${companyId}`)
      .set('Cookie', [cookie]);
    return confirmResponse.body as PurchaseOrderBody;
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

  /** Full setup: company, branch, warehouse, category, brand, variant, active price list item, customer, supplier. */
  async function setupBaseFixture(cookie: string) {
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
    await createActivePriceListItem(
      cookie,
      company.id,
      priceList.id,
      variant.id,
      '100.00',
    );
    await seedOpeningStock(cookie, company.id, warehouse.id, variant.id, 1000);
    const chartOfAccounts = await createChartOfAccountsFixture(
      cookie,
      company.id,
    );
    const customer = await createCustomer(
      cookie,
      company.id,
      chartOfAccounts.receivableAccountId,
    );
    const supplier = await createSupplier(
      cookie,
      company.id,
      chartOfAccounts.payableAccountId,
    );
    const paymentMethod = await createPaymentMethod(cookie, company.id);
    await setPaymentMethodGlAccount(
      paymentMethod.id,
      chartOfAccounts.cashAccountId,
    );
    return {
      company,
      branch,
      warehouse,
      category,
      brand,
      chartOfAccounts,
      variant,
      priceList,
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

    // Clean slate for this suite's own data only, respecting FK order
    // (children before parents) — mirrors the Phase 09-15 cleanup
    // convention (scope-to-own-prefix, never an unscoped DELETE).
    const cleanup = async () => {
      // Phase 18 addition: every real POST /payments call in this suite now
      // also creates an outbox_events row (payment.confirmed, same
      // transaction) — clean those (and any processed_events rows a
      // consumer may have recorded for them) up before the companies rows
      // outbox_events.company_id FKs to.
      //
      // Phase 21 addition: NotificationsModule is wired into the same
      // AppModule this suite boots, so NotificationEventConsumer is also
      // live and creates `notifications` rows for these same payments.
      // Those rows FK to companies too, so they must be deleted before the
      // companies delete below.
      await dataSource.query(
        `DELETE FROM notifications WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
      );
      await dataSource.query(
        `DELETE FROM processed_events WHERE event_id IN (SELECT event_id FROM (SELECT event_id FROM outbox_events WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
      );
      await dataSource.query(
        `DELETE FROM outbox_events WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
      );
      // Phase 17 addition: every real POST /payments call in this suite
      // now also creates a POSTED journal_entries row (synchronous Payment
      // -> GL posting) — clean those up before the payments/companies
      // rows they reference.
      await dataSource.query(
        `DELETE FROM journal_entry_lines WHERE journal_entry_id IN (SELECT id FROM (SELECT id FROM journal_entries WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
      );
      await dataSource.query(
        `DELETE FROM journal_entries WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
      );
      await dataSource.query(
        `DELETE FROM company_journal_counters WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
      );
      // Also clean the lazily-created FiscalYear/AccountingPeriod rows
      // (AccountingPeriodResolverService.resolveOpenPeriod(), Phase 17) —
      // journal_entries.accounting_period_id FKs to accounting_periods, so
      // these must be deleted after journal_entries but before companies.
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
      // Phase 17 addition: clear the gl_account_id FK before deleting
      // payment_methods rows themselves (payment_methods -> accounts).
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
      // Phase 17 addition: clear self-referencing accounts.parent_id before
      // bulk delete (same fix category as categories.parent_id, Phase 09).
      await dataSource.query(
        `UPDATE accounts SET parent_id = NULL WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
      );
      await dataSource.query(
        `DELETE FROM accounts WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
      );
      // Phase 21 addition: NotificationEventConsumer can still finish a
      // late-arriving payment.confirmed message while cleanup is tearing
      // down this suite's data. Retry the final company delete after one
      // last scoped notifications purge so FK-safe teardown remains stable.
      let deleteCompaniesError: unknown;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await dataSource.query(
          `DELETE FROM notifications WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
        );
        try {
          await dataSource.query(
            `DELETE FROM companies WHERE code LIKE '${prefix}%'`,
          );
          deleteCompaniesError = undefined;
          break;
        } catch (error) {
          deleteCompaniesError = error;
          if (attempt < 4) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        }
      }
      if (deleteCompaniesError) {
        if (deleteCompaniesError instanceof Error) {
          throw deleteCompaniesError;
        }
        throw new Error('Unknown company cleanup failure');
      }
      await dataSource.query(
        `DELETE FROM user_roles WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE 'pmt-e2e-%') t)`,
      );
      await dataSource.query("DELETE FROM users WHERE email LIKE 'pmt-e2e-%'");
    };

    await cleanup();

    const userRepository = dataSource.getRepository(User);
    const roleRepository = dataSource.getRepository(Role);
    const userRoleRepository = dataSource.getRepository(UserRole);

    superAdminUser = await userRepository.save(
      userRepository.create({
        email: 'pmt-e2e-superadmin@example.com',
        passwordHash: await passwordService.hash(password),
        firstName: 'Payments',
        lastName: 'SuperAdmin',
        displayName: 'Payments Super Admin',
        status: UserStatus.Active,
        isEmailVerified: true,
        lastLoginAt: null,
        passwordChangedAt: null,
      }),
    );

    plainUser = await userRepository.save(
      userRepository.create({
        email: 'pmt-e2e-plain@example.com',
        passwordHash: await passwordService.hash(password),
        firstName: 'Payments',
        lastName: 'Plain',
        displayName: 'Payments Plain User',
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
      globalThis as unknown as { __paymentsE2eCleanup: () => Promise<void> }
    ).__paymentsE2eCleanup = cleanup;
  });

  afterAll(async () => {
    const cleanup = (
      globalThis as unknown as { __paymentsE2eCleanup?: () => Promise<void> }
    ).__paymentsE2eCleanup;
    if (cleanup) {
      await cleanup();
    }
    await app.close();
  });

  describe('authentication and permission boundaries', () => {
    it('rejects an unauthenticated request with 401', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/v1/payments',
      );
      expect(response.status).toBe(401);
    });

    it('rejects an authenticated user with no payments permission with 403', async () => {
      const cookie = await loginAndGetCookie(plainUser.email);
      const response = await request(app.getHttpServer())
        .get('/api/v1/payments')
        .set('Cookie', [cookie]);
      expect(response.status).toBe(403);
    });
  });

  describe('no PATCH/DELETE/refund endpoint of any kind (D5/D10)', () => {
    it('has no PATCH /payments/:id', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company } = await setupBaseFixture(cookie);
      const response = await request(app.getHttpServer())
        .patch(
          `/api/v1/payments/00000000-0000-0000-0000-000000000000?companyId=${company.id}`,
        )
        .set('Cookie', [cookie])
        .send({ amount: '1.00' });
      expect([404, 405]).toContain(response.status);
    });

    it('has no DELETE /payments/:id', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company } = await setupBaseFixture(cookie);
      const response = await request(app.getHttpServer())
        .delete(
          `/api/v1/payments/00000000-0000-0000-0000-000000000000?companyId=${company.id}`,
        )
        .set('Cookie', [cookie]);
      expect([404, 405]).toContain(response.status);
    });

    it('has no refund/reverse/void endpoint', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company } = await setupBaseFixture(cookie);
      for (const action of ['refund', 'reverse', 'void', 'cancel']) {
        const response = await request(app.getHttpServer())
          .post(
            `/api/v1/payments/00000000-0000-0000-0000-000000000000/${action}?companyId=${company.id}`,
          )
          .set('Cookie', [cookie]);
        expect([404, 405]).toContain(response.status);
      }
    });
  });

  describe('RECEIPT payment against a confirmed Sale', () => {
    it('creates a RECEIPT payment, fully allocates it, and updates Sale.paidAmount/balanceAmount', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, customer, variant, paymentMethod } =
        await setupBaseFixture(cookie);

      const sale = await createAndConfirmSale(
        cookie,
        company.id,
        customer.id,
        warehouse.id,
        variant.id,
        1,
      );
      expect(sale.status).toBe('CONFIRMED');
      expect(sale.grandTotal).toBe('100.00');
      expect(sale.balanceAmount).toBe('100.00');

      const response = await request(app.getHttpServer())
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

      expect(response.status).toBe(201);
      const payment = response.body as PaymentBody;
      expect(payment.status).toBe('CONFIRMED');
      expect(payment.paymentNumber).toMatch(/^PMT-\d{4}-\d{6}$/);
      expect(payment.allocations).toHaveLength(1);

      const saleResponse = await request(app.getHttpServer())
        .get(`/api/v1/sales/${sale.id}?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      const updatedSale = saleResponse.body as SaleBody;
      expect(updatedSale.paidAmount).toBe('100.00');
      expect(updatedSale.balanceAmount).toBe('0.00');
    });

    it('supports a partial payment, leaving a nonzero balance', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, customer, variant, paymentMethod } =
        await setupBaseFixture(cookie);

      const sale = await createAndConfirmSale(
        cookie,
        company.id,
        customer.id,
        warehouse.id,
        variant.id,
        1,
      );

      const response = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          direction: 'RECEIPT',
          customerId: customer.id,
          paymentMethodId: paymentMethod.id,
          amount: '40.00',
          currency: 'USD',
          allocations: [
            {
              referenceType: 'SALE',
              referenceId: sale.id,
              allocatedAmount: '40.00',
            },
          ],
        });
      expect(response.status).toBe(201);

      const saleResponse = await request(app.getHttpServer())
        .get(`/api/v1/sales/${sale.id}?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      const updatedSale = saleResponse.body as SaleBody;
      expect(updatedSale.paidAmount).toBe('40.00');
      expect(updatedSale.balanceAmount).toBe('60.00');
    });

    it('rejects over-allocation beyond the Sale grandTotal with 409', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, customer, variant, paymentMethod } =
        await setupBaseFixture(cookie);

      const sale = await createAndConfirmSale(
        cookie,
        company.id,
        customer.id,
        warehouse.id,
        variant.id,
        1,
      );

      const response = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          direction: 'RECEIPT',
          customerId: customer.id,
          paymentMethodId: paymentMethod.id,
          amount: '150.00',
          currency: 'USD',
          allocations: [
            {
              referenceType: 'SALE',
              referenceId: sale.id,
              allocatedAmount: '150.00',
            },
          ],
        });

      expect(response.status).toBe(409);

      // No partial Payment/PaymentAllocation rows survive the rollback.
      const paymentCount = await countRows(
        'SELECT COUNT(*) AS c FROM payments WHERE company_id = ?',
        [company.id],
      );
      expect(paymentCount).toBe(0);

      const saleResponse = await request(app.getHttpServer())
        .get(`/api/v1/sales/${sale.id}?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      const untouchedSale = saleResponse.body as SaleBody;
      expect(untouchedSale.paidAmount).toBe('0.00');
    });

    it('rejects a second payment that would push cumulative paidAmount over grandTotal', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, customer, variant, paymentMethod } =
        await setupBaseFixture(cookie);

      const sale = await createAndConfirmSale(
        cookie,
        company.id,
        customer.id,
        warehouse.id,
        variant.id,
        1,
      );

      const first = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          direction: 'RECEIPT',
          customerId: customer.id,
          paymentMethodId: paymentMethod.id,
          amount: '70.00',
          currency: 'USD',
          allocations: [
            {
              referenceType: 'SALE',
              referenceId: sale.id,
              allocatedAmount: '70.00',
            },
          ],
        });
      expect(first.status).toBe(201);

      const second = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          direction: 'RECEIPT',
          customerId: customer.id,
          paymentMethodId: paymentMethod.id,
          amount: '40.00',
          currency: 'USD',
          allocations: [
            {
              referenceType: 'SALE',
              referenceId: sale.id,
              allocatedAmount: '40.00',
            },
          ],
        });
      expect(second.status).toBe(409);
    });
  });

  describe('PAYMENT against a confirmed PurchaseOrder', () => {
    it('creates a PAYMENT, allocates it, and updates PurchaseOrder.paidAmount/balanceAmount', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, supplier, variant, paymentMethod } =
        await setupBaseFixture(cookie);

      const po = await createAndConfirmPurchaseOrder(
        cookie,
        company.id,
        supplier.id,
        variant.id,
        5,
        '10.00',
      );
      expect(po.status).toBe('CONFIRMED');
      expect(po.grandTotal).toBe('50.00');

      const response = await request(app.getHttpServer())
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

      expect(response.status).toBe(201);
      const payment = response.body as PaymentBody;
      expect(payment.direction).toBe('PAYMENT');

      const poResponse = await request(app.getHttpServer())
        .get(`/api/v1/purchase-orders/${po.id}?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      const updatedPo = poResponse.body as PurchaseOrderBody;
      expect(updatedPo.paidAmount).toBe('50.00');
      expect(updatedPo.balanceAmount).toBe('0.00');
    });
  });

  describe('direction/reference-type cross-validation (locked spec step 5)', () => {
    it('rejects RECEIPT + PURCHASE_ORDER allocation with 400', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, supplier, customer, variant, paymentMethod } =
        await setupBaseFixture(cookie);
      const po = await createAndConfirmPurchaseOrder(
        cookie,
        company.id,
        supplier.id,
        variant.id,
        1,
        '10.00',
      );

      const response = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          direction: 'RECEIPT',
          customerId: customer.id,
          paymentMethodId: paymentMethod.id,
          amount: '10.00',
          currency: 'USD',
          allocations: [
            {
              referenceType: 'PURCHASE_ORDER',
              referenceId: po.id,
              allocatedAmount: '10.00',
            },
          ],
        });

      expect(response.status).toBe(400);
    });

    it('rejects PAYMENT + SALE allocation with 400', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, customer, supplier, variant, paymentMethod } =
        await setupBaseFixture(cookie);
      const sale = await createAndConfirmSale(
        cookie,
        company.id,
        customer.id,
        warehouse.id,
        variant.id,
        1,
      );

      const response = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          direction: 'PAYMENT',
          supplierId: supplier.id,
          paymentMethodId: paymentMethod.id,
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

      expect(response.status).toBe(400);
    });

    it('rejects a RECEIPT with both customerId and supplierId set', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, customer, supplier, paymentMethod } =
        await setupBaseFixture(cookie);

      const response = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          direction: 'RECEIPT',
          customerId: customer.id,
          supplierId: supplier.id,
          paymentMethodId: paymentMethod.id,
          amount: '10.00',
          currency: 'USD',
          allocations: [
            {
              referenceType: 'SALE',
              referenceId: '00000000-0000-0000-0000-000000000000',
              allocatedAmount: '10.00',
            },
          ],
        });

      expect(response.status).toBe(400);
    });
  });

  describe('validation', () => {
    it('rejects unknown/extra fields (whitelist)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, customer, paymentMethod } =
        await setupBaseFixture(cookie);

      const response = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          direction: 'RECEIPT',
          customerId: customer.id,
          paymentMethodId: paymentMethod.id,
          amount: '10.00',
          currency: 'USD',
          status: 'CONFIRMED',
          allocations: [
            {
              referenceType: 'SALE',
              referenceId: '00000000-0000-0000-0000-000000000000',
              allocatedAmount: '10.00',
            },
          ],
        });

      expect(response.status).toBe(400);
    });

    it('rejects an empty allocations array', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, customer, paymentMethod } =
        await setupBaseFixture(cookie);

      const response = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          direction: 'RECEIPT',
          customerId: customer.id,
          paymentMethodId: paymentMethod.id,
          amount: '10.00',
          currency: 'USD',
          allocations: [],
        });

      expect(response.status).toBe(400);
    });

    it('rejects allocations summing to more than the payment amount', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, customer, variant, paymentMethod } =
        await setupBaseFixture(cookie);
      const sale = await createAndConfirmSale(
        cookie,
        company.id,
        customer.id,
        warehouse.id,
        variant.id,
        1,
      );

      const response = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          direction: 'RECEIPT',
          customerId: customer.id,
          paymentMethodId: paymentMethod.id,
          amount: '10.00',
          currency: 'USD',
          allocations: [
            {
              referenceType: 'SALE',
              referenceId: sale.id,
              allocatedAmount: '99.00',
            },
          ],
        });

      expect(response.status).toBe(400);
    });

    it('rejects an inactive payment method', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, customer } = await setupBaseFixture(cookie);
      const response = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          direction: 'RECEIPT',
          customerId: customer.id,
          paymentMethodId: '00000000-0000-0000-0000-000000000000',
          amount: '10.00',
          currency: 'USD',
          allocations: [
            {
              referenceType: 'SALE',
              referenceId: '00000000-0000-0000-0000-000000000000',
              allocatedAmount: '10.00',
            },
          ],
        });

      expect(response.status).toBe(404);
    });

    it('rejects a cross-company customerId as not found (IDOR-safe 404)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const first = await setupBaseFixture(cookie);
      const other = await setupBaseFixture(cookie);

      const response = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Cookie', [cookie])
        .send({
          companyId: other.company.id,
          direction: 'RECEIPT',
          customerId: first.customer.id,
          paymentMethodId: other.paymentMethod.id,
          amount: '10.00',
          currency: 'USD',
          allocations: [
            {
              referenceType: 'SALE',
              referenceId: '00000000-0000-0000-0000-000000000000',
              allocatedAmount: '10.00',
            },
          ],
        });

      expect(response.status).toBe(404);
    });
  });

  describe('idempotency (D11)', () => {
    it('returns the original payment (200) on a repeat request with the same Idempotency-Key', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, customer, variant, paymentMethod } =
        await setupBaseFixture(cookie);
      const sale = await createAndConfirmSale(
        cookie,
        company.id,
        customer.id,
        warehouse.id,
        variant.id,
        1,
      );

      const idempotencyKey = uniqueCode('IDEMP');
      const body = {
        companyId: company.id,
        direction: 'RECEIPT',
        customerId: customer.id,
        paymentMethodId: paymentMethod.id,
        amount: '30.00',
        currency: 'USD',
        allocations: [
          {
            referenceType: 'SALE',
            referenceId: sale.id,
            allocatedAmount: '30.00',
          },
        ],
      };

      const first = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Cookie', [cookie])
        .set('Idempotency-Key', idempotencyKey)
        .send(body);
      expect(first.status).toBe(201);
      const firstPayment = first.body as PaymentBody;

      const second = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Cookie', [cookie])
        .set('Idempotency-Key', idempotencyKey)
        .send(body);
      expect(second.status).toBe(200);
      const secondPayment = second.body as PaymentBody;
      expect(secondPayment.id).toBe(firstPayment.id);

      // Exactly one Payment row was created, not two, and the Sale's
      // paidAmount reflects only the ONE application (30.00, not 60.00).
      const paymentCount = await countRows(
        'SELECT COUNT(*) AS c FROM payments WHERE company_id = ? AND payment_number = ?',
        [company.id, firstPayment.paymentNumber],
      );
      expect(paymentCount).toBe(1);

      const saleResponse = await request(app.getHttpServer())
        .get(`/api/v1/sales/${sale.id}?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      const updatedSale = saleResponse.body as SaleBody;
      expect(updatedSale.paidAmount).toBe('30.00');
    });

    it('does not collide across two different companies using the same key value', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const fixtureA = await setupBaseFixture(cookie);
      const fixtureB = await setupBaseFixture(cookie);
      const saleA = await createAndConfirmSale(
        cookie,
        fixtureA.company.id,
        fixtureA.customer.id,
        fixtureA.warehouse.id,
        fixtureA.variant.id,
        1,
      );
      const saleB = await createAndConfirmSale(
        cookie,
        fixtureB.company.id,
        fixtureB.customer.id,
        fixtureB.warehouse.id,
        fixtureB.variant.id,
        1,
      );

      const sharedKey = uniqueCode('SHARED-KEY');

      const responseA = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Cookie', [cookie])
        .set('Idempotency-Key', sharedKey)
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
      expect(responseA.status).toBe(201);

      const responseB = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Cookie', [cookie])
        .set('Idempotency-Key', sharedKey)
        .send({
          companyId: fixtureB.company.id,
          direction: 'RECEIPT',
          customerId: fixtureB.customer.id,
          paymentMethodId: fixtureB.paymentMethod.id,
          amount: '25.00',
          currency: 'USD',
          allocations: [
            {
              referenceType: 'SALE',
              referenceId: saleB.id,
              allocatedAmount: '25.00',
            },
          ],
        });
      // Same key, different company — must be treated as a DIFFERENT
      // payment (201, not the company-A payment echoed back).
      expect(responseB.status).toBe(201);
      expect((responseB.body as PaymentBody).id).not.toBe(
        (responseA.body as PaymentBody).id,
      );
    });
  });

  describe('concurrency — real Promise.all() race (locked spec §8/D18)', () => {
    it('prevents over-allocation when two concurrent payments together exceed the Sale grandTotal', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, customer, variant, paymentMethod } =
        await setupBaseFixture(cookie);

      const sale = await createAndConfirmSale(
        cookie,
        company.id,
        customer.id,
        warehouse.id,
        variant.id,
        1,
      );
      // Sale.grandTotal = 100.00. Fire two genuinely concurrent payments of
      // 60.00 each (sum 120.00 > 100.00) — exactly one must succeed, the
      // other must be rejected with 409, and the Sale's final paidAmount
      // must be exactly 60.00, never 120.00 and never left inconsistent.
      const makePayment = () =>
        request(app.getHttpServer())
          .post('/api/v1/payments')
          .set('Cookie', [cookie])
          .send({
            companyId: company.id,
            direction: 'RECEIPT',
            customerId: customer.id,
            paymentMethodId: paymentMethod.id,
            amount: '60.00',
            currency: 'USD',
            allocations: [
              {
                referenceType: 'SALE',
                referenceId: sale.id,
                allocatedAmount: '60.00',
              },
            ],
          });

      const [resultA, resultB] = await Promise.all([
        makePayment(),
        makePayment(),
      ]);

      const statuses = [resultA.status, resultB.status].sort();
      expect(statuses).toEqual([201, 409]);

      const saleResponse = await request(app.getHttpServer())
        .get(`/api/v1/sales/${sale.id}?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      const updatedSale = saleResponse.body as SaleBody;
      expect(updatedSale.paidAmount).toBe('60.00');
      expect(updatedSale.balanceAmount).toBe('40.00');

      const paymentCount = await countRows(
        'SELECT COUNT(*) AS c FROM payments WHERE company_id = ?',
        [company.id],
      );
      expect(paymentCount).toBe(1);
    });

    it('assigns unique payment numbers under 10-way real concurrent POST /payments', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, customer, variant, paymentMethod } =
        await setupBaseFixture(cookie);

      // A large sale so 10 concurrent 5.00 payments (sum 50.00) never
      // exceeds grandTotal — this test isolates the counter-uniqueness
      // property from the over-allocation-rejection property tested above.
      const sale = await createAndConfirmSale(
        cookie,
        company.id,
        customer.id,
        warehouse.id,
        variant.id,
        1,
      );

      const requests = Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .post('/api/v1/payments')
          .set('Cookie', [cookie])
          .send({
            companyId: company.id,
            direction: 'RECEIPT',
            customerId: customer.id,
            paymentMethodId: paymentMethod.id,
            amount: '5.00',
            currency: 'USD',
            allocations: [
              {
                referenceType: 'SALE',
                referenceId: sale.id,
                allocatedAmount: '5.00',
              },
            ],
          }),
      );

      const results = await Promise.all(requests);
      const succeeded = results.filter((r) => r.status === 201);
      expect(succeeded.length).toBe(10);

      const paymentNumbers = succeeded.map(
        (r) => (r.body as PaymentBody).paymentNumber,
      );
      const uniqueNumbers = new Set(paymentNumbers);
      expect(uniqueNumbers.size).toBe(10);

      const saleResponse = await request(app.getHttpServer())
        .get(`/api/v1/sales/${sale.id}?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      const updatedSale = saleResponse.body as SaleBody;
      expect(updatedSale.paidAmount).toBe('50.00');
    });
  });

  describe('PaymentMethod API (D14 minimal scope: read+create only)', () => {
    it('creates and lists payment methods, scoped by company', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, paymentMethod } = await setupBaseFixture(cookie);

      const listResponse = await request(app.getHttpServer())
        .get(`/api/v1/payment-methods?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      expect(listResponse.status).toBe(200);
      const list = listResponse.body as { data: PaymentMethodBody[] };
      expect(list.data.some((pm) => pm.id === paymentMethod.id)).toBe(true);
    });

    it('rejects a duplicate code within the same company (409)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, paymentMethod } = await setupBaseFixture(cookie);

      const response = await request(app.getHttpServer())
        .post('/api/v1/payment-methods')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          code: paymentMethod.code,
          name: 'Cash Again',
        });

      expect(response.status).toBe(409);
    });

    it('has no PATCH/DELETE endpoint for payment methods (D14 minimal scope)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, paymentMethod } = await setupBaseFixture(cookie);

      const patchResponse = await request(app.getHttpServer())
        .patch(
          `/api/v1/payment-methods/${paymentMethod.id}?companyId=${company.id}`,
        )
        .set('Cookie', [cookie])
        .send({ name: 'Renamed' });
      expect([404, 405]).toContain(patchResponse.status);

      const deleteResponse = await request(app.getHttpServer())
        .delete(
          `/api/v1/payment-methods/${paymentMethod.id}?companyId=${company.id}`,
        )
        .set('Cookie', [cookie]);
      expect([404, 405]).toContain(deleteResponse.status);
    });
  });

  describe('GET /payments list and detail', () => {
    it('lists payments filtered by direction/status and returns detail with allocations', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, customer, variant, paymentMethod } =
        await setupBaseFixture(cookie);
      const sale = await createAndConfirmSale(
        cookie,
        company.id,
        customer.id,
        warehouse.id,
        variant.id,
        1,
      );

      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          direction: 'RECEIPT',
          customerId: customer.id,
          paymentMethodId: paymentMethod.id,
          amount: '25.00',
          currency: 'USD',
          allocations: [
            {
              referenceType: 'SALE',
              referenceId: sale.id,
              allocatedAmount: '25.00',
            },
          ],
        });
      const created = createResponse.body as PaymentBody;

      const listResponse = await request(app.getHttpServer())
        .get(`/api/v1/payments?companyId=${company.id}&direction=RECEIPT`)
        .set('Cookie', [cookie]);
      expect(listResponse.status).toBe(200);
      const list = listResponse.body as { data: PaymentBody[] };
      expect(list.data.some((p) => p.id === created.id)).toBe(true);

      const detailResponse = await request(app.getHttpServer())
        .get(`/api/v1/payments/${created.id}?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      expect(detailResponse.status).toBe(200);
      const detail = detailResponse.body as PaymentBody;
      expect(detail.allocations).toHaveLength(1);
      expect(detail.allocations?.[0].allocatedAmount).toBe('25.00');
    });

    it('returns 404 for a cross-company payment id (IDOR-safe)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const first = await setupBaseFixture(cookie);
      const other = await setupBaseFixture(cookie);
      const sale = await createAndConfirmSale(
        cookie,
        first.company.id,
        first.customer.id,
        first.warehouse.id,
        first.variant.id,
        1,
      );
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Cookie', [cookie])
        .send({
          companyId: first.company.id,
          direction: 'RECEIPT',
          customerId: first.customer.id,
          paymentMethodId: first.paymentMethod.id,
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
      const created = createResponse.body as PaymentBody;

      const response = await request(app.getHttpServer())
        .get(`/api/v1/payments/${created.id}?companyId=${other.company.id}`)
        .set('Cookie', [cookie]);
      expect(response.status).toBe(404);
    });
  });
});
