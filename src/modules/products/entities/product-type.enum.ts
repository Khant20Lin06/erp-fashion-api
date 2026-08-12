/**
 * SIMPLE products still get exactly one ProductVariant row (created
 * transactionally alongside the Product) — this enum only affects how the
 * frontend presents the variant editor, never whether a Variant row exists.
 * Keeping a single stockable-unit contract (ProductVariant) for every
 * Product, regardless of type, is what lets Phase 12/13/14 reference
 * ProductVariant.id unconditionally.
 */
export enum ProductType {
  Simple = 'SIMPLE',
  Variant = 'VARIANT',
}
