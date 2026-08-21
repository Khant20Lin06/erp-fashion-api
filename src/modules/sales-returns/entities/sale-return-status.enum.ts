/**
 * DRAFT -> CONFIRMED -> REFUNDED (terminal)
 * DRAFT -> CANCELLED (terminal)
 * CONFIRMED -> CANCELLED is NOT allowed — CONFIRMED already restocked
 * inventory (a real, traceable StockMovement was written); undoing that
 * would require a second reversing movement this phase does not implement.
 * A confirmed return that must be undone is a manual out-of-band correction,
 * matching Sale's own "CONFIRMED is terminal" precedent exactly.
 * No transition is ever allowed FROM REFUNDED or CANCELLED — both terminal.
 */
export enum SaleReturnStatus {
  Draft = 'DRAFT',
  Confirmed = 'CONFIRMED',
  Refunded = 'REFUNDED',
  Cancelled = 'CANCELLED',
}
