/**
 * ACTIVE -> INACTIVE and back, mirroring PayrollComponent's own
 * activate/deactivate discipline. A promotion referenced by historical
 * Sale/SaleItem discount application is never hard-deleted — soft-delete
 * (BaseEntity.deletedAt) plus this status field both apply, matching
 * LeaveType/PayrollComponent's own precedent (status for "usable now",
 * soft-delete for "no longer exists at all").
 */
export enum PromotionStatus {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
}
