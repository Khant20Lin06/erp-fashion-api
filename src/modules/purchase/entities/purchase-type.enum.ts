/**
 * Minimal, defensible purchase-type set (Phase 13 locked decision,
 * mirroring SaleType's Phase 12 reasoning rather than copying an
 * illustrative multi-value list). STANDARD covers the default/ordinary
 * purchase-order channel; CREDIT distinguishes an order placed against
 * supplier-extended credit terms (Supplier.creditDays, Phase 11) from a
 * standard/immediate-settlement order — a real, already-modeled business
 * distinction in this codebase's own Supplier entity, not a speculative
 * addition. No POS/RETAIL/WHOLESALE-style channel split was added because
 * Purchase has no equivalent "sales channel" concept to distinguish at the
 * header level the way Sale's POS-vs-RETAIL-vs-WHOLESALE split does.
 */
export enum PurchaseType {
  Standard = 'STANDARD',
  Credit = 'CREDIT',
}
