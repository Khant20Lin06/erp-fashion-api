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
  authRateLimitMaxAttempts: number;
  authRateLimitWindowSeconds: number;
  refreshCookieName: string;
  refreshCookiePath: string;
  refreshTokenExpiresInDays: number;
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
  authRateLimitMaxAttempts: parseInt(
    process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS ?? '10',
    10,
  ),
  authRateLimitWindowSeconds: parseInt(
    process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS ?? '60',
    10,
  ),
  refreshCookieName:
    process.env.AUTH_REFRESH_COOKIE_NAME ?? 'fashion_erp_refresh_token',
  // Deliberately `/`, matching the access-token cookie's path, rather than
  // scoped to /auth only. A same-origin frontend (this app's own Next.js
  // Route Handlers, not the browser talking to the backend directly) does
  // not necessarily call the backend at a URL path that mirrors the
  // backend's own /auth/* routing — e.g. this app's logout endpoint lives
  // at /api/auth/logout on the frontend origin, which a path-scoped cookie
  // set for /api/v1/auth would never be attached to. `/` trades a slightly
  // larger cookie-attachment surface for actually being deliverable to
  // every route that might need it; the cookie remains httpOnly regardless,
  // so it is never readable by page JavaScript either way.
  refreshCookiePath: process.env.AUTH_REFRESH_COOKIE_PATH ?? '/',
  refreshTokenExpiresInDays: parseInt(
    process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS ?? '30',
    10,
  ),
}));
