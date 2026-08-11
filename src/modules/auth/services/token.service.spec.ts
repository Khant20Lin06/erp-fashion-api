import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';
import { AuthConfig } from '../../../config/auth.config';

describe('TokenService', () => {
  let tokenService: TokenService;
  let jwtService: JwtService;

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

  beforeEach(() => {
    jwtService = new JwtService();
    tokenService = new TokenService(jwtService, configService);
  });

  it('signs a token containing the user id as sub', () => {
    const token = tokenService.signAccessToken('user-123');
    const payload = tokenService.verifyAccessToken(token);

    expect(payload.sub).toBe('user-123');
  });

  it('includes a unique jti per token', () => {
    const tokenA = tokenService.signAccessToken('user-123');
    const tokenB = tokenService.signAccessToken('user-123');

    const payloadA = tokenService.verifyAccessToken(tokenA);
    const payloadB = tokenService.verifyAccessToken(tokenB);

    expect(payloadA.jti).not.toBe(payloadB.jti);
  });

  it('does not include any permission or role claims', () => {
    const token = tokenService.signAccessToken('user-123');
    const payload = tokenService.verifyAccessToken(token) as unknown as Record<
      string,
      unknown
    >;

    expect(payload).not.toHaveProperty('role');
    expect(payload).not.toHaveProperty('permissions');
    expect(payload).not.toHaveProperty('roles');
  });

  it('rejects a token signed with a different secret', () => {
    const foreignJwtService = new JwtService();
    const foreignToken = foreignJwtService.sign(
      { sub: 'attacker', jti: 'x' },
      {
        secret: 'b'.repeat(32),
        expiresIn: '15m',
        issuer: authConfig.jwtIssuer,
        audience: authConfig.jwtAudience,
      },
    );

    expect(() => tokenService.verifyAccessToken(foreignToken)).toThrow();
  });

  it('rejects an expired token', () => {
    const expiredToken = jwtService.sign(
      { sub: 'user-123', jti: 'x' },
      {
        secret: authConfig.jwtSecret,
        expiresIn: '-1s',
        issuer: authConfig.jwtIssuer,
        audience: authConfig.jwtAudience,
      },
    );

    expect(() => tokenService.verifyAccessToken(expiredToken)).toThrow();
  });

  it('rejects a token with the wrong audience', () => {
    const wrongAudienceToken = jwtService.sign(
      { sub: 'user-123', jti: 'x' },
      {
        secret: authConfig.jwtSecret,
        expiresIn: '15m',
        issuer: authConfig.jwtIssuer,
        audience: 'some-other-app',
      },
    );

    expect(() => tokenService.verifyAccessToken(wrongAudienceToken)).toThrow();
  });
});
