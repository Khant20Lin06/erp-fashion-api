import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CacheService } from '../../modules/redis/cache.service';
import { PerUserRateLimitGuard } from './per-user-rate-limit.guard';
import { RateLimitOverride } from './rate-limit.decorator';

describe('PerUserRateLimitGuard', () => {
  let guard: PerUserRateLimitGuard;
  let cacheService: jest.Mocked<Pick<CacheService, 'increment'>>;
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;

  const override: RateLimitOverride = { max: 10, windowSeconds: 60 };

  const buildContext = (userId?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          user: userId ? { id: userId } : undefined,
          method: 'POST',
          originalUrl: '/api/v1/ai/chat',
        }),
      }),
      getHandler: () => ({ name: 'chat' }),
      getClass: () => ({ name: 'AiChatController' }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    cacheService = { increment: jest.fn() };
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(override) };
    guard = new PerUserRateLimitGuard(
      reflector as unknown as Reflector,
      cacheService as unknown as CacheService,
    );
  });

  it('allows the request when no @RateLimit override is declared on the route', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(buildContext('user-1'))).resolves.toBe(true);
    expect(cacheService.increment).not.toHaveBeenCalled();
  });

  it('allows the request when there is no authenticated user (JwtAuthGuard should have already rejected it)', async () => {
    await expect(guard.canActivate(buildContext(undefined))).resolves.toBe(
      true,
    );
    expect(cacheService.increment).not.toHaveBeenCalled();
  });

  it('allows the request when the per-user counter is within the limit', async () => {
    cacheService.increment.mockResolvedValue(5);

    await expect(guard.canActivate(buildContext('user-1'))).resolves.toBe(true);
  });

  it('rejects the request when the per-user counter exceeds the limit', async () => {
    cacheService.increment.mockResolvedValue(11);

    await expect(guard.canActivate(buildContext('user-1'))).rejects.toMatchObject(
      { status: HttpStatus.TOO_MANY_REQUESTS },
    );
  });

  it('fails open when Redis is unavailable', async () => {
    cacheService.increment.mockResolvedValue(undefined);

    await expect(guard.canActivate(buildContext('user-1'))).resolves.toBe(true);
  });

  it('keys the counter per user, not per IP', async () => {
    cacheService.increment.mockResolvedValue(1);

    await guard.canActivate(buildContext('user-42'));

    expect(cacheService.increment).toHaveBeenCalledWith(
      expect.stringContaining('user-42'),
      override.windowSeconds,
    );
  });
});
