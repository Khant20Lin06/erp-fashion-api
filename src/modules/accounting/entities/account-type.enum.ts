/**
 * D4 (LOCKED): the five standard accounting classifications only. No
 * speculative subtypes (COGS/RECEIVABLE/PAYABLE/CASH/BANK) — the locked
 * spec explicitly says these are unneeded unless the posting implementation
 * genuinely requires distinguishing them, and it does not: which specific
 * Account is used for the cash/bank side of a Payment posting is resolved
 * from PaymentMethod.glAccountId, and which Account is used for the
 * receivable/payable side is resolved from Customer.receivableAccountId /
 * Supplier.payableAccountId — accountType itself is never branched on by
 * AccountingPostingService.
 */
export enum AccountType {
  Asset = 'ASSET',
  Liability = 'LIABILITY',
  Equity = 'EQUITY',
  Revenue = 'REVENUE',
  Expense = 'EXPENSE',
}
