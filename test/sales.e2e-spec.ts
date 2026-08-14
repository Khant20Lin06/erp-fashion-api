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
  companyId: string;
}
interface CustomerBody {
  id: string;
  companyId: string;
}
interface EmployeeBody {
  id: string;
}
interface SalesAccountBody {
  id: string;
  companyId: string;
  branchId: string;
}
interface UserBody {
  id: string;
  email: string;
}
interface SaleItemBody {
  id: string;
  productVariantId: string;
  unitPriceSnapshot: string;
  quantity: number;
  lineTotal: string;
}
interface SaleBody {
  id: string;
  saleNumber: string;
  companyId: string;
  branchId: string | null;
  warehouseId: string | null;
  customerId: string;
  salesAccountId: string | null;
  status: string;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  grandTotal: string;
  paidAmount: string;
  balanceAmount: string;
  currency: string;
  items?: SaleItemBody[];
}

describeIfDb('Sales (Phase 12) (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let passwordService: PasswordService;

  let superAdminUser: User;
  let plainUser: User;

  const password = 'correct-horse-battery-staple';
  const prefix = 'SALE-E2E';

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
        name: 'Sale E2E Test Company',
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
    sku?: string,
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
          sku: sku ?? uniqueCode('SKU'),
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
  ): Promise<CustomerBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Cookie', [cookie])
      .send({
        companyId,
        customerCode: uniqueCode('CUST'),
        name: 'Acme Retail',
      });
    return response.body as CustomerBody;
  }

  async function createUser(cookie: string): Promise<UserBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Cookie', [cookie])
      .send({
        email: `sale-e2e-${rand()}@example.com`.toLowerCase(),
        password,
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
        employeeCode: uniqueCode('EMP'),
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
        code: uniqueCode('SA'),
        name: 'Sale E2E Sales Account',
        companyId,
        branchId,
        employeeId,
      });
    return response.body as SalesAccountBody;
  }

  /** Full setup: company, branch, warehouse, category, brand, variant, active price list item, customer. */
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
    const customer = await createCustomer(cookie, company.id);
    return {
      company,
      branch,
      warehouse,
      category,
      brand,
      variant,
      priceList,
      customer,
    };
  }

  async function countRows(sql: string, params: unknown[]): Promise<number> {
    const rows: Array<{ c: number | string }> = await dataSource.query(
      sql,
      params,
    );
    return Number(rows[0].c);
  }

  /**
   * Phase 14 test helper: seeds WarehouseStock via a real
   * POST /stock-adjustments (reason: OPENING_BALANCE) so Sale confirmation
   * (which now deducts real stock, Phase 14 locked decision D5) has
   * sufficient onHandQuantity to succeed. Uses the SUPER_ADMIN cookie —
   * callers needing a different actor should already hold their own
   * cookie for the actual test action.
   */
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

  async function createSale(
    cookie: string,
    companyId: string,
    customerId: string,
    items: Array<{
      productVariantId: string;
      quantity: number;
      discountAmount?: string;
      taxAmount?: string;
    }>,
    overrides: Partial<{
      branchId: string;
      warehouseId: string;
      salesAccountId: string;
      currency: string;
      saleType: string;
      notes: string;
      subtotal: string;
      grandTotal: string;
    }> = {},
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .post('/api/v1/sales')
      .set('Cookie', [cookie])
      .send({
        companyId,
        customerId,
        branchId: overrides.branchId,
        warehouseId: overrides.warehouseId,
        salesAccountId: overrides.salesAccountId,
        currency: overrides.currency ?? 'USD',
        saleType: overrides.saleType,
        notes: overrides.notes,
        subtotal: overrides.subtotal,
        grandTotal: overrides.grandTotal,
        items,
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
    // (children before parents) — mirrors the Phase 09/10/11 cleanup
    // convention (scope-to-own-prefix, never an unscoped DELETE).
    await dataSource.query(
      `DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM (SELECT id FROM sales WHERE sale_number LIKE 'SAL-%' AND company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
    );
    await dataSource.query(
      `DELETE FROM sales WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM company_sale_counters WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM sales_account_assignments WHERE sales_account_id IN (SELECT id FROM (SELECT id FROM sales_accounts WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM sales_accounts WHERE code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM employees WHERE employee_code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM customers WHERE customer_code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM price_list_items WHERE price_list_id IN (SELECT id FROM (SELECT id FROM price_lists WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM price_lists WHERE code LIKE '${prefix}%'`,
    );
    // Phase 14 addition: stock_movements/warehouse_stock/stock_adjustments/
    // goods_receipt_items/goods_receipts/stock_transfer_items/
    // stock_transfers all now reference product_variants and/or warehouses
    // (RESTRICT) — must be cleared before either of those tables' own
    // cleanup below, mirroring the Phase 09-established "children before
    // parents" convention. This suite's seedOpeningStock() helper creates
    // stock_adjustments rows; the others are included defensively since
    // they share the same FK risk profile even though this suite never
    // creates them directly.
    await dataSource.query(
      `DELETE FROM stock_movements WHERE product_variant_id IN (SELECT id FROM (SELECT id FROM product_variants WHERE sku LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM warehouse_stock WHERE product_variant_id IN (SELECT id FROM (SELECT id FROM product_variants WHERE sku LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM stock_adjustments WHERE product_variant_id IN (SELECT id FROM (SELECT id FROM product_variants WHERE sku LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM goods_receipt_items WHERE product_variant_id IN (SELECT id FROM (SELECT id FROM product_variants WHERE sku LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM stock_transfer_items WHERE product_variant_id IN (SELECT id FROM (SELECT id FROM product_variants WHERE sku LIKE '${prefix}%') t)`,
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
      `DELETE FROM stock_movements WHERE warehouse_id IN (SELECT id FROM (SELECT id FROM warehouses WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
    );
    await dataSource.query(
      `DELETE FROM warehouse_stock WHERE warehouse_id IN (SELECT id FROM (SELECT id FROM warehouses WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
    );
    await dataSource.query(
      `DELETE FROM stock_adjustments WHERE warehouse_id IN (SELECT id FROM (SELECT id FROM warehouses WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
    );
    await dataSource.query(
      `DELETE FROM goods_receipt_items WHERE goods_receipt_id IN (SELECT id FROM (SELECT id FROM goods_receipts WHERE warehouse_id IN (SELECT id FROM warehouses WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%'))) t)`,
    );
    await dataSource.query(
      `DELETE FROM goods_receipts WHERE warehouse_id IN (SELECT id FROM (SELECT id FROM warehouses WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
    );
    await dataSource.query(
      `DELETE FROM stock_transfer_items WHERE stock_transfer_id IN (SELECT id FROM (SELECT id FROM stock_transfers WHERE source_warehouse_id IN (SELECT id FROM warehouses WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%'))) t)`,
    );
    await dataSource.query(
      `DELETE FROM stock_transfers WHERE source_warehouse_id IN (SELECT id FROM (SELECT id FROM warehouses WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
    );
    await dataSource.query(
      `DELETE FROM warehouses WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM branches WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    // Phase 14 addition: the three per-company document counter tables
    // reference companies directly (RESTRICT) — must be cleared before
    // the companies delete below.
    await dataSource.query(
      `DELETE FROM company_goods_receipt_counters WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM company_stock_transfer_counters WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM company_stock_adjustment_counters WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM companies WHERE code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM user_roles WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE 'sale-e2e-%') t)`,
    );
    await dataSource.query("DELETE FROM users WHERE email LIKE 'sale-e2e-%'");

    const userRepository = dataSource.getRepository(User);
    const roleRepository = dataSource.getRepository(Role);
    const userRoleRepository = dataSource.getRepository(UserRole);

    superAdminUser = await userRepository.save(
      userRepository.create({
        email: 'sale-e2e-superadmin@example.com',
        passwordHash: await passwordService.hash(password),
        firstName: 'Sale',
        lastName: 'SuperAdmin',
        displayName: 'Sale Super Admin',
        status: UserStatus.Active,
        isEmailVerified: true,
        lastLoginAt: null,
        passwordChangedAt: null,
      }),
    );

    plainUser = await userRepository.save(
      userRepository.create({
        email: 'sale-e2e-plain@example.com',
        passwordHash: await passwordService.hash(password),
        firstName: 'Sale',
        lastName: 'Plain',
        displayName: 'Sale Plain User',
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
      `DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM (SELECT id FROM sales WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
    );
    await dataSource.query(
      `DELETE FROM sales WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM company_sale_counters WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM sales_account_assignments WHERE sales_account_id IN (SELECT id FROM (SELECT id FROM sales_accounts WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM sales_accounts WHERE code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM employees WHERE employee_code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM customers WHERE customer_code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM price_list_items WHERE price_list_id IN (SELECT id FROM (SELECT id FROM price_lists WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM price_lists WHERE code LIKE '${prefix}%'`,
    );
    // Phase 14 addition: stock_movements/warehouse_stock/stock_adjustments/
    // goods_receipt_items/stock_transfer_items all reference
    // product_variants and/or warehouses (RESTRICT) — must be cleared
    // before either of those tables' own cleanup below.
    await dataSource.query(
      `DELETE FROM stock_movements WHERE product_variant_id IN (SELECT id FROM (SELECT id FROM product_variants WHERE sku LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM warehouse_stock WHERE product_variant_id IN (SELECT id FROM (SELECT id FROM product_variants WHERE sku LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM stock_adjustments WHERE product_variant_id IN (SELECT id FROM (SELECT id FROM product_variants WHERE sku LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM goods_receipt_items WHERE product_variant_id IN (SELECT id FROM (SELECT id FROM product_variants WHERE sku LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM stock_transfer_items WHERE product_variant_id IN (SELECT id FROM (SELECT id FROM product_variants WHERE sku LIKE '${prefix}%') t)`,
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
      `DELETE FROM stock_movements WHERE warehouse_id IN (SELECT id FROM (SELECT id FROM warehouses WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
    );
    await dataSource.query(
      `DELETE FROM warehouse_stock WHERE warehouse_id IN (SELECT id FROM (SELECT id FROM warehouses WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
    );
    await dataSource.query(
      `DELETE FROM stock_adjustments WHERE warehouse_id IN (SELECT id FROM (SELECT id FROM warehouses WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
    );
    await dataSource.query(
      `DELETE FROM goods_receipt_items WHERE goods_receipt_id IN (SELECT id FROM (SELECT id FROM goods_receipts WHERE warehouse_id IN (SELECT id FROM warehouses WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%'))) t)`,
    );
    await dataSource.query(
      `DELETE FROM goods_receipts WHERE warehouse_id IN (SELECT id FROM (SELECT id FROM warehouses WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
    );
    await dataSource.query(
      `DELETE FROM stock_transfer_items WHERE stock_transfer_id IN (SELECT id FROM (SELECT id FROM stock_transfers WHERE source_warehouse_id IN (SELECT id FROM warehouses WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%'))) t)`,
    );
    await dataSource.query(
      `DELETE FROM stock_transfers WHERE source_warehouse_id IN (SELECT id FROM (SELECT id FROM warehouses WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
    );
    await dataSource.query(
      `DELETE FROM warehouses WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM branches WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    // Phase 14 addition: the three per-company document counter tables
    // reference companies directly (RESTRICT) — must be cleared before
    // the companies delete below.
    await dataSource.query(
      `DELETE FROM company_goods_receipt_counters WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM company_stock_transfer_counters WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM company_stock_adjustment_counters WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM companies WHERE code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM user_roles WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE 'sale-e2e-%') t)`,
    );
    await dataSource.query("DELETE FROM users WHERE email LIKE 'sale-e2e-%'");
    await app.close();
  });

  describe('authentication boundary', () => {
    it('returns 401 for sales endpoints without a session', async () => {
      const listResponse = await request(app.getHttpServer()).get(
        '/api/v1/sales',
      );
      expect(listResponse.status).toBe(401);

      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/sales')
        .send({});
      expect(createResponse.status).toBe(401);
    });
  });

  describe('permission boundary (403 for a plain authenticated user)', () => {
    it('rejects sale listing without sales.read', async () => {
      const cookie = await loginAndGetCookie(plainUser.email);
      const response = await request(app.getHttpServer())
        .get('/api/v1/sales')
        .set('Cookie', [cookie]);
      expect(response.status).toBe(403);
    });

    it('rejects sale creation without sales.create', async () => {
      const adminCookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, customer } =
        await setupBaseFixture(adminCookie);
      const cookie = await loginAndGetCookie(plainUser.email);

      const response = await createSale(cookie, company.id, customer.id, [
        { productVariantId: variant.id, quantity: 1 },
      ]);
      expect(response.status).toBe(403);
    });
  });

  describe('sale creation', () => {
    it('creates a DRAFT sale with server-resolved pricing', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, customer } = await setupBaseFixture(cookie);

      const response = await createSale(cookie, company.id, customer.id, [
        { productVariantId: variant.id, quantity: 2 },
      ]);

      expect(response.status).toBe(201);
      const sale = response.body as SaleBody;
      expect(sale.status).toBe('DRAFT');
      expect(sale.subtotal).toBe('200.00');
      expect(sale.grandTotal).toBe('200.00');
      expect(sale.balanceAmount).toBe('200.00');
      expect(sale.paidAmount).toBe('0.00');
      expect(sale.saleNumber).toMatch(/^SAL-\d{4}-\d{6}$/);
    });

    it('creates a multi-item sale and sums totals across all lines', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, category, brand, priceList, customer } =
        await setupBaseFixture(cookie);

      const variant2 = await createProductVariant(
        cookie,
        company.id,
        category.id,
        brand.id,
      );
      await createActivePriceListItem(
        cookie,
        company.id,
        priceList.id,
        variant2.id,
        '50.00',
      );

      const fixtureVariant = await createProductVariant(
        cookie,
        company.id,
        category.id,
        brand.id,
      );
      await createActivePriceListItem(
        cookie,
        company.id,
        priceList.id,
        fixtureVariant.id,
        '30.00',
      );

      const response = await createSale(cookie, company.id, customer.id, [
        { productVariantId: variant2.id, quantity: 2 },
        { productVariantId: fixtureVariant.id, quantity: 3 },
      ]);

      expect(response.status).toBe(201);
      const sale = response.body as SaleBody;
      // (50*2) + (30*3) = 100 + 90 = 190
      expect(sale.subtotal).toBe('190.00');
      expect(sale.grandTotal).toBe('190.00');
      expect(sale.items).toHaveLength(2);
    });

    it('rejects an items array with zero elements', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, customer } = await setupBaseFixture(cookie);

      const response = await createSale(cookie, company.id, customer.id, []);
      expect(response.status).toBe(400);
    });

    it('rejects unknown fields (400)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, customer } = await setupBaseFixture(cookie);

      const response = await request(app.getHttpServer())
        .post('/api/v1/sales')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          customerId: customer.id,
          currency: 'USD',
          items: [{ productVariantId: variant.id, quantity: 1 }],
          unexpectedField: 'should be rejected',
        });

      expect(response.status).toBe(400);
    });

    it('rejects a request that attempts to submit subtotal/grandTotal at all (CreateSaleDto has no such fields — forbidNonWhitelisted 400s it outright, stronger than silently ignoring)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, customer } = await setupBaseFixture(cookie);

      const response = await createSale(
        cookie,
        company.id,
        customer.id,
        [{ productVariantId: variant.id, quantity: 1 }],
        { subtotal: '1.00', grandTotal: '1.00' },
      );

      expect(response.status).toBe(400);
    });

    it('computes subtotal/grandTotal purely server-side from the resolved active price, never from any client input', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, customer } = await setupBaseFixture(cookie);

      const response = await createSale(cookie, company.id, customer.id, [
        { productVariantId: variant.id, quantity: 1 },
      ]);

      expect(response.status).toBe(201);
      const sale = response.body as SaleBody;
      // Fixture's active price is 100.00 — the only source of truth.
      expect(sale.subtotal).toBe('100.00');
      expect(sale.grandTotal).toBe('100.00');
    });

    it('rejects a per-line unitPrice submitted by the client (CreateSaleItemDto has no such field)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, customer } = await setupBaseFixture(cookie);

      const response = await request(app.getHttpServer())
        .post('/api/v1/sales')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          customerId: customer.id,
          currency: 'USD',
          items: [
            {
              productVariantId: variant.id,
              quantity: 1,
              unitPrice: '1.00',
            },
          ],
        });

      expect(response.status).toBe(400);
    });

    it('rejects invalid ProductVariant ids', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, customer } = await setupBaseFixture(cookie);

      const response = await createSale(cookie, company.id, customer.id, [
        {
          productVariantId: '00000000-0000-0000-0000-000000000000',
          quantity: 1,
        },
      ]);

      expect(response.status).toBe(404);
    });

    it('rejects when no active PriceListItem exists for the variant', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const category = await createCategory(cookie, company.id);
      const brand = await createBrand(cookie, company.id);
      const variant = await createProductVariant(
        cookie,
        company.id,
        category.id,
        brand.id,
      );
      // Deliberately no PriceListItem created for this variant.
      const customer = await createCustomer(cookie, company.id);

      const response = await createSale(cookie, company.id, customer.id, [
        { productVariantId: variant.id, quantity: 1 },
      ]);

      expect(response.status).toBe(400);
    });

    it('transactionally rolls back the whole sale when one item is invalid (partial multi-item failure)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, customer } = await setupBaseFixture(cookie);

      const beforeCount = await countRows(
        'SELECT COUNT(*) as c FROM sales WHERE company_id = ?',
        [company.id],
      );

      const response = await createSale(cookie, company.id, customer.id, [
        { productVariantId: variant.id, quantity: 1 },
        {
          productVariantId: '00000000-0000-0000-0000-000000000000',
          quantity: 1,
        },
      ]);

      expect(response.status).toBe(404);

      const afterCount = await countRows(
        'SELECT COUNT(*) as c FROM sales WHERE company_id = ?',
        [company.id],
      );
      expect(afterCount).toBe(beforeCount);

      const itemCount = await countRows(
        'SELECT COUNT(*) as c FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE s.company_id = ?',
        [company.id],
      );
      expect(itemCount).toBe(0);
    });
  });

  describe('sale-number uniqueness and concurrency', () => {
    it('generates unique, sequential sale numbers for sequential creations', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, customer } = await setupBaseFixture(cookie);

      const first = await createSale(cookie, company.id, customer.id, [
        { productVariantId: variant.id, quantity: 1 },
      ]);
      const second = await createSale(cookie, company.id, customer.id, [
        { productVariantId: variant.id, quantity: 1 },
      ]);

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect((first.body as SaleBody).saleNumber).not.toBe(
        (second.body as SaleBody).saleNumber,
      );
    });

    it('generates unique sale numbers under real concurrent POST /sales requests (no duplicates, no unexpected failures)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, customer } = await setupBaseFixture(cookie);

      const CONCURRENCY = 10;
      const responses = await Promise.all(
        Array.from({ length: CONCURRENCY }, () =>
          createSale(cookie, company.id, customer.id, [
            { productVariantId: variant.id, quantity: 1 },
          ]),
        ),
      );

      const failures = responses.filter((r) => r.status !== 201);
      expect(failures).toHaveLength(0);

      const saleNumbers = responses.map((r) => (r.body as SaleBody).saleNumber);
      const uniqueSaleNumbers = new Set(saleNumbers);
      expect(uniqueSaleNumbers.size).toBe(CONCURRENCY);
    });
  });

  describe('pricing snapshot correctness', () => {
    it('preserves unitPriceSnapshot after the PriceListItem price later changes', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, priceList, customer } =
        await setupBaseFixture(cookie);

      const saleResponse = await createSale(cookie, company.id, customer.id, [
        { productVariantId: variant.id, quantity: 1 },
      ]);
      expect(saleResponse.status).toBe(201);
      const sale = saleResponse.body as SaleBody;
      const originalUnitPrice = sale.items?.[0]?.unitPriceSnapshot;
      expect(originalUnitPrice).toBe('100.00');

      // Close the old price and open a new, higher price effective in the future
      // relative to the old row — simulate a price change after the sale.
      await dataSource.query(
        `UPDATE price_list_items SET valid_to = NOW() WHERE price_list_id = ? AND product_variant_id = ?`,
        [priceList.id, variant.id],
      );
      await createActivePriceListItem(
        cookie,
        company.id,
        priceList.id,
        variant.id,
        '999.00',
      );

      const refetched = await request(app.getHttpServer())
        .get(`/api/v1/sales/${sale.id}?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      expect(refetched.status).toBe(200);
      const refetchedSale = refetched.body as SaleBody;
      expect(refetchedSale.items?.[0]?.unitPriceSnapshot).toBe(
        originalUnitPrice,
      );
      expect(refetchedSale.items?.[0]?.unitPriceSnapshot).not.toBe('999.00');
    });
  });

  describe('customer integration', () => {
    it('rejects a cross-company customerId as not found (404)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const firstCompanyFixture = await setupBaseFixture(cookie);

      const otherCompany = await createCompany(cookie);
      const category = await createCategory(cookie, otherCompany.id);
      const brand = await createBrand(cookie, otherCompany.id);
      const otherVariant = await createProductVariant(
        cookie,
        otherCompany.id,
        category.id,
        brand.id,
      );
      const otherPriceList = await createPriceList(cookie, otherCompany.id);
      await createActivePriceListItem(
        cookie,
        otherCompany.id,
        otherPriceList.id,
        otherVariant.id,
        '10.00',
      );

      // Submit companyId of otherCompany with a customerId belonging to the
      // FIRST company — must be rejected as not found, never leaking
      // whether the customer exists elsewhere (IDOR-safe, matching Phase
      // 11's own cross-company Customer lookup convention).
      const response = await createSale(
        cookie,
        otherCompany.id,
        firstCompanyFixture.customer.id,
        [{ productVariantId: otherVariant.id, quantity: 1 }],
      );

      expect(response.status).toBe(404);
    });
  });

  describe('company/branch/warehouse isolation and spoofing rejection', () => {
    it('rejects a branchId belonging to a different company', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, customer } = await setupBaseFixture(cookie);
      const otherCompany = await createCompany(cookie);
      const otherBranch = await createBranch(cookie, otherCompany.id);

      const response = await createSale(
        cookie,
        company.id,
        customer.id,
        [{ productVariantId: variant.id, quantity: 1 }],
        { branchId: otherBranch.id },
      );

      expect(response.status).toBe(400);
    });

    it('rejects a warehouseId belonging to a different company', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, customer } = await setupBaseFixture(cookie);
      const otherCompany = await createCompany(cookie);
      const otherBranch = await createBranch(cookie, otherCompany.id);
      const otherWarehouse = await createWarehouse(
        cookie,
        otherCompany.id,
        otherBranch.id,
      );

      const response = await createSale(
        cookie,
        company.id,
        customer.id,
        [{ productVariantId: variant.id, quantity: 1 }],
        { warehouseId: otherWarehouse.id },
      );

      expect(response.status).toBe(400);
    });

    it('rejects a warehouseId that does not belong to the supplied branchId', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, branch, variant, customer } =
        await setupBaseFixture(cookie);
      const otherBranch = await createBranch(cookie, company.id);
      const otherWarehouse = await createWarehouse(
        cookie,
        company.id,
        otherBranch.id,
      );

      // otherWarehouse actually belongs to otherBranch, not the fixture's
      // own branch — submitting the fixture branchId alongside it must be
      // rejected (the exact Warehouse-belongs-to-a-different-branch
      // spoofing scenario Phase 07 already established for Warehouse
      // creation itself).
      const response = await createSale(
        cookie,
        company.id,
        customer.id,
        [{ productVariantId: variant.id, quantity: 1 }],
        { branchId: branch.id, warehouseId: otherWarehouse.id },
      );

      expect(response.status).toBe(400);
    });

    it('accepts a valid branch + warehouse combination', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, branch, warehouse, variant, customer } =
        await setupBaseFixture(cookie);

      const response = await createSale(
        cookie,
        company.id,
        customer.id,
        [{ productVariantId: variant.id, quantity: 1 }],
        { branchId: branch.id, warehouseId: warehouse.id },
      );

      expect(response.status).toBe(201);
      const sale = response.body as SaleBody;
      expect(sale.branchId).toBe(branch.id);
      expect(sale.warehouseId).toBe(warehouse.id);
    });
  });

  describe('SalesAccount integration', () => {
    it('proves canAccessSalesAccount is the sole gate: even SUPER_ADMIN (full permissions, ALL data scope) is rejected 403 when not assigned to the target sales account', async () => {
      const adminCookie = await loginAndGetCookie(superAdminUser.email);
      const { company, branch, variant, customer } =
        await setupBaseFixture(adminCookie);

      const employee = await createEmployee(adminCookie, company.id, branch.id);
      const user = await createUser(adminCookie);
      await request(app.getHttpServer())
        .post(`/api/v1/employees/${employee.id}/user`)
        .set('Cookie', [adminCookie])
        .send({ userId: user.id });

      const account = await createSalesAccount(
        adminCookie,
        company.id,
        branch.id,
        employee.id,
      );
      // Assignment exists for `user`, NOT for superAdminUser — proves
      // SalesAccount authorization is assignment-based, entirely
      // independent of RBAC permissions/DataScope breadth (Phase 12 locked
      // decision §A: canAccessSalesAccount is the only mechanism, no
      // permission/scope-based bypass exists).
      await request(app.getHttpServer())
        .post(`/api/v1/sales-accounts/${account.id}/assignments`)
        .set('Cookie', [adminCookie])
        .send({ userId: user.id, employeeId: employee.id });

      const response = await createSale(
        adminCookie,
        company.id,
        customer.id,
        [{ productVariantId: variant.id, quantity: 1 }],
        { salesAccountId: account.id },
      );

      expect(response.status).toBe(403);
    });

    it('rejects a cross-company SalesAccount as not found (404)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, customer } = await setupBaseFixture(cookie);
      const otherCompany = await createCompany(cookie);
      const otherBranch = await createBranch(cookie, otherCompany.id);
      const otherAccount = await createSalesAccount(
        cookie,
        otherCompany.id,
        otherBranch.id,
      );

      const response = await createSale(
        cookie,
        company.id,
        customer.id,
        [{ productVariantId: variant.id, quantity: 1 }],
        { salesAccountId: otherAccount.id },
      );

      expect(response.status).toBe(404);
    });

    it('rejects an unauthorized-but-existing SalesAccount as forbidden (403)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, branch, variant, customer } =
        await setupBaseFixture(cookie);
      const account = await createSalesAccount(cookie, company.id, branch.id);
      // No assignment created for SUPER_ADMIN -> account, so this must 403.

      const response = await createSale(
        cookie,
        company.id,
        customer.id,
        [{ productVariantId: variant.id, quantity: 1 }],
        { salesAccountId: account.id },
      );

      expect(response.status).toBe(403);
    });

    it('allows omitting salesAccountId entirely (null attribution)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, customer } = await setupBaseFixture(cookie);

      const response = await createSale(cookie, company.id, customer.id, [
        { productVariantId: variant.id, quantity: 1 },
      ]);

      expect(response.status).toBe(201);
      expect((response.body as SaleBody).salesAccountId).toBeNull();
    });
  });

  describe('lifecycle: DRAFT -> CONFIRMED / CANCELLED', () => {
    it('confirms a DRAFT sale and deducts stock (Phase 14 D5)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant, customer } =
        await setupBaseFixture(cookie);
      await seedOpeningStock(cookie, company.id, warehouse.id, variant.id, 10);
      const saleResponse = await createSale(
        cookie,
        company.id,
        customer.id,
        [{ productVariantId: variant.id, quantity: 1 }],
        { warehouseId: warehouse.id },
      );
      const sale = saleResponse.body as SaleBody;

      const response = await request(app.getHttpServer())
        .post(`/api/v1/sales/${sale.id}/confirm?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(200);
      expect((response.body as SaleBody).status).toBe('CONFIRMED');

      const stockResponse = await request(app.getHttpServer())
        .get(
          `/api/v1/warehouse-stock?companyId=${company.id}&warehouseId=${warehouse.id}&productVariantId=${variant.id}`,
        )
        .set('Cookie', [cookie]);
      const stockBody = stockResponse.body as {
        data: Array<{ onHandQuantity: number }>;
      };
      expect(stockBody.data[0]?.onHandQuantity).toBe(9);
    });

    it('rejects confirmation with 409 when stock is insufficient, leaving the sale in DRAFT', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant, customer } =
        await setupBaseFixture(cookie);
      await seedOpeningStock(cookie, company.id, warehouse.id, variant.id, 1);
      const saleResponse = await createSale(
        cookie,
        company.id,
        customer.id,
        [{ productVariantId: variant.id, quantity: 5 }],
        { warehouseId: warehouse.id },
      );
      const sale = saleResponse.body as SaleBody;

      const response = await request(app.getHttpServer())
        .post(`/api/v1/sales/${sale.id}/confirm?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(409);

      const refetched = await request(app.getHttpServer())
        .get(`/api/v1/sales/${sale.id}?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      expect((refetched.body as SaleBody).status).toBe('DRAFT');
    });

    it('rejects confirmation when Sale.warehouseId is null (400)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, customer } = await setupBaseFixture(cookie);
      const saleResponse = await createSale(cookie, company.id, customer.id, [
        { productVariantId: variant.id, quantity: 1 },
      ]);
      const sale = saleResponse.body as SaleBody;
      expect(sale.warehouseId).toBeNull();

      const response = await request(app.getHttpServer())
        .post(`/api/v1/sales/${sale.id}/confirm?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(400);
    });

    it('a multi-item sale confirmation is atomic: one insufficient item rolls back the whole thing (no partial deduction)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, category, brand, customer, priceList } =
        await setupBaseFixture(cookie);
      // Reuse setupBaseFixture's own single active price list — creating a
      // second one here would trigger Sale's own "ambiguous price list"
      // 400 rejection (Phase 12 locked rule: exactly one company ACTIVE
      // price list resolves automatically, otherwise priceListId is
      // required per item).
      const variant2 = await createProductVariant(
        cookie,
        company.id,
        category.id,
        brand.id,
      );
      await createActivePriceListItem(
        cookie,
        company.id,
        priceList.id,
        variant2.id,
        '50.00',
      );

      await seedOpeningStock(cookie, company.id, warehouse.id, variant2.id, 1);
      // No stock seeded at all for a second, brand-new variant — guaranteed
      // insufficient (0 available).
      const variant3 = await createProductVariant(
        cookie,
        company.id,
        category.id,
        brand.id,
      );
      await createActivePriceListItem(
        cookie,
        company.id,
        priceList.id,
        variant3.id,
        '20.00',
      );

      const saleResponse = await createSale(
        cookie,
        company.id,
        customer.id,
        [
          { productVariantId: variant2.id, quantity: 1 },
          { productVariantId: variant3.id, quantity: 1 },
        ],
        { warehouseId: warehouse.id },
      );
      const sale = saleResponse.body as SaleBody;

      const response = await request(app.getHttpServer())
        .post(`/api/v1/sales/${sale.id}/confirm?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(409);

      // variant2's stock must remain untouched (1) — proving atomicity.
      const stockResponse = await request(app.getHttpServer())
        .get(
          `/api/v1/warehouse-stock?companyId=${company.id}&warehouseId=${warehouse.id}&productVariantId=${variant2.id}`,
        )
        .set('Cookie', [cookie]);
      const stockBody = stockResponse.body as {
        data: Array<{ onHandQuantity: number }>;
      };
      expect(stockBody.data[0]?.onHandQuantity).toBe(1);
    });

    it('cancels a DRAFT sale', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, customer } = await setupBaseFixture(cookie);
      const saleResponse = await createSale(cookie, company.id, customer.id, [
        { productVariantId: variant.id, quantity: 1 },
      ]);
      const sale = saleResponse.body as SaleBody;

      const response = await request(app.getHttpServer())
        .post(`/api/v1/sales/${sale.id}/cancel?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(200);
      expect((response.body as SaleBody).status).toBe('CANCELLED');
    });

    it('rejects CONFIRMED -> CANCELLED (409)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant, customer } =
        await setupBaseFixture(cookie);
      await seedOpeningStock(cookie, company.id, warehouse.id, variant.id, 10);
      const saleResponse = await createSale(
        cookie,
        company.id,
        customer.id,
        [{ productVariantId: variant.id, quantity: 1 }],
        { warehouseId: warehouse.id },
      );
      const sale = saleResponse.body as SaleBody;
      await request(app.getHttpServer())
        .post(`/api/v1/sales/${sale.id}/confirm?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/sales/${sale.id}/cancel?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(409);
    });

    it('rejects re-confirming an already-CONFIRMED sale (409)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant, customer } =
        await setupBaseFixture(cookie);
      await seedOpeningStock(cookie, company.id, warehouse.id, variant.id, 10);
      const saleResponse = await createSale(
        cookie,
        company.id,
        customer.id,
        [{ productVariantId: variant.id, quantity: 1 }],
        { warehouseId: warehouse.id },
      );
      const sale = saleResponse.body as SaleBody;
      await request(app.getHttpServer())
        .post(`/api/v1/sales/${sale.id}/confirm?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/sales/${sale.id}/confirm?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(409);
    });

    it('rejects CANCELLED -> CONFIRMED (409)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, customer } = await setupBaseFixture(cookie);
      const saleResponse = await createSale(cookie, company.id, customer.id, [
        { productVariantId: variant.id, quantity: 1 },
      ]);
      const sale = saleResponse.body as SaleBody;
      await request(app.getHttpServer())
        .post(`/api/v1/sales/${sale.id}/cancel?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/sales/${sale.id}/confirm?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(409);
    });

    it('rejects re-cancelling an already-CANCELLED sale (409)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, customer } = await setupBaseFixture(cookie);
      const saleResponse = await createSale(cookie, company.id, customer.id, [
        { productVariantId: variant.id, quantity: 1 },
      ]);
      const sale = saleResponse.body as SaleBody;
      await request(app.getHttpServer())
        .post(`/api/v1/sales/${sale.id}/cancel?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/sales/${sale.id}/cancel?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(409);
    });

    it('no generic PATCH /sales/:id endpoint exists (405 or 404)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, customer } = await setupBaseFixture(cookie);
      const saleResponse = await createSale(cookie, company.id, customer.id, [
        { productVariantId: variant.id, quantity: 1 },
      ]);
      const sale = saleResponse.body as SaleBody;

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/sales/${sale.id}`)
        .set('Cookie', [cookie])
        .send({ status: 'CONFIRMED' });

      expect([404, 405]).toContain(response.status);
    });
  });

  describe('confirmed-sale immutability', () => {
    it('a CONFIRMED sale retains its original financial values (no update path exists to change them)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant, customer } =
        await setupBaseFixture(cookie);
      await seedOpeningStock(cookie, company.id, warehouse.id, variant.id, 10);
      const saleResponse = await createSale(
        cookie,
        company.id,
        customer.id,
        [{ productVariantId: variant.id, quantity: 1 }],
        { warehouseId: warehouse.id },
      );
      const sale = saleResponse.body as SaleBody;
      await request(app.getHttpServer())
        .post(`/api/v1/sales/${sale.id}/confirm?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      const refetched = await request(app.getHttpServer())
        .get(`/api/v1/sales/${sale.id}?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      const refetchedSale = refetched.body as SaleBody;
      expect(refetchedSale.status).toBe('CONFIRMED');
      expect(refetchedSale.grandTotal).toBe(sale.grandTotal);
      expect(refetchedSale.subtotal).toBe(sale.subtotal);
    });
  });

  describe('GET /sales and /sales/:id', () => {
    it('lists sales scoped to the resolved company', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, customer } = await setupBaseFixture(cookie);
      await createSale(cookie, company.id, customer.id, [
        { productVariantId: variant.id, quantity: 1 },
      ]);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/sales?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(200);
      const body = response.body as { data: SaleBody[] };
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data.every((s) => s.companyId === company.id)).toBe(true);
    });

    it('returns 404 for a cross-company sale id lookup', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, customer } = await setupBaseFixture(cookie);
      const saleResponse = await createSale(cookie, company.id, customer.id, [
        { productVariantId: variant.id, quantity: 1 },
      ]);
      const sale = saleResponse.body as SaleBody;
      const otherCompany = await createCompany(cookie);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/sales/${sale.id}?companyId=${otherCompany.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(404);
    });
  });
});
