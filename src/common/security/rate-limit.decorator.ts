import { SetMetadata } from '@nestjs/common';

export interface RateLimitOverride {
  /** Max requests allowed within the window. */
  max: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

export const RATE_LIMIT_METADATA_KEY = 'rate-limit-override';

/**
 * Declares a per-user rate limit for a specific route/controller, enforced
 * by PerUserRateLimitGuard — for authenticated, expensive, or metered
 * endpoints (AI chat, report generation, exports) where the limit should
 * follow the account, not the network address. Must be paired with
 * @UseGuards(PerUserRateLimitGuard) after JwtAuthGuard on the same route,
 * exactly like @AuthRateLimit + AuthRateLimitGuard.
 *
 * This is IN ADDITION TO the always-on global IP-based floor
 * (GlobalRateLimitGuard) — the two are independent checks, not a
 * replacement for one another.
 *
 *   @UseGuards(JwtAuthGuard, PerUserRateLimitGuard)
 *   @RateLimit({ max: 10, windowSeconds: 60 })
 */
export const RateLimit = (
  override: RateLimitOverride,
): MethodDecorator & ClassDecorator =>
  SetMetadata(RATE_LIMIT_METADATA_KEY, override);

export const SKIP_RATE_LIMIT_METADATA_KEY = 'skip-rate-limit';

/**
 * Exempts a route from the global IP-based rate limit (GlobalRateLimitGuard)
 * entirely. Health/metrics/docs are already skipped by path — this is for
 * any other route that needs the same treatment (e.g. a webhook receiver
 * with its own signature-based protection instead).
 */
export const SkipRateLimit = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_RATE_LIMIT_METADATA_KEY, true);
