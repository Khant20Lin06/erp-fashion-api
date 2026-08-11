import { registerAs } from '@nestjs/config';

export interface AuthConfig {
  jwtSecret: string;
  jwtAccessTokenExpiresIn: string;
  jwtIssuer: string;
  jwtAudience: string;
  cookieName: string;
  cookieSecure: boolean;
  cookieSameSite: 'lax' | 'strict' | 'none';
  cookieDomain: string | undefined;
  cookiePath: string;
  passwordResetTokenExpiresInMinutes: number;
}

export default registerAs('auth', (): AuthConfig => ({
  jwtSecret: process.env.JWT_SECRET ?? '',
  jwtAccessTokenExpiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN ?? '15m',
  jwtIssuer: process.env.JWT_ISSUER ?? 'fashion-erp-backend',
  jwtAudience: process.env.JWT_AUDIENCE ?? 'fashion-erp-frontend',
  cookieName: process.env.AUTH_COOKIE_NAME ?? 'fashion_erp_access_token',
  cookieSecure: process.env.AUTH_COOKIE_SECURE !== 'false',
  cookieSameSite:
    (process.env.AUTH_COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') ?? 'lax',
  cookieDomain: process.env.AUTH_COOKIE_DOMAIN || undefined,
  cookiePath: process.env.AUTH_COOKIE_PATH ?? '/',
  passwordResetTokenExpiresInMinutes: parseInt(
    process.env.PASSWORD_RESET_TOKEN_EXPIRES_IN_MINUTES ?? '30',
    10,
  ),
}));
