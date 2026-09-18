import {
  HttpException,
  INestApplication,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from '../services/auth.service';
import { AuthRateLimitGuard } from '../guards/auth-rate-limit.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CacheService } from '../../redis/cache.service';
import { configureApplication } from '../../../bootstrap/configure-app';
import { MetricsService } from '../../../observability/metrics/metrics.controller';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('Login HTTP response contract (isolated dependencies)', () => {
  let app: INestApplication;
  let attempts: number;
  const login = jest.fn();
  beforeAll(async () => {
    const config = {
      get: (key: string) =>
        key === 'app'
          ? {
              apiPrefix: 'api',
              apiVersion: '1',
              trustProxy: false,
              httpBodyLimit: '1kb',
              corsOrigins: [],
              metricsPath: '',
              metricsEnabled: false,
            }
          : {
              authRateLimitMaxAttempts: 10,
              authRateLimitWindowSeconds: 60,
              cookieName: 'fashion_erp_access_token',
              cookiePath: '/',
              cookieSecure: true,
              cookieSameSite: 'lax',
              refreshCookieName: 'fashion_erp_refresh_token',
              refreshCookiePath: '/',
            },
    };
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthRateLimitGuard,
        { provide: AuthService, useValue: { login } },
        { provide: ConfigService, useValue: config },
        {
          provide: CacheService,
          useValue: { increment: async () => ++attempts },
        },
        { provide: MetricsService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.use(
      (
        _req: unknown,
        res: { type: (type: string) => void },
        next: () => void,
      ) => {
        res.type('text/html'); // Simulate an earlier middleware setting the wrong type.
        next();
      },
    );
    configureApplication(app, config as ConfigService);
    await app.init();
  });
  beforeEach(() => {
    attempts = 0;
    login.mockReset().mockResolvedValue({
      user: { id: 'test-bot' },
      accessToken: 'test-access',
      refreshToken: 'test-refresh',
      refreshExpiresAt: new Date(Date.now() + 60000),
    });
  });
  afterAll(async () => {
    await app.close();
  });
  const send = () =>
    request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'test-bot@example.com', password: 'test-password' });
  const expectError = (res: request.Response, status: number) => {
    expect(res.status).toBe(status);
    expect(res.headers['content-type']).toMatch(/^application\/json/);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        statusCode: status,
        code: expect.any(String),
        message: expect.any(String),
        requestId: expect.any(String),
      }),
    );
  };
  it('returns JSON and both HttpOnly cookies on success', async () => {
    const res = await send();
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^application\/json/);
    expect(res.body).toEqual({ user: { id: 'test-bot' } });
    expect(res.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^fashion_erp_access_token=.*HttpOnly/),
        expect.stringMatching(/^fashion_erp_refresh_token=.*HttpOnly/),
      ]),
    );
  });
  it('returns structured validation and malformed JSON errors', async () => {
    expectError(
      await request(app.getHttpServer()).post('/api/v1/auth/login').send({}),
      400,
    );
    expectError(
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .type('json')
        .send('{broken'),
      400,
    );
  });
  it('returns structured 401 without issuing cookies', async () => {
    login.mockRejectedValue(
      new AppException(ErrorCode.Unauthorized, 'Invalid email or password'),
    );
    expectError(await send(), 401);
  });
  it('returns structured 500 and 503 without leaking upstream HTML', async () => {
    login
      .mockRejectedValueOnce(new Error('database-secret'))
      .mockRejectedValueOnce(
        new ServiceUnavailableException(
          '<html>upstream internal details</html>',
        ),
      );
    const unknown = await send();
    expectError(unknown, 500);
    expect(unknown.text).not.toContain('database-secret');
    const upstream = await send();
    expectError(upstream, 503);
    expect(upstream.text).not.toContain('<html>');
  });
  it('keeps rapid requests JSON, returning 429 after the configured limit', async () => {
    const results = await Promise.all(Array.from({ length: 14 }, send));
    expect(results.filter((res) => res.status === 200)).toHaveLength(10);
    expect(results.filter((res) => res.status === 429)).toHaveLength(4);
    for (const res of results) {
      expect(res.headers['content-type']).toMatch(/^application\/json/);
      if (res.status === 429) expectError(res, 429);
    }
  });
  it.each([502, 504])(
    'wraps application-raised %i as safe JSON',
    async (status) => {
      login.mockRejectedValue(
        new HttpException('<html>gateway internals</html>', status),
      );
      const res = await send();
      expectError(res, status);
      expect(res.text).not.toContain('<html>');
    },
  );
});
