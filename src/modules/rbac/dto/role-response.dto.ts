import { Role } from '../entities/role.entity';
import { RoleStatus } from '../entities/role-status.enum';
import { DataScope } from '../enums/data-scope.enum';

export interface RoleScopeResponseDto {
  resource: string;
  scope: DataScope;
  scopeValue: string | null;
}

export interface RoleResponseDto {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: RoleStatus;
  isSystemRole: boolean;
  permissionCodes: string[];
  scopes: RoleScopeResponseDto[];
  createdAt: Date;
  updatedAt: Date;
}

export function toRoleResponseDto(role: Role): RoleResponseDto {
  return {
    id: role.id,
    name: role.name,
    code: role.code,
    description: role.description,
    status: role.status,
    isSystemRole: role.isSystemRole,
    permissionCodes: (role.rolePermissions ?? []).map(
      (rp) => rp.permission.code,
    ),
    scopes: (role.resourceScopes ?? []).map((scope) => ({
      resource: scope.resource,
      scope: scope.scope,
      scopeValue: scope.scopeValue,
    })),
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}
