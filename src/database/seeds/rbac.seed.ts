import 'dotenv/config';
import { AppDataSource } from '../data-source';
import { Role } from '../../modules/rbac/entities/role.entity';
import { Permission } from '../../modules/rbac/entities/permission.entity';
import { RolePermission } from '../../modules/rbac/entities/role-permission.entity';
import { RoleStatus } from '../../modules/rbac/entities/role-status.enum';
import { SystemRoleCode } from '../../modules/rbac/entities/system-role-code';

/**
 * Idempotent RBAC seed: the base permission catalog required to administer
 * RBAC itself, plus the single SUPER_ADMIN system role holding all of them.
 * Only the RBAC-administration permissions are seeded here (Phase 06 scope)
 * — business-module permissions (sales.*, inventory.*, ...) are registered
 * by the phases that introduce those modules, not invented here.
 *
 * Safe to run multiple times: every insert is guarded by a "does this code
 * already exist" check, so re-running never creates duplicates and never
 * deletes custom roles/permissions created after the initial seed.
 */
const PERMISSION_CATALOG: Array<{
  resource: string;
  action: string;
  description: string;
}> = [
  { resource: 'users', action: 'read', description: 'View users' },
  { resource: 'users', action: 'create', description: 'Create users' },
  { resource: 'users', action: 'update', description: 'Update users' },
  { resource: 'users', action: 'delete', description: 'Delete users' },
  { resource: 'roles', action: 'read', description: 'View roles' },
  { resource: 'roles', action: 'create', description: 'Create roles' },
  { resource: 'roles', action: 'update', description: 'Update roles' },
  { resource: 'roles', action: 'delete', description: 'Delete roles' },
  {
    resource: 'permissions',
    action: 'read',
    description: 'View permission catalog',
  },
  {
    resource: 'user_roles',
    action: 'read',
    description: 'View user role assignments',
  },
  {
    resource: 'user_roles',
    action: 'assign',
    description: 'Assign roles to users',
  },
  {
    resource: 'user_roles',
    action: 'remove',
    description: 'Remove roles from users',
  },
];

async function seed(): Promise<void> {
  await AppDataSource.initialize();

  const permissionRepository = AppDataSource.getRepository(Permission);
  const roleRepository = AppDataSource.getRepository(Role);
  const rolePermissionRepository = AppDataSource.getRepository(RolePermission);

  const permissions: Permission[] = [];

  for (const entry of PERMISSION_CATALOG) {
    const code = `${entry.resource}.${entry.action}`;
    let permission = await permissionRepository.findOne({ where: { code } });

    if (!permission) {
      permission = permissionRepository.create({
        resource: entry.resource,
        action: entry.action,
        code,
        description: entry.description,
      });
      permission = await permissionRepository.save(permission);
      console.log(`Created permission: ${code}`);
    }

    permissions.push(permission);
  }

  let superAdminRole = await roleRepository.findOne({
    where: { code: SystemRoleCode.SuperAdmin },
  });

  if (!superAdminRole) {
    superAdminRole = roleRepository.create({
      name: 'Super Admin',
      code: SystemRoleCode.SuperAdmin,
      description: 'Full administrative access to the RBAC system.',
      status: RoleStatus.Active,
      isSystemRole: true,
    });
    superAdminRole = await roleRepository.save(superAdminRole);
    console.log('Created role: SUPER_ADMIN');
  }

  for (const permission of permissions) {
    const existing = await rolePermissionRepository.findOne({
      where: { roleId: superAdminRole.id, permissionId: permission.id },
    });

    if (!existing) {
      await rolePermissionRepository.save(
        rolePermissionRepository.create({
          roleId: superAdminRole.id,
          permissionId: permission.id,
        }),
      );
      console.log(`Granted ${permission.code} to SUPER_ADMIN`);
    }
  }

  await AppDataSource.destroy();
  console.log('RBAC seed complete.');
}

seed().catch((error: unknown) => {
  console.error('RBAC seed failed', error);
  process.exit(1);
});
