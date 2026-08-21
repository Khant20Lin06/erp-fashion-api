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
    authRateLimitMaxAttempts: 10,
    authRateLimitWindowSeconds: 60,
    refreshCookieName: 'fashion_erp_refresh_token',
    refreshCookiePath: '/',
    refreshTokenExpiresInDays: 30,
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

  it('includes a millisecond issuance timestamp for precise revocation checks', () => {
    const token = tokenService.signAccessToken('user-123');
    const payload = tokenService.verifyAccessToken(token);

    expect(typeof payload.iatMs).toBe('number');
    expect(payload.iatMs).toBeGreaterThan(0);
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

  describe('refresh tokens', () => {
    it('generates a high-entropy opaque token, not a JWT', () => {
      const token = tokenService.generateRefreshToken();

      expect(token).toMatch(/^[0-9a-f]{64}$/);
      expect(token.split('.').length).toBe(1); // not JWT-shaped (no dots)
    });

    it('generates a different token on every call', () => {
      const tokenA = tokenService.generateRefreshToken();
      const tokenB = tokenService.generateRefreshToken();

      expect(tokenA).not.toBe(tokenB);
    });

    it('hashes deterministically so a stored hash can be matched on lookup', () => {
      const token = tokenService.generateRefreshToken();

      expect(tokenService.hashRefreshToken(token)).toBe(
        tokenService.hashRefreshToken(token),
      );
    });

    it('produces different hashes for different tokens', () => {
      const tokenA = tokenService.generateRefreshToken();
      const tokenB = tokenService.generateRefreshToken();

      expect(tokenService.hashRefreshToken(tokenA)).not.toBe(
        tokenService.hashRefreshToken(tokenB),
      );
    });

    it('never returns the raw token from the hash', () => {
      const token = tokenService.generateRefreshToken();
      const hash = tokenService.hashRefreshToken(token);

      expect(hash).not.toBe(token);
      expect(hash).not.toContain(token);
    });
  });
});
