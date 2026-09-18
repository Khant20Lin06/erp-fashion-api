import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { CacheService } from '../../redis/cache.service';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';
import { AuthConfig } from '../../../config/auth.config';

describe('AuthRateLimitGuard', () => {
  let guard: AuthRateLimitGuard;
  let cacheService: jest.Mocked<Pick<CacheService, 'increment'>>;

  const authConfig: AuthConfig = {
    botSessionAllowedEmails: [],
    jwtSecret: 'a'.repeat(32),
    jwtAccessTokenExpiresIn: '15m',
    jwtIssuer: 'fashion-erp-backend',
    jwtAudience: 'fashion-erp-frontend',
    cookieName: 'fashion_erp_access_token',
    cookieSecure: true,
    cookieSameSite: 'lax',
    cookieDomain: undefined,
    cookiePath: '/',
    passwordResetTokenExpiresInMinutes: 30,
    authRateLimitMaxAttempts: 10,
    authRateLimitWindowSeconds: 60,
    refreshCookieName: 'fashion_erp_refresh_token',
    refreshCookiePath: '/',
    refreshTokenExpiresInDays: 30,
  };

  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue('login'),
  } as unknown as Reflector;

  const configService = {
    get: jest.fn().mockReturnValue(authConfig),
  } as unknown as ConfigService;

  const buildContext = (body: Record<string, unknown> = {}): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          ip: '127.0.0.1',
          method: 'POST',
          originalUrl: '/api/v1/auth/login',
          body,
          headers: {},
          socket: { remoteAddress: '127.0.0.1' },
        }),
      }),
      getHandler: () => undefined,
      getClass: () => undefined,
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    cacheService = { increment: jest.fn() };
    guard = new AuthRateLimitGuard(
      reflector,
      cacheService as unknown as CacheService,
      configService,
    );
  });

  it('allows the request when the counter is within the configured limit', async () => {
    cacheService.increment.mockResolvedValue(3);

    await expect(
      guard.canActivate(buildContext({ email: 'user@example.com' })),
    ).resolves.toBe(true);
  });

  it('rejects the request when the counter exceeds the configured limit', async () => {
    cacheService.increment.mockResolvedValue(11);

    await expect(
      guard.canActivate(buildContext({ email: 'user@example.com' })),
    ).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
  });

  it('fails open when Redis is unavailable', async () => {
    cacheService.increment.mockResolvedValue(undefined);

    await expect(
      guard.canActivate(buildContext({ email: 'user@example.com' })),
    ).resolves.toBe(true);
  });
});
