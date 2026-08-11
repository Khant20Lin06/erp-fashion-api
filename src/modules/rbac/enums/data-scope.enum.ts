/**
 * Resource-specific data visibility scope. A role grants one scope per
 * resource (see RoleResourceScope) — there is no single global scope value
 * for a user, because the same user may need OWN visibility for one
 * resource and COMPANY visibility for another.
 */
export enum DataScope {
  Own = 'OWN',
  Account = 'ACCOUNT',
  Team = 'TEAM',
  Branch = 'BRANCH',
  Warehouse = 'WAREHOUSE',
  Company = 'COMPANY',
  Organization = 'ORGANIZATION',
  All = 'ALL',
}
