/**
 * Base permission actions. Modules may register additional business-specific
 * actions (approve, cancel, export, ...) as plain strings on Permission.action
 * without extending this enum — this enum documents the actions Phase 06
 * itself uses for RBAC administration permissions, not a closed set for
 * every future module.
 */
export enum PermissionAction {
  Read = 'read',
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
  Assign = 'assign',
  Remove = 'remove',
}
