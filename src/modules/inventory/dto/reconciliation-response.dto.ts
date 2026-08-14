/**
 * Response shape for GET /inventory-ledger/reconciliation (Phase 15 locked
 * scope D — exact field set from the locked specification). Purely
 * diagnostic: computed on read, never persisted, never "fixes" a
 * discrepancy.
 *
 * ledgerBalance = SUM(StockMovement.quantityChange) for (warehouseId,
 * productVariantId).
 * warehouseStockBalance = WarehouseStock.onHandQuantity for the same pair
 * (0 if no WarehouseStock row exists yet).
 * difference = warehouseStockBalance - ledgerBalance.
 * reconciled = difference === 0.
 */
export interface ReconciliationResponseDto {
  warehouseId: string;
  productVariantId: string;
  warehouseStockBalance: number;
  ledgerBalance: number;
  difference: number;
  reconciled: boolean;
}
