import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';

export interface DebitCreditLine {
  debitAmount: string | number;
  creditAmount: string | number;
}

/**
 * Converts a DECIMAL(14,2) string amount to integer cents. Decimal-safe
 * arithmetic decision (LOCKED spec's own "your call, document which
 * approach you took"): this codebase's dominant convention elsewhere is
 * `Number(...).toFixed(2)` string-decimal discipline (Payment/Sale/
 * PurchaseOrder all do this), but summing many lines with native
 * floating-point `Number` addition and only rounding at the end (as those
 * single-value computations do) is exactly the failure mode that can make
 * `SUM(debit) === SUM(credit)` intermittently false for values that are
 * decimal-exact but not binary-float-exact (e.g. 0.1 + 0.2). Since
 * JournalEntry's core invariant is an exact equality check across
 * potentially many lines, this module uses integer-cents arithmetic
 * (multiply by 100, round, sum as integers) for the balance
 * validation specifically — the one place in this phase where exact
 * equality over a sum of multiple values matters — while every
 * individual amount is still stored/formatted via the standard
 * `.toFixed(2)` string-decimal convention everywhere else (DTOs, entity
 * columns, response shapes). This is the more robust choice for this one
 * specific check, documented here rather than silently mixed with the
 * rest of the codebase's per-value `.toFixed(2)` convention.
 */
export function toCents(amount: string | number): number {
  return Math.round(Number(amount) * 100);
}

export function centsToDecimalString(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Enforces the one-sided-line invariant (LOCKED spec's "Double-entry
 * invariants"): exactly one of debitAmount/creditAmount is non-zero and
 * positive, the other is exactly zero — never both non-zero, never both
 * zero.
 */
export function assertOneSidedLine(line: DebitCreditLine): void {
  const debitCents = toCents(line.debitAmount);
  const creditCents = toCents(line.creditAmount);

  if (debitCents < 0 || creditCents < 0) {
    throw new AppException(
      ErrorCode.ValidationError,
      'debitAmount and creditAmount must not be negative',
    );
  }
  const debitSet = debitCents > 0;
  const creditSet = creditCents > 0;
  if (debitSet === creditSet) {
    throw new AppException(
      ErrorCode.ValidationError,
      'Each journal entry line must have exactly one of debitAmount/creditAmount greater than zero (never both, never neither)',
    );
  }
}

/**
 * Enforces the journal-level balance invariant: SUM(debitAmount) ===
 * SUM(creditAmount) across all lines, computed via integer-cents
 * arithmetic (see toCents()'s docblock). Returns the balanced totals as
 * DECIMAL(14,2) strings for storage in JournalEntry.totalDebit/totalCredit.
 */
export function assertBalanced(lines: DebitCreditLine[]): {
  totalDebit: string;
  totalCredit: string;
} {
  if (lines.length === 0) {
    throw new AppException(
      ErrorCode.ValidationError,
      'A journal entry must have at least one line',
    );
  }

  let totalDebitCents = 0;
  let totalCreditCents = 0;
  for (const line of lines) {
    assertOneSidedLine(line);
    totalDebitCents += toCents(line.debitAmount);
    totalCreditCents += toCents(line.creditAmount);
  }

  if (totalDebitCents !== totalCreditCents) {
    throw new AppException(
      ErrorCode.ValidationError,
      `Journal entry is not balanced: total debit (${centsToDecimalString(totalDebitCents)}) does not equal total credit (${centsToDecimalString(totalCreditCents)})`,
    );
  }

  return {
    totalDebit: centsToDecimalString(totalDebitCents),
    totalCredit: centsToDecimalString(totalCreditCents),
  };
}
