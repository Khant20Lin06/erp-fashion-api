import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { TokenService } from '../services/token.service';
import { RequestContextService } from '../../../core/context/request-context.service';
import { AuthConfig } from '../../../config/auth.config';
import { AuthenticatedUser } from '../types/authenticated-user';

interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
    private readonly requestContext: RequestContextService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authConfig = this.configService.get<AuthConfig>('auth')!;

    const token = (request.cookies as Record<string, string> | undefined)?.[
      authConfig.cookieName
    ];

    if (!token) {
      throw new UnauthorizedException('Not authenticated');
    }

    try {
      const payload = this.tokenService.verifyAccessToken(token);

      request.user = { id: payload.sub };
      this.requestContext.setUserId(payload.sub);

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }
  }
}
