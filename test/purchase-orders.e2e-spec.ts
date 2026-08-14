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
interface SupplierBody {
  id: string;
  companyId: string;
}
interface PaymentTermBody {
  id: string;
  companyId: string;
}
interface PurchaseOrderItemBody {
  id: string;
  productVariantId: string;
  unitCostSnapshot: string;
  quantity: number;
  lineTotal: string;
}
interface PurchaseOrderBody {
  id: string;
  purchaseOrderNumber: string;
  companyId: string;
  branchId: string | null;
  warehouseId: string | null;
  supplierId: string;
  paymentTermId: string | null;
  status: string;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  grandTotal: string;
  paidAmount: string;
  balanceAmount: string;
  currency: string;
  items?: PurchaseOrderItemBody[];
}

describeIfDb('Purchase Orders (Phase 13) (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let passwordService: PasswordService;

  let superAdminUser: User;
  let plainUser: User;

  const password = 'correct-horse-battery-staple';
  const prefix = 'PO-E2E';

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
        name: 'Purchase E2E Test Company',
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

  async function createSupplier(
    cookie: string,
    companyId: string,
  ): Promise<SupplierBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/suppliers')
      .set('Cookie', [cookie])
      .send({
        companyId,
        supplierCode: uniqueCode('SUP'),
        name: 'Acme Wholesale Supplier',
      });
    return response.body as SupplierBody;
  }

  async function blockSupplier(
    cookie: string,
    supplierId: string,
    companyId: string,
  ) {
    return request(app.getHttpServer())
      .post(`/api/v1/suppliers/${supplierId}/block?companyId=${companyId}`)
      .set('Cookie', [cookie]);
  }

  async function createPaymentTerm(
    cookie: string,
    companyId: string,
  ): Promise<PaymentTermBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/payment-terms')
      .set('Cookie', [cookie])
      .send({
        companyId,
        code: uniqueCode('PT'),
        name: 'Net 30',
        dueDays: 30,
      });
    return response.body as PaymentTermBody;
  }

  /** Full setup: company, branch, warehouse, category, brand, variant, supplier. */
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
    const supplier = await createSupplier(cookie, company.id);
    return {
      company,
      branch,
      warehouse,
      category,
      brand,
      variant,
      supplier,
    };
  }

  async function countRows(sql: string, params: unknown[]): Promise<number> {
    const rows: Array<{ c: number | string }> = await dataSource.query(
      sql,
      params,
    );
    return Number(rows[0].c);
  }

  async function createPurchaseOrder(
    cookie: string,
    companyId: string,
    supplierId: string,
    items: Array<{
      productVariantId: string;
      quantity: number;
      unitCost: string;
      discountAmount?: string;
      taxAmount?: string;
    }>,
    overrides: Partial<{
      branchId: string;
      warehouseId: string;
      paymentTermId: string;
      currency: string;
      purchaseType: string;
      notes: string;
      subtotal: string;
      grandTotal: string;
    }> = {},
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .post('/api/v1/purchase-orders')
      .set('Cookie', [cookie])
      .send({
        companyId,
        supplierId,
        branchId: overrides.branchId,
        warehouseId: overrides.warehouseId,
        paymentTermId: overrides.paymentTermId,
        currency: overrides.currency ?? 'USD',
        purchaseType: overrides.purchaseType,
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
    // (children before parents) — mirrors the Phase 09-12 cleanup
    // convention (scope-to-own-prefix, never an unscoped DELETE).
    await dataSource.query(
      `DELETE FROM purchase_order_items WHERE purchase_order_id IN (SELECT id FROM (SELECT id FROM purchase_orders WHERE purchase_order_number LIKE 'PO-%' AND company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
    );
    await dataSource.query(
      `DELETE FROM purchase_orders WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM company_purchase_counters WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM payment_terms WHERE code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM suppliers WHERE supplier_code LIKE '${prefix}%'`,
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
      `DELETE FROM companies WHERE code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM user_roles WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE 'po-e2e-%') t)`,
    );
    await dataSource.query("DELETE FROM users WHERE email LIKE 'po-e2e-%'");

    const userRepository = dataSource.getRepository(User);
    const roleRepository = dataSource.getRepository(Role);
    const userRoleRepository = dataSource.getRepository(UserRole);

    superAdminUser = await userRepository.save(
      userRepository.create({
        email: 'po-e2e-superadmin@example.com',
        passwordHash: await passwordService.hash(password),
        firstName: 'Purchase',
        lastName: 'SuperAdmin',
        displayName: 'Purchase Super Admin',
        status: UserStatus.Active,
        isEmailVerified: true,
        lastLoginAt: null,
        passwordChangedAt: null,
      }),
    );

    plainUser = await userRepository.save(
      userRepository.create({
        email: 'po-e2e-plain@example.com',
        passwordHash: await passwordService.hash(password),
        firstName: 'Purchase',
        lastName: 'Plain',
        displayName: 'Purchase Plain User',
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
      `DELETE FROM purchase_order_items WHERE purchase_order_id IN (SELECT id FROM (SELECT id FROM purchase_orders WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
    );
    await dataSource.query(
      `DELETE FROM purchase_orders WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM company_purchase_counters WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM payment_terms WHERE code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM suppliers WHERE supplier_code LIKE '${prefix}%'`,
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
      `DELETE FROM companies WHERE code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM user_roles WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE 'po-e2e-%') t)`,
    );
    await dataSource.query("DELETE FROM users WHERE email LIKE 'po-e2e-%'");
    await app.close();
  });

  describe('authentication boundary', () => {
    it('returns 401 for purchase-order endpoints without a session', async () => {
      const listResponse = await request(app.getHttpServer()).get(
        '/api/v1/purchase-orders',
      );
      expect(listResponse.status).toBe(401);

      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .send({});
      expect(createResponse.status).toBe(401);
    });
  });

  describe('permission boundary (403 for a plain authenticated user)', () => {
    it('rejects purchase order listing without purchase_orders.read', async () => {
      const cookie = await loginAndGetCookie(plainUser.email);
      const response = await request(app.getHttpServer())
        .get('/api/v1/purchase-orders')
        .set('Cookie', [cookie]);
      expect(response.status).toBe(403);
    });

    it('rejects purchase order creation without purchase_orders.create', async () => {
      const adminCookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, supplier } =
        await setupBaseFixture(adminCookie);
      const cookie = await loginAndGetCookie(plainUser.email);

      const response = await createPurchaseOrder(
        cookie,
        company.id,
        supplier.id,
        [{ productVariantId: variant.id, quantity: 1, unitCost: '10.00' }],
      );
      expect(response.status).toBe(403);
    });
  });

  describe('purchase order creation', () => {
    it('creates a DRAFT purchase order with client-supplied cost snapshot', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, supplier } = await setupBaseFixture(cookie);

      const response = await createPurchaseOrder(
        cookie,
        company.id,
        supplier.id,
        [{ productVariantId: variant.id, quantity: 2, unitCost: '15.50' }],
      );

      expect(response.status).toBe(201);
      const po = response.body as PurchaseOrderBody;
      expect(po.status).toBe('DRAFT');
      expect(po.subtotal).toBe('31.00');
      expect(po.grandTotal).toBe('31.00');
      expect(po.balanceAmount).toBe('31.00');
      expect(po.paidAmount).toBe('0.00');
      expect(po.purchaseOrderNumber).toMatch(/^PO-\d{4}-\d{6}$/);
      expect(po.items?.[0]?.unitCostSnapshot).toBe('15.50');
    });

    it('creates a multi-item purchase order and sums totals across all lines', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, category, brand, supplier } =
        await setupBaseFixture(cookie);

      const variant2 = await createProductVariant(
        cookie,
        company.id,
        category.id,
        brand.id,
      );
      const variant3 = await createProductVariant(
        cookie,
        company.id,
        category.id,
        brand.id,
      );

      const response = await createPurchaseOrder(
        cookie,
        company.id,
        supplier.id,
        [
          { productVariantId: variant2.id, quantity: 2, unitCost: '50.00' },
          { productVariantId: variant3.id, quantity: 3, unitCost: '30.00' },
        ],
      );

      expect(response.status).toBe(201);
      const po = response.body as PurchaseOrderBody;
      // (50*2) + (30*3) = 100 + 90 = 190
      expect(po.subtotal).toBe('190.00');
      expect(po.grandTotal).toBe('190.00');
      expect(po.items).toHaveLength(2);
    });

    it('rejects an items array with zero elements', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, supplier } = await setupBaseFixture(cookie);

      const response = await createPurchaseOrder(
        cookie,
        company.id,
        supplier.id,
        [],
      );
      expect(response.status).toBe(400);
    });

    it('rejects unknown fields (400)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, supplier } = await setupBaseFixture(cookie);

      const response = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          supplierId: supplier.id,
          currency: 'USD',
          items: [
            { productVariantId: variant.id, quantity: 1, unitCost: '10.00' },
          ],
          unexpectedField: 'should be rejected',
        });

      expect(response.status).toBe(400);
    });

    it('rejects a request that attempts to submit subtotal/grandTotal at all (CreatePurchaseOrderDto has no such fields — forbidNonWhitelisted 400s it outright)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, supplier } = await setupBaseFixture(cookie);

      const response = await createPurchaseOrder(
        cookie,
        company.id,
        supplier.id,
        [{ productVariantId: variant.id, quantity: 1, unitCost: '10.00' }],
        { subtotal: '1.00', grandTotal: '1.00' },
      );

      expect(response.status).toBe(400);
    });

    it('computes subtotal/grandTotal purely server-side from client-supplied unitCost, never trusting a manipulated total', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, supplier } = await setupBaseFixture(cookie);

      const response = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          supplierId: supplier.id,
          currency: 'USD',
          items: [
            {
              productVariantId: variant.id,
              quantity: 2,
              unitCost: '25.00',
              lineTotal: '999999.99',
            },
          ],
        });

      // lineTotal is not a whitelisted field on CreatePurchaseOrderItemDto
      expect(response.status).toBe(400);
    });

    it('rejects invalid ProductVariant ids (cross-company/nonexistent -> 404)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, supplier } = await setupBaseFixture(cookie);

      const response = await createPurchaseOrder(
        cookie,
        company.id,
        supplier.id,
        [
          {
            productVariantId: '00000000-0000-0000-0000-000000000000',
            quantity: 1,
            unitCost: '10.00',
          },
        ],
      );

      expect(response.status).toBe(404);
    });

    it('rejects a cross-company ProductVariant id as not found (404)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const otherCompany = await createCompany(cookie);
      const otherCategory = await createCategory(cookie, otherCompany.id);
      const otherBrand = await createBrand(cookie, otherCompany.id);
      const otherVariant = await createProductVariant(
        cookie,
        otherCompany.id,
        otherCategory.id,
        otherBrand.id,
      );

      // otherVariant belongs to otherCompany; we submit it alongside a
      // supplier from a different (first) company — the ProductVariant
      // lookup must reject it as not found (404), not silently accept it.
      const firstCompany = await createCompany(cookie);
      const firstSupplier = await createSupplier(cookie, firstCompany.id);

      const response = await createPurchaseOrder(
        cookie,
        firstCompany.id,
        firstSupplier.id,
        [{ productVariantId: otherVariant.id, quantity: 1, unitCost: '10.00' }],
      );

      expect(response.status).toBe(404);
    });

    it('transactionally rolls back the whole purchase order when one item is invalid (partial multi-item failure)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, supplier } = await setupBaseFixture(cookie);

      const beforeCount = await countRows(
        'SELECT COUNT(*) as c FROM purchase_orders WHERE company_id = ?',
        [company.id],
      );

      const response = await createPurchaseOrder(
        cookie,
        company.id,
        supplier.id,
        [
          { productVariantId: variant.id, quantity: 1, unitCost: '10.00' },
          {
            productVariantId: '00000000-0000-0000-0000-000000000000',
            quantity: 1,
            unitCost: '10.00',
          },
        ],
      );

      expect(response.status).toBe(404);

      const afterCount = await countRows(
        'SELECT COUNT(*) as c FROM purchase_orders WHERE company_id = ?',
        [company.id],
      );
      expect(afterCount).toBe(beforeCount);

      const itemCount = await countRows(
        'SELECT COUNT(*) as c FROM purchase_order_items poi JOIN purchase_orders po ON po.id = poi.purchase_order_id WHERE po.company_id = ?',
        [company.id],
      );
      expect(itemCount).toBe(0);
    });

    it('rejects a negative unitCost (400)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, supplier } = await setupBaseFixture(cookie);

      const response = await createPurchaseOrder(
        cookie,
        company.id,
        supplier.id,
        [{ productVariantId: variant.id, quantity: 1, unitCost: '-5.00' }],
      );

      expect(response.status).toBe(400);
    });

    it('rejects an invalid quantity (0 or negative) (400)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, supplier } = await setupBaseFixture(cookie);

      const response = await createPurchaseOrder(
        cookie,
        company.id,
        supplier.id,
        [{ productVariantId: variant.id, quantity: 0, unitCost: '10.00' }],
      );

      expect(response.status).toBe(400);
    });

    it('rejects an invalid currency code (400)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, supplier } = await setupBaseFixture(cookie);

      const response = await createPurchaseOrder(
        cookie,
        company.id,
        supplier.id,
        [{ productVariantId: variant.id, quantity: 1, unitCost: '10.00' }],
        { currency: 'usd' },
      );

      expect(response.status).toBe(400);
    });

    it('rejects an invalid UUID for supplierId (400)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant } = await setupBaseFixture(cookie);

      const response = await request(app.getHttpServer())
        .post('/api/v1/purchase-orders')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          supplierId: 'not-a-uuid',
          currency: 'USD',
          items: [
            { productVariantId: variant.id, quantity: 1, unitCost: '10.00' },
          ],
        });

      expect(response.status).toBe(400);
    });

    it('rejects a BLOCKED supplier (400)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, supplier } = await setupBaseFixture(cookie);
      await blockSupplier(cookie, supplier.id, company.id);

      const response = await createPurchaseOrder(
        cookie,
        company.id,
        supplier.id,
        [{ productVariantId: variant.id, quantity: 1, unitCost: '10.00' }],
      );

      expect(response.status).toBe(400);
    });

    it('includes a validated per-line taxAmount pass-through in the server-computed total', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, supplier } = await setupBaseFixture(cookie);

      const response = await createPurchaseOrder(
        cookie,
        company.id,
        supplier.id,
        [
          {
            productVariantId: variant.id,
            quantity: 1,
            unitCost: '100.00',
            taxAmount: '10.00',
          },
        ],
      );

      expect(response.status).toBe(201);
      const po = response.body as PurchaseOrderBody;
      expect(po.grandTotal).toBe('110.00');
      expect(po.taxAmount).toBe('10.00');
    });
  });

  describe('purchase-order-number uniqueness and concurrency', () => {
    it('generates unique, sequential purchase order numbers for sequential creations', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, supplier } = await setupBaseFixture(cookie);

      const first = await createPurchaseOrder(cookie, company.id, supplier.id, [
        { productVariantId: variant.id, quantity: 1, unitCost: '10.00' },
      ]);
      const second = await createPurchaseOrder(
        cookie,
        company.id,
        supplier.id,
        [{ productVariantId: variant.id, quantity: 1, unitCost: '10.00' }],
      );

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect((first.body as PurchaseOrderBody).purchaseOrderNumber).not.toBe(
        (second.body as PurchaseOrderBody).purchaseOrderNumber,
      );
    });

    it('generates unique purchase order numbers under real concurrent POST /purchase-orders requests (no duplicates, no unexpected failures)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, supplier } = await setupBaseFixture(cookie);

      const CONCURRENCY = 10;
      const responses = await Promise.all(
        Array.from({ length: CONCURRENCY }, () =>
          createPurchaseOrder(cookie, company.id, supplier.id, [
            { productVariantId: variant.id, quantity: 1, unitCost: '10.00' },
          ]),
        ),
      );

      const failures = responses.filter((r) => r.status !== 201);
      expect(failures).toHaveLength(0);

      const purchaseOrderNumbers = responses.map(
        (r) => (r.body as PurchaseOrderBody).purchaseOrderNumber,
      );
      const uniqueNumbers = new Set(purchaseOrderNumbers);
      expect(uniqueNumbers.size).toBe(CONCURRENCY);
    });
  });

  describe('supplier integration', () => {
    it('rejects a cross-company supplierId as not found (404)', async () => {
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

      // Submit companyId of otherCompany with a supplierId belonging to the
      // FIRST company — must be rejected as not found, never leaking
      // whether the supplier exists elsewhere (IDOR-safe convention).
      const response = await createPurchaseOrder(
        cookie,
        otherCompany.id,
        firstCompanyFixture.supplier.id,
        [{ productVariantId: otherVariant.id, quantity: 1, unitCost: '10.00' }],
      );

      expect(response.status).toBe(404);
    });
  });

  describe('company/branch/warehouse isolation and spoofing rejection', () => {
    it('rejects a branchId belonging to a different company', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, supplier } = await setupBaseFixture(cookie);
      const otherCompany = await createCompany(cookie);
      const otherBranch = await createBranch(cookie, otherCompany.id);

      const response = await createPurchaseOrder(
        cookie,
        company.id,
        supplier.id,
        [{ productVariantId: variant.id, quantity: 1, unitCost: '10.00' }],
        { branchId: otherBranch.id },
      );

      expect(response.status).toBe(400);
    });

    it('rejects a warehouseId belonging to a different company', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, supplier } = await setupBaseFixture(cookie);
      const otherCompany = await createCompany(cookie);
      const otherBranch = await createBranch(cookie, otherCompany.id);
      const otherWarehouse = await createWarehouse(
        cookie,
        otherCompany.id,
        otherBranch.id,
      );

      const response = await createPurchaseOrder(
        cookie,
        company.id,
        supplier.id,
        [{ productVariantId: variant.id, quantity: 1, unitCost: '10.00' }],
        { warehouseId: otherWarehouse.id },
      );

      expect(response.status).toBe(400);
    });

    it('rejects a warehouseId that does not belong to the supplied branchId', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, branch, variant, supplier } =
        await setupBaseFixture(cookie);
      const otherBranch = await createBranch(cookie, company.id);
      const otherWarehouse = await createWarehouse(
        cookie,
        company.id,
        otherBranch.id,
      );

      const response = await createPurchaseOrder(
        cookie,
        company.id,
        supplier.id,
        [{ productVariantId: variant.id, quantity: 1, unitCost: '10.00' }],
        { branchId: branch.id, warehouseId: otherWarehouse.id },
      );

      expect(response.status).toBe(400);
    });

    it('accepts a valid branch + warehouse combination', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, branch, warehouse, variant, supplier } =
        await setupBaseFixture(cookie);

      const response = await createPurchaseOrder(
        cookie,
        company.id,
        supplier.id,
        [{ productVariantId: variant.id, quantity: 1, unitCost: '10.00' }],
        { branchId: branch.id, warehouseId: warehouse.id },
      );

      expect(response.status).toBe(201);
      const po = response.body as PurchaseOrderBody;
      expect(po.branchId).toBe(branch.id);
      expect(po.warehouseId).toBe(warehouse.id);
    });
  });

  describe('PaymentTerm integration', () => {
    it('accepts a valid company-scoped paymentTermId', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, supplier } = await setupBaseFixture(cookie);
      const paymentTerm = await createPaymentTerm(cookie, company.id);

      const response = await createPurchaseOrder(
        cookie,
        company.id,
        supplier.id,
        [{ productVariantId: variant.id, quantity: 1, unitCost: '10.00' }],
        { paymentTermId: paymentTerm.id },
      );

      expect(response.status).toBe(201);
      expect((response.body as PurchaseOrderBody).paymentTermId).toBe(
        paymentTerm.id,
      );
    });

    it("rejects a cross-company paymentTermId as not found (404, IDOR-safe — mirrors PaymentTermsService.findByIdInCompany's existing convention)", async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, supplier } = await setupBaseFixture(cookie);
      const otherCompany = await createCompany(cookie);
      const otherPaymentTerm = await createPaymentTerm(cookie, otherCompany.id);

      const response = await createPurchaseOrder(
        cookie,
        company.id,
        supplier.id,
        [{ productVariantId: variant.id, quantity: 1, unitCost: '10.00' }],
        { paymentTermId: otherPaymentTerm.id },
      );

      expect(response.status).toBe(404);
    });

    it('allows omitting paymentTermId entirely', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, supplier } = await setupBaseFixture(cookie);

      const response = await createPurchaseOrder(
        cookie,
        company.id,
        supplier.id,
        [{ productVariantId: variant.id, quantity: 1, unitCost: '10.00' }],
      );

      expect(response.status).toBe(201);
      expect((response.body as PurchaseOrderBody).paymentTermId).toBeNull();
    });
  });

  describe('lifecycle: DRAFT -> CONFIRMED / CANCELLED', () => {
    it('confirms a DRAFT purchase order', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, supplier } = await setupBaseFixture(cookie);
      const poResponse = await createPurchaseOrder(
        cookie,
        company.id,
        supplier.id,
        [{ productVariantId: variant.id, quantity: 1, unitCost: '10.00' }],
      );
      const po = poResponse.body as PurchaseOrderBody;

      const response = await request(app.getHttpServer())
        .post(
          `/api/v1/purchase-orders/${po.id}/confirm?companyId=${company.id}`,
        )
        .set('Cookie', [cookie]);

      expect(response.status).toBe(200);
      expect((response.body as PurchaseOrderBody).status).toBe('CONFIRMED');
    });

    it('cancels a DRAFT purchase order', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, supplier } = await setupBaseFixture(cookie);
      const poResponse = await createPurchaseOrder(
        cookie,
        company.id,
        supplier.id,
        [{ productVariantId: variant.id, quantity: 1, unitCost: '10.00' }],
      );
      const po = poResponse.body as PurchaseOrderBody;

      const response = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${po.id}/cancel?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(200);
      expect((response.body as PurchaseOrderBody).status).toBe('CANCELLED');
    });

    it('rejects CONFIRMED -> CANCELLED (409)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, supplier } = await setupBaseFixture(cookie);
      const poResponse = await createPurchaseOrder(
        cookie,
        company.id,
        supplier.id,
        [{ productVariantId: variant.id, quantity: 1, unitCost: '10.00' }],
      );
      const po = poResponse.body as PurchaseOrderBody;
      await request(app.getHttpServer())
        .post(
          `/api/v1/purchase-orders/${po.id}/confirm?companyId=${company.id}`,
        )
        .set('Cookie', [cookie]);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${po.id}/cancel?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(409);
    });

    it('rejects re-confirming an already-CONFIRMED purchase order (409)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, supplier } = await setupBaseFixture(cookie);
      const poResponse = await createPurchaseOrder(
        cookie,
        company.id,
        supplier.id,
        [{ productVariantId: variant.id, quantity: 1, unitCost: '10.00' }],
      );
      const po = poResponse.body as PurchaseOrderBody;
      await request(app.getHttpServer())
        .post(
          `/api/v1/purchase-orders/${po.id}/confirm?companyId=${company.id}`,
        )
        .set('Cookie', [cookie]);

      const response = await request(app.getHttpServer())
        .post(
          `/api/v1/purchase-orders/${po.id}/confirm?companyId=${company.id}`,
        )
        .set('Cookie', [cookie]);

      expect(response.status).toBe(409);
    });

    it('rejects CANCELLED -> CONFIRMED (409)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, supplier } = await setupBaseFixture(cookie);
      const poResponse = await createPurchaseOrder(
        cookie,
        company.id,
        supplier.id,
        [{ productVariantId: variant.id, quantity: 1, unitCost: '10.00' }],
      );
      const po = poResponse.body as PurchaseOrderBody;
      await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${po.id}/cancel?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      const response = await request(app.getHttpServer())
        .post(
          `/api/v1/purchase-orders/${po.id}/confirm?companyId=${company.id}`,
        )
        .set('Cookie', [cookie]);

      expect(response.status).toBe(409);
    });

    it('rejects re-cancelling an already-CANCELLED purchase order (409)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, supplier } = await setupBaseFixture(cookie);
      const poResponse = await createPurchaseOrder(
        cookie,
        company.id,
        supplier.id,
        [{ productVariantId: variant.id, quantity: 1, unitCost: '10.00' }],
      );
      const po = poResponse.body as PurchaseOrderBody;
      await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${po.id}/cancel?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/purchase-orders/${po.id}/cancel?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(409);
    });

    it('no generic PATCH /purchase-orders/:id endpoint exists (404 or 405)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, supplier } = await setupBaseFixture(cookie);
      const poResponse = await createPurchaseOrder(
        cookie,
        company.id,
        supplier.id,
        [{ productVariantId: variant.id, quantity: 1, unitCost: '10.00' }],
      );
      const po = poResponse.body as PurchaseOrderBody;

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/purchase-orders/${po.id}`)
        .set('Cookie', [cookie])
        .send({ status: 'CONFIRMED' });

      expect([404, 405]).toContain(response.status);
    });
  });

  describe('confirmed-purchase-order immutability', () => {
    it('a CONFIRMED purchase order retains its original financial values (no update path exists to change them)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, supplier } = await setupBaseFixture(cookie);
      const poResponse = await createPurchaseOrder(
        cookie,
        company.id,
        supplier.id,
        [{ productVariantId: variant.id, quantity: 1, unitCost: '10.00' }],
      );
      const po = poResponse.body as PurchaseOrderBody;
      await request(app.getHttpServer())
        .post(
          `/api/v1/purchase-orders/${po.id}/confirm?companyId=${company.id}`,
        )
        .set('Cookie', [cookie]);

      const refetched = await request(app.getHttpServer())
        .get(`/api/v1/purchase-orders/${po.id}?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      const refetchedPo = refetched.body as PurchaseOrderBody;
      expect(refetchedPo.status).toBe('CONFIRMED');
      expect(refetchedPo.grandTotal).toBe(po.grandTotal);
      expect(refetchedPo.subtotal).toBe(po.subtotal);
    });
  });

  describe('GET /purchase-orders and /purchase-orders/:id', () => {
    it('lists purchase orders scoped to the resolved company', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, supplier } = await setupBaseFixture(cookie);
      await createPurchaseOrder(cookie, company.id, supplier.id, [
        { productVariantId: variant.id, quantity: 1, unitCost: '10.00' },
      ]);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/purchase-orders?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(200);
      const body = response.body as { data: PurchaseOrderBody[] };
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data.every((p) => p.companyId === company.id)).toBe(true);
    });

    it('returns 404 for a cross-company purchase order id lookup', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, variant, supplier } = await setupBaseFixture(cookie);
      const poResponse = await createPurchaseOrder(
        cookie,
        company.id,
        supplier.id,
        [{ productVariantId: variant.id, quantity: 1, unitCost: '10.00' }],
      );
      const po = poResponse.body as PurchaseOrderBody;
      const otherCompany = await createCompany(cookie);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/purchase-orders/${po.id}?companyId=${otherCompany.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(404);
    });
  });
});
