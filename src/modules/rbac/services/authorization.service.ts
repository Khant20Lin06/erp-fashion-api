import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../entities/user-role.entity';
import { RoleStatus } from '../entities/role-status.enum';

@Injectable()
export class AuthorizationService {
  constructor(
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
  ) {}

  /**
   * Effective permissions = deduplicated union of every permission code
   * granted by every ACTIVE role the user holds. Inactive/soft-deleted
   * roles and their permissions are excluded — a role stops granting
   * access the moment it is deactivated or deleted, not just hidden from
   * the UI (Phase 06 §76).
   */
  async getEffectivePermissionCodes(userId: string): Promise<Set<string>> {
    const userRoles = await this.userRoleRepository.find({
      where: { userId, role: { status: RoleStatus.Active } },
      relations: {
        role: {
          rolePermissions: { permission: true },
        },
      },
    });

    const codes = new Set<string>();
    for (const userRole of userRoles) {
      for (const rolePermission of userRole.role.rolePermissions ?? []) {
        codes.add(rolePermission.permission.code);
      }
    }

    return codes;
  }

  async can(userId: string, permissionCode: string): Promise<boolean> {
    const codes = await this.getEffectivePermissionCodes(userId);
    return codes.has(permissionCode);
  }

  async canAny(userId: string, permissionCodes: string[]): Promise<boolean> {
    const codes = await this.getEffectivePermissionCodes(userId);
    return permissionCodes.some((code) => codes.has(code));
  }

  async canAll(userId: string, permissionCodes: string[]): Promise<boolean> {
    const codes = await this.getEffectivePermissionCodes(userId);
    return permissionCodes.every((code) => codes.has(code));
  }

  /**
   * Roles currently held by a user (active roles only), used by
   * SuperAdminInvariantService and administration endpoints that need to
   * reason about role membership rather than individual permissions.
   */
  async getActiveRoleCodes(userId: string): Promise<Set<string>> {
    const userRoles = await this.userRoleRepository.find({
      where: { userId, role: { status: RoleStatus.Active } },
      relations: { role: true },
    });

    return new Set(userRoles.map((userRole) => userRole.role.code));
  }
}
