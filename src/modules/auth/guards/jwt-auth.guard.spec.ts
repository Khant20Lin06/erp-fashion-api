import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TokenService } from '../services/token.service';
import { RequestContextService } from '../../../core/context/request-context.service';
import { AuthConfig } from '../../../config/auth.config';
import { UsersService } from '../../users/services/users.service';
import { UserStatus } from '../../users/entities/user-status.enum';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let tokenService: jest.Mocked<Pick<TokenService, 'verifyAccessToken'>>;
  let usersService: jest.Mocked<Pick<UsersService, 'findActiveById'>>;
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
    authRateLimitMaxAttempts: 10,
    authRateLimitWindowSeconds: 60,
    refreshCookieName: 'fashion_erp_refresh_token',
    refreshCookiePath: '/',
    refreshTokenExpiresInDays: 30,
  };

  const configService = {
    get: jest.fn().mockReturnValue(authConfig),
  } as unknown as ConfigService;

  const buildContext = ({
    cookies = {},
    headers = {},
  }: {
    cookies?: Record<string, string>;
    headers?: Record<string, string>;
  }): ExecutionContext => {
    const request = { cookies, headers };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    tokenService = { verifyAccessToken: jest.fn() };
    usersService = { findActiveById: jest.fn() };
    requestContext = new RequestContextService();
    guard = new JwtAuthGuard(
      tokenService as unknown as TokenService,
      configService,
      requestContext,
      usersService as unknown as UsersService,
    );
  });

  it('throws 401 when neither bearer header nor cookie is present', async () => {
    const context = buildContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws 401 when the Authorization header is malformed', async () => {
    const context = buildContext({
      headers: { authorization: 'Token invalid-format' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws 401 when the token is invalid', async () => {
    tokenService.verifyAccessToken.mockImplementation(() => {
      throw new Error('invalid signature');
    });
    const context = buildContext({
      cookies: {
        fashion_erp_access_token: 'garbage-token',
      },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('allows the request and attaches the user when the cookie token is valid', async () => {
    tokenService.verifyAccessToken.mockReturnValue({
      sub: 'user-123',
      jti: 'x',
      iatMs: Date.now(),
      iat: Math.floor(Date.now() / 1000),
      exp: 0,
    });
    usersService.findActiveById.mockResolvedValue({
      id: 'user-123',
      status: UserStatus.Active,
      passwordChangedAt: null,
    } as never);
    const request: {
      cookies: Record<string, string>;
      headers: Record<string, string>;
      user?: unknown;
    } = {
      cookies: { fashion_erp_access_token: 'valid-token' },
      headers: {},
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toEqual({ id: 'user-123' });
  });

  it('accepts a valid bearer token header', async () => {
    tokenService.verifyAccessToken.mockReturnValue({
      sub: 'user-123',
      jti: 'x',
      iatMs: Date.now(),
      iat: Math.floor(Date.now() / 1000),
      exp: 0,
    });
    usersService.findActiveById.mockResolvedValue({
      id: 'user-123',
      status: UserStatus.Active,
      passwordChangedAt: null,
    } as never);

    const request: {
      cookies: Record<string, string>;
      headers: Record<string, string>;
      user?: unknown;
    } = {
      cookies: {},
      headers: { authorization: 'Bearer valid-token' },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'user-123' });
  });

  it('rejects a token for an inactive user', async () => {
    tokenService.verifyAccessToken.mockReturnValue({
      sub: 'user-123',
      jti: 'x',
      iatMs: Date.now(),
      iat: Math.floor(Date.now() / 1000),
      exp: 0,
    });
    usersService.findActiveById.mockResolvedValue(null);

    const context = buildContext({
      cookies: { fashion_erp_access_token: 'valid-token' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token issued before the last password change', async () => {
    tokenService.verifyAccessToken.mockReturnValue({
      sub: 'user-123',
      jti: 'x',
      iatMs: Date.now() - 120_000,
      iat: Math.floor(Date.now() / 1000) - 120,
      exp: 0,
    });
    usersService.findActiveById.mockResolvedValue({
      id: 'user-123',
      status: UserStatus.Active,
      passwordChangedAt: new Date(),
    } as never);

    const context = buildContext({
      cookies: { fashion_erp_access_token: 'valid-token' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token issued earlier in the same second as the password change', async () => {
    const passwordChangedAt = new Date();
    const sameSecondEarlierMs =
      Math.floor(passwordChangedAt.getTime() / 1000) * 1000;

    tokenService.verifyAccessToken.mockReturnValue({
      sub: 'user-123',
      jti: 'x',
      iatMs: sameSecondEarlierMs,
      iat: Math.floor(passwordChangedAt.getTime() / 1000),
      exp: 0,
    });
    usersService.findActiveById.mockResolvedValue({
      id: 'user-123',
      status: UserStatus.Active,
      passwordChangedAt,
    } as never);

    const context = buildContext({
      cookies: { fashion_erp_access_token: 'valid-token' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
