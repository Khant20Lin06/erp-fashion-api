import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';
import { CacheService } from '../src/modules/redis/cache.service';
import { CacheKeys } from '../src/modules/redis/cache-keys';

/**
 * Phase 19 (Redis) — a REAL integration test against the actual Redis
 * container (docker-compose's `redis` service), not a mock. Proves:
 *   1. The health endpoint's `redis` field is a genuine, awaited PING probe.
 *   2. CacheService.set/get/delete/exists/ttl round-trip through real Redis.
 *   3. The `erp:cache:<domain>:<key>` namespace convention is honored.
 *   4. A cache miss (key never set / already deleted) returns undefined,
 *      never throws — the contract every cache-aside caller relies on.
 *
 * This suite deliberately does NOT simulate a Redis outage (that invariant
 * — a Payment succeeding with Redis/Kafka/BullMQ fully down — is proven in
 * the Phase 21 notifications e2e suite, which is the more meaningful place
 * to demonstrate it end-to-end against a real business transaction).
 */
describe('Redis Cache (Phase 19) (e2e)', () => {
  let app: INestApplication<App>;
  let cacheService: CacheService;

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
    await app.init();

    cacheService = app.get(CacheService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('health endpoint reports real Redis connectivity as up', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', redis: 'up' });
  });

  it('CacheService.isConnected() succeeds against the real container', async () => {
    await expect(cacheService.isConnected()).resolves.toBe(true);
  });

  it('round-trips a value through the real Redis container (set -> get -> delete)', async () => {
    const key = `erp:cache:test:${randomUUID()}`;
    const value = { hello: 'world', n: 42 };

    await expect(cacheService.get(key)).resolves.toBeUndefined();

    await cacheService.set(key, value, 30);
    await expect(cacheService.get(key)).resolves.toEqual(value);
    await expect(cacheService.exists(key)).resolves.toBe(true);

    const ttl = await cacheService.ttl(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(30);

    await cacheService.delete(key);
    await expect(cacheService.get(key)).resolves.toBeUndefined();
    await expect(cacheService.exists(key)).resolves.toBe(false);
  });

  it('builds company-prefixed keys per the locked namespace convention', () => {
    const companyId = 'company-123';
    expect(CacheKeys.paymentMethods(companyId)).toBe(
      `erp:cache:payment-methods:${companyId}`,
    );
    expect(CacheKeys.companySettings(companyId)).toBe(
      `erp:cache:company-settings:${companyId}`,
    );
  });
});
