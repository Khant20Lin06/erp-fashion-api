/**
 * Extensible warehouse-kind label. Not all values need active support from
 * day one (Phase 07 §14) — inventory behavior per type belongs to Phase 14.
 */
export enum WarehouseType {
  Main = 'MAIN',
  Store = 'STORE',
  Distribution = 'DISTRIBUTION',
  Transit = 'TRANSIT',
  Return = 'RETURN',
  Virtual = 'VIRTUAL',
  Other = 'OTHER',
}
