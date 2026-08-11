import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import type { StringValue } from 'ms';
import { AuthConfig } from '../../../config/auth.config';
import { JwtPayload } from '../types/jwt-payload';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  signAccessToken(userId: string): string {
    const authConfig = this.configService.get<AuthConfig>('auth')!;
    const jti: string = randomUUID();

    return this.jwtService.sign(
      { sub: userId, jti },
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
}
