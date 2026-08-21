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

interface CategoryBody {
  id: string;
}

interface BrandBody {
  id: string;
}

interface AttributeOptionBody {
  id: string;
  kind: string;
}

interface ProductBody {
  id: string;
  companyId: string;
  code: string;
  status: string;
}

interface ProductVariantBody {
  id: string;
  productId: string;
  sku: string;
  status: string;
  attributes: Array<{ kind: string; optionId: string }>;
}

interface BarcodeBody {
  id: string;
  variantId: string;
  barcode: string;
  status: string;
}

interface PriceListBody {
  id: string;
  companyId: string;
  code: string;
  currency: string;
  status: string;
}

interface PriceListItemBody {
  id: string;
  priceListId: string;
  productVariantId: string;
  price: string;
  status: string;
}

describeIfDb('Products — Product/Variant/Barcode/PriceList (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let passwordService: PasswordService;

  let superAdminUser: User;
  let plainUser: User;

  const password = 'correct-horse-battery-staple';
  const authCookieByEmail = new Map<string, string>();
  const prefix = 'PROD-E2E';

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

  async function createCompany(cookie: string): Promise<CompanyBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Cookie', [cookie])
      .send({
        code: `${prefix}-CO-${rand()}`,
        name: 'Product E2E Test Company',
        baseCurrency: 'USD',
        timezone: 'Asia/Yangon',
      });
    return response.body as CompanyBody;
  }

  async function createCategory(
    cookie: string,
    companyId: string,
  ): Promise<CategoryBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Cookie', [cookie])
      .send({ companyId, code: `${prefix}-CAT-${rand()}`, name: 'T-Shirts' });
    return response.body as CategoryBody;
  }

  async function createBrand(
    cookie: string,
    companyId: string,
  ): Promise<BrandBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/brands')
      .set('Cookie', [cookie])
      .send({ companyId, code: `${prefix}-BR-${rand()}`, name: 'Nike' });
    return response.body as BrandBody;
  }

  async function createAttributeOption(
    cookie: string,
    companyId: string,
    kind: string,
    value: string,
  ): Promise<AttributeOptionBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/attribute-options')
      .set('Cookie', [cookie])
      .send({ companyId, kind, code: `${prefix}-ATTR-${rand()}`, value });
    return response.body as AttributeOptionBody;
  }

  async function createProduct(
    cookie: string,
    companyId: string,
    overrides: Partial<{
      code: string;
      categoryId: string;
      brandId: string;
      collectionId: string;
      attributes: Array<{ kind: string; optionId: string }>;
      sku: string;
    }> = {},
    categoryId: string,
    brandId: string,
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Cookie', [cookie])
      .send({
        companyId,
        code: overrides.code ?? `${prefix}-PROD-${rand()}`,
        name: 'Classic T-Shirt',
        categoryId: overrides.categoryId ?? categoryId,
        brandId: overrides.brandId ?? brandId,
        collectionId: overrides.collectionId,
        initialVariant: {
          sku: overrides.sku ?? `${prefix}-SKU-${rand()}`,
          costPrice: '10.00',
          sellingPrice: '20.00',
          attributes: overrides.attributes ?? [],
        },
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

    // Clean slate for this suite's own data only. Deletion order respects
    // FKs: price_list_items -> price_lists, product_variant_barcodes ->
    // product_variant_attributes -> product_variants -> products, then
    // categories/brands/attribute_options/companies/users.
    await dataSource.query(
      `DELETE FROM price_list_items WHERE price_list_id IN (SELECT id FROM (SELECT id FROM price_lists WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM price_lists WHERE code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM product_variant_barcodes WHERE barcode LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM product_variant_attributes WHERE variant_id IN (SELECT id FROM (SELECT id FROM product_variants WHERE sku LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM product_variants WHERE sku LIKE '${prefix}%'`,
    );
    await dataSource.query(`DELETE FROM products WHERE code LIKE '${prefix}%'`);
    await dataSource.query(
      `DELETE FROM attribute_options WHERE code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM categories WHERE code LIKE '${prefix}%'`,
    );
    await dataSource.query(`DELETE FROM brands WHERE code LIKE '${prefix}%'`);
    await dataSource.query(
      `DELETE FROM companies WHERE code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM user_roles WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE 'prod-e2e-%') t)`,
    );
    await dataSource.query("DELETE FROM users WHERE email LIKE 'prod-e2e-%'");

    const userRepository = dataSource.getRepository(User);
    const roleRepository = dataSource.getRepository(Role);
    const userRoleRepository = dataSource.getRepository(UserRole);

    superAdminUser = await userRepository.save(
      userRepository.create({
        email: 'prod-e2e-superadmin@example.com',
        passwordHash: await passwordService.hash(password),
        firstName: 'Prod',
        lastName: 'SuperAdmin',
        displayName: 'Prod Super Admin',
        status: UserStatus.Active,
        isEmailVerified: true,
        lastLoginAt: null,
        passwordChangedAt: null,
      }),
    );

    plainUser = await userRepository.save(
      userRepository.create({
        email: 'prod-e2e-plain@example.com',
        passwordHash: await passwordService.hash(password),
        firstName: 'Prod',
        lastName: 'Plain',
        displayName: 'Prod Plain User',
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
      `DELETE FROM price_list_items WHERE price_list_id IN (SELECT id FROM (SELECT id FROM price_lists WHERE code LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM price_lists WHERE code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM product_variant_barcodes WHERE barcode LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM product_variant_attributes WHERE variant_id IN (SELECT id FROM (SELECT id FROM product_variants WHERE sku LIKE '${prefix}%') t)`,
    );
    await dataSource.query(
      `DELETE FROM product_variants WHERE sku LIKE '${prefix}%'`,
    );
    await dataSource.query(`DELETE FROM products WHERE code LIKE '${prefix}%'`);
    await dataSource.query(
      `DELETE FROM attribute_options WHERE code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM categories WHERE code LIKE '${prefix}%'`,
    );
    await dataSource.query(`DELETE FROM brands WHERE code LIKE '${prefix}%'`);
    await dataSource.query(
      `DELETE FROM companies WHERE code LIKE '${prefix}%'`,
    );
    await dataSource.query(
      `DELETE FROM user_roles WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE 'prod-e2e-%') t)`,
    );
    await dataSource.query("DELETE FROM users WHERE email LIKE 'prod-e2e-%'");
    await app.close();
  });

  describe('authentication boundary', () => {
    it('returns 401 for all five resources without a session', async () => {
      const routes = ['/api/v1/products', '/api/v1/price-lists'];

      for (const route of routes) {
        const response = await request(app.getHttpServer()).get(route);
        expect(response.status).toBe(401);
      }
    });
  });

  describe('permission boundary', () => {
    it('returns 403 for a plain user attempting to create a product', async () => {
      const cookie = await loginAndGetCookie(plainUser.email);

      const response = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Cookie', [cookie])
        .send({ code: 'X', name: 'X', categoryId: 'x', brandId: 'x' });

      expect(response.status).toBe(403);
    });
  });

  describe('Product + initial Variant creation (transactional)', () => {
    it('creates a product with its initial variant and attributes in one call', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const category = await createCategory(cookie, company.id);
      const brand = await createBrand(cookie, company.id);
      const color = await createAttributeOption(
        cookie,
        company.id,
        'COLOR',
        'Black',
      );

      const response = await createProduct(
        cookie,
        company.id,
        { attributes: [{ kind: 'COLOR', optionId: color.id }] },
        category.id,
        brand.id,
      );

      expect(response.status).toBe(201);
      const product = response.body as ProductBody;
      expect(product.companyId).toBe(company.id);
      expect(product.status).toBe('ACTIVE');

      const variantsResponse = await request(app.getHttpServer())
        .get(`/api/v1/products/${product.id}/variants?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      expect(variantsResponse.status).toBe(200);
      const variants = (variantsResponse.body as { data: ProductVariantBody[] })
        .data;
      expect(variants).toHaveLength(1);
      expect(variants[0].attributes).toEqual([
        { kind: 'COLOR', optionId: color.id },
      ]);
    });

    it('rejects a categoryId belonging to a different company', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const companyA = await createCompany(cookie);
      const companyB = await createCompany(cookie);
      const categoryB = await createCategory(cookie, companyB.id);
      const brandA = await createBrand(cookie, companyA.id);

      const response = await createProduct(
        cookie,
        companyA.id,
        { categoryId: categoryB.id },
        categoryB.id,
        brandA.id,
      );

      expect(response.status).toBe(404);
    });

    it('rejects a duplicate product code within the same company', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const category = await createCategory(cookie, company.id);
      const brand = await createBrand(cookie, company.id);
      const code = `${prefix}-PROD-DUP-${rand()}`;

      const first = await createProduct(
        cookie,
        company.id,
        { code },
        category.id,
        brand.id,
      );
      expect(first.status).toBe(201);

      const second = await createProduct(
        cookie,
        company.id,
        { code },
        category.id,
        brand.id,
      );
      expect(second.status).toBe(409);
    });

    it('rejects a duplicate SKU within the same company', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const category = await createCategory(cookie, company.id);
      const brand = await createBrand(cookie, company.id);
      const sku = `${prefix}-SKU-DUP-${rand()}`;

      const first = await createProduct(
        cookie,
        company.id,
        { sku },
        category.id,
        brand.id,
      );
      expect(first.status).toBe(201);

      const second = await createProduct(
        cookie,
        company.id,
        { sku },
        category.id,
        brand.id,
      );
      expect(second.status).toBe(409);
    });

    it('rejects an unknown field on product create', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const category = await createCategory(cookie, company.id);
      const brand = await createBrand(cookie, company.id);

      const response = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          code: `${prefix}-PROD-${rand()}`,
          name: 'X',
          categoryId: category.id,
          brandId: brand.id,
          initialVariant: {
            sku: `${prefix}-SKU-${rand()}`,
            costPrice: '1',
            sellingPrice: '2',
          },
          barcode: 'should-not-exist',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Additional Variant creation — combination uniqueness (LOCKED)', () => {
    it('rejects a second variant with the exact same attribute combination', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const category = await createCategory(cookie, company.id);
      const brand = await createBrand(cookie, company.id);
      const black = await createAttributeOption(
        cookie,
        company.id,
        'COLOR',
        'Black',
      );
      const sizeM = await createAttributeOption(
        cookie,
        company.id,
        'SIZE',
        'M',
      );

      const productResponse = await createProduct(
        cookie,
        company.id,
        {
          attributes: [
            { kind: 'COLOR', optionId: black.id },
            { kind: 'SIZE', optionId: sizeM.id },
          ],
        },
        category.id,
        brand.id,
      );
      const product = productResponse.body as ProductBody;

      const duplicateResponse = await request(app.getHttpServer())
        .post(`/api/v1/products/${product.id}/variants?companyId=${company.id}`)
        .set('Cookie', [cookie])
        .send({
          sku: `${prefix}-SKU-${rand()}`,
          costPrice: '10.00',
          sellingPrice: '20.00',
          attributes: [
            { kind: 'COLOR', optionId: black.id },
            { kind: 'SIZE', optionId: sizeM.id },
          ],
        });

      expect(duplicateResponse.status).toBe(409);
    });

    it('allows a different attribute combination under the same product', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const category = await createCategory(cookie, company.id);
      const brand = await createBrand(cookie, company.id);
      const black = await createAttributeOption(
        cookie,
        company.id,
        'COLOR',
        'Black',
      );
      const sizeM = await createAttributeOption(
        cookie,
        company.id,
        'SIZE',
        'M',
      );
      const sizeL = await createAttributeOption(
        cookie,
        company.id,
        'SIZE',
        'L',
      );

      const productResponse = await createProduct(
        cookie,
        company.id,
        {
          attributes: [
            { kind: 'COLOR', optionId: black.id },
            { kind: 'SIZE', optionId: sizeM.id },
          ],
        },
        category.id,
        brand.id,
      );
      const product = productResponse.body as ProductBody;

      const secondResponse = await request(app.getHttpServer())
        .post(`/api/v1/products/${product.id}/variants?companyId=${company.id}`)
        .set('Cookie', [cookie])
        .send({
          sku: `${prefix}-SKU-${rand()}`,
          costPrice: '10.00',
          sellingPrice: '20.00',
          attributes: [
            { kind: 'COLOR', optionId: black.id },
            { kind: 'SIZE', optionId: sizeL.id },
          ],
        });

      expect(secondResponse.status).toBe(201);
    });

    it('rejects a duplicate attribute kind within the same variant', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const category = await createCategory(cookie, company.id);
      const brand = await createBrand(cookie, company.id);
      const black = await createAttributeOption(
        cookie,
        company.id,
        'COLOR',
        'Black',
      );
      const white = await createAttributeOption(
        cookie,
        company.id,
        'COLOR',
        'White',
      );

      const response = await createProduct(
        cookie,
        company.id,
        {
          attributes: [
            { kind: 'COLOR', optionId: black.id },
            { kind: 'COLOR', optionId: white.id },
          ],
        },
        category.id,
        brand.id,
      );

      expect(response.status).toBe(400);
    });
  });

  describe('Product delete — blocked while active variants exist', () => {
    it('rejects deleting a product that has an active variant', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const category = await createCategory(cookie, company.id);
      const brand = await createBrand(cookie, company.id);

      const productResponse = await createProduct(
        cookie,
        company.id,
        {},
        category.id,
        brand.id,
      );
      const product = productResponse.body as ProductBody;

      const deleteResponse = await request(app.getHttpServer())
        .delete(`/api/v1/products/${product.id}?companyId=${company.id}`)
        .set('Cookie', [cookie]);

      expect(deleteResponse.status).toBe(409);
    });
  });

  describe('Cross-company isolation (IDOR/BOLA)', () => {
    it('returns 404 for a product belonging to a different company', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const companyA = await createCompany(cookie);
      const companyB = await createCompany(cookie);
      const categoryA = await createCategory(cookie, companyA.id);
      const brandA = await createBrand(cookie, companyA.id);

      const productResponse = await createProduct(
        cookie,
        companyA.id,
        {},
        categoryA.id,
        brandA.id,
      );
      const product = productResponse.body as ProductBody;

      const response = await request(app.getHttpServer())
        .get(`/api/v1/products/${product.id}?companyId=${companyB.id}`)
        .set('Cookie', [cookie]);

      expect(response.status).toBe(404);
    });
  });

  describe('Barcode — normalized table, multiple barcodes per variant (LOCKED)', () => {
    it('supports creating multiple barcodes for the same variant', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const category = await createCategory(cookie, company.id);
      const brand = await createBrand(cookie, company.id);

      const productResponse = await createProduct(
        cookie,
        company.id,
        {},
        category.id,
        brand.id,
      );
      const product = productResponse.body as ProductBody;

      const variantsResponse = await request(app.getHttpServer())
        .get(`/api/v1/products/${product.id}/variants?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      const variant = (variantsResponse.body as { data: ProductVariantBody[] })
        .data[0];

      const firstBarcode = await request(app.getHttpServer())
        .post(`/api/v1/product-variants/${variant.id}/barcodes`)
        .set('Cookie', [cookie])
        .send({ companyId: company.id, barcode: `${prefix}-BC-${rand()}` });
      expect(firstBarcode.status).toBe(201);

      const secondBarcode = await request(app.getHttpServer())
        .post(`/api/v1/product-variants/${variant.id}/barcodes`)
        .set('Cookie', [cookie])
        .send({ companyId: company.id, barcode: `${prefix}-BC-${rand()}` });
      expect(secondBarcode.status).toBe(201);

      const listResponse = await request(app.getHttpServer())
        .get(
          `/api/v1/product-variants/${variant.id}/barcodes?companyId=${company.id}`,
        )
        .set('Cookie', [cookie]);
      expect((listResponse.body as { data: BarcodeBody[] }).data).toHaveLength(
        2,
      );
    });

    it('rejects a duplicate barcode within the same company', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const category = await createCategory(cookie, company.id);
      const brand = await createBrand(cookie, company.id);
      const barcode = `${prefix}-BC-DUP-${rand()}`;

      const productResponse = await createProduct(
        cookie,
        company.id,
        {},
        category.id,
        brand.id,
      );
      const product = productResponse.body as ProductBody;
      const variantsResponse = await request(app.getHttpServer())
        .get(`/api/v1/products/${product.id}/variants?companyId=${company.id}`)
        .set('Cookie', [cookie]);
      const variant = (variantsResponse.body as { data: ProductVariantBody[] })
        .data[0];

      const first = await request(app.getHttpServer())
        .post(`/api/v1/product-variants/${variant.id}/barcodes`)
        .set('Cookie', [cookie])
        .send({ companyId: company.id, barcode });
      expect(first.status).toBe(201);

      const second = await request(app.getHttpServer())
        .post(`/api/v1/product-variants/${variant.id}/barcodes`)
        .set('Cookie', [cookie])
        .send({ companyId: company.id, barcode });
      expect(second.status).toBe(409);
    });
  });

  describe('PriceList / PriceListItem — effective-dated pricing (LOCKED)', () => {
    async function setupProductAndVariant(
      cookie: string,
      companyId: string,
      categoryId: string,
      brandId: string,
    ): Promise<ProductVariantBody> {
      const productResponse = await createProduct(
        cookie,
        companyId,
        {},
        categoryId,
        brandId,
      );
      const product = productResponse.body as ProductBody;
      const variantsResponse = await request(app.getHttpServer())
        .get(`/api/v1/products/${product.id}/variants?companyId=${companyId}`)
        .set('Cookie', [cookie]);
      return (variantsResponse.body as { data: ProductVariantBody[] }).data[0];
    }

    it('creates a price list and a price list item', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const category = await createCategory(cookie, company.id);
      const brand = await createBrand(cookie, company.id);
      const variant = await setupProductAndVariant(
        cookie,
        company.id,
        category.id,
        brand.id,
      );

      const priceListResponse = await request(app.getHttpServer())
        .post('/api/v1/price-lists')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          code: `${prefix}-PL-${rand()}`,
          name: 'Retail Price List',
          currency: 'USD',
        });
      expect(priceListResponse.status).toBe(201);
      const priceList = priceListResponse.body as PriceListBody;

      const itemResponse = await request(app.getHttpServer())
        .post(
          `/api/v1/price-lists/${priceList.id}/items?companyId=${company.id}`,
        )
        .set('Cookie', [cookie])
        .send({
          productVariantId: variant.id,
          price: '25.00',
          validFrom: '2026-01-01T00:00:00Z',
        });
      expect(itemResponse.status).toBe(201);
      const item = itemResponse.body as PriceListItemBody;
      expect(item.priceListId).toBe(priceList.id);
      expect(item.productVariantId).toBe(variant.id);
    });

    it('rejects a negative price', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const category = await createCategory(cookie, company.id);
      const brand = await createBrand(cookie, company.id);
      const variant = await setupProductAndVariant(
        cookie,
        company.id,
        category.id,
        brand.id,
      );

      const priceListResponse = await request(app.getHttpServer())
        .post('/api/v1/price-lists')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          code: `${prefix}-PL-${rand()}`,
          name: 'Retail Price List',
          currency: 'USD',
        });
      const priceList = priceListResponse.body as PriceListBody;

      const response = await request(app.getHttpServer())
        .post(
          `/api/v1/price-lists/${priceList.id}/items?companyId=${company.id}`,
        )
        .set('Cookie', [cookie])
        .send({
          productVariantId: variant.id,
          price: '-5.00',
          validFrom: '2026-01-01T00:00:00Z',
        });

      expect(response.status).toBe(400);
    });

    it('rejects validTo at or before validFrom', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const category = await createCategory(cookie, company.id);
      const brand = await createBrand(cookie, company.id);
      const variant = await setupProductAndVariant(
        cookie,
        company.id,
        category.id,
        brand.id,
      );

      const priceListResponse = await request(app.getHttpServer())
        .post('/api/v1/price-lists')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          code: `${prefix}-PL-${rand()}`,
          name: 'Retail Price List',
          currency: 'USD',
        });
      const priceList = priceListResponse.body as PriceListBody;

      const response = await request(app.getHttpServer())
        .post(
          `/api/v1/price-lists/${priceList.id}/items?companyId=${company.id}`,
        )
        .set('Cookie', [cookie])
        .send({
          productVariantId: variant.id,
          price: '25.00',
          validFrom: '2026-06-01T00:00:00Z',
          validTo: '2026-01-01T00:00:00Z',
        });

      expect(response.status).toBe(400);
    });

    it('rejects an overlapping active price window for the same variant', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const category = await createCategory(cookie, company.id);
      const brand = await createBrand(cookie, company.id);
      const variant = await setupProductAndVariant(
        cookie,
        company.id,
        category.id,
        brand.id,
      );

      const priceListResponse = await request(app.getHttpServer())
        .post('/api/v1/price-lists')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          code: `${prefix}-PL-${rand()}`,
          name: 'Retail Price List',
          currency: 'USD',
        });
      const priceList = priceListResponse.body as PriceListBody;

      const first = await request(app.getHttpServer())
        .post(
          `/api/v1/price-lists/${priceList.id}/items?companyId=${company.id}`,
        )
        .set('Cookie', [cookie])
        .send({
          productVariantId: variant.id,
          price: '25.00',
          validFrom: '2026-01-01T00:00:00Z',
        });
      expect(first.status).toBe(201);

      const second = await request(app.getHttpServer())
        .post(
          `/api/v1/price-lists/${priceList.id}/items?companyId=${company.id}`,
        )
        .set('Cookie', [cookie])
        .send({
          productVariantId: variant.id,
          price: '30.00',
          validFrom: '2026-03-01T00:00:00Z',
        });

      expect(second.status).toBe(409);
    });

    it('rejects a productVariantId belonging to a different company', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const companyA = await createCompany(cookie);
      const companyB = await createCompany(cookie);
      const categoryA = await createCategory(cookie, companyA.id);
      const brandA = await createBrand(cookie, companyA.id);
      const variantA = await setupProductAndVariant(
        cookie,
        companyA.id,
        categoryA.id,
        brandA.id,
      );

      const priceListResponse = await request(app.getHttpServer())
        .post('/api/v1/price-lists')
        .set('Cookie', [cookie])
        .send({
          companyId: companyB.id,
          code: `${prefix}-PL-${rand()}`,
          name: 'Retail Price List',
          currency: 'USD',
        });
      const priceList = priceListResponse.body as PriceListBody;

      const response = await request(app.getHttpServer())
        .post(
          `/api/v1/price-lists/${priceList.id}/items?companyId=${companyB.id}`,
        )
        .set('Cookie', [cookie])
        .send({
          productVariantId: variantA.id,
          price: '25.00',
          validFrom: '2026-01-01T00:00:00Z',
        });

      expect(response.status).toBe(404);
    });

    it('rejects an invalid ISO currency code on price list create', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);

      const response = await request(app.getHttpServer())
        .post('/api/v1/price-lists')
        .set('Cookie', [cookie])
        .send({
          companyId: company.id,
          code: `${prefix}-PL-${rand()}`,
          name: 'Bad Currency',
          currency: 'usd',
        });

      expect(response.status).toBe(400);
    });

    it('rejects a duplicate price list code within the same company', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);
      const company = await createCompany(cookie);
      const code = `${prefix}-PL-DUP-${rand()}`;

      const first = await request(app.getHttpServer())
        .post('/api/v1/price-lists')
        .set('Cookie', [cookie])
        .send({ companyId: company.id, code, name: 'First', currency: 'USD' });
      expect(first.status).toBe(201);

      const second = await request(app.getHttpServer())
        .post('/api/v1/price-lists')
        .set('Cookie', [cookie])
        .send({ companyId: company.id, code, name: 'Second', currency: 'USD' });
      expect(second.status).toBe(409);
    });
  });

  describe('Unit/UOM deferral proof (LOCKED)', () => {
    it('there is no /units endpoint', async () => {
      const cookie = await loginAndGetCookie(superAdminUser.email);

      const response = await request(app.getHttpServer())
        .get('/api/v1/units')
        .set('Cookie', [cookie]);

      expect(response.status).toBe(404);
    });
  });
});
