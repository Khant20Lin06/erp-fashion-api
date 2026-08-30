export function formatPurchaseRfqNumber(
  year: number,
  sequence: number,
): string {
  const padded = String(sequence).padStart(4, '0');
  return `RFQ-${year}-${padded}`;
}
