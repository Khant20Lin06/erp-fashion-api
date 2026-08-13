/**
 * Formats a sale number as SAL-<year>-<6-digit zero-padded sequence>, e.g.
 * SAL-2026-000001. See docs/SALES_ARCHITECTURE.md "Sale Number
 * Architecture" for the full concurrency-safe generation mechanism this
 * feeds into (SalesService.generateSaleNumber).
 */
export function formatSaleNumber(year: number, sequence: number): string {
  return `SAL-${year}-${String(sequence).padStart(6, '0')}`;
}
