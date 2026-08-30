import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { CacheService } from '../../modules/redis/cache.service';
import { RATE_LIMIT_METADATA_KEY, RateLimitOverride } from './rate-limit.decorator';
import type { AuthenticatedUser } from '../../modules/auth/types/authenticated-user';

interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}

/**
 * Enforces the per-user limit declared by @RateLimit(...) on a route.
 * Must run AFTER JwtAuthGuard (apply both via @UseGuards, JwtAuthGuard
 * first) so request.user is populated — this is what lets it key on the
 * account rather than the IP, unlike GlobalRateLimitGuard.
 *
 * Layered ON TOP OF, not instead of, the always-on global IP-based floor:
 * a route using this guard is still also covered by GlobalRateLimitGuard
 * globally. Reuses the same Redis-backed, fail-open CacheService.increment
 * primitive as GlobalRateLimitGuard/AuthRateLimitGuard.
 */
@Injectable()
export class PerUserRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(PerUserRateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly cacheService: CacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const override = this.reflector.getAllAndOverride<
      RateLimitOverride | undefined
    >(RATE_LIMIT_METADATA_KEY, [context.getHandler(), context.getClass()]);

    if (!override) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.user?.id;
    if (!userId) {
      // No authenticated identity to key on — JwtAuthGuard should have run
      // first and already rejected an unauthenticated request; nothing
      // further to enforce here.
      return true;
    }

    const bucket = `${context.getClass().name}.${context.getHandler().name}`;
    const key = `erp:security:rate-limit:user:${bucket}:${userId}`;

    const count = await this.cacheService.increment(key, override.windowSeconds);

    if (count === undefined) {
      return true;
    }

    if (count > override.max) {
      this.logger.warn(
        `Per-user rate limit exceeded for ${request.method} ${request.originalUrl ?? request.url} by user ${userId} (${count}/${override.max} in ${override.windowSeconds}s)`,
      );
      throw new HttpException(
        'Too many requests. Please slow down and try again shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
