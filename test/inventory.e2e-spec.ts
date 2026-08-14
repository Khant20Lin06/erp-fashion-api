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
interface PurchaseOrderItemBody {
  id: string;
  productVariantId: string;
  quantity: number;
}
interface PurchaseOrderBody {
  id: string;
  status: string;
  items?: PurchaseOrderItemBody[];
}
interface WarehouseStockBody {
  id: string;
  warehouseId: string;
  productVariantId: string;
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
}
interface GoodsReceiptBody {
  id: string;
  receiptNumber: string;
  purchaseOrderId: string;
  warehouseId: string;
  supplierId: string;
  companyId: string;
  items?: Array<{
    purchaseOrderItemId: string;
    productVariantId: string;
    receivedQuantity: number;
  }>;
}
interface StockTransferBody {
  id: string;
  transferNumber: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
}
interface StockAdjustmentBody {
  id: string;
  adjustmentNumber: string;
  warehouseId: string;
  productVariantId: string;
  quantityChange: number;
  reason: string;
}

describeIfDb('Inventory (Phase 14) (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let passwordService: PasswordService;

  let superAdminUser: User;
  let plainUser: User;

  const password = 'correct-horse-battery-staple';
  const prefix = 'INV-E2E';

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
        name: 'Inventory E2E Test Company',
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

  async function deactivateWarehouse(cookie: string, warehouseId: string) {
    return request(app.getHttpServer())
      .post(`/api/v1/warehouses/${warehouseId}/deactivate`)
      .set('Cookie', [cookie]);
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

  async function deactivateVariant(
    cookie: string,
    variantId: string,
    companyId: string,
  ) {
    return request(app.getHttpServer())
      .post(
        `/api/v1/product-variants/${variantId}/deactivate?companyId=${companyId}`,
      )
      .set('Cookie', [cookie]);
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

  async function createPurchaseOrder(
    cookie: string,
    companyId: string,
    supplierId: string,
    items: Array<{
      productVariantId: string;
      quantity: number;
      unitCost: string;
    }>,
    overrides: Partial<{ warehouseId: string }> = {},
  ): Promise<PurchaseOrderBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/purchase-orders')
      .set('Cookie', [cookie])
      .send({
        companyId,
        supplierId,
        warehouseId: overrides.warehouseId,
        currency: 'USD',
        items,
      });
    return response.body as PurchaseOrderBody;
  }

  async function confirmPurchaseOrder(
    cookie: string,
    companyId: string,
    id: string,
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .post(`/api/v1/purchase-orders/${id}/confirm?companyId=${companyId}`)
      .set('Cookie', [cookie]);
  }

  async function cancelPurchaseOrder(
    cookie: string,
    companyId: string,
    id: string,
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .post(`/api/v1/purchase-orders/${id}/cancel?companyId=${companyId}`)
      .set('Cookie', [cookie]);
  }

  async function createGoodsReceipt(
    cookie: string,
    companyId: string,
    purchaseOrderId: string,
    warehouseId: string,
    items: Array<{
      purchaseOrderItemId: string;
      productVariantId: string;
      receivedQuantity: number;
      rejectedQuantity?: number;
    }>,
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .post('/api/v1/goods-receipts')
      .set('Cookie', [cookie])
      .send({ companyId, purchaseOrderId, warehouseId, items });
  }

  async function createStockTransfer(
    cookie: string,
    companyId: string,
    sourceWarehouseId: string,
    destinationWarehouseId: string,
    items: Array<{ productVariantId: string; quantity: number }>,
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .post('/api/v1/stock-transfers')
      .set('Cookie', [cookie])
      .send({ companyId, sourceWarehouseId, destinationWarehouseId, items });
  }

  async function createStockAdjustment(
    cookie: string,
    companyId: string,
    warehouseId: string,
    productVariantId: string,
    quantityChange: number,
    reason: string,
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .post('/api/v1/stock-adjustments')
      .set('Cookie', [cookie])
      .send({
        companyId,
        warehouseId,
        productVariantId,
        quantityChange,
        reason,
      });
  }

  async function getStock(
    cookie: string,
    companyId: string,
    warehouseId: string,
    productVariantId: string,
  ): Promise<WarehouseStockBody | undefined> {
    const response = await request(app.getHttpServer())
      .get(
        `/api/v1/warehouse-stock?companyId=${companyId}&warehouseId=${warehouseId}&productVariantId=${productVariantId}`,
      )
      .set('Cookie', [cookie]);
    const body = response.body as { data: WarehouseStockBody[] };
    return body.data[0];
  }

  /** Full setup: company, branch, 2 warehouses, category, brand, variant, supplier. */
  async function setupBaseFixture(cookie: string) {
    const company = await createCompany(cookie);
    const branch = await createBranch(cookie, company.id);
    const warehouse = await createWarehouse(cookie, company.id, branch.id);
    const warehouse2 = await createWarehouse(cookie, company.id, branch.id);
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
      warehouse2,
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

    // Clean slate for this suite's own data only, respecting FK order.
    await dataSource.query(
      `DELETE FROM stock_movements WHERE warehouse_id IN (SELECT id FROM (SELECT id FROM warehouses WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
    );
    await dataSource.query(
      `DELETE FROM warehouse_stock WHERE warehouse_id IN (SELECT id FROM (SELECT id FROM warehouses WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
    );
    await dataSource.query(
      `DELETE FROM stock_adjustments WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM company_stock_adjustment_counters WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM stock_transfer_items WHERE stock_transfer_id IN (SELECT id FROM (SELECT id FROM stock_transfers WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
    );
    await dataSource.query(
      `DELETE FROM stock_transfers WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM company_stock_transfer_counters WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM goods_receipt_items WHERE goods_receipt_id IN (SELECT id FROM (SELECT id FROM goods_receipts WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
    );
    await dataSource.query(
      `DELETE FROM goods_receipts WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
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
      `DELETE FROM user_roles WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE 'inv-e2e-%') t)`,
    );
    await dataSource.query("DELETE FROM users WHERE email LIKE 'inv-e2e-%'");

    const userRepository = dataSource.getRepository(User);
    const roleRepository = dataSource.getRepository(Role);
    const userRoleRepository = dataSource.getRepository(UserRole);

    superAdminUser = await userRepository.save(
      userRepository.create({
        email: 'inv-e2e-superadmin@example.com',
        passwordHash: await passwordService.hash(password),
        firstName: 'Inventory',
        lastName: 'SuperAdmin',
        displayName: 'Inventory Super Admin',
        status: UserStatus.Active,
        isEmailVerified: true,
        lastLoginAt: null,
        passwordChangedAt: null,
      }),
    );

    plainUser = await userRepository.save(
      userRepository.create({
        email: 'inv-e2e-plain@example.com',
        passwordHash: await passwordService.hash(password),
        firstName: 'Inventory',
        lastName: 'Plain',
        displayName: 'Inventory Plain User',
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
      `DELETE FROM stock_movements WHERE warehouse_id IN (SELECT id FROM (SELECT id FROM warehouses WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
    );
    await dataSource.query(
      `DELETE FROM warehouse_stock WHERE warehouse_id IN (SELECT id FROM (SELECT id FROM warehouses WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
    );
    await dataSource.query(
      `DELETE FROM stock_adjustments WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM company_stock_adjustment_counters WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM stock_transfer_items WHERE stock_transfer_id IN (SELECT id FROM (SELECT id FROM stock_transfers WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
    );
    await dataSource.query(
      `DELETE FROM stock_transfers WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM company_stock_transfer_counters WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM goods_receipt_items WHERE goods_receipt_id IN (SELECT id FROM (SELECT id FROM goods_receipts WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
    );
    await dataSource.query(
      `DELETE FROM goods_receipts WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
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
      `DELETE FROM user_roles WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE 'inv-e2e-%') t)`,
    );
    await dataSource.query("DELETE FROM users WHERE email LIKE 'inv-e2e-%'");
    await app.close();
  });

  describe('authentication / permission boundary', () => {
    it('returns 401 for inventory endpoints without a session', async () => {
      const responses = await Promise.all([
        request(app.getHttpServer()).get('/api/v1/warehouse-stock'),
        request(app.getHttpServer()).get('/api/v1/goods-receipts'),
        request(app.getHttpServer()).post('/api/v1/goods-receipts').send({}),
        request(app.getHttpServer()).get('/api/v1/stock-transfers'),
        request(app.getHttpServer()).post('/api/v1/stock-transfers').send({}),
        request(app.getHttpServer()).get('/api/v1/stock-adjustments'),
        request(app.getHttpServer()).post('/api/v1/stock-adjustments').send({}),
      ]);
      for (const response of responses) {
        expect(response.status).toBe(401);
      }
    });

    it('rejects goods receipt creation without goods_receipts.create (403)', async () => {
      const adminCookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant, supplier } =
        await setupBaseFixture(adminCookie);
      const po = await createPurchaseOrder(
        adminCookie,
        company.id,
        supplier.id,
        [{ productVariantId: variant.id, quantity: 10, unitCost: '5.00' }],
      );
      await confirmPurchaseOrder(adminCookie, company.id, po.id);

      const cookie = await loginAndGetCookie(plainUser.email);
      const response = await createGoodsReceipt(
        cookie,
        company.id,
        po.id,
        warehouse.id,
        [
          {
            purchaseOrderItemId: po.items![0].id,
            productVariantId: variant.id,
            receivedQuantity: 5,
          },
        ],
      );
      expect(response.status).toBe(403);
    });
  });

  describe('GoodsReceipt — receiving against a purchase order', () => {
    it('rejects receiving against a DRAFT purchase order (409)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant, supplier } =
        await setupBaseFixture(cookie);
      const po = await createPurchaseOrder(cookie, company.id, supplier.id, [
        { productVariantId: variant.id, quantity: 10, unitCost: '5.00' },
      ]);

      const response = await createGoodsReceipt(
        cookie,
        company.id,
        po.id,
        warehouse.id,
        [
          {
            purchaseOrderItemId: po.items![0].id,
            productVariantId: variant.id,
            receivedQuantity: 5,
          },
        ],
      );
      expect(response.status).toBe(409);
    });

    it('rejects receiving against a CANCELLED purchase order (409)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant, supplier } =
        await setupBaseFixture(cookie);
      const po = await createPurchaseOrder(cookie, company.id, supplier.id, [
        { productVariantId: variant.id, quantity: 10, unitCost: '5.00' },
      ]);
      await cancelPurchaseOrder(cookie, company.id, po.id);

      const response = await createGoodsReceipt(
        cookie,
        company.id,
        po.id,
        warehouse.id,
        [
          {
            purchaseOrderItemId: po.items![0].id,
            productVariantId: variant.id,
            receivedQuantity: 5,
          },
        ],
      );
      expect(response.status).toBe(409);
    });

    it('receives against a CONFIRMED purchase order and increases WarehouseStock, writing a PURCHASE_RECEIPT movement', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant, supplier } =
        await setupBaseFixture(cookie);
      const po = await createPurchaseOrder(cookie, company.id, supplier.id, [
        { productVariantId: variant.id, quantity: 10, unitCost: '5.00' },
      ]);
      await confirmPurchaseOrder(cookie, company.id, po.id);

      const response = await createGoodsReceipt(
        cookie,
        company.id,
        po.id,
        warehouse.id,
        [
          {
            purchaseOrderItemId: po.items![0].id,
            productVariantId: variant.id,
            receivedQuantity: 10,
          },
        ],
      );

      expect(response.status).toBe(201);
      const gr = response.body as GoodsReceiptBody;
      expect(gr.receiptNumber).toMatch(/^GR-\d{4}-\d{6}$/);
      expect(gr.supplierId).toBe(supplier.id);

      const stock = await getStock(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
      );
      expect(stock?.onHandQuantity).toBe(10);

      const movementCount = await countRows(
        'SELECT COUNT(*) as c FROM stock_movements WHERE reference_id = ? AND movement_type = ?',
        [gr.id, 'PURCHASE_RECEIPT'],
      );
      expect(movementCount).toBe(1);
    });

    it('supports partial receiving across multiple receipts, summing correctly', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant, supplier } =
        await setupBaseFixture(cookie);
      const po = await createPurchaseOrder(cookie, company.id, supplier.id, [
        { productVariantId: variant.id, quantity: 10, unitCost: '5.00' },
      ]);
      await confirmPurchaseOrder(cookie, company.id, po.id);
      const poItemId = po.items![0].id;

      const first = await createGoodsReceipt(
        cookie,
        company.id,
        po.id,
        warehouse.id,
        [
          {
            purchaseOrderItemId: poItemId,
            productVariantId: variant.id,
            receivedQuantity: 4,
          },
        ],
      );
      expect(first.status).toBe(201);

      const second = await createGoodsReceipt(
        cookie,
        company.id,
        po.id,
        warehouse.id,
        [
          {
            purchaseOrderItemId: poItemId,
            productVariantId: variant.id,
            receivedQuantity: 6,
          },
        ],
      );
      expect(second.status).toBe(201);

      const stock = await getStock(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
      );
      expect(stock?.onHandQuantity).toBe(10);
    });

    it('rejects over-receiving beyond the remaining ordered quantity (409)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant, supplier } =
        await setupBaseFixture(cookie);
      const po = await createPurchaseOrder(cookie, company.id, supplier.id, [
        { productVariantId: variant.id, quantity: 10, unitCost: '5.00' },
      ]);
      await confirmPurchaseOrder(cookie, company.id, po.id);
      const poItemId = po.items![0].id;

      await createGoodsReceipt(cookie, company.id, po.id, warehouse.id, [
        {
          purchaseOrderItemId: poItemId,
          productVariantId: variant.id,
          receivedQuantity: 8,
        },
      ]);

      const response = await createGoodsReceipt(
        cookie,
        company.id,
        po.id,
        warehouse.id,
        [
          {
            purchaseOrderItemId: poItemId,
            productVariantId: variant.id,
            receivedQuantity: 3,
          },
        ],
      );
      expect(response.status).toBe(409);
    });

    it('accepts an exact-final-receipt that consumes the remaining quantity precisely', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant, supplier } =
        await setupBaseFixture(cookie);
      const po = await createPurchaseOrder(cookie, company.id, supplier.id, [
        { productVariantId: variant.id, quantity: 10, unitCost: '5.00' },
      ]);
      await confirmPurchaseOrder(cookie, company.id, po.id);
      const poItemId = po.items![0].id;

      await createGoodsReceipt(cookie, company.id, po.id, warehouse.id, [
        {
          purchaseOrderItemId: poItemId,
          productVariantId: variant.id,
          receivedQuantity: 7,
        },
      ]);
      const response = await createGoodsReceipt(
        cookie,
        company.id,
        po.id,
        warehouse.id,
        [
          {
            purchaseOrderItemId: poItemId,
            productVariantId: variant.id,
            receivedQuantity: 3,
          },
        ],
      );
      expect(response.status).toBe(201);

      const stock = await getStock(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
      );
      expect(stock?.onHandQuantity).toBe(10);
    });

    it('rejects a cross-company purchase order (404)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const fixtureA = await setupBaseFixture(cookie);
      const po = await createPurchaseOrder(
        cookie,
        fixtureA.company.id,
        fixtureA.supplier.id,
        [
          {
            productVariantId: fixtureA.variant.id,
            quantity: 10,
            unitCost: '5.00',
          },
        ],
      );
      await confirmPurchaseOrder(cookie, fixtureA.company.id, po.id);

      const fixtureB = await setupBaseFixture(cookie);

      const response = await createGoodsReceipt(
        cookie,
        fixtureB.company.id,
        po.id,
        fixtureB.warehouse.id,
        [
          {
            purchaseOrderItemId: po.items![0].id,
            productVariantId: fixtureA.variant.id,
            receivedQuantity: 5,
          },
        ],
      );
      expect(response.status).toBe(404);
    });

    it('rejects a cross-company warehouse (400)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const fixtureA = await setupBaseFixture(cookie);
      const po = await createPurchaseOrder(
        cookie,
        fixtureA.company.id,
        fixtureA.supplier.id,
        [
          {
            productVariantId: fixtureA.variant.id,
            quantity: 10,
            unitCost: '5.00',
          },
        ],
      );
      await confirmPurchaseOrder(cookie, fixtureA.company.id, po.id);

      const fixtureB = await setupBaseFixture(cookie);

      const response = await createGoodsReceipt(
        cookie,
        fixtureA.company.id,
        po.id,
        fixtureB.warehouse.id,
        [
          {
            purchaseOrderItemId: po.items![0].id,
            productVariantId: fixtureA.variant.id,
            receivedQuantity: 5,
          },
        ],
      );
      expect(response.status).toBe(400);
    });

    it('rejects an inactive warehouse (400)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant, supplier } =
        await setupBaseFixture(cookie);
      const po = await createPurchaseOrder(cookie, company.id, supplier.id, [
        { productVariantId: variant.id, quantity: 10, unitCost: '5.00' },
      ]);
      await confirmPurchaseOrder(cookie, company.id, po.id);
      await deactivateWarehouse(cookie, warehouse.id);

      const response = await createGoodsReceipt(
        cookie,
        company.id,
        po.id,
        warehouse.id,
        [
          {
            purchaseOrderItemId: po.items![0].id,
            productVariantId: variant.id,
            receivedQuantity: 5,
          },
        ],
      );
      expect(response.status).toBe(400);
    });

    it('rejects an inactive product variant (400)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant, supplier } =
        await setupBaseFixture(cookie);
      const po = await createPurchaseOrder(cookie, company.id, supplier.id, [
        { productVariantId: variant.id, quantity: 10, unitCost: '5.00' },
      ]);
      await confirmPurchaseOrder(cookie, company.id, po.id);
      await deactivateVariant(cookie, variant.id, company.id);

      const response = await createGoodsReceipt(
        cookie,
        company.id,
        po.id,
        warehouse.id,
        [
          {
            purchaseOrderItemId: po.items![0].id,
            productVariantId: variant.id,
            receivedQuantity: 5,
          },
        ],
      );
      expect(response.status).toBe(400);
    });

    it('rejects a productVariantId that does not match the referenced PurchaseOrderItem (400)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, category, brand, variant, supplier } =
        await setupBaseFixture(cookie);
      const otherVariant = await createProductVariant(
        cookie,
        company.id,
        category.id,
        brand.id,
      );
      const po = await createPurchaseOrder(cookie, company.id, supplier.id, [
        { productVariantId: variant.id, quantity: 10, unitCost: '5.00' },
      ]);
      await confirmPurchaseOrder(cookie, company.id, po.id);

      const response = await createGoodsReceipt(
        cookie,
        company.id,
        po.id,
        warehouse.id,
        [
          {
            purchaseOrderItemId: po.items![0].id,
            productVariantId: otherVariant.id,
            receivedQuantity: 5,
          },
        ],
      );
      expect(response.status).toBe(400);
    });

    it("blocking a purchase order's cancellation once a goods receipt exists against it (Phase 14 addition to PurchaseOrdersService.cancel())", async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant, supplier } =
        await setupBaseFixture(cookie);
      const po = await createPurchaseOrder(cookie, company.id, supplier.id, [
        { productVariantId: variant.id, quantity: 10, unitCost: '5.00' },
      ]);
      await confirmPurchaseOrder(cookie, company.id, po.id);
      await createGoodsReceipt(cookie, company.id, po.id, warehouse.id, [
        {
          purchaseOrderItemId: po.items![0].id,
          productVariantId: variant.id,
          receivedQuantity: 5,
        },
      ]);

      const response = await cancelPurchaseOrder(cookie, company.id, po.id);
      expect(response.status).toBe(409);
    });

    it('a real concurrency test: multiple parallel POST /goods-receipts against the same PurchaseOrderItem never over-receive and never lose updates', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant, supplier } =
        await setupBaseFixture(cookie);
      const ORDERED_QTY = 50;
      const po = await createPurchaseOrder(cookie, company.id, supplier.id, [
        {
          productVariantId: variant.id,
          quantity: ORDERED_QTY,
          unitCost: '5.00',
        },
      ]);
      await confirmPurchaseOrder(cookie, company.id, po.id);
      const poItemId = po.items![0].id;

      const CONCURRENCY = 10;
      const PER_REQUEST_QTY = 5; // 10 * 5 = 50 == ORDERED_QTY exactly
      const responses = await Promise.all(
        Array.from({ length: CONCURRENCY }, () =>
          createGoodsReceipt(cookie, company.id, po.id, warehouse.id, [
            {
              purchaseOrderItemId: poItemId,
              productVariantId: variant.id,
              receivedQuantity: PER_REQUEST_QTY,
            },
          ]),
        ),
      );

      const successes = responses.filter((r) => r.status === 201);
      const conflicts = responses.filter((r) => r.status === 409);
      // Exactly enough remaining quantity for all 10 to succeed since
      // 10 * 5 == 50 == ordered quantity — no over-receiving is possible,
      // so every single one must succeed with no lost updates.
      expect(successes).toHaveLength(CONCURRENCY);
      expect(conflicts).toHaveLength(0);

      const stock = await getStock(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
      );
      expect(stock?.onHandQuantity).toBe(ORDERED_QTY);

      const cumulativeReceived = await countRows(
        'SELECT COALESCE(SUM(received_quantity), 0) as c FROM goods_receipt_items WHERE purchase_order_item_id = ?',
        [poItemId],
      );
      expect(cumulativeReceived).toBe(ORDERED_QTY);

      const movementCount = await countRows(
        'SELECT COUNT(*) as c FROM stock_movements WHERE warehouse_id = ? AND product_variant_id = ? AND movement_type = ?',
        [warehouse.id, variant.id, 'PURCHASE_RECEIPT'],
      );
      expect(movementCount).toBe(CONCURRENCY);
    });

    it('a second concurrency test proving no over-receiving: 10 parallel requests each requesting more than 1/10th of remaining stock cause exactly the right number to fail', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant, supplier } =
        await setupBaseFixture(cookie);
      const ORDERED_QTY = 30;
      const po = await createPurchaseOrder(cookie, company.id, supplier.id, [
        {
          productVariantId: variant.id,
          quantity: ORDERED_QTY,
          unitCost: '5.00',
        },
      ]);
      await confirmPurchaseOrder(cookie, company.id, po.id);
      const poItemId = po.items![0].id;

      const CONCURRENCY = 10;
      const PER_REQUEST_QTY = 5; // 10 * 5 = 50 > 30 ordered — over-subscribed on purpose
      const responses = await Promise.all(
        Array.from({ length: CONCURRENCY }, () =>
          createGoodsReceipt(cookie, company.id, po.id, warehouse.id, [
            {
              purchaseOrderItemId: poItemId,
              productVariantId: variant.id,
              receivedQuantity: PER_REQUEST_QTY,
            },
          ]),
        ),
      );

      const successes = responses.filter((r) => r.status === 201);
      const conflicts = responses.filter((r) => r.status === 409);
      // Exactly 6 can succeed (6 * 5 = 30 == ORDERED_QTY), the rest must
      // be rejected — proving the lock serializes correctly with no lost
      // updates and no over-receiving under real concurrency.
      expect(successes).toHaveLength(6);
      expect(conflicts).toHaveLength(4);

      const stock = await getStock(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
      );
      expect(stock?.onHandQuantity).toBe(ORDERED_QTY);

      const cumulativeReceived = await countRows(
        'SELECT COALESCE(SUM(received_quantity), 0) as c FROM goods_receipt_items WHERE purchase_order_item_id = ?',
        [poItemId],
      );
      expect(cumulativeReceived).toBe(ORDERED_QTY);
    });
  });

  describe('StockTransfer', () => {
    it('successfully transfers stock between two warehouses', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, warehouse2, variant } =
        await setupBaseFixture(cookie);
      await createStockAdjustment(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
        20,
        'OPENING_BALANCE',
      );

      const response = await createStockTransfer(
        cookie,
        company.id,
        warehouse.id,
        warehouse2.id,
        [{ productVariantId: variant.id, quantity: 8 }],
      );

      expect(response.status).toBe(201);
      const transfer = response.body as StockTransferBody;
      expect(transfer.transferNumber).toMatch(/^TRF-\d{4}-\d{6}$/);

      const sourceStock = await getStock(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
      );
      const destStock = await getStock(
        cookie,
        company.id,
        warehouse2.id,
        variant.id,
      );
      expect(sourceStock?.onHandQuantity).toBe(12);
      expect(destStock?.onHandQuantity).toBe(8);

      const outCount = await countRows(
        'SELECT COUNT(*) as c FROM stock_movements WHERE reference_id = ? AND movement_type = ?',
        [transfer.id, 'TRANSFER_OUT'],
      );
      const inCount = await countRows(
        'SELECT COUNT(*) as c FROM stock_movements WHERE reference_id = ? AND movement_type = ?',
        [transfer.id, 'TRANSFER_IN'],
      );
      expect(outCount).toBe(1);
      expect(inCount).toBe(1);
    });

    it('rejects insufficient source stock (409)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, warehouse2, variant } =
        await setupBaseFixture(cookie);
      await createStockAdjustment(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
        2,
        'OPENING_BALANCE',
      );

      const response = await createStockTransfer(
        cookie,
        company.id,
        warehouse.id,
        warehouse2.id,
        [{ productVariantId: variant.id, quantity: 10 }],
      );
      expect(response.status).toBe(409);
    });

    it('rejects source === destination (400)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant } = await setupBaseFixture(cookie);

      const response = await createStockTransfer(
        cookie,
        company.id,
        warehouse.id,
        warehouse.id,
        [{ productVariantId: variant.id, quantity: 1 }],
      );
      expect(response.status).toBe(400);
    });

    it('rejects a cross-company destination warehouse (400)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const fixtureA = await setupBaseFixture(cookie);
      const fixtureB = await setupBaseFixture(cookie);

      const response = await createStockTransfer(
        cookie,
        fixtureA.company.id,
        fixtureA.warehouse.id,
        fixtureB.warehouse.id,
        [{ productVariantId: fixtureA.variant.id, quantity: 1 }],
      );
      expect(response.status).toBe(400);
    });

    it('rejects an inactive destination warehouse (400)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, warehouse2, variant } =
        await setupBaseFixture(cookie);
      await createStockAdjustment(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
        10,
        'OPENING_BALANCE',
      );
      await deactivateWarehouse(cookie, warehouse2.id);

      const response = await createStockTransfer(
        cookie,
        company.id,
        warehouse.id,
        warehouse2.id,
        [{ productVariantId: variant.id, quantity: 1 }],
      );
      expect(response.status).toBe(400);
    });

    it('a real concurrency test proving deterministic lock ordering prevents deadlock and lost updates under concurrent transfers moving stock in both directions between the same warehouse pair', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, warehouse2, variant } =
        await setupBaseFixture(cookie);
      await createStockAdjustment(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
        100,
        'OPENING_BALANCE',
      );
      await createStockAdjustment(
        cookie,
        company.id,
        warehouse2.id,
        variant.id,
        100,
        'OPENING_BALANCE',
      );

      const CONCURRENCY = 10;
      const requests = Array.from({ length: CONCURRENCY }, (_, i) =>
        i % 2 === 0
          ? createStockTransfer(
              cookie,
              company.id,
              warehouse.id,
              warehouse2.id,
              [{ productVariantId: variant.id, quantity: 3 }],
            )
          : createStockTransfer(
              cookie,
              company.id,
              warehouse2.id,
              warehouse.id,
              [{ productVariantId: variant.id, quantity: 2 }],
            ),
      );

      const responses = await Promise.all(requests);
      const failures = responses.filter((r) => r.status !== 201);
      expect(failures).toHaveLength(0);

      // 5 transfers of 3 from wh1->wh2, 5 transfers of 2 from wh2->wh1.
      // wh1: 100 - (5*3) + (5*2) = 100 - 15 + 10 = 95
      // wh2: 100 - (5*2) + (5*3) = 100 - 10 + 15 = 105
      const sourceStock = await getStock(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
      );
      const destStock = await getStock(
        cookie,
        company.id,
        warehouse2.id,
        variant.id,
      );
      expect(sourceStock?.onHandQuantity).toBe(95);
      expect(destStock?.onHandQuantity).toBe(105);
      // Total stock conserved across both warehouses — proves no lost updates.
      expect(
        (sourceStock?.onHandQuantity ?? 0) + (destStock?.onHandQuantity ?? 0),
      ).toBe(200);

      const transferNumbers = responses.map(
        (r) => (r.body as StockTransferBody).transferNumber,
      );
      expect(new Set(transferNumbers).size).toBe(CONCURRENCY);
    });
  });

  describe('StockAdjustment', () => {
    it('applies a positive adjustment with no restriction', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant } = await setupBaseFixture(cookie);

      const response = await createStockAdjustment(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
        15,
        'FOUND',
      );
      expect(response.status).toBe(201);
      const adjustment = response.body as StockAdjustmentBody;
      expect(adjustment.adjustmentNumber).toMatch(/^ADJ-\d{4}-\d{6}$/);

      const stock = await getStock(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
      );
      expect(stock?.onHandQuantity).toBe(15);
    });

    it('applies a negative adjustment when sufficient stock exists', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant } = await setupBaseFixture(cookie);
      await createStockAdjustment(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
        20,
        'OPENING_BALANCE',
      );

      const response = await createStockAdjustment(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
        -5,
        'DAMAGE',
      );
      expect(response.status).toBe(201);

      const stock = await getStock(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
      );
      expect(stock?.onHandQuantity).toBe(15);
    });

    it('rejects a negative adjustment that would drive on-hand quantity below zero (409)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant } = await setupBaseFixture(cookie);
      await createStockAdjustment(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
        2,
        'OPENING_BALANCE',
      );

      const response = await createStockAdjustment(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
        -5,
        'LOSS',
      );
      expect(response.status).toBe(409);
    });

    it('rejects quantityChange === 0 (400)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant } = await setupBaseFixture(cookie);

      const response = await createStockAdjustment(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
        0,
        'CORRECTION',
      );
      expect(response.status).toBe(400);
    });

    it('records movement type OPENING_BALANCE correctly when reason is OPENING_BALANCE', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant } = await setupBaseFixture(cookie);

      const response = await createStockAdjustment(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
        25,
        'OPENING_BALANCE',
      );
      const adjustment = response.body as StockAdjustmentBody;

      const movementCount = await countRows(
        'SELECT COUNT(*) as c FROM stock_movements WHERE reference_id = ? AND movement_type = ?',
        [adjustment.id, 'OPENING_BALANCE'],
      );
      expect(movementCount).toBe(1);
    });

    it('records movement type ADJUSTMENT for any non-opening-balance reason', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant } = await setupBaseFixture(cookie);

      const response = await createStockAdjustment(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
        7,
        'CORRECTION',
      );
      const adjustment = response.body as StockAdjustmentBody;

      const movementCount = await countRows(
        'SELECT COUNT(*) as c FROM stock_movements WHERE reference_id = ? AND movement_type = ?',
        [adjustment.id, 'ADJUSTMENT'],
      );
      expect(movementCount).toBe(1);
    });

    it('rejects unknown fields (400)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant } = await setupBaseFixture(cookie);

      const response = await request(app.getHttpServer())
        .post('/api/v1/stock-adjustments')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          warehouseId: warehouse.id,
          productVariantId: variant.id,
          quantityChange: 5,
          reason: 'FOUND',
          unexpectedField: 'nope',
        });
      expect(response.status).toBe(400);
    });
  });

  describe('no PATCH/DELETE endpoints exist anywhere in Phase 14', () => {
    it('PATCH/DELETE on goods-receipts/:id, stock-transfers/:id, stock-adjustments/:id, warehouse-stock/:id all 404 or 405', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const routes = [
        '/api/v1/goods-receipts',
        '/api/v1/stock-transfers',
        '/api/v1/stock-adjustments',
        '/api/v1/warehouse-stock',
      ];
      for (const route of routes) {
        const patchResponse = await request(app.getHttpServer())
          .patch(`${route}/${fakeId}`)
          .set('Cookie', [cookie])
          .send({});
        expect([404, 405]).toContain(patchResponse.status);

        const deleteResponse = await request(app.getHttpServer())
          .delete(`${route}/${fakeId}`)
          .set('Cookie', [cookie]);
        expect([404, 405]).toContain(deleteResponse.status);
      }
    });
  });
});
