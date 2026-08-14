/**
 * Formats a purchase order number as PO-<year>-<6-digit zero-padded
 * sequence>, e.g. PO-2026-000001. See docs/PURCHASE_ARCHITECTURE.md
 * "Numbering / Concurrency" for the full concurrency-safe generation
 * mechanism this feeds into (PurchaseOrdersService.generatePurchaseOrderNumber),
 * a direct mirror of SalesService.generateSaleNumber() (Phase 12).
 */
export function formatPurchaseOrderNumber(
  year: number,
  sequence: number,
): string {
  return `PO-${year}-${String(sequence).padStart(6, '0')}`;
}
