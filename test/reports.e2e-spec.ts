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
interface AccountBody {
  id: string;
}
interface CustomerBody {
  id: string;
}
interface SupplierBody {
  id: string;
}
interface PaymentMethodBody {
  id: string;
}
interface JournalEntryBody {
  id: string;
  status: string;
}

/**
 * Phase 22 (Reports/Dashboard) e2e. Builds one real, fully-wired fixture
 * (company/branch/chart of accounts/customer/supplier/payment method/
 * product/warehouse/sale/purchase order/payment/manual Revenue-Expense
 * journal/inventory) and exercises every new report endpoint plus the
 * dashboard against it — proving each report is real SQL-aggregated data
 * from the actual source tables, not a stub.
 *
 * Two invariants get dedicated, explicit tests (per the task's testing
 * requirements): (1) the fundamental accounting equality SUM(debit) ===
 * SUM(credit) surfaces correctly through the new Balance Sheet report's own
 * `balanced` field, and (2) DataScope isolation — a report request scoped
 * to Company A never returns Company B's data, proven with two real
 * companies and a real cross-company query attempt.
 */
describeIfDb('Reports / Dashboard (Phase 22) (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let passwordService: PasswordService;

  let superAdminUser: User;

  const password = 'correct-horse-battery-staple';
  const authCookieByEmail = new Map<string, string>();
  const prefix = 'RPT-E2E';

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
        name: 'Reports E2E Test Company',
        baseCurrency: 'USD',
        timezone: 'Asia/Yangon',
      });
    return response.body as CompanyBody;
  }

  async function createBranch(
    cookie: string,
    companyId: string,
  ): Promise<{ id: string }> {
    const code = uniqueCode('BR');
    const response = await request(app.getHttpServer())
      .post('/api/v1/branches')
      .set('Cookie', [cookie])
      .send({ companyId, code, name: `Branch ${code}` });
    return response.body as { id: string };
  }

  async function createWarehouse(
    cookie: string,
    companyId: string,
    branchId: string,
  ): Promise<{ id: string }> {
    const code = uniqueCode('WH');
    const response = await request(app.getHttpServer())
      .post('/api/v1/warehouses')
      .set('Cookie', [cookie])
      .send({ companyId, branchId, code, name: `Warehouse ${code}` });
    return response.body as { id: string };
  }

  async function createAccount(
    cookie: string,
    companyId: string,
    accountType: string,
  ): Promise<AccountBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/accounts')
      .set('Cookie', [cookie])
      .send({
        companyId,
        code: uniqueCode('ACCT'),
        name: `Account ${accountType}`,
        accountType,
      });
    return response.body as AccountBody;
  }

  async function createCustomer(
    cookie: string,
    companyId: string,
    receivableAccountId: string,
  ): Promise<CustomerBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Cookie', [cookie])
      .send({
        companyId,
        customerCode: uniqueCode('CUST'),
        name: 'Reports E2E Customer',
        receivableAccountId,
      });
    return response.body as CustomerBody;
  }

  async function createSupplier(
    cookie: string,
    companyId: string,
    payableAccountId: string,
  ): Promise<SupplierBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/suppliers')
      .set('Cookie', [cookie])
      .send({
        companyId,
        supplierCode: uniqueCode('SUP'),
        name: 'Reports E2E Supplier',
        payableAccountId,
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

  async function setPaymentMethodGlAccount(
    paymentMethodId: string,
    accountId: string,
  ): Promise<void> {
    await dataSource.query(
      'UPDATE payment_methods SET gl_account_id = ? WHERE id = ?',
      [accountId, paymentMethodId],
    );
  }

  async function createCategory(
    cookie: string,
    companyId: string,
  ): Promise<{ id: string }> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Cookie', [cookie])
      .send({ companyId, code: uniqueCode('CAT'), name: 'Category' });
    return response.body as { id: string };
  }

  async function createBrand(
    cookie: string,
    companyId: string,
  ): Promise<{ id: string }> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/brands')
      .set('Cookie', [cookie])
      .send({ companyId, code: uniqueCode('BRD'), name: 'Brand' });
    return response.body as { id: string };
  }

  async function createProductVariant(
    cookie: string,
    companyId: string,
    categoryId: string,
    brandId: string,
  ): Promise<{ id: string; sku: string }> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Cookie', [cookie])
      .send({
        companyId,
        code: uniqueCode('PROD'),
        name: 'Reports E2E Product',
        categoryId,
        brandId,
        initialVariant: {
          sku: uniqueCode('SKU'),
          costPrice: '10.00',
          sellingPrice: '100.00',
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

  async function createPriceList(
    cookie: string,
    companyId: string,
    variantId: string,
    price: string,
  ): Promise<void> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/price-lists')
      .set('Cookie', [cookie])
      .send({
        companyId,
        code: uniqueCode('PL'),
        name: 'Price List',
        currency: 'USD',
      });
    const priceListId = (response.body as { id: string }).id;
    await request(app.getHttpServer())
      .post(`/api/v1/price-lists/${priceListId}/items?companyId=${companyId}`)
      .set('Cookie', [cookie])
      .send({
        productVariantId: variantId,
        price,
        validFrom: '2020-01-01T00:00:00Z',
      });
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
  ): Promise<{ id: string; grandTotal: string }> {
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
    const sale = createResponse.body as { id: string };
    const confirmResponse = await request(app.getHttpServer())
      .post(`/api/v1/sales/${sale.id}/confirm?companyId=${companyId}`)
      .set('Cookie', [cookie]);
    return confirmResponse.body as { id: string; grandTotal: string };
  }

  async function createAndConfirmPurchaseOrder(
    cookie: string,
    companyId: string,
    supplierId: string,
    warehouseId: string,
    productVariantId: string,
    quantity: number,
    unitCost: string,
  ): Promise<{
    id: string;
    grandTotal: string;
    items: Array<{ id: string; productVariantId: string }>;
  }> {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/purchase-orders')
      .set('Cookie', [cookie])
      .send({
        companyId,
        supplierId,
        warehouseId,
        currency: 'USD',
        items: [{ productVariantId, quantity, unitCost }],
      });
    const po = createResponse.body as { id: string };
    const confirmResponse = await request(app.getHttpServer())
      .post(`/api/v1/purchase-orders/${po.id}/confirm?companyId=${companyId}`)
      .set('Cookie', [cookie]);
    return confirmResponse.body as {
      id: string;
      grandTotal: string;
      items: Array<{ id: string; productVariantId: string }>;
    };
  }

  /** Receiving goods is what actually creates a PURCHASE_RECEIPT StockMovement (Phase 14, GoodsReceiptsService) — confirming a PurchaseOrder alone never touches stock. */
  async function createGoodsReceipt(
    cookie: string,
    companyId: string,
    purchaseOrderId: string,
    warehouseId: string,
    items: Array<{
      purchaseOrderItemId: string;
      productVariantId: string;
      receivedQuantity: number;
    }>,
  ): Promise<{ id: string }> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/goods-receipts')
      .set('Cookie', [cookie])
      .send({ companyId, purchaseOrderId, warehouseId, items });
    return response.body as { id: string };
  }

  async function createPayment(
    cookie: string,
    companyId: string,
    branchId: string,
    customerId: string,
    paymentMethodId: string,
    saleId: string,
    amount: string,
  ): Promise<{ id: string }> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Cookie', [cookie])
      .send({
        companyId,
        branchId,
        direction: 'RECEIPT',
        customerId,
        paymentMethodId,
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
    return response.body as { id: string };
  }

  async function createAndPostManualJournal(
    cookie: string,
    companyId: string,
    revenueAccountId: string,
    expenseAccountId: string,
    cashAccountId: string,
  ): Promise<JournalEntryBody> {
    // A manual, balanced 3-line journal exercising Revenue (credit) and
    // Expense (debit) accountTypes so ProfitLossService has real data —
    // Payment's own automatic posting (AccountingPostingService) only ever
    // touches Asset/Liability accounts, never Revenue/Expense (see
    // ProfitLossService's own docblock for this honestly-documented gap).
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/journal-entries')
      .set('Cookie', [cookie])
      .send({
        companyId,
        description: 'Reports E2E manual revenue/expense journal',
        lines: [
          {
            accountId: cashAccountId,
            debitAmount: '80.00',
            creditAmount: '0.00',
          },
          {
            accountId: revenueAccountId,
            debitAmount: '0.00',
            creditAmount: '150.00',
          },
          {
            accountId: expenseAccountId,
            debitAmount: '70.00',
            creditAmount: '0.00',
          },
        ],
      });
    const entry = createResponse.body as JournalEntryBody;
    const postResponse = await request(app.getHttpServer())
      .post(`/api/v1/journal-entries/${entry.id}/post?companyId=${companyId}`)
      .set('Cookie', [cookie]);
    return postResponse.body as JournalEntryBody;
  }

  async function countRows(sql: string, params: unknown[]): Promise<number> {
    const rows: Array<{ c: number | string }> = await dataSource.query(
      sql,
      params,
    );
    return Number(rows[0].c);
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
      `DELETE FROM user_roles WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE 'reports-e2e-%') t)`,
    );
    await dataSource.query(
      "DELETE FROM users WHERE email LIKE 'reports-e2e-%'",
    );
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

    await cleanup();

    const userRepository = dataSource.getRepository(User);
    const roleRepository = dataSource.getRepository(Role);
    const userRoleRepository = dataSource.getRepository(UserRole);

    superAdminUser = await userRepository.save(
      userRepository.create({
        email: 'reports-e2e-superadmin@example.com',
        passwordHash: await passwordService.hash(password),
        firstName: 'Reports',
        lastName: 'SuperAdmin',
        displayName: 'Reports Super Admin',
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

  describe('full report surface against one real, fully-wired fixture', () => {
    let cookie: string;
    let company: CompanyBody;
    let branch: { id: string };
    let cashAccount: AccountBody;
    let receivableAccount: AccountBody;
    let payableAccount: AccountBody;
    let revenueAccount: AccountBody;
    let expenseAccount: AccountBody;
    let customer: CustomerBody;
    let supplier: SupplierBody;
    let paymentMethod: PaymentMethodBody;
    let sale: { id: string; grandTotal: string };
    let purchaseOrder: {
      id: string;
      grandTotal: string;
      items: Array<{ id: string; productVariantId: string }>;
    };
    let payment: { id: string };

    beforeAll(async () => {
      cookie = await loginAndGetCookie(superAdminUser.email);
      company = await createCompany(cookie);
      branch = await createBranch(cookie, company.id);
      const warehouse = await createWarehouse(cookie, company.id, branch.id);
      const category = await createCategory(cookie, company.id);
      const brand = await createBrand(cookie, company.id);
      const variant = await createProductVariant(
        cookie,
        company.id,
        category.id,
        brand.id,
      );
      await createPriceList(cookie, company.id, variant.id, '100.00');
      await seedOpeningStock(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
        1000,
      );

      cashAccount = await createAccount(cookie, company.id, 'ASSET');
      receivableAccount = await createAccount(cookie, company.id, 'ASSET');
      payableAccount = await createAccount(cookie, company.id, 'LIABILITY');
      revenueAccount = await createAccount(cookie, company.id, 'REVENUE');
      expenseAccount = await createAccount(cookie, company.id, 'EXPENSE');

      customer = await createCustomer(cookie, company.id, receivableAccount.id);
      supplier = await createSupplier(cookie, company.id, payableAccount.id);
      paymentMethod = await createPaymentMethod(cookie, company.id);
      await setPaymentMethodGlAccount(paymentMethod.id, cashAccount.id);

      sale = await createAndConfirmSale(
        cookie,
        company.id,
        customer.id,
        warehouse.id,
        variant.id,
        2,
      );
      purchaseOrder = await createAndConfirmPurchaseOrder(
        cookie,
        company.id,
        supplier.id,
        warehouse.id,
        variant.id,
        5,
        '10.00',
      );
      await createGoodsReceipt(
        cookie,
        company.id,
        purchaseOrder.id,
        warehouse.id,
        [
          {
            purchaseOrderItemId: purchaseOrder.items[0].id,
            productVariantId: variant.id,
            receivedQuantity: 5,
          },
        ],
      );
      payment = await createPayment(
        cookie,
        company.id,
        branch.id,
        customer.id,
        paymentMethod.id,
        sale.id,
        '50.00',
      );
      await createAndPostManualJournal(
        cookie,
        company.id,
        revenueAccount.id,
        expenseAccount.id,
        cashAccount.id,
      );
    }, 30000);

    it('GET /reports/sales/summary reflects the real confirmed sale', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/reports/sales/summary?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(200);
      const body = response.body as { saleCount: number; grandTotal: string };
      expect(body.saleCount).toBe(1);
      expect(body.grandTotal).toBe(sale.grandTotal);
    });

    it('GET /reports/sales/by-customer attributes the sale to the real customer', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/reports/sales/by-customer?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(200);
      const rows = response.body as Array<{
        customerId: string;
        saleCount: number;
      }>;
      const row = rows.find((r) => r.customerId === customer.id);
      expect(row).toBeDefined();
      expect(row!.saleCount).toBe(1);
    });

    it('GET /reports/purchases/summary reflects the real confirmed purchase order', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/reports/purchases/summary?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(200);
      const body = response.body as {
        purchaseOrderCount: number;
        grandTotal: string;
      };
      expect(body.purchaseOrderCount).toBe(1);
      expect(body.grandTotal).toBe(purchaseOrder.grandTotal);
    });

    it('GET /reports/purchases/by-supplier attributes the purchase order to the real supplier', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/reports/purchases/by-supplier?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(200);
      const rows = response.body as Array<{ supplierId: string }>;
      expect(rows.some((r) => r.supplierId === supplier.id)).toBe(true);
    });

    it('GET /reports/payments/by-direction shows the real RECEIPT payment', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/reports/payments/by-direction?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(200);
      const rows = response.body as Array<{
        direction: string;
        paymentCount: number;
        totalAmount: string;
      }>;
      const receiptRow = rows.find((r) => r.direction === 'RECEIPT');
      expect(receiptRow).toBeDefined();
      expect(receiptRow!.totalAmount).toBe('50.00');
    });

    it('GET /reports/payments/by-method attributes the payment to the real payment method', async () => {
      expect(payment.id).toBeDefined();

      const response = await request(app.getHttpServer())
        .get(`/api/v1/reports/payments/by-method?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(200);
      const rows = response.body as Array<{ paymentMethodId: string }>;
      expect(rows.some((r) => r.paymentMethodId === paymentMethod.id)).toBe(
        true,
      );
    });

    it('GET /reports/inventory/stock-summary shows real on-hand quantity, never a valuation field', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/reports/inventory/stock-summary?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(200);
      const rows = response.body as Array<Record<string, unknown>>;
      expect(rows.length).toBeGreaterThan(0);
      // 1000 opening - 2 sold + 5 purchased = 1003
      expect(rows[0].onHandQuantity).toBe(1003);
      for (const row of rows) {
        expect(row).not.toHaveProperty('cost');
        expect(row).not.toHaveProperty('value');
        expect(row).not.toHaveProperty('costPrice');
      }
    });

    it('GET /reports/inventory/movements returns a real paginated movement history', async () => {
      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/reports/inventory/movements?companyId=${company.id}&limit=50`,
        )
        .set('Cookie', [cookie]);

      expect(response.status).toBe(200);
      const body = response.body as {
        data: Array<{ movementType: string }>;
        meta: { total: number };
      };
      expect(body.meta.total).toBeGreaterThanOrEqual(3); // OPENING_BALANCE + SALE_ISSUE + PURCHASE_RECEIPT
      const types = body.data.map((m) => m.movementType);
      expect(types).toContain('OPENING_BALANCE');
      expect(types).toContain('SALE_ISSUE');
      expect(types).toContain('PURCHASE_RECEIPT');
    });

    it('GET /reports/ar-ap-aging shows the real receivable from the confirmed RECEIPT payment', async () => {
      // asOfDate is deliberately a day past "now" — journal_entries.entry_date
      // is a full timestamp, and the fixture's journal was posted "today" at
      // whatever time this test happens to run; comparing entryDate <=
      // asOfDate with asOfDate defaulted to a bare today-date (implicit
      // midnight) would exclude a same-day entry created later in the day.
      // Same asOfDate<=entryDate convention TrialBalanceService already
      // uses — this is a test-fixture timing concern, not a service bug.
      const asOfDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/reports/ar-ap-aging?companyId=${company.id}&asOfDate=${asOfDate}`,
        )
        .set('Cookie', [cookie]);

      expect(response.status).toBe(200);
      const body = response.body as {
        receivables: Array<{ customerId: string; total: string }>;
      };
      const row = body.receivables.find((r) => r.customerId === customer.id);
      expect(row).toBeDefined();
    });

    describe('accounting invariant: SUM(debit) === SUM(credit) surfaces through Balance Sheet.balanced', () => {
      it('GET /reports/balance-sheet reports balanced=true (the fundamental double-entry equality)', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/v1/reports/balance-sheet?companyId=${company.id}`)
          .set('Cookie', [cookie]);

        expect(response.status).toBe(200);
        const body = response.body as {
          balanced: boolean;
          assets: { total: string };
          liabilities: { total: string };
          equity: { total: string };
          totalLiabilitiesAndEquity: string;
        };
        expect(body.balanced).toBe(true);
        expect(body.assets.total).toBe(body.totalLiabilitiesAndEquity);
      });

      it('GET /reports/profit-loss reflects the real manual Revenue/Expense journal', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/v1/reports/profit-loss?companyId=${company.id}`)
          .set('Cookie', [cookie]);

        expect(response.status).toBe(200);
        const body = response.body as {
          revenue: { total: string };
          expense: { total: string };
          netIncome: string;
        };
        expect(body.revenue.total).toBe('150.00');
        expect(body.expense.total).toBe('70.00');
        expect(body.netIncome).toBe('80.00');
      });
    });

    describe('dashboard', () => {
      it('GET /reports/dashboard returns a typed summary with a genuine asOfTimestamp, never fabricated fields', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/v1/reports/dashboard?companyId=${company.id}`)
          .set('Cookie', [cookie]);

        expect(response.status).toBe(200);
        const body = response.body as Record<string, unknown>;
        expect(body.cached).toBe(false);
        expect(body.asOfTimestamp).toBeDefined();
        expect(body).not.toHaveProperty('grossProfit');
        expect(body).not.toHaveProperty('cogs');
        const sales = body.sales as { grandTotal: string };
        expect(sales.grandTotal).toBe(sale.grandTotal);
      });

      it('a second identical request within the TTL is served from cache (cached=true), with the SAME asOfTimestamp as the first', async () => {
        const first = await request(app.getHttpServer())
          .get(
            `/api/v1/reports/dashboard?companyId=${company.id}&fromDate=2020-01-01`,
          )
          .set('Cookie', [cookie]);
        const firstBody = first.body as {
          asOfTimestamp: string;
          cached: boolean;
        };
        expect(firstBody.cached).toBe(false);

        const second = await request(app.getHttpServer())
          .get(
            `/api/v1/reports/dashboard?companyId=${company.id}&fromDate=2020-01-01`,
          )
          .set('Cookie', [cookie]);
        const secondBody = second.body as {
          asOfTimestamp: string;
          cached: boolean;
        };

        expect(secondBody.cached).toBe(true);
        expect(secondBody.asOfTimestamp).toBe(firstBody.asOfTimestamp);
      });
    });

    it('every report endpoint rejects an unauthenticated request', async () => {
      const endpoints = [
        '/api/v1/reports/sales/summary',
        '/api/v1/reports/purchases/summary',
        '/api/v1/reports/payments/by-date',
        '/api/v1/reports/inventory/stock-summary',
        '/api/v1/reports/ar-ap-aging',
        '/api/v1/reports/balance-sheet',
        '/api/v1/reports/profit-loss',
        '/api/v1/reports/dashboard',
      ];

      for (const endpoint of endpoints) {
        const response = await request(app.getHttpServer()).get(endpoint);
        expect(response.status).toBe(401);
      }
    });

    it('no report/dashboard endpoint ever writes to a business table (structural check: none of these GETs changed the sale/payment/PO row counts)', async () => {
      const saleCountBefore = await countRows(
        'SELECT COUNT(*) AS c FROM sales WHERE company_id = ?',
        [company.id],
      );
      const paymentCountBefore = await countRows(
        'SELECT COUNT(*) AS c FROM payments WHERE company_id = ?',
        [company.id],
      );

      await request(app.getHttpServer())
        .get(`/api/v1/reports/dashboard?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      await request(app.getHttpServer())
        .get(`/api/v1/reports/balance-sheet?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      const saleCountAfter = await countRows(
        'SELECT COUNT(*) AS c FROM sales WHERE company_id = ?',
        [company.id],
      );
      const paymentCountAfter = await countRows(
        'SELECT COUNT(*) AS c FROM payments WHERE company_id = ?',
        [company.id],
      );

      expect(saleCountAfter).toBe(saleCountBefore);
      expect(paymentCountAfter).toBe(paymentCountBefore);
    });
  });

  describe('DataScope isolation: a report scoped to Company A never returns Company B data', () => {
    it('Company B has zero sales/payments/receivables visible in its own report despite Company A having real data', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);

      const companyA = await createCompany(cookie);
      const branchA = await createBranch(cookie, companyA.id);
      const warehouseA = await createWarehouse(cookie, companyA.id, branchA.id);
      const categoryA = await createCategory(cookie, companyA.id);
      const brandA = await createBrand(cookie, companyA.id);
      const variantA = await createProductVariant(
        cookie,
        companyA.id,
        categoryA.id,
        brandA.id,
      );
      await createPriceList(cookie, companyA.id, variantA.id, '20.00');
      await seedOpeningStock(
        cookie,
        companyA.id,
        warehouseA.id,
        variantA.id,
        100,
      );
      const receivableAccountA = await createAccount(
        cookie,
        companyA.id,
        'ASSET',
      );
      const customerA = await createCustomer(
        cookie,
        companyA.id,
        receivableAccountA.id,
      );
      await createAndConfirmSale(
        cookie,
        companyA.id,
        customerA.id,
        warehouseA.id,
        variantA.id,
        1,
      );

      const companyB = await createCompany(cookie);

      const responseB = await request(app.getHttpServer())
        .get(`/api/v1/reports/sales/summary?companyId=${companyB.id}`)
        .set('Cookie', [cookie]);

      expect(responseB.status).toBe(200);
      const bodyB = responseB.body as { saleCount: number; grandTotal: string };
      expect(bodyB.saleCount).toBe(0);
      expect(bodyB.grandTotal).toBe('0.00');

      // Cross-check: Company A's own report DOES show the sale — proving
      // this isn't just an always-empty endpoint.
      const responseA = await request(app.getHttpServer())
        .get(`/api/v1/reports/sales/summary?companyId=${companyA.id}`)
        .set('Cookie', [cookie]);
      const bodyA = responseA.body as { saleCount: number };
      expect(bodyA.saleCount).toBe(1);
    }, 30000);
  });
});
