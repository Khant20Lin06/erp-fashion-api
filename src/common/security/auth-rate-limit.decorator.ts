import { SetMetadata } from '@nestjs/common';

export type AuthRateLimitMode = 'login' | 'forgot-password' | 'reset-password';

export const AUTH_RATE_LIMIT_METADATA_KEY = 'auth-rate-limit-mode';

export const AuthRateLimit = (mode: AuthRateLimitMode) =>
  SetMetadata(AUTH_RATE_LIMIT_METADATA_KEY, mode);
