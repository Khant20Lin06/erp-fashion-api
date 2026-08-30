import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { CacheService } from '../../modules/redis/cache.service';
import { GlobalRateLimitGuard } from './global-rate-limit.guard';
import { AppConfig } from '../../config/app.config';

describe('GlobalRateLimitGuard', () => {
  let guard: GlobalRateLimitGuard;
  let cacheService: jest.Mocked<Pick<CacheService, 'increment'>>;
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;

  const baseAppConfig: Partial<AppConfig> = {
    rateLimitEnabled: true,
    rateLimitMaxRequests: 300,
    rateLimitWindowSeconds: 60,
  };

  const buildContext = (path: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          ip: '127.0.0.1',
          path,
          method: 'GET',
          originalUrl: path,
          headers: {},
          socket: { remoteAddress: '127.0.0.1' },
        }),
      }),
      getHandler: () => undefined,
      getClass: () => undefined,
    }) as unknown as ExecutionContext;

  let configService: ConfigService;

  beforeEach(() => {
    cacheService = { increment: jest.fn() };
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };
    configService = {
      get: jest.fn().mockReturnValue(baseAppConfig),
    } as unknown as ConfigService;
    guard = new GlobalRateLimitGuard(
      reflector as unknown as Reflector,
      cacheService as unknown as CacheService,
      configService,
    );
  });

  it('allows the request when the counter is within the configured limit', async () => {
    cacheService.increment.mockResolvedValue(1);

    await expect(
      guard.canActivate(buildContext('/api/v1/sales')),
    ).resolves.toBe(true);
  });

  it('rejects the request when the counter exceeds the configured limit', async () => {
    cacheService.increment.mockResolvedValue(301);

    await expect(
      guard.canActivate(buildContext('/api/v1/sales')),
    ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
  });

  it('fails open when Redis is unavailable', async () => {
    cacheService.increment.mockResolvedValue(undefined);

    await expect(
      guard.canActivate(buildContext('/api/v1/sales')),
    ).resolves.toBe(true);
  });

  it('does not rate-limit health check paths', async () => {
    await expect(guard.canActivate(buildContext('/health/live'))).resolves.toBe(
      true,
    );
    expect(cacheService.increment).not.toHaveBeenCalled();
  });

  it('does not rate-limit metrics paths', async () => {
    await expect(guard.canActivate(buildContext('/metrics'))).resolves.toBe(
      true,
    );
    expect(cacheService.increment).not.toHaveBeenCalled();
  });

  it('does not rate-limit docs/swagger paths', async () => {
    await expect(guard.canActivate(buildContext('/docs'))).resolves.toBe(true);
    expect(cacheService.increment).not.toHaveBeenCalled();
  });

  it('is a no-op entirely when RATE_LIMIT_ENABLED is false', async () => {
    configService.get = jest
      .fn()
      .mockReturnValue({ ...baseAppConfig, rateLimitEnabled: false });

    await expect(
      guard.canActivate(buildContext('/api/v1/sales')),
    ).resolves.toBe(true);
    expect(cacheService.increment).not.toHaveBeenCalled();
  });

  it('skips a route decorated with @SkipRateLimit', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    await expect(
      guard.canActivate(buildContext('/api/v1/webhooks/receive')),
    ).resolves.toBe(true);
    expect(cacheService.increment).not.toHaveBeenCalled();
  });
});
