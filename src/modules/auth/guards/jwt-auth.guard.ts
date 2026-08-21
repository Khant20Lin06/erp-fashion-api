import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { TokenService } from '../services/token.service';
import { RequestContextService } from '../../../core/context/request-context.service';
import { AuthConfig } from '../../../config/auth.config';
import { AuthenticatedUser } from '../types/authenticated-user';
import { UsersService } from '../../users/services/users.service';

interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
    private readonly requestContext: RequestContextService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authConfig = this.configService.get<AuthConfig>('auth')!;
    const header = request.headers.authorization;

    const token = this.resolveToken(request, authConfig.cookieName, header);

    if (!token) {
      this.logger.warn(
        `Authentication rejected for ${request.method} ${request.originalUrl ?? request.url}: missing credentials`,
      );
      throw new UnauthorizedException('Not authenticated');
    }

    try {
      const payload = this.tokenService.verifyAccessToken(token);
      const user = await this.usersService.findActiveById(payload.sub);
      const tokenIssuedAtMs =
        typeof payload.iatMs === 'number' ? payload.iatMs : payload.iat * 1000;

      if (!user) {
        this.logger.warn(
          `Authentication rejected for ${request.method} ${request.originalUrl ?? request.url}: inactive or missing user ${payload.sub}`,
        );
        throw new UnauthorizedException('Invalid or expired session');
      }

      if (
        user.passwordChangedAt &&
        tokenIssuedAtMs < user.passwordChangedAt.getTime()
      ) {
        this.logger.warn(
          `Authentication rejected for ${request.method} ${request.originalUrl ?? request.url}: token issued before password change for user ${payload.sub}`,
        );
        throw new UnauthorizedException('Invalid or expired session');
      }

      request.user = { id: payload.sub };
      this.requestContext.setUserId(payload.sub);

      return true;
    } catch {
      this.logger.warn(
        `Authentication rejected for ${request.method} ${request.originalUrl ?? request.url}: invalid or expired token`,
      );
      throw new UnauthorizedException('Invalid or expired session');
    }
  }

  private resolveToken(
    request: RequestWithUser,
    cookieName: string,
    authorizationHeader: string | string[] | undefined,
  ): string | null {
    const normalizedHeader = Array.isArray(authorizationHeader)
      ? authorizationHeader[0]
      : authorizationHeader;

    if (normalizedHeader) {
      const match = normalizedHeader.match(/^Bearer\s+(.+)$/i);
      if (!match) {
        throw new UnauthorizedException('Invalid or expired session');
      }
      return match[1].trim();
    }

    const cookieToken = (
      request.cookies as Record<string, string> | undefined
    )?.[cookieName];
    return cookieToken?.trim() || null;
  }
}
