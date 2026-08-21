/**
 * OPEN -> PROCESSING -> FINALIZED (terminal, immutable)
 * OPEN -> CANCELLED (terminal)
 * PROCESSING -> CANCELLED (terminal)
 * No transition is ever allowed FROM FINALIZED or CANCELLED — both are
 * terminal, matching this codebase's established Sale/PurchaseOrder/
 * JournalEntry "confirmed/posted is immutable" convention exactly.
 */
export enum PayrollPeriodStatus {
  Open = 'OPEN',
  Processing = 'PROCESSING',
  Finalized = 'FINALIZED',
  Cancelled = 'CANCELLED',
}
