/** Exponential backoff cap — retries never wait longer than this between attempts (5 minutes). */
export const MAX_BACKOFF_MS = 5 * 60 * 1000;

/** Base delay for the first retry (1s), doubling each subsequent attempt. */
export const BASE_BACKOFF_MS = 1000;

/**
 * Computes the delay (ms) before the next publish attempt, given how many
 * attempts have already been made (including the one that just failed).
 * attemptCount=1 (first failure) -> 1s, 2 -> 2s, 3 -> 4s, 4 -> 8s, ...
 * capped at MAX_BACKOFF_MS. There is no dead/exhausted terminal state in
 * this phase's scope (locked spec) — attempts beyond the point where the
 * exponent would exceed the cap simply keep retrying at MAX_BACKOFF_MS
 * forever, rather than ever giving up.
 */
export function computeBackoffMs(attemptCount: number): number {
  if (attemptCount <= 0) {
    return 0;
  }
  const exponential = BASE_BACKOFF_MS * 2 ** (attemptCount - 1);
  return Math.min(exponential, MAX_BACKOFF_MS);
}

/**
 * Removes anything that looks like a credential/secret from an error
 * message before it is persisted to outbox_events.last_error (locked spec:
 * "sanitized — never include secrets"). Truncates to a bounded length
 * (matches the column's varchar(1000)) and strips common
 * credential-bearing patterns (Authorization headers, basic-auth URLs,
 * password= query params, bearer tokens) defensively — this table is
 * operational/debugging data, not a place a raw driver error (which can
 * embed connection strings) should ever land verbatim.
 */
export function sanitizeErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  const sanitized = raw
    .replace(/:\/\/[^@/\s]+@/gi, '://***REDACTED***@') // user:pass@host
    .replace(/(bearer\s+)\S+/gi, '$1***REDACTED***') // "Bearer <token>" before the broader Authorization pass below
    .replace(/(authorization\s*[:=]\s*)\S+/gi, '$1***REDACTED***')
    .replace(
      /((?:password|passwd|pwd|secret|token|api[_-]?key)\s*[:=]\s*)\S+/gi,
      '$1***REDACTED***',
    );

  return sanitized.slice(0, 1000);
}
