export function formatPurchaseRequestNumber(
  year: number,
  sequence: number,
): string {
  return `PR-${year}-${String(sequence).padStart(6, '0')}`;
}
