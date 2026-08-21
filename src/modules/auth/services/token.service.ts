import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID, randomBytes, createHash } from 'crypto';
import type { StringValue } from 'ms';
import { AuthConfig } from '../../../config/auth.config';
import { JwtPayload } from '../types/jwt-payload';

const REFRESH_TOKEN_BYTES = 32;

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  signAccessToken(userId: string): string {
    const authConfig = this.configService.get<AuthConfig>('auth')!;
    const jti: string = randomUUID();
    const iatMs = Date.now();

    return this.jwtService.sign(
      { sub: userId, jti, iatMs },
      {
        secret: authConfig.jwtSecret,
        expiresIn: authConfig.jwtAccessTokenExpiresIn as StringValue,
        issuer: authConfig.jwtIssuer,
        audience: authConfig.jwtAudience,
      },
    );
  }

  verifyAccessToken(token: string): JwtPayload {
    const authConfig = this.configService.get<AuthConfig>('auth')!;

    return this.jwtService.verify<JwtPayload>(token, {
      secret: authConfig.jwtSecret,
      issuer: authConfig.jwtIssuer,
      audience: authConfig.jwtAudience,
    });
  }

  /**
   * Opaque refresh token — cryptographically random, not a JWT. Revocation
   * and rotation only need a database lookup by hash, so there is no
   * benefit to a self-describing signed token here, and an opaque token
   * cannot be inspected/misused client-side the way a JWT could be.
   */
  generateRefreshToken(): string {
    return randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
  }

  /** Only this hash is ever persisted — the raw token exists solely in the httpOnly cookie. */
  hashRefreshToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}
