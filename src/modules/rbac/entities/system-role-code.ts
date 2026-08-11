/**
 * Stable codes for system-seeded roles. This is the ONE place a system
 * role's identity may be referenced by code — application logic must check
 * `role.code === SystemRoleCode.SuperAdmin` (a database-loaded value),
 * never a user's email/id, and never duplicate this check across modules.
 */
export enum SystemRoleCode {
  SuperAdmin = 'SUPER_ADMIN',
}
