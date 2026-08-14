/**
 * Polymorphic source discriminator for JournalEntry.sourceType/sourceId
 * (nullable — a manual journal entry, D12, may have no source at all, or
 * MANUAL explicitly). PAYMENT is the only value actually produced by any
 * automatic posting in this phase (D6, D7, D13). OPENING_BALANCE is
 * reserved on the enum per D11's explicit instruction ("keep the value
 * ready") but nothing in this phase ever creates a journal with this
 * sourceType — no endpoint or automatic trigger generates an opening
 * balance journal; see docs/ACCOUNTING_ARCHITECTURE.md for the full
 * reasoning behind this deliberate minimal-scope choice.
 */
export enum JournalSourceType {
  Manual = 'MANUAL',
  Payment = 'PAYMENT',
  OpeningBalance = 'OPENING_BALANCE',
}
