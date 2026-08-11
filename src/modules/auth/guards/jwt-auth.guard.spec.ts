import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TokenService } from '../services/token.service';
import { RequestContextService } from '../../../core/context/request-context.service';
import { AuthConfig } from '../../../config/auth.config';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let tokenService: jest.Mocked<Pick<TokenService, 'verifyAccessToken'>>;
  let requestContext: RequestContextService;

  const authConfig: AuthConfig = {
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
  };

  const configService = {
    get: jest.fn().mockReturnValue(authConfig),
  } as unknown as ConfigService;

  const buildContext = (cookies: Record<string, string>): ExecutionContext => {
    const request = { cookies };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    tokenService = { verifyAccessToken: jest.fn() };
    requestContext = new RequestContextService();
    guard = new JwtAuthGuard(
      tokenService as unknown as TokenService,
      configService,
      requestContext,
    );
  });

  it('throws 401 when no cookie is present', () => {
    const context = buildContext({});

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('throws 401 when the token is invalid', () => {
    tokenService.verifyAccessToken.mockImplementation(() => {
      throw new Error('invalid signature');
    });
    const context = buildContext({
      fashion_erp_access_token: 'garbage-token',
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('allows the request and attaches the user when the token is valid', () => {
    tokenService.verifyAccessToken.mockReturnValue({
      sub: 'user-123',
      jti: 'x',
      iat: 0,
      exp: 0,
    });
    const request: { cookies: Record<string, string>; user?: unknown } = {
      cookies: { fashion_erp_access_token: 'valid-token' },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    const result = guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toEqual({ id: 'user-123' });
  });
});
