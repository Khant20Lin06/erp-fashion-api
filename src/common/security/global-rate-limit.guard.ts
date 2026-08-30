import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { CacheService } from '../../modules/redis/cache.service';
import { AppConfig } from '../../config/app.config';
import { SKIP_RATE_LIMIT_METADATA_KEY } from './rate-limit.decorator';

/**
 * Blunt-force floor against flooding/DoS across the ENTIRE API surface
 * (docs/SECURITY_RULES.md #28 Rate Limiting — "no business endpoint has
 * any rate limiting" was a known gap this closes). Registered as a global
 * APP_GUARD (see AppModule), so it runs before any controller-level guard,
 * including JwtAuthGuard — request.user is NOT reliably populated here.
 * This guard is deliberately IP-only for that reason; a per-authenticated-
 * user limit for a specific expensive endpoint (AI chat, report exports)
 * is a separate, controller-level concern — see PerUserRateLimitGuard,
 * which runs after JwtAuthGuard and can see request.user.
 *
 * This is a SEPARATE, coarser mechanism from AuthRateLimitGuard
 * (per-identity, auth-endpoint-specific, much stricter) — the two are not
 * meant to merge; AuthRateLimitGuard keeps protecting login/refresh/
 * password-reset with its own tighter limits on top of this floor.
 *
 * Reuses CacheService.increment — the same Redis-backed, fail-open
 * counter primitive AuthRateLimitGuard already uses — rather than adding a
 * second rate-limiting library/mechanism (@nestjs/throttler was
 * deliberately not introduced for this reason).
 */
@Injectable()
export class GlobalRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(GlobalRateLimitGuard.name);

  /**
   * Health/metrics/docs paths are infrastructure surfaces (liveness/
   * readiness probes, Prometheus scraping, Swagger asset loads) that must
   * never be throttled — orchestrators and monitoring poll them far more
   * often than any real client traffic. Matched by prefix so this doesn't
   * need to track the app's configured apiPrefix/version/paths.
   */
  private static readonly EXEMPT_PATH_PREFIXES = [
    '/health',
    '/metrics',
    '/docs',
  ];

  constructor(
    private readonly reflector: Reflector,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const appConfig = this.configService.get<AppConfig>('app')!;
    if (!appConfig.rateLimitEnabled) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    if (this.isExemptPath(request.path)) {
      return true;
    }

    const skip = this.reflector.getAllAndOverride<boolean | undefined>(
      SKIP_RATE_LIMIT_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skip) {
      return true;
    }

    const { rateLimitMaxRequests: max, rateLimitWindowSeconds: windowSeconds } =
      appConfig;
    const ip = this.resolveIp(request);
    const key = `erp:security:rate-limit:global:${ip}`;

    const count = await this.cacheService.increment(key, windowSeconds);

    // A Redis outage must never take down the API — fail open, matching
    // AuthRateLimitGuard's own documented tradeoff.
    if (count === undefined) {
      return true;
    }

    if (count > max) {
      this.logger.warn(
        `Global rate limit exceeded for ${request.method} ${request.originalUrl ?? request.url} by ${ip} (${count}/${max} in ${windowSeconds}s)`,
      );
      throw new HttpException(
        'Too many requests. Please slow down and try again shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private isExemptPath(path: string): boolean {
    return GlobalRateLimitGuard.EXEMPT_PATH_PREFIXES.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    );
  }

  private resolveIp(request: Request): string {
    return (
      request.ip ||
      request.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      request.socket.remoteAddress ||
      'unknown'
    );
  }
}
