/**
 * Phase 11 §14 asks for ACTIVE/INACTIVE/BLOCKED (three values), unlike the
 * two-value ACTIVE/INACTIVE convention used by Phase 09/10 master-data
 * entities. BLOCKED is kept because it carries a distinct real-world meaning
 * for a Customer (e.g. blocked for credit-policy reasons) that INACTIVE does
 * not — collapsing them would lose information Phase 12 (Sales) will need
 * when deciding whether a customer may transact. No business logic keyed off
 * BLOCKED is implemented in this phase (no credit-blocking engine) — the
 * value only exists as configurable master-data status today.
 */
export enum CustomerStatus {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
  Blocked = 'BLOCKED',
}
