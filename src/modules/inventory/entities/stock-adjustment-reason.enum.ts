/**
 * Minimal, justified reason set for a StockAdjustment (Phase 14 locked
 * decision D10/D11). OPENING_BALANCE is required by the locked spec —
 * opening stock is modeled as a StockAdjustment reason, not a separate
 * entity. DAMAGE/LOSS/FOUND/CORRECTION cover the smallest defensible set
 * of positive/negative manual-correction reasons without building a
 * configurable reason-code admin surface nothing in this phase asked for.
 */
export enum StockAdjustmentReason {
  OpeningBalance = 'OPENING_BALANCE',
  Damage = 'DAMAGE',
  Loss = 'LOSS',
  Found = 'FOUND',
  Correction = 'CORRECTION',
}
