import { SetMetadata } from '@nestjs/common';

export type AuthRateLimitMode =
  | 'login'
  | 'forgot-password'
  | 'reset-password'
  | 'refresh'
  | 'telegram-link-request'
  | 'telegram-link-verify';

export const AUTH_RATE_LIMIT_METADATA_KEY = 'auth-rate-limit-mode';

export const AuthRateLimit = (mode: AuthRateLimitMode) =>
  SetMetadata(AUTH_RATE_LIMIT_METADATA_KEY, mode);
