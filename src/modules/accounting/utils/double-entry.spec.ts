import {
  assertBalanced,
  assertOneSidedLine,
  toCents,
  centsToDecimalString,
} from './double-entry';

describe('double-entry utils', () => {
  describe('toCents / centsToDecimalString', () => {
    it('converts decimal strings to integer cents exactly', () => {
      expect(toCents('100.00')).toBe(10000);
      expect(toCents('0.10')).toBe(10);
      expect(toCents('0.20')).toBe(20);
    });

    it('round-trips cents back to a decimal string', () => {
      expect(centsToDecimalString(10000)).toBe('100.00');
      expect(centsToDecimalString(30)).toBe('0.30');
    });

    it('avoids the classic 0.1 + 0.2 floating-point error via integer-cents summation', () => {
      const cents = toCents('0.10') + toCents('0.20');
      expect(cents).toBe(30);
      expect(centsToDecimalString(cents)).toBe('0.30');
      // Demonstrates why this matters: native float addition does NOT equal 0.3 exactly.
      expect(0.1 + 0.2 === 0.3).toBe(false);
    });
  });

  describe('assertOneSidedLine', () => {
    it('accepts a debit-only line', () => {
      expect(() =>
        assertOneSidedLine({ debitAmount: '100.00', creditAmount: '0.00' }),
      ).not.toThrow();
    });

    it('accepts a credit-only line', () => {
      expect(() =>
        assertOneSidedLine({ debitAmount: '0.00', creditAmount: '100.00' }),
      ).not.toThrow();
    });

    it('rejects a line with both debit and credit non-zero', () => {
      expect(() =>
        assertOneSidedLine({ debitAmount: '50.00', creditAmount: '50.00' }),
      ).toThrow();
    });

    it('rejects a line with both debit and credit zero', () => {
      expect(() =>
        assertOneSidedLine({ debitAmount: '0.00', creditAmount: '0.00' }),
      ).toThrow();
    });

    it('rejects a negative debitAmount', () => {
      expect(() =>
        assertOneSidedLine({ debitAmount: '-10.00', creditAmount: '0.00' }),
      ).toThrow();
    });
  });

  describe('assertBalanced', () => {
    it('accepts a simple balanced two-line journal', () => {
      const result = assertBalanced([
        { debitAmount: '100.00', creditAmount: '0.00' },
        { debitAmount: '0.00', creditAmount: '100.00' },
      ]);
      expect(result.totalDebit).toBe('100.00');
      expect(result.totalCredit).toBe('100.00');
    });

    it('accepts a balanced multi-line journal', () => {
      const result = assertBalanced([
        { debitAmount: '60.00', creditAmount: '0.00' },
        { debitAmount: '40.00', creditAmount: '0.00' },
        { debitAmount: '0.00', creditAmount: '100.00' },
      ]);
      expect(result.totalDebit).toBe('100.00');
      expect(result.totalCredit).toBe('100.00');
    });

    it('rejects an unbalanced journal', () => {
      expect(() =>
        assertBalanced([
          { debitAmount: '100.00', creditAmount: '0.00' },
          { debitAmount: '0.00', creditAmount: '99.99' },
        ]),
      ).toThrow();
    });

    it('rejects an empty line list', () => {
      expect(() => assertBalanced([])).toThrow();
    });

    it('rejects if any individual line violates the one-sided invariant', () => {
      expect(() =>
        assertBalanced([
          { debitAmount: '100.00', creditAmount: '100.00' },
          { debitAmount: '0.00', creditAmount: '0.00' },
        ]),
      ).toThrow();
    });

    it('balances correctly even with values prone to float error (0.1 + 0.2 style sums)', () => {
      const result = assertBalanced([
        { debitAmount: '0.10', creditAmount: '0.00' },
        { debitAmount: '0.20', creditAmount: '0.00' },
        { debitAmount: '0.00', creditAmount: '0.30' },
      ]);
      expect(result.totalDebit).toBe('0.30');
      expect(result.totalCredit).toBe('0.30');
    });
  });
});
