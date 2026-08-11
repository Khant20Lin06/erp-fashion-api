import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../entities/role.entity';
import { RoleStatus } from '../entities/role-status.enum';
import { RolePermission } from '../entities/role-permission.entity';
import { RoleResourceScope } from '../entities/role-resource-scope.entity';
import { UserRole } from '../entities/user-role.entity';
import { Permission } from '../entities/permission.entity';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { ReplaceRolePermissionsDto } from '../dto/replace-role-permissions.dto';
import { ReplaceRoleScopesDto } from '../dto/replace-role-scopes.dto';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { SuperAdminInvariantService } from './super-admin-invariant.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  PaginationDto,
} from '../../../shared/dto/pagination.dto';

export interface PaginatedRoles {
  data: Role[];
  meta: { page: number; limit: number; total: number };
}

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    private readonly transactionService: TransactionService,
    private readonly superAdminInvariant: SuperAdminInvariantService,
  ) {}

  async findAll(pagination: PaginationDto): Promise<PaginatedRoles> {
    const page = pagination.page ?? DEFAULT_PAGE;
    const limit = pagination.limit ?? DEFAULT_LIMIT;

    const [data, total] = await this.roleRepository.findAndCount({
      relations: {
        rolePermissions: { permission: true },
        resourceScopes: true,
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, meta: { page, limit, total } };
  }

  async findById(id: string): Promise<Role> {
    const role = await this.roleRepository.findOne({
      where: { id },
      relations: {
        rolePermissions: { permission: true },
        resourceScopes: true,
      },
    });

    if (!role) {
      throw new AppException(ErrorCode.NotFound, 'Role not found');
    }

    return role;
  }

  async create(dto: CreateRoleDto): Promise<Role> {
    const existing = await this.roleRepository.findOne({
      where: { code: dto.code },
    });

    if (existing) {
      throw new AppException(ErrorCode.Conflict, 'Role code already exists');
    }

    const role = this.roleRepository.create({
      name: dto.name,
      code: dto.code,
      description: dto.description ?? null,
      status: RoleStatus.Active,
      isSystemRole: false,
    });

    return this.roleRepository.save(role);
  }

  async update(id: string, dto: UpdateRoleDto): Promise<Role> {
    const role = await this.getRoleOrThrow(id);

    if (dto.name !== undefined) {
      role.name = dto.name;
    }
    if (dto.description !== undefined) {
      role.description = dto.description;
    }

    await this.roleRepository.save(role);
    return this.findById(id);
  }

  async activate(id: string): Promise<Role> {
    const role = await this.getRoleOrThrow(id);
    role.status = RoleStatus.Active;
    await this.roleRepository.save(role);
    return this.findById(id);
  }

  /**
   * Deactivation must not leave the system with zero active Super Admins.
   * The status change and the invariant check happen inside the same
   * transaction so a concurrent deactivation of a different Super Admin
   * cannot race past this check (see SuperAdminInvariantService).
   */
  async deactivate(id: string): Promise<Role> {
    await this.transactionService.run(async (manager) => {
      const role = await manager.findOne(Role, { where: { id } });
      if (!role) {
        throw new AppException(ErrorCode.NotFound, 'Role not found');
      }
      if (role.isSystemRole) {
        throw new AppException(
          ErrorCode.Forbidden,
          'System roles cannot be deactivated',
        );
      }

      role.status = RoleStatus.Inactive;
      await manager.save(role);

      await this.superAdminInvariant.assertAtLeastOneActiveSuperAdminRemains(
        manager,
      );
    });

    return this.findById(id);
  }

  /**
   * A role with active user assignments must not be deletable — this is
   * enforced both by the FK (ON DELETE RESTRICT on user_roles.role_id) and
   * checked explicitly here first so the caller gets a clear 409 instead of
   * a raw database constraint error. System roles are never deletable.
   */
  async remove(id: string): Promise<void> {
    await this.transactionService.run(async (manager) => {
      const role = await manager.findOne(Role, { where: { id } });
      if (!role) {
        throw new AppException(ErrorCode.NotFound, 'Role not found');
      }
      if (role.isSystemRole) {
        throw new AppException(
          ErrorCode.Forbidden,
          'System roles cannot be deleted',
        );
      }

      const assignmentCount = await manager.count(UserRole, {
        where: { roleId: id },
      });
      if (assignmentCount > 0) {
        throw new AppException(
          ErrorCode.Conflict,
          'Role has active user assignments and cannot be deleted',
        );
      }

      await manager.softRemove(role);
    });
  }

  /**
   * Replaces the role's entire permission set atomically: remove existing
   * RolePermission rows, insert the new set, in one transaction (Phase 06
   * §41 — no partially-updated permission sets).
   */
  async replacePermissions(
    id: string,
    dto: ReplaceRolePermissionsDto,
  ): Promise<Role> {
    await this.transactionService.run(async (manager) => {
      const role = await manager.findOne(Role, { where: { id } });
      if (!role) {
        throw new AppException(ErrorCode.NotFound, 'Role not found');
      }

      if (dto.permissionIds.length > 0) {
        const foundPermissions = await manager.find(Permission, {
          where: dto.permissionIds.map((permissionId) => ({
            id: permissionId,
          })),
        });
        if (foundPermissions.length !== dto.permissionIds.length) {
          throw new AppException(
            ErrorCode.ValidationError,
            'One or more permission ids do not exist',
          );
        }
      }

      await manager.delete(RolePermission, { roleId: id });

      const newRolePermissions = dto.permissionIds.map((permissionId) =>
        manager.create(RolePermission, { roleId: id, permissionId }),
      );
      if (newRolePermissions.length > 0) {
        await manager.save(newRolePermissions);
      }
    });

    return this.findById(id);
  }

  /** Replaces the role's entire resource-scope set atomically. */
  async replaceScopes(id: string, dto: ReplaceRoleScopesDto): Promise<Role> {
    await this.transactionService.run(async (manager) => {
      const role = await manager.findOne(Role, { where: { id } });
      if (!role) {
        throw new AppException(ErrorCode.NotFound, 'Role not found');
      }

      await manager.delete(RoleResourceScope, { roleId: id });

      const newScopes = dto.scopes.map((scopeInput) =>
        manager.create(RoleResourceScope, {
          roleId: id,
          resource: scopeInput.resource,
          scope: scopeInput.scope,
          scopeValue: scopeInput.scopeValue ?? null,
        }),
      );
      if (newScopes.length > 0) {
        await manager.save(newScopes);
      }
    });

    return this.findById(id);
  }

  private async getRoleOrThrow(id: string): Promise<Role> {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) {
      throw new AppException(ErrorCode.NotFound, 'Role not found');
    }
    return role;
  }
}
