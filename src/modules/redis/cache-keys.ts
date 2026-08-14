/**
 * Centralized cache key builders (Phase 19, locked convention:
 * `erp:cache:<domain>:<key>`, always company-prefixed where the cached
 * data is company-scoped, to prevent cross-tenant collision). Every cached
 * resource in the codebase must build its key through one of these
 * functions rather than string-concatenating ad hoc — keeps the namespace
 * convention enforceable in one place.
 */
export const CacheKeys = {
  paymentMethods: (companyId: string): string =>
    `erp:cache:payment-methods:${companyId}`,
  companySettings: (companyId: string): string =>
    `erp:cache:company-settings:${companyId}`,
  /**
   * Phase 22 — dashboard aggregation cache. Key includes companyId +
   * branchScope + date range (locked spec requirement) so two different
   * scope/range combinations never collide. branchScope is the literal
   * string 'all' when no branchId filter was applied, or the branchId
   * itself — never omitted, since the whole point is that two different
   * scopes must never share a cache entry.
   */
  dashboard: (
    companyId: string,
    branchScope: string,
    fromDate: string,
    toDate: string,
  ): string =>
    `erp:cache:dashboard:${companyId}:${branchScope}:${fromDate}:${toDate}`,
} as const;

/** Default TTLs (seconds) for each cached resource — short enough that a stale write is invisible within one cache lifetime, long enough to actually reduce MySQL load for read-heavy master data. */
export const CacheTtl = {
  PAYMENT_METHODS_SECONDS: 300,
  COMPANY_SETTINGS_SECONDS: 300,
  /** Phase 22 — short TTL (locked spec: 60-300s) so dashboard financial-summary staleness is always tightly bounded. */
  DASHBOARD_SECONDS: 120,
} as const;
