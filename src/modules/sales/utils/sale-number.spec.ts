import { formatSaleNumber } from './sale-number';

describe('formatSaleNumber', () => {
  it('formats with a 6-digit zero-padded sequence', () => {
    expect(formatSaleNumber(2026, 1)).toBe('SAL-2026-000001');
  });

  it('formats a larger sequence without truncating digits', () => {
    expect(formatSaleNumber(2026, 123456)).toBe('SAL-2026-123456');
  });

  it('formats sequence 0 correctly', () => {
    expect(formatSaleNumber(2026, 0)).toBe('SAL-2026-000000');
  });
});
