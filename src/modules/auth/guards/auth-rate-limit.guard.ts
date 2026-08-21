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
import { CacheService } from '../../redis/cache.service';
import {
  AUTH_RATE_LIMIT_METADATA_KEY,
  AuthRateLimitMode,
} from '../../../common/security/auth-rate-limit.decorator';
import { AuthConfig } from '../../../config/auth.config';

interface AuthRateLimitRequest extends Request {
  body: Record<string, unknown>;
}

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(AuthRateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const mode = this.reflector.getAllAndOverride<
      AuthRateLimitMode | undefined
    >(AUTH_RATE_LIMIT_METADATA_KEY, [context.getHandler(), context.getClass()]);

    if (!mode) {
      return true;
    }

    const authConfig = this.configService.get<AuthConfig>('auth')!;
    const request = context.switchToHttp().getRequest<AuthRateLimitRequest>();
    const identifier = this.buildIdentifier(request, mode);
    const key = `erp:security:auth-rate-limit:${mode}:${identifier}`;

    const count = await this.cacheService.increment(
      key,
      authConfig.authRateLimitWindowSeconds,
    );

    // Redis outages must never block business/API behavior. If the
    // infrastructure is unavailable, fail open here and let the existing
    // application-level behavior continue.
    if (count === undefined) {
      return true;
    }

    if (count > authConfig.authRateLimitMaxAttempts) {
      this.logger.warn(
        `Rate-limited auth endpoint ${request.method} ${request.originalUrl ?? request.url} for ${identifier}`,
      );
      throw new HttpException(
        'Too many authentication attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private buildIdentifier(
    request: AuthRateLimitRequest,
    mode: AuthRateLimitMode,
  ): string {
    const ip =
      request.ip ||
      request.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      request.socket.remoteAddress ||
      'unknown';

    if (mode === 'login' || mode === 'forgot-password') {
      const email = request.body?.email;
      if (typeof email === 'string' && email.trim().length > 0) {
        return `${ip}:${email.trim().toLowerCase()}`;
      }
    }

    if (mode === 'reset-password') {
      const token = request.body?.token;
      if (typeof token === 'string' && token.trim().length > 0) {
        return `${ip}:${token.trim().slice(0, 32)}`;
      }
    }

    return ip;
  }
}
