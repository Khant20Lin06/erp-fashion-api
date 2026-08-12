/**
 * Deterministic, sorted-and-joined combination key from a set of
 * AttributeOption IDs — the relational uniqueness token that prevents two
 * variants under the same Product from sharing an identical attribute set
 * (Phase 10 analysis §10, approved). Sorting removes input-order
 * sensitivity; a SIMPLE product's single default variant has zero
 * attributes and therefore an empty-string key, which is still unique per
 * product since only one such row is ever created for it.
 */
export function computeCombinationKey(optionIds: string[]): string {
  return [...optionIds].sort().join('|');
}
