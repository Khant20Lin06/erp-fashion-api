/**
 * Closed discriminator unifying Color/Size/Style/Material into one table
 * (Phase 09 §8, LOCKED) rather than four near-identical tables — matches
 * the frontend's own AttributeOption/AttributeKind design exactly.
 */
export enum AttributeKind {
  Color = 'COLOR',
  Size = 'SIZE',
  Style = 'STYLE',
  Material = 'MATERIAL',
}
