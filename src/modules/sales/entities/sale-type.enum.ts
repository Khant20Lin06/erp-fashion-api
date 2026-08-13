/**
 * Minimal, defensible sale-type set (Phase 12 locked decision, overriding
 * Phase 12.md's larger illustrative POS/RETAIL/WHOLESALE/CREDIT/CASH/ONLINE
 * list). POS and RETAIL are the two concrete channel concepts a fashion
 * ERP+POS system actually needs to distinguish at the header level for
 * reporting/filtering; WHOLESALE covers bulk/B2B sales explicitly
 * referenced throughout Phase 12.md. CREDIT/CASH describe a *payment*
 * dimension, not a sale-type/channel dimension (that belongs to the Phase
 * 16 Payment module, not this enum) — folding them in here would conflate
 * two unrelated axes. ONLINE has no backend/frontend evidence of an actual
 * e-commerce channel integration in this codebase and was left out rather
 * than speculatively added.
 */
export enum SaleType {
  Pos = 'POS',
  Retail = 'RETAIL',
  Wholesale = 'WHOLESALE',
}
