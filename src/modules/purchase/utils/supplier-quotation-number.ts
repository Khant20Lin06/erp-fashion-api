export function formatSupplierQuotationNumber(
  year: number,
  sequence: number,
): string {
  const padded = String(sequence).padStart(4, '0');
  return `SQ-${year}-${padded}`;
}
