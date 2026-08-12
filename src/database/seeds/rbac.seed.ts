import 'dotenv/config';
import { AppDataSource } from '../data-source';
import { Role } from '../../modules/rbac/entities/role.entity';
import { Permission } from '../../modules/rbac/entities/permission.entity';
import { RolePermission } from '../../modules/rbac/entities/role-permission.entity';
import { RoleResourceScope } from '../../modules/rbac/entities/role-resource-scope.entity';
import { RoleStatus } from '../../modules/rbac/entities/role-status.enum';
import { SystemRoleCode } from '../../modules/rbac/entities/system-role-code';
import { DataScope } from '../../modules/rbac/enums/data-scope.enum';

/**
 * Idempotent RBAC seed: the base permission catalog required to administer
 * RBAC itself, plus the single SUPER_ADMIN system role holding all of them.
 * RBAC-administration permissions (Phase 06), organization administration
 * permissions (Phase 07: companies/branches/warehouses), user/employee/
 * membership/sales-account administration permissions (Phase 08),
 * master-data administration permissions (Phase 09: categories/brands/
 * collections/attribute_options), and product/variant/pricing
 * administration permissions (Phase 10: products/product_variants/
 * barcodes/price_lists/price_list_items) are seeded here —
 * business-module permissions (sales.*, inventory.*, ...) are registered
 * by the phases that introduce those modules, not invented here.
 *
 * Phase 09 is also the first phase whose controllers call
 * DataScopeService.resolveScope() on a real request path, which returns
 * null ("no access") when a role has no RoleResourceScope row for the
 * resource at all. Since no seed previously populated that table, this
 * seed also grants SUPER_ADMIN an ALL-scope RoleResourceScope row for each
 * of the Phase 09 and Phase 10 resources — otherwise SUPER_ADMIN itself
 * would be locked out. No other role receives one here.
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
  // Phase 07 — Organization / Company / Branch / Warehouse
  { resource: 'companies', action: 'read', description: 'View companies' },
  { resource: 'companies', action: 'create', description: 'Create companies' },
  { resource: 'companies', action: 'update', description: 'Update companies' },
  { resource: 'companies', action: 'delete', description: 'Delete companies' },
  { resource: 'branches', action: 'read', description: 'View branches' },
  { resource: 'branches', action: 'create', description: 'Create branches' },
  { resource: 'branches', action: 'update', description: 'Update branches' },
  { resource: 'branches', action: 'delete', description: 'Delete branches' },
  { resource: 'warehouses', action: 'read', description: 'View warehouses' },
  {
    resource: 'warehouses',
    action: 'create',
    description: 'Create warehouses',
  },
  {
    resource: 'warehouses',
    action: 'update',
    description: 'Update warehouses',
  },
  {
    resource: 'warehouses',
    action: 'delete',
    description: 'Delete warehouses',
  },
  // Phase 08 — User / Employee / Account Management
  // users.read/create/update/delete already seeded above (Phase 06) — reused
  // as-is, only the new action verbs are added here.
  { resource: 'users', action: 'activate', description: 'Activate users' },
  { resource: 'users', action: 'deactivate', description: 'Deactivate users' },
  { resource: 'users', action: 'lock', description: 'Lock users' },
  { resource: 'users', action: 'unlock', description: 'Unlock users' },
  { resource: 'employees', action: 'read', description: 'View employees' },
  { resource: 'employees', action: 'create', description: 'Create employees' },
  { resource: 'employees', action: 'update', description: 'Update employees' },
  { resource: 'employees', action: 'delete', description: 'Delete employees' },
  {
    resource: 'user_organizations',
    action: 'read',
    description: "View a user's organization membership",
  },
  {
    resource: 'user_organizations',
    action: 'assign',
    description: 'Assign a user to a company/branch/warehouse',
  },
  {
    resource: 'user_organizations',
    action: 'remove',
    description: "Remove a user's company/branch/warehouse membership",
  },
  {
    resource: 'sales_accounts',
    action: 'read',
    description: 'View sales accounts',
  },
  {
    resource: 'sales_accounts',
    action: 'create',
    description: 'Create sales accounts',
  },
  {
    resource: 'sales_accounts',
    action: 'update',
    description: 'Update sales accounts',
  },
  {
    resource: 'sales_accounts',
    action: 'delete',
    description: 'Delete sales accounts',
  },
  {
    resource: 'sales_accounts',
    action: 'assign',
    description: 'Assign a user to a sales account',
  },
  {
    resource: 'sales_accounts',
    action: 'unassign',
    description: "Remove a user's sales account assignment",
  },
  // Phase 09 — Master Data (Category, Brand, Collection, AttributeOption)
  { resource: 'categories', action: 'read', description: 'View categories' },
  {
    resource: 'categories',
    action: 'create',
    description: 'Create categories',
  },
  {
    resource: 'categories',
    action: 'update',
    description: 'Update categories',
  },
  {
    resource: 'categories',
    action: 'delete',
    description: 'Delete categories',
  },
  { resource: 'brands', action: 'read', description: 'View brands' },
  { resource: 'brands', action: 'create', description: 'Create brands' },
  { resource: 'brands', action: 'update', description: 'Update brands' },
  { resource: 'brands', action: 'delete', description: 'Delete brands' },
  { resource: 'collections', action: 'read', description: 'View collections' },
  {
    resource: 'collections',
    action: 'create',
    description: 'Create collections',
  },
  {
    resource: 'collections',
    action: 'update',
    description: 'Update collections',
  },
  {
    resource: 'collections',
    action: 'delete',
    description: 'Delete collections',
  },
  {
    resource: 'attribute_options',
    action: 'read',
    description: 'View attribute options (color/size/style/material)',
  },
  {
    resource: 'attribute_options',
    action: 'create',
    description: 'Create attribute options',
  },
  {
    resource: 'attribute_options',
    action: 'update',
    description: 'Update attribute options',
  },
  {
    resource: 'attribute_options',
    action: 'delete',
    description: 'Delete attribute options',
  },
  // Phase 10 — Product / Variant / Pricing
  { resource: 'products', action: 'read', description: 'View products' },
  { resource: 'products', action: 'create', description: 'Create products' },
  { resource: 'products', action: 'update', description: 'Update products' },
  { resource: 'products', action: 'delete', description: 'Delete products' },
  {
    resource: 'product_variants',
    action: 'read',
    description: 'View product variants',
  },
  {
    resource: 'product_variants',
    action: 'create',
    description: 'Create product variants',
  },
  {
    resource: 'product_variants',
    action: 'update',
    description: 'Update product variants',
  },
  {
    resource: 'product_variants',
    action: 'delete',
    description: 'Delete product variants',
  },
  { resource: 'barcodes', action: 'read', description: 'View barcodes' },
  { resource: 'barcodes', action: 'create', description: 'Create barcodes' },
  { resource: 'barcodes', action: 'update', description: 'Update barcodes' },
  { resource: 'barcodes', action: 'delete', description: 'Delete barcodes' },
  {
    resource: 'price_lists',
    action: 'read',
    description: 'View price lists',
  },
  {
    resource: 'price_lists',
    action: 'create',
    description: 'Create price lists',
  },
  {
    resource: 'price_lists',
    action: 'update',
    description: 'Update price lists',
  },
  {
    resource: 'price_lists',
    action: 'delete',
    description: 'Delete price lists',
  },
  {
    resource: 'price_list_items',
    action: 'read',
    description: 'View price list items',
  },
  {
    resource: 'price_list_items',
    action: 'create',
    description: 'Create price list items',
  },
  {
    resource: 'price_list_items',
    action: 'update',
    description: 'Update price list items',
  },
  {
    resource: 'price_list_items',
    action: 'delete',
    description: 'Delete price list items',
  },
];

/**
 * Resources that gate access through DataScopeService.resolveScope() (Phase
 * 09 §12 — reusing the existing Phase 06/08 scope-resolution mechanism
 * rather than inventing another one). SUPER_ADMIN is granted ALL scope for
 * each so it can operate without an explicit RoleResourceScope row being
 * missing entirely; no other role receives one from this seed.
 */
const SUPER_ADMIN_ALL_SCOPE_RESOURCES: readonly string[] = [
  'categories',
  'brands',
  'collections',
  'attribute_options',
  'products',
  'product_variants',
  'barcodes',
  'price_lists',
  'price_list_items',
];

async function seed(): Promise<void> {
  await AppDataSource.initialize();

  const permissionRepository = AppDataSource.getRepository(Permission);
  const roleRepository = AppDataSource.getRepository(Role);
  const rolePermissionRepository = AppDataSource.getRepository(RolePermission);
  const roleResourceScopeRepository =
    AppDataSource.getRepository(RoleResourceScope);

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

  for (const resource of SUPER_ADMIN_ALL_SCOPE_RESOURCES) {
    const existing = await roleResourceScopeRepository.findOne({
      where: { roleId: superAdminRole.id, resource },
    });

    if (!existing) {
      await roleResourceScopeRepository.save(
        roleResourceScopeRepository.create({
          roleId: superAdminRole.id,
          resource,
          scope: DataScope.All,
          scopeValue: null,
        }),
      );
      console.log(`Granted ALL scope for ${resource} to SUPER_ADMIN`);
    }
  }

  await AppDataSource.destroy();
  console.log('RBAC seed complete.');
}

seed().catch((error: unknown) => {
  console.error('RBAC seed failed', error);
  process.exit(1);
});
