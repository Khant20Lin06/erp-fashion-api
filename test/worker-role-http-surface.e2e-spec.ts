import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import {
  configureApplication,
  registerSwagger,
} from '../src/bootstrap/configure-app';

/**
 * Bug: "WORKER ROLE HTTP EXPOSURE" (release-gate closure task, item 1).
 *
 * A `worker` role process (APP_ROLE=worker) exists purely to run BullMQ
 * workers + Kafka consumers, plus a minimal HTTP listener for container
 * orchestration (`/health/live`, `/health/ready`, `/metrics`). It must
 * NEVER expose the public business API surface or Swagger/docs, even
 * though the underlying Nest module graph (and therefore its DI-registered
 * controllers) is identical to the `api`/`all` role process — the module
 * graph is intentionally NOT split per role so the Kafka/BullMQ providers
 * that live alongside the HTTP controllers keep working unmodified.
 *
 * This suite boots the app the same way src/main.ts does (via
 * configureApplication + registerSwagger, not the ad-hoc setup other
 * *.e2e-spec.ts files use) so it genuinely exercises the role-gating
 * middleware added in src/bootstrap/configure-app.ts.
 */
const dbEnvAvailable =
  !!process.env.DB_USERNAME &&
  !!process.env.DB_PASSWORD &&
  !!process.env.DB_DATABASE;

const describeIfDb = dbEnvAvailable ? describe : describe.skip;

/**
 * getAppRole() (src/shared/utils/runtime-flags.ts) intentionally reads
 * process.env.APP_ROLE live on every call — that is correct for a real
 * process (the env var never changes after boot) but means a test must
 * keep APP_ROLE set to the role under test for as long as that app
 * instance is still receiving requests, not just during compile(). Each
 * caller is responsible for restoring the previous value once its app is
 * closed (see afterAll below) — bootApp deliberately does not reset it
 * itself, since that would race requests made from within the same `it`.
 */
async function bootApp(
  role: 'api' | 'worker' | 'all',
): Promise<INestApplication<App>> {
  process.env.APP_ROLE = role;

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  const configService = app.get(ConfigService);
  configureApplication(app, configService);
  registerSwagger(app, configService);
  await app.init();
  return app;
}

describeIfDb('Worker role HTTP surface (e2e)', () => {
  const originalAppRole = process.env.APP_ROLE;

  afterAll(() => {
    if (originalAppRole === undefined) {
      delete process.env.APP_ROLE;
    } else {
      process.env.APP_ROLE = originalAppRole;
    }
  });

  describe('APP_ROLE=worker', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      app = await bootApp('worker');
    });

    afterAll(async () => {
      await app.close();
    });

    it('allows /api/v1/health/live', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health/live');
      expect(res.status).toBe(200);
      const body = res.body as { role: string };
      expect(body.role).toBe('worker');
    });

    it('allows /api/v1/health/ready', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/v1/health/ready',
      );
      expect([200, 503]).toContain(res.status);
    });

    it('allows /metrics', async () => {
      const res = await request(app.getHttpServer()).get('/metrics');
      expect(res.status).toBe(200);
      expect(res.text).toEqual(expect.any(String));
    });

    it('blocks Swagger UI at /docs', async () => {
      const res = await request(app.getHttpServer()).get('/docs');
      expect(res.status).toBe(404);
    });

    it('blocks the Swagger JSON document at /docs-json', async () => {
      const res = await request(app.getHttpServer()).get('/docs-json');
      expect(res.status).toBe(404);
    });

    it('blocks public business API routes, e.g. /api/v1/auth/login', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'irrelevant' });

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ success: false, statusCode: 404 });
    });

    it('blocks other business routes, e.g. /api/v1/products', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/products');
      expect(res.status).toBe(404);
    });
  });

  describe('APP_ROLE=api', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      app = await bootApp('api');
    });

    afterAll(async () => {
      await app.close();
    });

    it('allows /api/v1/health/live', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health/live');
      expect(res.status).toBe(200);
      const body = res.body as { role: string };
      expect(body.role).toBe('api');
    });

    it('serves Swagger UI at /docs', async () => {
      const res = await request(app.getHttpServer()).get('/docs');
      expect(res.status).toBe(200);
    });

    it('serves the business API surface, e.g. /api/v1/auth/login route exists', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'irrelevant' });

      // Route exists and is reachable (401/400 for bad creds), not 404.
      expect(res.status).not.toBe(404);
    });
  });
});
