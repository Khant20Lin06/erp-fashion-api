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
}
interface CustomerBody {
  id: string;
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
interface StockAdjustmentBody {
  id: string;
  adjustmentNumber: string;
}
interface SaleItemBody {
  id: string;
  productVariantId: string;
}
interface SaleBody {
  id: string;
  status: string;
  items?: SaleItemBody[];
}
interface LedgerEntryBody {
  id: string;
  warehouseId: string;
  productVariantId: string;
  movementType: string;
  quantityChange: number;
  quantityAfter: number;
  referenceType: string;
  referenceId: string;
  createdAt: string;
  createdBy: string | null;
}
interface StockCardEntryBody {
  id: string;
  movementType: string;
  quantityChange: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType: string;
  referenceId: string;
  createdAt: string;
}
interface ReconciliationBody {
  warehouseId: string;
  productVariantId: string;
  warehouseStockBalance: number;
  ledgerBalance: number;
  difference: number;
  reconciled: boolean;
}

describeIfDb('Inventory Ledger (Phase 15) (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let passwordService: PasswordService;

  let superAdminUser: User;
  let plainUser: User;

  const password = 'correct-horse-battery-staple';
  const authCookieByEmail = new Map<string, string>();
  const prefix = 'LEDGER-E2E';

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
        name: 'Inventory Ledger E2E Test Company',
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
        name: 'Retail Customer',
      });
    return response.body as CustomerBody;
  }

  async function createPriceListWithItem(
    cookie: string,
    companyId: string,
    variantId: string,
  ): Promise<void> {
    const plResponse = await request(app.getHttpServer())
      .post('/api/v1/price-lists')
      .set('Cookie', [cookie])
      .send({
        companyId,
        code: uniqueCode('PL'),
        name: 'Default Price List',
        currency: 'USD',
      });
    const priceListId = (plResponse.body as { id: string }).id;
    const itemResponse = await request(app.getHttpServer())
      .post(`/api/v1/price-lists/${priceListId}/items?companyId=${companyId}`)
      .set('Cookie', [cookie])
      .send({
        productVariantId: variantId,
        price: '20.00',
        validFrom: '2020-01-01T00:00:00Z',
      });
    if (itemResponse.status !== 201) {
      throw new Error(
        `createPriceListWithItem failed: ${itemResponse.status} ${JSON.stringify(itemResponse.body)}`,
      );
    }
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
  ): Promise<PurchaseOrderBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/purchase-orders')
      .set('Cookie', [cookie])
      .send({ companyId, supplierId, currency: 'USD', items });
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

  async function createSale(
    cookie: string,
    companyId: string,
    warehouseId: string,
    customerId: string,
    items: Array<{ productVariantId: string; quantity: number }>,
  ): Promise<SaleBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .set('Cookie', [cookie])
      .send({ companyId, warehouseId, customerId, currency: 'USD', items });
    if (response.status !== 201) {
      throw new Error(
        `createSale failed: ${response.status} ${JSON.stringify(response.body)}`,
      );
    }
    return response.body as SaleBody;
  }

  async function confirmSale(
    cookie: string,
    companyId: string,
    id: string,
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .post(`/api/v1/sales/${id}/confirm?companyId=${companyId}`)
      .set('Cookie', [cookie]);
  }

  /** Full setup: company, branch, 2 warehouses, category, brand, variant, supplier, customer, price list. */
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
    const customer = await createCustomer(cookie, company.id);
    await createPriceListWithItem(cookie, company.id, variant.id);
    return {
      company,
      branch,
      warehouse,
      warehouse2,
      category,
      brand,
      variant,
      supplier,
      customer,
    };
  }

  async function cleanupPrefixedData(): Promise<void> {
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
      `DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM (SELECT id FROM sales WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
    );
    await dataSource.query(
      `DELETE FROM sales WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM company_sale_counters WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM price_list_items WHERE price_list_id IN (SELECT id FROM (SELECT id FROM price_lists WHERE company_id IN (SELECT id FROM companies WHERE code LIKE '${prefix}%')) t)`,
    );
    await dataSource.query(
      `DELETE FROM price_lists WHERE company_id IN (SELECT id FROM (SELECT id FROM companies WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM suppliers WHERE supplier_code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM customers WHERE customer_code LIKE '${prefix}%'`,
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
      `DELETE FROM user_roles WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE 'ledger-e2e-%') t)`,
    );
    await dataSource.query("DELETE FROM users WHERE email LIKE 'ledger-e2e-%'");
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

    await cleanupPrefixedData();

    const userRepository = dataSource.getRepository(User);
    const roleRepository = dataSource.getRepository(Role);
    const userRoleRepository = dataSource.getRepository(UserRole);

    superAdminUser = await userRepository.save(
      userRepository.create({
        email: 'ledger-e2e-superadmin@example.com',
        passwordHash: await passwordService.hash(password),
        firstName: 'Ledger',
        lastName: 'SuperAdmin',
        displayName: 'Ledger Super Admin',
        status: UserStatus.Active,
        isEmailVerified: true,
        lastLoginAt: null,
        passwordChangedAt: null,
      }),
    );

    plainUser = await userRepository.save(
      userRepository.create({
        email: 'ledger-e2e-plain@example.com',
        passwordHash: await passwordService.hash(password),
        firstName: 'Ledger',
        lastName: 'Plain',
        displayName: 'Ledger Plain User',
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
    await cleanupPrefixedData();
    await app.close();
  });

  describe('authentication / permission boundary', () => {
    it('returns 401 for every inventory-ledger endpoint without a session', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const responses = await Promise.all([
        request(app.getHttpServer()).get('/api/v1/inventory-ledger'),
        request(app.getHttpServer()).get(`/api/v1/inventory-ledger/${fakeId}`),
        request(app.getHttpServer()).get('/api/v1/inventory-ledger/stock-card'),
        request(app.getHttpServer()).get(
          '/api/v1/inventory-ledger/reconciliation',
        ),
      ]);
      for (const response of responses) {
        expect(response.status).toBe(401);
      }
    });

    it('rejects a user without inventory_ledger.read (403)', async () => {
      const cookie = await loginAndGetCookie(plainUser.email);
      const response = await request(app.getHttpServer())
        .get('/api/v1/inventory-ledger')
        .set('Cookie', [cookie]);
      expect(response.status).toBe(403);
    });

    it('has no POST/PATCH/DELETE endpoint anywhere under /inventory-ledger (read-only surface)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const postResponse = await request(app.getHttpServer())
        .post('/api/v1/inventory-ledger')
        .set('Cookie', [cookie])
        .send({});
      expect([404, 405]).toContain(postResponse.status);

      const patchResponse = await request(app.getHttpServer())
        .patch(`/api/v1/inventory-ledger/${fakeId}`)
        .set('Cookie', [cookie])
        .send({});
      expect([404, 405]).toContain(patchResponse.status);

      const deleteResponse = await request(app.getHttpServer())
        .delete(`/api/v1/inventory-ledger/${fakeId}`)
        .set('Cookie', [cookie]);
      expect([404, 405]).toContain(deleteResponse.status);
    });
  });

  describe('GET /inventory-ledger — list, filters, pagination, ordering', () => {
    it('returns an empty list for a fresh company with no movements yet', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company } = await setupBaseFixture(cookie);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/inventory-ledger?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      expect(response.status).toBe(200);
      const body = response.body as { data: LedgerEntryBody[]; meta: unknown };
      expect(body.data).toEqual([]);
      expect(body.meta).toMatchObject({ page: 1, limit: 20, total: 0 });
    });

    it('lists movements generated by a real StockAdjustment write path', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant } = await setupBaseFixture(cookie);

      const adjResponse = await createStockAdjustment(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
        30,
        'OPENING_BALANCE',
      );
      expect(adjResponse.status).toBe(201);
      const adjustment = adjResponse.body as StockAdjustmentBody;

      const response = await request(app.getHttpServer())
        .get(`/api/v1/inventory-ledger?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      expect(response.status).toBe(200);
      const body = response.body as { data: LedgerEntryBody[] };
      expect(body.data).toHaveLength(1);
      expect(body.data[0].movementType).toBe('OPENING_BALANCE');
      expect(body.data[0].quantityChange).toBe(30);
      expect(body.data[0].quantityAfter).toBe(30);
      expect(body.data[0].referenceType).toBe('STOCK_ADJUSTMENT');
      expect(body.data[0].referenceId).toBe(adjustment.id);
    });

    it('accumulates movements across GoodsReceipt, Sale confirm, StockTransfer, and StockAdjustment (multiple movements)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, warehouse2, variant, supplier, customer } =
        await setupBaseFixture(cookie);

      // 1. GoodsReceipt -> PURCHASE_RECEIPT
      const po = await createPurchaseOrder(cookie, company.id, supplier.id, [
        { productVariantId: variant.id, quantity: 20, unitCost: '5.00' },
      ]);
      await confirmPurchaseOrder(cookie, company.id, po.id);
      await createGoodsReceipt(cookie, company.id, po.id, warehouse.id, [
        {
          purchaseOrderItemId: po.items![0].id,
          productVariantId: variant.id,
          receivedQuantity: 20,
        },
      ]);

      // 2. StockTransfer -> TRANSFER_OUT + TRANSFER_IN
      await createStockTransfer(
        cookie,
        company.id,
        warehouse.id,
        warehouse2.id,
        [{ productVariantId: variant.id, quantity: 5 }],
      );

      // 3. Sale confirm -> SALE_ISSUE
      const sale = await createSale(
        cookie,
        company.id,
        warehouse.id,
        customer.id,
        [{ productVariantId: variant.id, quantity: 3 }],
      );
      const confirmResponse = await confirmSale(cookie, company.id, sale.id);
      expect(confirmResponse.status).toBe(200);

      // 4. StockAdjustment -> ADJUSTMENT
      await createStockAdjustment(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
        -2,
        'DAMAGE',
      );

      const response = await request(app.getHttpServer())
        .get(`/api/v1/inventory-ledger?companyId=${company.id}&limit=100`)
        .set('Cookie', [cookie]);
      expect(response.status).toBe(200);
      const body = response.body as {
        data: LedgerEntryBody[];
        meta: { total: number };
      };
      // PURCHASE_RECEIPT(1) + TRANSFER_OUT(1) + TRANSFER_IN(1) + SALE_ISSUE(1) + ADJUSTMENT(1) = 5
      expect(body.meta.total).toBe(5);
      const types = body.data.map((m) => m.movementType).sort();
      expect(types).toEqual(
        [
          'ADJUSTMENT',
          'PURCHASE_RECEIPT',
          'SALE_ISSUE',
          'TRANSFER_IN',
          'TRANSFER_OUT',
        ].sort(),
      );
    });

    it('filters by warehouseId', async () => {
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
      await createStockAdjustment(
        cookie,
        company.id,
        warehouse2.id,
        variant.id,
        15,
        'OPENING_BALANCE',
      );

      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/inventory-ledger?companyId=${company.id}&warehouseId=${warehouse.id}`,
        )
        .set('Cookie', [cookie]);
      const body = response.body as { data: LedgerEntryBody[] };
      expect(body.data).toHaveLength(1);
      expect(body.data[0].warehouseId).toBe(warehouse.id);
    });

    it('filters by productVariantId', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, category, brand, variant } =
        await setupBaseFixture(cookie);
      const otherVariant = await createProductVariant(
        cookie,
        company.id,
        category.id,
        brand.id,
      );
      await createStockAdjustment(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
        10,
        'OPENING_BALANCE',
      );
      await createStockAdjustment(
        cookie,
        company.id,
        warehouse.id,
        otherVariant.id,
        12,
        'OPENING_BALANCE',
      );

      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/inventory-ledger?companyId=${company.id}&productVariantId=${variant.id}`,
        )
        .set('Cookie', [cookie]);
      const body = response.body as { data: LedgerEntryBody[] };
      expect(body.data).toHaveLength(1);
      expect(body.data[0].productVariantId).toBe(variant.id);
    });

    it('filters by movementType', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant } = await setupBaseFixture(cookie);
      await createStockAdjustment(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
        10,
        'OPENING_BALANCE',
      );
      await createStockAdjustment(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
        -2,
        'DAMAGE',
      );

      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/inventory-ledger?companyId=${company.id}&movementType=ADJUSTMENT`,
        )
        .set('Cookie', [cookie]);
      const body = response.body as { data: LedgerEntryBody[] };
      expect(body.data).toHaveLength(1);
      expect(body.data[0].movementType).toBe('ADJUSTMENT');
    });

    it('filters by referenceType', async () => {
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
      await createStockTransfer(
        cookie,
        company.id,
        warehouse.id,
        warehouse2.id,
        [{ productVariantId: variant.id, quantity: 5 }],
      );

      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/inventory-ledger?companyId=${company.id}&referenceType=STOCK_ADJUSTMENT`,
        )
        .set('Cookie', [cookie]);
      const body = response.body as { data: LedgerEntryBody[] };
      expect(body.data).toHaveLength(1);
      expect(body.data[0].referenceType).toBe('STOCK_ADJUSTMENT');
    });

    it('filters by referenceId', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant } = await setupBaseFixture(cookie);
      const adjResponse = await createStockAdjustment(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
        20,
        'OPENING_BALANCE',
      );
      const adjustment = adjResponse.body as StockAdjustmentBody;
      await createStockAdjustment(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
        5,
        'FOUND',
      );

      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/inventory-ledger?companyId=${company.id}&referenceId=${adjustment.id}`,
        )
        .set('Cookie', [cookie]);
      const body = response.body as { data: LedgerEntryBody[] };
      expect(body.data).toHaveLength(1);
      expect(body.data[0].referenceId).toBe(adjustment.id);
    });

    it('filters by fromDate/toDate, excluding movements outside the window', async () => {
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

      const farFuture = '2099-01-01';
      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/inventory-ledger?companyId=${company.id}&fromDate=${farFuture}`,
        )
        .set('Cookie', [cookie]);
      expect(response.status).toBe(200);
      const body = response.body as { data: LedgerEntryBody[] };
      expect(body.data).toHaveLength(0);

      const farPast = '1970-01-01';
      const response2 = await request(app.getHttpServer())
        .get(
          `/api/v1/inventory-ledger?companyId=${company.id}&fromDate=${farPast}&toDate=${farFuture}`,
        )
        .set('Cookie', [cookie]);
      const body2 = response2.body as { data: LedgerEntryBody[] };
      expect(body2.data.length).toBeGreaterThanOrEqual(1);
    });

    it('rejects fromDate > toDate with 400', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company } = await setupBaseFixture(cookie);

      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/inventory-ledger?companyId=${company.id}&fromDate=2026-02-01&toDate=2026-01-01`,
        )
        .set('Cookie', [cookie]);
      expect(response.status).toBe(400);
    });

    it('paginates correctly (limit + page)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant } = await setupBaseFixture(cookie);
      for (let i = 0; i < 5; i += 1) {
        await createStockAdjustment(
          cookie,
          company.id,
          warehouse.id,
          variant.id,
          1,
          'CORRECTION',
        );
      }

      const page1 = await request(app.getHttpServer())
        .get(`/api/v1/inventory-ledger?companyId=${company.id}&limit=2&page=1`)
        .set('Cookie', [cookie]);
      const page1Body = page1.body as {
        data: LedgerEntryBody[];
        meta: { total: number };
      };
      expect(page1Body.data).toHaveLength(2);
      expect(page1Body.meta.total).toBe(5);

      const page3 = await request(app.getHttpServer())
        .get(`/api/v1/inventory-ledger?companyId=${company.id}&limit=2&page=3`)
        .set('Cookie', [cookie]);
      const page3Body = page3.body as { data: LedgerEntryBody[] };
      expect(page3Body.data).toHaveLength(1);
    });

    it('orders deterministically (createdAt DESC + id ASC tiebreak) — no duplicate/missing rows across pages', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant } = await setupBaseFixture(cookie);
      for (let i = 0; i < 4; i += 1) {
        await createStockAdjustment(
          cookie,
          company.id,
          warehouse.id,
          variant.id,
          1,
          'CORRECTION',
        );
      }

      const full = await request(app.getHttpServer())
        .get(`/api/v1/inventory-ledger?companyId=${company.id}&limit=100`)
        .set('Cookie', [cookie]);
      const fullBody = full.body as { data: LedgerEntryBody[] };
      const fullIds = fullBody.data.map((m) => m.id);

      const p1 = await request(app.getHttpServer())
        .get(`/api/v1/inventory-ledger?companyId=${company.id}&limit=2&page=1`)
        .set('Cookie', [cookie]);
      const p2 = await request(app.getHttpServer())
        .get(`/api/v1/inventory-ledger?companyId=${company.id}&limit=2&page=2`)
        .set('Cookie', [cookie]);
      const p1Ids = (p1.body as { data: LedgerEntryBody[] }).data.map(
        (m) => m.id,
      );
      const p2Ids = (p2.body as { data: LedgerEntryBody[] }).data.map(
        (m) => m.id,
      );
      expect([...p1Ids, ...p2Ids]).toEqual(fullIds);
      expect(new Set([...p1Ids, ...p2Ids]).size).toBe(fullIds.length);
    });
  });

  describe('GET /inventory-ledger/:id — detail', () => {
    it('returns the movement when it exists and belongs to the resolved company', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant } = await setupBaseFixture(cookie);
      const adjResponse = await createStockAdjustment(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
        10,
        'OPENING_BALANCE',
      );
      const adjustment = adjResponse.body as StockAdjustmentBody;

      const listResponse = await request(app.getHttpServer())
        .get(`/api/v1/inventory-ledger?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      const list = listResponse.body as { data: LedgerEntryBody[] };
      const movementId = list.data.find(
        (m) => m.referenceId === adjustment.id,
      )!.id;

      const response = await request(app.getHttpServer())
        .get(`/api/v1/inventory-ledger/${movementId}?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      expect(response.status).toBe(200);
      const body = response.body as LedgerEntryBody;
      expect(body.id).toBe(movementId);
      expect(body.quantityChange).toBe(10);
    });

    it('returns 404 for a nonexistent id', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company } = await setupBaseFixture(cookie);
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app.getHttpServer())
        .get(`/api/v1/inventory-ledger/${fakeId}?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      expect(response.status).toBe(404);
    });

    it('returns 404 (never a leaked existence signal) for a movement belonging to a different company', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const fixtureA = await setupBaseFixture(cookie);
      const fixtureB = await setupBaseFixture(cookie);
      const adjResponse = await createStockAdjustment(
        cookie,
        fixtureA.company.id,
        fixtureA.warehouse.id,
        fixtureA.variant.id,
        10,
        'OPENING_BALANCE',
      );
      const adjustment = adjResponse.body as StockAdjustmentBody;

      const listResponse = await request(app.getHttpServer())
        .get(`/api/v1/inventory-ledger?companyId=${fixtureA.company.id}`)
        .set('Cookie', [cookie]);
      const list = listResponse.body as { data: LedgerEntryBody[] };
      const movementId = list.data.find(
        (m) => m.referenceId === adjustment.id,
      )!.id;

      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/inventory-ledger/${movementId}?companyId=${fixtureB.company.id}`,
        )
        .set('Cookie', [cookie]);
      expect(response.status).toBe(404);
    });
  });

  describe('GET /inventory-ledger/stock-card — chronological balance reconstruction', () => {
    it('requires warehouseId and productVariantId (400 if missing)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse } = await setupBaseFixture(cookie);

      const missingVariant = await request(app.getHttpServer())
        .get(
          `/api/v1/inventory-ledger/stock-card?companyId=${company.id}&warehouseId=${warehouse.id}`,
        )
        .set('Cookie', [cookie]);
      expect(missingVariant.status).toBe(400);

      const missingWarehouse = await request(app.getHttpServer())
        .get(`/api/v1/inventory-ledger/stock-card?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      expect(missingWarehouse.status).toBe(400);
    });

    it('reconstructs a mixed real sequence — PURCHASE_RECEIPT, SALE_ISSUE, TRANSFER_OUT/IN, ADJUSTMENT, OPENING_BALANCE — in chronological order with correct balanceBefore/balanceAfter at every step', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, warehouse2, variant, supplier, customer } =
        await setupBaseFixture(cookie);

      // Step 1: OPENING_BALANCE +50 -> balance 50
      await createStockAdjustment(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
        50,
        'OPENING_BALANCE',
      );

      // Step 2: PURCHASE_RECEIPT +20 -> balance 70
      const po = await createPurchaseOrder(cookie, company.id, supplier.id, [
        { productVariantId: variant.id, quantity: 20, unitCost: '5.00' },
      ]);
      await confirmPurchaseOrder(cookie, company.id, po.id);
      await createGoodsReceipt(cookie, company.id, po.id, warehouse.id, [
        {
          purchaseOrderItemId: po.items![0].id,
          productVariantId: variant.id,
          receivedQuantity: 20,
        },
      ]);

      // Step 3: SALE_ISSUE -10 -> balance 60
      const sale = await createSale(
        cookie,
        company.id,
        warehouse.id,
        customer.id,
        [{ productVariantId: variant.id, quantity: 10 }],
      );
      const confirmResponse = await confirmSale(cookie, company.id, sale.id);
      expect(confirmResponse.status).toBe(200);

      // Step 4: TRANSFER_OUT -15 -> balance 45 (on source warehouse)
      await createStockTransfer(
        cookie,
        company.id,
        warehouse.id,
        warehouse2.id,
        [{ productVariantId: variant.id, quantity: 15 }],
      );

      // Step 5: ADJUSTMENT -5 (DAMAGE) -> balance 40
      await createStockAdjustment(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
        -5,
        'DAMAGE',
      );

      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/inventory-ledger/stock-card?companyId=${company.id}&warehouseId=${warehouse.id}&productVariantId=${variant.id}`,
        )
        .set('Cookie', [cookie]);
      expect(response.status).toBe(200);
      const body = response.body as { data: StockCardEntryBody[] };
      const entries = body.data;

      expect(entries).toHaveLength(5);
      expect(entries.map((e) => e.movementType)).toEqual([
        'OPENING_BALANCE',
        'PURCHASE_RECEIPT',
        'SALE_ISSUE',
        'TRANSFER_OUT',
        'ADJUSTMENT',
      ]);

      // Chronological order verified via createdAt non-decreasing.
      for (let i = 1; i < entries.length; i += 1) {
        expect(new Date(entries[i].createdAt).getTime()).toBeGreaterThanOrEqual(
          new Date(entries[i - 1].createdAt).getTime(),
        );
      }

      const expectedBalances = [50, 70, 60, 45, 40];
      entries.forEach((entry, index) => {
        expect(entry.balanceAfter).toBe(expectedBalances[index]);
        const expectedBefore = index === 0 ? 0 : expectedBalances[index - 1];
        expect(entry.balanceBefore).toBe(expectedBefore);
        // Verify the derivation formula directly against the raw fields.
        expect(entry.balanceAfter - entry.quantityChange).toBe(
          entry.balanceBefore,
        );
      });

      // Final balance matches live WarehouseStock.
      const stockResponse = await request(app.getHttpServer())
        .get(
          `/api/v1/warehouse-stock?companyId=${company.id}&warehouseId=${warehouse.id}&productVariantId=${variant.id}`,
        )
        .set('Cookie', [cookie]);
      const stockBody = stockResponse.body as {
        data: Array<{ onHandQuantity: number }>;
      };
      expect(stockBody.data[0].onHandQuantity).toBe(40);
    });

    it('does not mix movements from a different warehouse or variant into the stock card', async () => {
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
      await createStockAdjustment(
        cookie,
        company.id,
        warehouse2.id,
        variant.id,
        99,
        'OPENING_BALANCE',
      );

      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/inventory-ledger/stock-card?companyId=${company.id}&warehouseId=${warehouse.id}&productVariantId=${variant.id}`,
        )
        .set('Cookie', [cookie]);
      const body = response.body as { data: StockCardEntryBody[] };
      expect(body.data).toHaveLength(1);
      expect(body.data[0].balanceAfter).toBe(10);
    });
  });

  describe('GET /inventory-ledger/reconciliation — diagnostic', () => {
    it('requires warehouseId and productVariantId (400 if missing)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company } = await setupBaseFixture(cookie);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/inventory-ledger/reconciliation?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      expect(response.status).toBe(400);
    });

    it('reports reconciled = true for a pair whose stock was built entirely through real Phase 14 write paths (no discrepancy possible under correct code)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, warehouse2, variant, supplier, customer } =
        await setupBaseFixture(cookie);

      await createStockAdjustment(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
        40,
        'OPENING_BALANCE',
      );
      const po = await createPurchaseOrder(cookie, company.id, supplier.id, [
        { productVariantId: variant.id, quantity: 10, unitCost: '5.00' },
      ]);
      await confirmPurchaseOrder(cookie, company.id, po.id);
      await createGoodsReceipt(cookie, company.id, po.id, warehouse.id, [
        {
          purchaseOrderItemId: po.items![0].id,
          productVariantId: variant.id,
          receivedQuantity: 10,
        },
      ]);
      const sale = await createSale(
        cookie,
        company.id,
        warehouse.id,
        customer.id,
        [{ productVariantId: variant.id, quantity: 5 }],
      );
      const confirmResponse = await confirmSale(cookie, company.id, sale.id);
      expect(confirmResponse.status).toBe(200);
      await createStockTransfer(
        cookie,
        company.id,
        warehouse.id,
        warehouse2.id,
        [{ productVariantId: variant.id, quantity: 8 }],
      );

      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/inventory-ledger/reconciliation?companyId=${company.id}&warehouseId=${warehouse.id}&productVariantId=${variant.id}`,
        )
        .set('Cookie', [cookie]);
      expect(response.status).toBe(200);
      const body = response.body as ReconciliationBody;
      // 40 + 10 - 5 - 8 = 37
      expect(body.warehouseStockBalance).toBe(37);
      expect(body.ledgerBalance).toBe(37);
      expect(body.difference).toBe(0);
      expect(body.reconciled).toBe(true);
    });

    it('reports reconciled = true (balance 0) for an untouched (warehouse, variant) pair with no movements at all', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant } = await setupBaseFixture(cookie);

      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/inventory-ledger/reconciliation?companyId=${company.id}&warehouseId=${warehouse.id}&productVariantId=${variant.id}`,
        )
        .set('Cookie', [cookie]);
      expect(response.status).toBe(200);
      const body = response.body as ReconciliationBody;
      expect(body.warehouseStockBalance).toBe(0);
      expect(body.ledgerBalance).toBe(0);
      expect(body.reconciled).toBe(true);
    });

    it('the reconciliation math itself is correct: verified directly against a hand-computed SUM and onHandQuantity from real operations (no data tampering)', async () => {
      // This test does not attempt to manufacture an artificial discrepancy
      // by writing directly to stock_movements/warehouse_stock (which the
      // locked spec explicitly forbids as "inappropriate" — it would not
      // prove anything about the read-only diagnostic's correctness, only
      // about a corrupted fixture). Instead, it independently recomputes
      // both sides of the comparison from the SAME live tables the service
      // reads, using a real GoodsReceipt + Sale + StockAdjustment sequence,
      // and asserts the API's response matches that independent computation
      // exactly — proving the formula (ledgerBalance = SUM(quantityChange),
      // difference = warehouseStockBalance - ledgerBalance) is implemented
      // correctly, without needing a genuinely broken state to exist.
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company, warehouse, variant, supplier } =
        await setupBaseFixture(cookie);

      await createStockAdjustment(
        cookie,
        company.id,
        warehouse.id,
        variant.id,
        12,
        'OPENING_BALANCE',
      );
      const po = await createPurchaseOrder(cookie, company.id, supplier.id, [
        { productVariantId: variant.id, quantity: 7, unitCost: '5.00' },
      ]);
      await confirmPurchaseOrder(cookie, company.id, po.id);
      await createGoodsReceipt(cookie, company.id, po.id, warehouse.id, [
        {
          purchaseOrderItemId: po.items![0].id,
          productVariantId: variant.id,
          receivedQuantity: 7,
        },
      ]);

      const independentSum: Array<{ total: string }> = await dataSource.query(
        `SELECT COALESCE(SUM(quantity_change), 0) as total FROM stock_movements WHERE warehouse_id = ? AND product_variant_id = ?`,
        [warehouse.id, variant.id],
      );
      const independentOnHand: Array<{ on_hand_quantity: number }> =
        await dataSource.query(
          `SELECT on_hand_quantity FROM warehouse_stock WHERE warehouse_id = ? AND product_variant_id = ?`,
          [warehouse.id, variant.id],
        );
      const expectedLedgerBalance = Number(independentSum[0].total);
      const expectedOnHand = Number(independentOnHand[0].on_hand_quantity);

      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/inventory-ledger/reconciliation?companyId=${company.id}&warehouseId=${warehouse.id}&productVariantId=${variant.id}`,
        )
        .set('Cookie', [cookie]);
      const body = response.body as ReconciliationBody;
      expect(body.ledgerBalance).toBe(expectedLedgerBalance);
      expect(body.warehouseStockBalance).toBe(expectedOnHand);
      expect(body.difference).toBe(expectedOnHand - expectedLedgerBalance);
      expect(body.reconciled).toBe(expectedOnHand === expectedLedgerBalance);
    });
  });

  describe('cross-company / unauthorized-scope rejection', () => {
    it('rejects a warehouseId/productVariantId belonging to a different company on the list endpoint (empty result, never a leaked cross-company row)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const fixtureA = await setupBaseFixture(cookie);
      const fixtureB = await setupBaseFixture(cookie);
      await createStockAdjustment(
        cookie,
        fixtureA.company.id,
        fixtureA.warehouse.id,
        fixtureA.variant.id,
        10,
        'OPENING_BALANCE',
      );

      // Query company B but filter by company A's warehouseId — the
      // companyId join means this can never leak A's data into B's scope.
      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/inventory-ledger?companyId=${fixtureB.company.id}&warehouseId=${fixtureA.warehouse.id}`,
        )
        .set('Cookie', [cookie]);
      expect(response.status).toBe(200);
      const body = response.body as { data: LedgerEntryBody[] };
      expect(body.data).toHaveLength(0);
    });

    it('rejects an unauthorized companyId for a user with no scope access (403)', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const { company } = await setupBaseFixture(cookie);

      const plainCookie = await loginAndGetCookie(plainUser.email);
      const response = await request(app.getHttpServer())
        .get(`/api/v1/inventory-ledger?companyId=${company.id}`)
        .set('Cookie', [plainCookie]);
      // plainUser has no roles/permissions at all -> PermissionGuard 403
      // before DataScope resolution is ever reached.
      expect(response.status).toBe(403);
    });

    it("reconciliation for a cross-company warehouseId/productVariantId returns zero balances, never another company's real data", async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const fixtureA = await setupBaseFixture(cookie);
      const fixtureB = await setupBaseFixture(cookie);
      await createStockAdjustment(
        cookie,
        fixtureA.company.id,
        fixtureA.warehouse.id,
        fixtureA.variant.id,
        999,
        'OPENING_BALANCE',
      );

      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/inventory-ledger/reconciliation?companyId=${fixtureB.company.id}&warehouseId=${fixtureA.warehouse.id}&productVariantId=${fixtureA.variant.id}`,
        )
        .set('Cookie', [cookie]);
      expect(response.status).toBe(200);
      const body = response.body as ReconciliationBody;
      expect(body.ledgerBalance).toBe(0);
      expect(body.warehouseStockBalance).toBe(0);
      expect(body.reconciled).toBe(true);
    });
  });
});
