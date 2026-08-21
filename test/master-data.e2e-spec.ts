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
  companyId: string;
  code: string;
  parentId: string | null;
  status: string;
}

interface BrandBody {
  id: string;
  companyId: string;
  code: string;
  status: string;
}

interface CollectionBody {
  id: string;
  companyId: string;
  code: string;
  season: string;
  status: string;
}

interface AttributeOptionBody {
  id: string;
  companyId: string;
  kind: string;
  code: string;
  swatch: string | null;
  status: string;
}

describeIfDb(
  'Master Data — Category/Brand/Collection/AttributeOption (e2e)',
  () => {
    let app: INestApplication<App>;
    let dataSource: DataSource;
    let passwordService: PasswordService;

    let superAdminUser: User;
    let plainUser: User;

    const password = 'correct-horse-battery-staple';
    const prefix = 'MD-E2E';
    const authCookieByEmail = new Map<string, string>();

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

    async function createCompany(cookie: string): Promise<CompanyBody> {
      const response = await request(app.getHttpServer())
        .post('/api/v1/companies')
        .set('Cookie', [cookie])
        .send({
          code: `${prefix}-CO-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
          name: 'MD E2E Test Company',
          baseCurrency: 'MMK',
          timezone: 'Asia/Yangon',
        });
      return response.body as CompanyBody;
    }

    async function createCategory(
      cookie: string,
      companyId: string,
      overrides: Partial<{ code: string; name: string; parentId: string }> = {},
    ): Promise<request.Response> {
      return request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Cookie', [cookie])
        .send({
          companyId,
          code:
            overrides.code ??
            `${prefix}-CAT-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
          name: overrides.name ?? 'Men',
          parentId: overrides.parentId,
        });
    }

    async function createBrand(
      cookie: string,
      companyId: string,
    ): Promise<BrandBody> {
      const response = await request(app.getHttpServer())
        .post('/api/v1/brands')
        .set('Cookie', [cookie])
        .send({
          companyId,
          code: `${prefix}-BR-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
          name: 'Nike',
        });
      return response.body as BrandBody;
    }

    async function createCollection(
      cookie: string,
      companyId: string,
    ): Promise<CollectionBody> {
      const response = await request(app.getHttpServer())
        .post('/api/v1/collections')
        .set('Cookie', [cookie])
        .send({
          companyId,
          code: `${prefix}-COL-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
          name: 'Summer 2026',
          season: 'SPRING_SUMMER',
          year: 2026,
        });
      return response.body as CollectionBody;
    }

    async function createAttributeOption(
      cookie: string,
      companyId: string,
      overrides: Partial<{
        kind: string;
        code: string;
        value: string;
        swatch: string;
      }> = {},
    ): Promise<request.Response> {
      return request(app.getHttpServer())
        .post('/api/v1/attribute-options')
        .set('Cookie', [cookie])
        .send({
          companyId,
          kind: overrides.kind ?? 'COLOR',
          code:
            overrides.code ??
            `${prefix}-ATTR-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
          value: overrides.value ?? 'Black',
          swatch: overrides.swatch,
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

      // Clean slate for this suite's own data only. parent_id is nulled
      // first so a leftover self-referencing category pair (e.g. from a
      // previously interrupted run) never trips the FK_cat_parent RESTRICT
      // constraint during the bulk DELETE below.
      await dataSource.query(
        `DELETE FROM attribute_options WHERE code LIKE '${prefix}%'`,
      );
      await dataSource.query(
        `DELETE FROM collections WHERE code LIKE '${prefix}%'`,
      );
      await dataSource.query(`DELETE FROM brands WHERE code LIKE '${prefix}%'`);
      await dataSource.query(
        `UPDATE categories SET parent_id = NULL WHERE code LIKE '${prefix}%'`,
      );
      await dataSource.query(
        `DELETE FROM categories WHERE code LIKE '${prefix}%'`,
      );
      await dataSource.query(
        `DELETE FROM companies WHERE code LIKE '${prefix}%'`,
      );
      await dataSource.query(
        `DELETE FROM user_roles WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE 'md-e2e-%') t)`,
      );
      await dataSource.query("DELETE FROM users WHERE email LIKE 'md-e2e-%'");

      const userRepository = dataSource.getRepository(User);
      const roleRepository = dataSource.getRepository(Role);
      const userRoleRepository = dataSource.getRepository(UserRole);

      superAdminUser = await userRepository.save(
        userRepository.create({
          email: 'md-e2e-superadmin@example.com',
          passwordHash: await passwordService.hash(password),
          firstName: 'MD',
          lastName: 'SuperAdmin',
          displayName: 'MD Super Admin',
          status: UserStatus.Active,
          isEmailVerified: true,
          lastLoginAt: null,
          passwordChangedAt: null,
        }),
      );

      plainUser = await userRepository.save(
        userRepository.create({
          email: 'md-e2e-plain@example.com',
          passwordHash: await passwordService.hash(password),
          firstName: 'MD',
          lastName: 'Plain',
          displayName: 'MD Plain User',
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
        `DELETE FROM attribute_options WHERE code LIKE '${prefix}%'`,
      );
      await dataSource.query(
        `DELETE FROM collections WHERE code LIKE '${prefix}%'`,
      );
      await dataSource.query(`DELETE FROM brands WHERE code LIKE '${prefix}%'`);
      await dataSource.query(
        `UPDATE categories SET parent_id = NULL WHERE code LIKE '${prefix}%'`,
      );
      await dataSource.query(
        `DELETE FROM categories WHERE code LIKE '${prefix}%'`,
      );
      await dataSource.query(
        `DELETE FROM companies WHERE code LIKE '${prefix}%'`,
      );
      await dataSource.query(
        `DELETE FROM user_roles WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email LIKE 'md-e2e-%') t)`,
      );
      await dataSource.query("DELETE FROM users WHERE email LIKE 'md-e2e-%'");
      await app.close();
    });

    describe('authentication boundary', () => {
      it('returns 401 for all four resources without a session', async () => {
        const routes = [
          '/api/v1/categories',
          '/api/v1/brands',
          '/api/v1/collections',
          '/api/v1/attribute-options',
        ];
        for (const route of routes) {
          const response = await request(app.getHttpServer()).get(route);
          expect(response.status).toBe(401);
        }
      });
    });

    describe('permission boundary (403 for a plain authenticated user)', () => {
      it('rejects category creation without categories.create', async () => {
        const cookie = await loginAndGetCookie(plainUser.email);
        const company = await (async () => {
          const adminCookie = await loginAndGetCookie(superAdminUser.email);
          return createCompany(adminCookie);
        })();

        const response = await createCategory(cookie, company.id);

        expect(response.status).toBe(403);
      });

      it('rejects brand listing without brands.read', async () => {
        const cookie = await loginAndGetCookie(plainUser.email);

        const response = await request(app.getHttpServer())
          .get('/api/v1/brands')
          .set('Cookie', [cookie]);

        expect(response.status).toBe(403);
      });
    });

    describe('Brand CRUD', () => {
      it('creates a brand', async () => {
        const cookie = await loginAndGetCookie(superAdminUser.email);
        const company = await createCompany(cookie);

        const brand = await createBrand(cookie, company.id);

        expect(brand.companyId).toBe(company.id);
        expect(brand.status).toBe('ACTIVE');
      });

      it('rejects a duplicate code within the same company (409)', async () => {
        const cookie = await loginAndGetCookie(superAdminUser.email);
        const company = await createCompany(cookie);
        const code = `${prefix}-BR-DUP-${Date.now()}`;

        await request(app.getHttpServer())
          .post('/api/v1/brands')
          .set('Cookie', [cookie])
          .send({ companyId: company.id, code, name: 'First' });

        const second = await request(app.getHttpServer())
          .post('/api/v1/brands')
          .set('Cookie', [cookie])
          .send({ companyId: company.id, code, name: 'Second' });

        expect(second.status).toBe(409);
      });

      it('allows the same code across two different companies', async () => {
        const cookie = await loginAndGetCookie(superAdminUser.email);
        const companyA = await createCompany(cookie);
        const companyB = await createCompany(cookie);
        const code = `${prefix}-BR-SHARED-${Date.now()}`;

        const first = await request(app.getHttpServer())
          .post('/api/v1/brands')
          .set('Cookie', [cookie])
          .send({ companyId: companyA.id, code, name: 'Brand A' });
        const second = await request(app.getHttpServer())
          .post('/api/v1/brands')
          .set('Cookie', [cookie])
          .send({ companyId: companyB.id, code, name: 'Brand B' });

        expect(first.status).toBe(201);
        expect(second.status).toBe(201);
      });

      it('activates and deactivates a brand', async () => {
        const cookie = await loginAndGetCookie(superAdminUser.email);
        const company = await createCompany(cookie);
        const brand = await createBrand(cookie, company.id);

        const deactivate = await request(app.getHttpServer())
          .post(`/api/v1/brands/${brand.id}/deactivate?companyId=${company.id}`)
          .set('Cookie', [cookie]);
        expect(deactivate.status).toBe(200);
        expect((deactivate.body as BrandBody).status).toBe('INACTIVE');

        const activate = await request(app.getHttpServer())
          .post(`/api/v1/brands/${brand.id}/activate?companyId=${company.id}`)
          .set('Cookie', [cookie]);
        expect(activate.status).toBe(200);
        expect((activate.body as BrandBody).status).toBe('ACTIVE');
      });

      it('returns 404 for a brand in a different company (IDOR — cross-company isolation)', async () => {
        const cookie = await loginAndGetCookie(superAdminUser.email);
        const companyA = await createCompany(cookie);
        const companyB = await createCompany(cookie);
        const brandInA = await createBrand(cookie, companyA.id);

        const response = await request(app.getHttpServer())
          .get(`/api/v1/brands/${brandInA.id}?companyId=${companyB.id}`)
          .set('Cookie', [cookie]);

        expect(response.status).toBe(404);
      });

      it('returns 404 for a nonexistent brand id', async () => {
        const cookie = await loginAndGetCookie(superAdminUser.email);
        const company = await createCompany(cookie);

        const response = await request(app.getHttpServer())
          .get(
            `/api/v1/brands/00000000-0000-0000-0000-000000000000?companyId=${company.id}`,
          )
          .set('Cookie', [cookie]);

        expect(response.status).toBe(404);
      });
    });

    describe('Category — hierarchy and cycle protection (LOCKED §4)', () => {
      it('creates a top-level category and a subcategory under it', async () => {
        const cookie = await loginAndGetCookie(superAdminUser.email);
        const company = await createCompany(cookie);

        const parentResponse = await createCategory(cookie, company.id, {
          name: 'Men',
        });
        expect(parentResponse.status).toBe(201);
        const parent = parentResponse.body as CategoryBody;

        const childResponse = await createCategory(cookie, company.id, {
          name: 'Shirts',
          parentId: parent.id,
        });
        expect(childResponse.status).toBe(201);
        expect((childResponse.body as CategoryBody).parentId).toBe(parent.id);
      });

      it('rejects a parentId that does not exist', async () => {
        const cookie = await loginAndGetCookie(superAdminUser.email);
        const company = await createCompany(cookie);

        const response = await createCategory(cookie, company.id, {
          parentId: '00000000-0000-0000-0000-000000000000',
        });

        expect(response.status).toBe(400);
      });

      it('rejects a parentId belonging to a different company', async () => {
        const cookie = await loginAndGetCookie(superAdminUser.email);
        const companyA = await createCompany(cookie);
        const companyB = await createCompany(cookie);
        const parentInA = (await createCategory(cookie, companyA.id))
          .body as CategoryBody;

        const response = await createCategory(cookie, companyB.id, {
          parentId: parentInA.id,
        });

        expect(response.status).toBe(400);
      });

      it('rejects assigning a category as its own parent (self-parent)', async () => {
        const cookie = await loginAndGetCookie(superAdminUser.email);
        const company = await createCompany(cookie);
        const category = (await createCategory(cookie, company.id))
          .body as CategoryBody;

        const response = await request(app.getHttpServer())
          .patch(`/api/v1/categories/${category.id}?companyId=${company.id}`)
          .set('Cookie', [cookie])
          .send({ parentId: category.id });

        expect(response.status).toBe(400);
      });

      it('REJECTS a circular hierarchy A -> B -> C -> A', async () => {
        const cookie = await loginAndGetCookie(superAdminUser.email);
        const company = await createCompany(cookie);

        const a = (await createCategory(cookie, company.id, { name: 'A' }))
          .body as CategoryBody;
        const b = (
          await createCategory(cookie, company.id, {
            name: 'B',
            parentId: a.id,
          })
        ).body as CategoryBody;
        const c = (
          await createCategory(cookie, company.id, {
            name: 'C',
            parentId: b.id,
          })
        ).body as CategoryBody;

        // Attempt: A.parentId = C, which would create A -> C -> B -> A
        const response = await request(app.getHttpServer())
          .patch(`/api/v1/categories/${a.id}?companyId=${company.id}`)
          .set('Cookie', [cookie])
          .send({ parentId: c.id });

        expect(response.status).toBe(400);
      });

      it('allows a valid non-circular reparenting', async () => {
        const cookie = await loginAndGetCookie(superAdminUser.email);
        const company = await createCompany(cookie);

        const a = (await createCategory(cookie, company.id, { name: 'A' }))
          .body as CategoryBody;
        const b = (
          await createCategory(cookie, company.id, {
            name: 'B',
            parentId: a.id,
          })
        ).body as CategoryBody;
        const standalone = (
          await createCategory(cookie, company.id, { name: 'Standalone' })
        ).body as CategoryBody;

        const response = await request(app.getHttpServer())
          .patch(`/api/v1/categories/${b.id}?companyId=${company.id}`)
          .set('Cookie', [cookie])
          .send({ parentId: standalone.id });

        expect(response.status).toBe(200);
        expect((response.body as CategoryBody).parentId).toBe(standalone.id);
      });

      it('rejects deleting a category that has children (no orphaning, §25)', async () => {
        const cookie = await loginAndGetCookie(superAdminUser.email);
        const company = await createCompany(cookie);
        const parent = (await createCategory(cookie, company.id))
          .body as CategoryBody;
        await createCategory(cookie, company.id, { parentId: parent.id });

        const response = await request(app.getHttpServer())
          .delete(`/api/v1/categories/${parent.id}?companyId=${company.id}`)
          .set('Cookie', [cookie]);

        expect(response.status).toBe(409);
      });

      it('rejects a duplicate category code within the same company', async () => {
        const cookie = await loginAndGetCookie(superAdminUser.email);
        const company = await createCompany(cookie);
        const code = `${prefix}-CAT-DUP-${Date.now()}`;

        await createCategory(cookie, company.id, { code });
        const second = await createCategory(cookie, company.id, { code });

        expect(second.status).toBe(409);
      });
    });

    describe('Collection — embedded Season, no standalone entity (LOCKED §7)', () => {
      it('creates a collection with a season value', async () => {
        const cookie = await loginAndGetCookie(superAdminUser.email);
        const company = await createCompany(cookie);

        const collection = await createCollection(cookie, company.id);

        expect(collection.season).toBe('SPRING_SUMMER');
      });

      it('rejects an invalid season enum value', async () => {
        const cookie = await loginAndGetCookie(superAdminUser.email);
        const company = await createCompany(cookie);

        const response = await request(app.getHttpServer())
          .post('/api/v1/collections')
          .set('Cookie', [cookie])
          .send({
            companyId: company.id,
            code: `${prefix}-COL-BAD-${Date.now()}`,
            name: 'Bad Season',
            season: 'NOT_A_REAL_SEASON',
          });

        expect(response.status).toBe(400);
      });

      it('there is no /seasons endpoint (Season is not a standalone entity)', async () => {
        const cookie = await loginAndGetCookie(superAdminUser.email);

        const response = await request(app.getHttpServer())
          .get('/api/v1/seasons')
          .set('Cookie', [cookie]);

        expect(response.status).toBe(404);
      });
    });

    describe('AttributeOption — unified kind discriminator (LOCKED §8-9)', () => {
      it('creates a COLOR option with a swatch', async () => {
        const cookie = await loginAndGetCookie(superAdminUser.email);
        const company = await createCompany(cookie);

        const response = await createAttributeOption(cookie, company.id, {
          kind: 'COLOR',
          code: `${prefix}-BLACK-${Date.now()}`,
          value: 'Black',
          swatch: '#000000',
        });

        expect(response.status).toBe(201);
        expect((response.body as AttributeOptionBody).swatch).toBe('#000000');
      });

      it('rejects a swatch on a non-COLOR kind', async () => {
        const cookie = await loginAndGetCookie(superAdminUser.email);
        const company = await createCompany(cookie);

        const response = await createAttributeOption(cookie, company.id, {
          kind: 'SIZE',
          code: `${prefix}-M-${Date.now()}`,
          value: 'Medium',
          swatch: '#ffffff',
        });

        expect(response.status).toBe(400);
      });

      it('allows the SAME code across DIFFERENT kinds (SIZE+M independent from COLOR+M)', async () => {
        const cookie = await loginAndGetCookie(superAdminUser.email);
        const company = await createCompany(cookie);
        const sharedCode = `${prefix}-SHARED-${Date.now()}`;

        const sizeResponse = await createAttributeOption(cookie, company.id, {
          kind: 'SIZE',
          code: sharedCode,
          value: 'Medium',
        });
        const colorResponse = await createAttributeOption(cookie, company.id, {
          kind: 'COLOR',
          code: sharedCode,
          value: 'Maroon',
          swatch: '#800000',
        });

        expect(sizeResponse.status).toBe(201);
        expect(colorResponse.status).toBe(201);
      });

      it('rejects a duplicate code within the SAME kind', async () => {
        const cookie = await loginAndGetCookie(superAdminUser.email);
        const company = await createCompany(cookie);
        const code = `${prefix}-DUP-${Date.now()}`;

        await createAttributeOption(cookie, company.id, {
          kind: 'COLOR',
          code,
        });
        const second = await createAttributeOption(cookie, company.id, {
          kind: 'COLOR',
          code,
        });

        expect(second.status).toBe(409);
      });

      it('there are no separate /colors or /sizes endpoints (unified table, LOCKED §8)', async () => {
        const cookie = await loginAndGetCookie(superAdminUser.email);

        const colorsResponse = await request(app.getHttpServer())
          .get('/api/v1/colors')
          .set('Cookie', [cookie]);
        const sizesResponse = await request(app.getHttpServer())
          .get('/api/v1/sizes')
          .set('Cookie', [cookie]);

        expect(colorsResponse.status).toBe(404);
        expect(sizesResponse.status).toBe(404);
      });
    });

    describe('Unknown/extra fields rejected (existing global ValidationPipe)', () => {
      it('rejects an unexpected field on brand create', async () => {
        const cookie = await loginAndGetCookie(superAdminUser.email);
        const company = await createCompany(cookie);

        const response = await request(app.getHttpServer())
          .post('/api/v1/brands')
          .set('Cookie', [cookie])
          .send({
            companyId: company.id,
            code: `${prefix}-BR-EXTRA-${Date.now()}`,
            name: 'Extra field test',
            logoUrl: 'https://example.com/logo.png',
          });

        expect(response.status).toBe(400);
      });
    });
  },
);
