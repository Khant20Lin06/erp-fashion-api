import { SetMetadata } from '@nestjs/common';

export const PERMISSION_METADATA_KEY = 'rbac:required-permissions';

export enum PermissionRequirementMode {
  Any = 'ANY',
  All = 'ALL',
}

export interface PermissionRequirement {
  codes: string[];
  mode: PermissionRequirementMode;
}

/**
 * Declares that a route requires the given permission(s). This decorator
 * only attaches metadata — PermissionGuard performs the actual check.
 *
 *   @RequirePermission('roles.read')
 *   @RequirePermission('roles.read', 'roles.update')            // ALL by default
 */
export const RequirePermission = (
  ...codes: string[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSION_METADATA_KEY, {
    codes,
    mode: PermissionRequirementMode.All,
  } satisfies PermissionRequirement);

/** Route is authorized if the user holds ANY of the given permissions. */
export const RequireAnyPermission = (
  ...codes: string[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSION_METADATA_KEY, {
    codes,
    mode: PermissionRequirementMode.Any,
  } satisfies PermissionRequirement);
