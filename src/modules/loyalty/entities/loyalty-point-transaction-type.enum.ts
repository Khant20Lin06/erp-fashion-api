/**
 * Deliberately closed set — only the types actually produced by implemented
 * behavior this phase (EARN on confirmed Sale, REDEEM on customer request,
 * REVERSAL on SaleReturn confirmation proportional to/matching the earned
 * amount). No EXPIRE (no expiration policy is implemented — see
 * LoyaltyProgram's own docblock) and no generic ADJUSTMENT beyond what a
 * manual correction genuinely requires.
 */
export enum LoyaltyPointTransactionType {
  Earn = 'EARN',
  Redeem = 'REDEEM',
  Reversal = 'REVERSAL',
  Adjustment = 'ADJUSTMENT',
}
