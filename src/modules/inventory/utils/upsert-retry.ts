/**
 * Retries a MySQL `INSERT ... ON DUPLICATE KEY UPDATE` upsert on the
 * specific transient InnoDB error it can raise under high concurrent-
 * insert contention against a not-yet-existing row: `ER_DUP_ENTRY`
 * (MySQL error code 1062). This is documented InnoDB behavior — a
 * concurrent `INSERT ... ON DUPLICATE KEY UPDATE` targeting a table with
 * a secondary unique index (e.g. this codebase's `(company_id, year)` /
 * `(warehouse_id, product_variant_id)` counter and stock-balance upserts)
 * can raise a duplicate-key error against a row that does not yet exist
 * from the client's perspective, because InnoDB's gap-lock/next-key-lock
 * handling for the not-yet-committed insert attempt can itself collide
 * with a concurrent connection's insert attempt on the same key gap.
 *
 * Found via a real 10-way parallel e2e concurrency test against live
 * Docker MySQL 8.0.40 (`test/inventory.e2e-spec.ts`) — the failure
 * reproduced deterministically, not as an intermittent flake, ruling out
 * a MySQL `UUID()` collision (the first hypothesis, since disproven: the
 * error persisted identically after switching to `crypto.randomUUID()`
 * for the candidate primary key). A short bounded retry (the upsert
 * itself is idempotent and side-effect-free beyond the no-op
 * `ON DUPLICATE KEY UPDATE <col> = <col>`) is the standard, minimal fix —
 * by the time a retry runs, the competing connection's insert has
 * committed, so the upsert now takes the UPDATE branch and succeeds.
 */
export async function retryOnDuplicateEntry<T>(
  work: () => Promise<T>,
  maxAttempts = 5,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await work();
    } catch (error) {
      const err = error as {
        code?: string;
        errno?: number;
        driverError?: { code?: string; errno?: number };
      };
      const code = err?.code ?? err?.driverError?.code;
      const errno = err?.errno ?? err?.driverError?.errno;

      console.error(
        `[retryOnDuplicateEntry] attempt ${attempt} failed: code=${String(code)} errno=${String(errno)}`,
      );
      const isDuplicateEntry = code === 'ER_DUP_ENTRY' || errno === 1062;
      if (!isDuplicateEntry || attempt === maxAttempts) {
        throw error;
      }
      lastError = error;
    }
  }
  throw lastError;
}
