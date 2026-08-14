/**
 * Shared <PREFIX>-<year>-<6-digit zero-padded sequence> formatter, e.g.
 * GR-2026-000001 / TRF-2026-000001 / ADJ-2026-000001 — the same shape as
 * SAL-/PO- (Phase 12/13), applied to Phase 14's three new document types.
 */
export function formatDocumentNumber(
  prefix: string,
  year: number,
  sequence: number,
): string {
  return `${prefix}-${year}-${String(sequence).padStart(6, '0')}`;
}
