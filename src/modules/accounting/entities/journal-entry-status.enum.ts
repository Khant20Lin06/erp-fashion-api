/**
 * D2 (LOCKED): minimal lifecycle. DRAFT -> POSTED (terminal, immutable —
 * D3). A DRAFT may additionally be cancelled (DRAFT -> CANCELLED, also
 * terminal) — added because, unlike Payment (Phase 16), a manual journal
 * entry (D12: POST /journal-entries) genuinely can sit unposted (a user
 * builds a DRAFT, realizes it is wrong, and needs a real terminal state to
 * put it in rather than leaving it forever postable). This mirrors
 * Sale/PurchaseOrder's own DRAFT->CONFIRMED|CANCELLED shape exactly, unlike
 * Payment (Phase 16), which had no DRAFT stage at all and therefore no
 * corresponding need for a cancel transition. No SUBMITTED/APPROVED/
 * REJECTED/REVERSED — no approval workflow, no reversal (D2/D3/D21).
 */
export enum JournalEntryStatus {
  Draft = 'DRAFT',
  Posted = 'POSTED',
  Cancelled = 'CANCELLED',
}
