/**
 * Deliberately closed, deterministic set — mirrors PayrollCalculationType's
 * own "no formula engine" precedent exactly. No eval/Function/dynamic SQL.
 */
export enum PromotionDiscountType {
  Percentage = 'PERCENTAGE',
  FixedAmount = 'FIXED_AMOUNT',
}
