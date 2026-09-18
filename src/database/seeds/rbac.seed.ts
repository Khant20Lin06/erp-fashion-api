import 'dotenv/config';
import {
  createScriptLogger,
  logScriptFailure,
} from '../../common/logging/script-logger';
import { AppDataSource } from '../data-source';
import { Role } from '../../modules/rbac/entities/role.entity';
import { Permission } from '../../modules/rbac/entities/permission.entity';
import { RolePermission } from '../../modules/rbac/entities/role-permission.entity';
import { RoleResourceScope } from '../../modules/rbac/entities/role-resource-scope.entity';
import { RoleStatus } from '../../modules/rbac/entities/role-status.enum';
import { SystemRoleCode } from '../../modules/rbac/entities/system-role-code';
import { DataScope } from '../../modules/rbac/enums/data-scope.enum';

const logger = createScriptLogger('RbacSeed');

/**
 * Idempotent RBAC seed: the base permission catalog required to administer
 * RBAC itself, plus the single SUPER_ADMIN system role holding all of them.
 * RBAC-administration permissions (Phase 06), organization administration
 * permissions (Phase 07: companies/branches/warehouses), user/employee/
 * membership/sales-account administration permissions (Phase 08),
 * master-data administration permissions (Phase 09: categories/brands/
 * collections/attribute_options), product/variant/pricing administration
 * permissions (Phase 10: products/product_variants/barcodes/price_lists/
 * price_list_items), sales permissions (Phase 12), purchase order
 * permissions (Phase 13), inventory permissions (Phase 14:
 * warehouse_stock/goods_receipts/stock_transfers/stock_adjustments — no
 * `.update`/`.delete`/`.approve` for any of these, matching Phase 13's
 * zero-dead-permission precedent), and the Phase 15 Inventory Ledger
 * permission (`inventory_ledger.read` — a single read-only permission,
 * since Phase 15 is a purely read-only query layer over Phase 14's
 * StockMovement/WarehouseStock tables with no create/update/delete
 * endpoint of any kind) are seeded here — business-module permissions for
 * phases not yet implemented are not invented here.
 *
 * Phase 09 is also the first phase whose controllers call
 * DataScopeService.resolveScope() on a real request path, which returns
 * null ("no access") when a role has no RoleResourceScope row for the
 * resource at all. Since no seed previously populated that table, this
 * seed also grants SUPER_ADMIN an ALL-scope RoleResourceScope row for each
 * of the Phase 09, Phase 10, and Phase 11 resources — otherwise SUPER_ADMIN
 * itself would be locked out. No other role receives one here.
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
    resource: 'departments',
    action: 'read',
    description: 'View departments',
  },
  {
    resource: 'departments',
    action: 'create',
    description: 'Create departments',
  },
  {
    resource: 'departments',
    action: 'update',
    description: 'Update departments',
  },
  {
    resource: 'departments',
    action: 'delete',
    description: 'Delete departments',
  },
  {
    resource: 'designations',
    action: 'read',
    description: 'View designations',
  },
  {
    resource: 'designations',
    action: 'create',
    description: 'Create designations',
  },
  {
    resource: 'designations',
    action: 'update',
    description: 'Update designations',
  },
  {
    resource: 'designations',
    action: 'delete',
    description: 'Delete designations',
  },
  {
    resource: 'employee_assignments',
    action: 'read',
    description: 'View employee assignments',
  },
  {
    resource: 'employee_assignments',
    action: 'create',
    description: 'Create employee assignments',
  },
  {
    resource: 'employee_assignments',
    action: 'update',
    description: 'Update employee assignments',
  },
  {
    resource: 'leave_types',
    action: 'read',
    description: 'View leave types',
  },
  {
    resource: 'leave_types',
    action: 'create',
    description: 'Create leave types',
  },
  {
    resource: 'leave_types',
    action: 'update',
    description: 'Update leave types',
  },
  {
    resource: 'leave_types',
    action: 'delete',
    description: 'Delete leave types',
  },
  {
    resource: 'leave_requests',
    action: 'read',
    description: 'View leave requests',
  },
  {
    resource: 'leave_requests',
    action: 'create',
    description: 'Create leave requests',
  },
  {
    resource: 'leave_requests',
    action: 'update',
    description: 'Update leave requests',
  },
  {
    resource: 'leave_requests',
    action: 'approve',
    description: 'Approve leave requests',
  },
  {
    resource: 'leave_requests',
    action: 'reject',
    description: 'Reject leave requests',
  },
  {
    resource: 'leave_requests',
    action: 'cancel',
    description: 'Cancel leave requests',
  },
  {
    resource: 'attendance',
    action: 'read',
    description: 'View attendance records',
  },
  {
    resource: 'attendance',
    action: 'create',
    description: 'Create attendance records',
  },
  {
    resource: 'attendance',
    action: 'update',
    description: 'Update attendance records',
  },
  {
    resource: 'settings',
    action: 'system.read',
    description: 'View system settings',
  },
  {
    resource: 'settings',
    action: 'system.update',
    description: 'Update system settings',
  },
  {
    resource: 'settings',
    action: 'company.read',
    description: 'View company settings',
  },
  {
    resource: 'settings',
    action: 'company.update',
    description: 'Update company settings',
  },
  {
    resource: 'settings',
    action: 'branch.read',
    description: 'View branch settings',
  },
  {
    resource: 'settings',
    action: 'branch.update',
    description: 'Update branch settings',
  },
  {
    resource: 'settings',
    action: 'user.read',
    description: 'View own user settings',
  },
  {
    resource: 'settings',
    action: 'user.update',
    description: 'Update own user settings',
  },
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
  { resource: 'uoms', action: 'read', description: 'View UOMs' },
  { resource: 'uoms', action: 'create', description: 'Create UOMs' },
  { resource: 'uoms', action: 'update', description: 'Update UOMs' },
  { resource: 'uoms', action: 'delete', description: 'Delete UOMs' },
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
  {
    resource: 'product_variant_uoms',
    action: 'read',
    description: 'View product variant UOM mappings',
  },
  {
    resource: 'product_variant_uoms',
    action: 'create',
    description: 'Create product variant UOM mappings',
  },
  {
    resource: 'product_variant_uoms',
    action: 'update',
    description: 'Update product variant UOM mappings',
  },
  {
    resource: 'product_variant_uoms',
    action: 'delete',
    description: 'Delete product variant UOM mappings',
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
  // Phase 11 — Customer / Supplier
  { resource: 'customers', action: 'read', description: 'View customers' },
  { resource: 'customers', action: 'create', description: 'Create customers' },
  { resource: 'customers', action: 'update', description: 'Update customers' },
  { resource: 'customers', action: 'delete', description: 'Delete customers' },
  { resource: 'suppliers', action: 'read', description: 'View suppliers' },
  { resource: 'suppliers', action: 'create', description: 'Create suppliers' },
  { resource: 'suppliers', action: 'update', description: 'Update suppliers' },
  { resource: 'suppliers', action: 'delete', description: 'Delete suppliers' },
  {
    resource: 'customer_groups',
    action: 'read',
    description: 'View customer groups',
  },
  {
    resource: 'customer_groups',
    action: 'create',
    description: 'Create customer groups',
  },
  {
    resource: 'customer_groups',
    action: 'update',
    description: 'Update customer groups',
  },
  {
    resource: 'customer_groups',
    action: 'delete',
    description: 'Delete customer groups',
  },
  {
    resource: 'supplier_groups',
    action: 'read',
    description: 'View supplier groups',
  },
  {
    resource: 'supplier_groups',
    action: 'create',
    description: 'Create supplier groups',
  },
  {
    resource: 'supplier_groups',
    action: 'update',
    description: 'Update supplier groups',
  },
  {
    resource: 'supplier_groups',
    action: 'delete',
    description: 'Delete supplier groups',
  },
  {
    resource: 'payment_terms',
    action: 'read',
    description: 'View payment terms',
  },
  {
    resource: 'payment_terms',
    action: 'create',
    description: 'Create payment terms',
  },
  {
    resource: 'payment_terms',
    action: 'update',
    description: 'Update payment terms',
  },
  {
    resource: 'payment_terms',
    action: 'delete',
    description: 'Delete payment terms',
  },
  {
    resource: 'customer_addresses',
    action: 'read',
    description: 'View customer addresses',
  },
  {
    resource: 'customer_addresses',
    action: 'create',
    description: 'Create customer addresses',
  },
  {
    resource: 'customer_addresses',
    action: 'update',
    description: 'Update customer addresses',
  },
  {
    resource: 'customer_addresses',
    action: 'delete',
    description: 'Delete customer addresses',
  },
  {
    resource: 'supplier_addresses',
    action: 'read',
    description: 'View supplier addresses',
  },
  {
    resource: 'supplier_addresses',
    action: 'create',
    description: 'Create supplier addresses',
  },
  {
    resource: 'supplier_addresses',
    action: 'update',
    description: 'Update supplier addresses',
  },
  {
    resource: 'supplier_addresses',
    action: 'delete',
    description: 'Delete supplier addresses',
  },
  {
    resource: 'customer_contacts',
    action: 'read',
    description: 'View customer contacts',
  },
  {
    resource: 'customer_contacts',
    action: 'create',
    description: 'Create customer contacts',
  },
  {
    resource: 'customer_contacts',
    action: 'update',
    description: 'Update customer contacts',
  },
  {
    resource: 'customer_contacts',
    action: 'delete',
    description: 'Delete customer contacts',
  },
  {
    resource: 'supplier_contacts',
    action: 'read',
    description: 'View supplier contacts',
  },
  {
    resource: 'supplier_contacts',
    action: 'create',
    description: 'Create supplier contacts',
  },
  {
    resource: 'supplier_contacts',
    action: 'update',
    description: 'Update supplier contacts',
  },
  {
    resource: 'supplier_contacts',
    action: 'delete',
    description: 'Delete supplier contacts',
  },
  // Phase 12 — Sales
  { resource: 'sales', action: 'read', description: 'View sales' },
  { resource: 'sales', action: 'create', description: 'Create sales' },
  {
    resource: 'sales',
    action: 'update',
    description: 'Update sales (reserved for future use)',
  },
  {
    resource: 'sales',
    action: 'delete',
    description: 'Delete sales (reserved for future use)',
  },
  { resource: 'sales', action: 'confirm', description: 'Confirm a draft sale' },
  { resource: 'sales', action: 'cancel', description: 'Cancel a draft sale' },
  {
    resource: 'sales',
    action: 'ship',
    description: 'Mark a confirmed sale as shipped (fulfillment tracking)',
  },
  {
    resource: 'sales',
    action: 'deliver',
    description: 'Mark a shipped sale as delivered (fulfillment tracking)',
  },
  {
    resource: 'sale_items',
    action: 'read',
    description: 'View sale line items',
  },
  // Phase 13 — Purchase (Purchase Order only)
  {
    resource: 'purchase_orders',
    action: 'read',
    description: 'View purchase orders',
  },
  {
    resource: 'purchase_requests',
    action: 'read',
    description: 'View purchase requests',
  },
  {
    resource: 'purchase_requests',
    action: 'create',
    description: 'Create purchase requests',
  },
  {
    resource: 'purchase_requests',
    action: 'confirm',
    description: 'Approve, reject, or convert a purchase request',
  },
  {
    resource: 'purchase_rfqs',
    action: 'read',
    description: 'View purchase RFQs',
  },
  {
    resource: 'purchase_rfqs',
    action: 'create',
    description: 'Create purchase RFQs',
  },
  {
    resource: 'purchase_rfqs',
    action: 'confirm',
    description: 'Send, close, or cancel purchase RFQs',
  },
  {
    resource: 'supplier_quotations',
    action: 'read',
    description: 'View supplier quotations',
  },
  {
    resource: 'supplier_quotations',
    action: 'create',
    description: 'Create supplier quotations',
  },
  {
    resource: 'supplier_quotations',
    action: 'confirm',
    description: 'Award or reject supplier quotations',
  },
  {
    resource: 'purchase_orders',
    action: 'create',
    description: 'Create purchase orders',
  },
  {
    resource: 'purchase_orders',
    action: 'confirm',
    description: 'Confirm a draft purchase order',
  },
  {
    resource: 'purchase_orders',
    action: 'cancel',
    description: 'Cancel a draft purchase order',
  },
  {
    resource: 'purchase_order_items',
    action: 'read',
    description: 'View purchase order line items',
  },
  {
    resource: 'purchase_invoices',
    action: 'read',
    description: 'View purchase invoices',
  },
  {
    resource: 'purchase_invoices',
    action: 'confirm',
    description: 'Post purchase invoices to accounts payable',
  },
  {
    resource: 'purchase_invoices',
    action: 'cancel',
    description: 'Void purchase invoices before or after posting',
  },
  {
    resource: 'purchase_returns',
    action: 'read',
    description: 'View purchase returns',
  },
  {
    resource: 'purchase_returns',
    action: 'create',
    description: 'Create purchase returns',
  },
  {
    resource: 'purchase_returns',
    action: 'confirm',
    description: 'Complete purchase returns and apply supplier credits',
  },
  {
    resource: 'purchase_returns',
    action: 'cancel',
    description: 'Cancel draft purchase returns',
  },
  // Phase 14 — Inventory (WarehouseStock/GoodsReceipt/StockTransfer/StockAdjustment)
  {
    resource: 'warehouse_stock',
    action: 'read',
    description: 'View warehouse stock balances',
  },
  {
    resource: 'goods_receipts',
    action: 'read',
    description: 'View goods receipts',
  },
  {
    resource: 'goods_receipts',
    action: 'create',
    description: 'Receive stock against a confirmed purchase order',
  },
  {
    resource: 'stock_transfers',
    action: 'read',
    description: 'View stock transfers',
  },
  {
    resource: 'stock_transfers',
    action: 'create',
    description: 'Transfer stock between warehouses',
  },
  {
    resource: 'stock_adjustments',
    action: 'read',
    description: 'View stock adjustments',
  },
  {
    resource: 'stock_adjustments',
    action: 'create',
    description: 'Create a manual stock adjustment (including opening balance)',
  },
  // Phase 15 — Inventory Ledger (read-only query layer over StockMovement)
  {
    resource: 'inventory_ledger',
    action: 'read',
    description:
      'View the inventory ledger (movement list, detail, stock card, reconciliation diagnostic)',
  },
  // Phase 16 — Payment. No .update/.delete/.refund/.reverse/.void/.export/
  // .summary/.reconcile — D13/D14, LOCKED (confirmed payments are
  // immutable, no update/delete endpoint of any kind exists). No
  // payments.confirm either — every Payment is created directly CONFIRMED
  // (D4 lifecycle decision, see docs/PAYMENT_ARCHITECTURE.md), so there is
  // no separate confirm step to gate.
  { resource: 'payments', action: 'read', description: 'View payments' },
  {
    resource: 'payments',
    action: 'create',
    description:
      'Create and confirm a payment (receipt or payment) with allocations',
  },
  {
    resource: 'payments',
    action: 'reverse',
    description: 'Reverse a confirmed payment and unwind its allocations',
  },
  {
    resource: 'payments',
    action: 'reallocate',
    description: 'Reallocate a confirmed payment across supplier invoices',
  },
  // PaymentMethod: read+create only, matching the locked minimal API
  // surface (D14) — no update/delete endpoint exists for PaymentMethod in
  // this phase.
  {
    resource: 'payment_methods',
    action: 'read',
    description: 'View payment methods',
  },
  {
    resource: 'payment_methods',
    action: 'create',
    description: 'Create a payment method',
  },
  // Phase 17 — Accounting / General Ledger. Exactly D14's locked list — no
  // .delete/.approve/.reject/.reverse/.void/general_ledger.write/etc. for
  // any of the four resources.
  {
    resource: 'accounts',
    action: 'read',
    description: 'View chart of accounts',
  },
  {
    resource: 'accounts',
    action: 'create',
    description: 'Create an account',
  },
  {
    resource: 'accounts',
    action: 'update',
    description: 'Update an account (including activate/deactivate)',
  },
  {
    resource: 'journal_entries',
    action: 'read',
    description: 'View journal entries',
  },
  {
    resource: 'journal_entries',
    action: 'create',
    description: 'Create a draft manual journal entry',
  },
  {
    resource: 'journal_entries',
    action: 'post',
    description: 'Post a draft journal entry (DRAFT -> POSTED)',
  },
  {
    resource: 'general_ledger',
    action: 'read',
    description:
      'View the general ledger (read-only query over posted journal lines)',
  },
  {
    resource: 'trial_balance',
    action: 'read',
    description:
      'View the trial balance (read-only query over posted journal lines)',
  },
  // Phase 21 — Notifications. Read + mark-as-read only — no
  // notifications.create (every row is created exclusively by
  // NotificationEventConsumer reacting to a Kafka event, never via the
  // API) and no notifications.delete (no delete endpoint exists).
  {
    resource: 'notifications',
    action: 'read',
    description: 'View notifications',
  },
  {
    resource: 'notifications',
    action: 'update',
    description: 'Mark a notification as read',
  },
  // Phase 22 — Reports/Dashboard. Every permission here backs a real
  // read-only endpoint this phase actually builds (zero-dead-permission
  // discipline, matching every prior phase). Trial Balance/General Ledger
  // are Phase 17's own permissions (trial_balance.read/general_ledger.read)
  // — not duplicated here, since this phase deliberately does not
  // duplicate those routes.
  {
    resource: 'reports',
    action: 'dashboard.read',
    description: 'View the reports dashboard summary',
  },
  {
    resource: 'reports',
    action: 'sales.read',
    description: 'View sales reports (summary/by-date/by-customer/by-branch)',
  },
  {
    resource: 'reports',
    action: 'purchases.read',
    description: 'View purchase reports (summary/by-date/by-supplier)',
  },
  {
    resource: 'reports',
    action: 'payments.read',
    description: 'View payment reports (by-date/by-direction/by-method)',
  },
  {
    resource: 'reports',
    action: 'inventory.read',
    description: 'View inventory reports (stock summary/movements)',
  },
  {
    resource: 'reports',
    action: 'balance_sheet.read',
    description: 'View the balance sheet report',
  },
  {
    resource: 'reports',
    action: 'profit_loss.read',
    description: 'View the profit & loss report',
  },
  {
    resource: 'reports',
    action: 'accounting_audit.read',
    description:
      'View the accounting audit log (journal entry/payment/sale/purchase order activity)',
  },
  {
    resource: 'reports',
    action: 'ar_ap.read',
    description: 'View the AR/AP aging report',
  },
  // Payroll / HR Advanced
  { resource: 'shifts', action: 'read', description: 'View shifts' },
  { resource: 'shifts', action: 'create', description: 'Create shifts' },
  {
    resource: 'shifts',
    action: 'update',
    description: 'Update shifts and manage employee shift assignments',
  },
  { resource: 'shifts', action: 'delete', description: 'Delete shifts' },
  {
    resource: 'employee_compensations',
    action: 'read',
    description: 'View employee compensation history',
  },
  {
    resource: 'employee_compensations',
    action: 'create',
    description: 'Create employee compensation records',
  },
  {
    resource: 'payroll_components',
    action: 'read',
    description: 'View payroll components',
  },
  {
    resource: 'payroll_components',
    action: 'create',
    description: 'Create payroll components',
  },
  {
    resource: 'payroll_components',
    action: 'update',
    description: 'Update payroll components',
  },
  {
    resource: 'payroll_components',
    action: 'delete',
    description: 'Delete payroll components',
  },
  {
    resource: 'employee_payroll_components',
    action: 'read',
    description: 'View employee payroll component assignments',
  },
  {
    resource: 'employee_payroll_components',
    action: 'create',
    description: 'Assign payroll components to employees',
  },
  {
    resource: 'payroll_configuration',
    action: 'read',
    description: 'View payroll configuration',
  },
  {
    resource: 'payroll_configuration',
    action: 'update',
    description: 'Update payroll configuration',
  },
  {
    resource: 'payroll_periods',
    action: 'read',
    description: 'View payroll periods',
  },
  {
    resource: 'payroll_periods',
    action: 'create',
    description: 'Create payroll periods',
  },
  {
    resource: 'payroll_periods',
    action: 'cancel',
    description: 'Cancel payroll periods',
  },
  {
    resource: 'payroll_runs',
    action: 'read',
    description: 'View payroll runs and payslips',
  },
  {
    resource: 'payroll_runs',
    action: 'create',
    description: 'Create payroll runs',
  },
  {
    resource: 'payroll_runs',
    action: 'calculate',
    description: 'Calculate a payroll run',
  },
  {
    resource: 'payroll_runs',
    action: 'finalize',
    description: 'Finalize a payroll run',
  },
  {
    resource: 'payroll_runs',
    action: 'cancel',
    description: 'Cancel a payroll run',
  },
  // Returns / Discounts / Loyalty
  {
    resource: 'sales_returns',
    action: 'read',
    description: 'View sales returns',
  },
  {
    resource: 'sales_returns',
    action: 'create',
    description: 'Create sales returns',
  },
  {
    resource: 'sales_returns',
    action: 'confirm',
    description:
      'Confirm a sales return (restocks inventory, reverses loyalty)',
  },
  {
    resource: 'sales_returns',
    action: 'cancel',
    description: 'Cancel a draft sales return',
  },
  // Online Orders (bot/online-placed orders — a document type wrapping a
  // Sale, see OnlineOrder's own docblock)
  {
    resource: 'online_orders',
    action: 'read',
    description: 'View bot/online-placed orders',
  },
  {
    resource: 'online_orders',
    action: 'update_status',
    description:
      'Move a bot/online-placed order through its delivery lifecycle (confirm/pack/ship/deliver/cancel)',
  },
  {
    resource: 'sales',
    action: 'discount.apply',
    description: 'Apply a manual discount or promotion code to a sale',
  },
  {
    resource: 'promotions',
    action: 'read',
    description: 'View promotions',
  },
  {
    resource: 'promotions',
    action: 'create',
    description: 'Create promotions',
  },
  {
    resource: 'promotions',
    action: 'update',
    description: 'Update promotions',
  },
  {
    resource: 'loyalty',
    action: 'read',
    description:
      'View loyalty program configuration, balances, and transaction history',
  },
  {
    resource: 'loyalty',
    action: 'manage',
    description: 'Configure the loyalty program',
  },
  {
    resource: 'loyalty',
    action: 'redeem',
    description: "Redeem a customer's loyalty points",
  },
  // Integrations / Webhooks
  {
    resource: 'webhooks',
    action: 'read',
    description: 'View webhook subscriptions and delivery history',
  },
  {
    resource: 'webhooks',
    action: 'create',
    description: 'Create webhook subscriptions',
  },
  {
    resource: 'webhooks',
    action: 'update',
    description:
      'Update, activate/deactivate, or test-deliver webhook subscriptions',
  },
  {
    resource: 'webhooks',
    action: 'delete',
    description: 'Delete webhook subscriptions',
  },
  // AI Assistant / RAG
  {
    resource: 'ai_assistant',
    action: 'chat',
    description: 'Use the AI assistant chat',
  },
  {
    resource: 'ai_assistant',
    action: 'conversations.read',
    description: "View the user's own AI conversation history",
  },
  {
    resource: 'ai_assistant',
    action: 'conversations.delete',
    description: "Delete the user's own AI conversations",
  },
  {
    resource: 'ai_knowledge',
    action: 'read',
    description: 'View AI knowledge-base documents',
  },
  {
    resource: 'ai_knowledge',
    action: 'create',
    description: 'Create AI knowledge-base documents',
  },
  {
    resource: 'ai_knowledge',
    action: 'delete',
    description: 'Delete AI knowledge-base documents',
  },
  {
    resource: 'ai_knowledge',
    action: 'ingest',
    description: 'Trigger re-ingestion of an AI knowledge-base document',
  },
  // Customer Portal (bot integration) — scoped to the CUSTOMER_SERVICE_BOT
  // and CUSTOMER_ORDER_BOT service-account roles only. See
  // create-bot-accounts.seed.ts.
  {
    resource: 'customer_portal',
    action: 'link',
    description:
      'Request/verify a Telegram-to-customer identity link (Customer Service Bot)',
  },
  {
    resource: 'customer_portal',
    action: 'order.create',
    description: 'Create a customer-initiated draft order (Customer Service Bot)',
  },
  {
    resource: 'customer_portal',
    action: 'profile',
    description:
      "Read/update the linked customer's own name/phone (Customer Service Bot)",
  },
  {
    resource: 'customer_portal',
    action: 'notify_lookup',
    description:
      "Resolve a customer's linked Telegram user id for order-status notifications (Customer Order Bot)",
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
  // Phase 07 — Organization
  'companies',
  'branches',
  'warehouses',
  'categories',
  'brands',
  'collections',
  'attribute_options',
  'uoms',
  'products',
  'product_variants',
  'product_variant_uoms',
  'barcodes',
  'price_lists',
  'price_list_items',
  // Phase 11 — Customer / Supplier
  'customers',
  'suppliers',
  'customer_groups',
  'supplier_groups',
  'payment_terms',
  'customer_addresses',
  'supplier_addresses',
  'customer_contacts',
  'supplier_contacts',
  // Phase 12 — Sales
  'sales',
  'sale_items',
  // Phase 13 — Purchase
  'purchase_requests',
  'purchase_rfqs',
  'supplier_quotations',
  'purchase_orders',
  'purchase_order_items',
  'purchase_invoices',
  'purchase_returns',
  // Phase 14 — Inventory
  'warehouse_stock',
  'goods_receipts',
  'stock_transfers',
  'stock_adjustments',
  // Phase 15 — Inventory Ledger
  'inventory_ledger',
  // Phase 16 — Payment
  'payments',
  'payment_methods',
  // Phase 17 — Accounting / General Ledger
  'accounts',
  'journal_entries',
  'general_ledger',
  'trial_balance',
  // Phase 21 — Notifications
  'notifications',
  // Phase 22 — Reports/Dashboard
  'reports',
  'employees',
  'departments',
  'designations',
  'employee_assignments',
  'leave_types',
  'leave_requests',
  'attendance',
  'settings_system',
  'settings_company',
  'settings_branch',
  'settings_user',
  // Payroll / HR Advanced
  'shifts',
  'employee_compensations',
  'payroll_components',
  'employee_payroll_components',
  'payroll_configuration',
  'payroll_periods',
  'payroll_runs',
  // Returns / Discounts / Loyalty
  'sales_returns',
  'online_orders',
  'promotions',
  'loyalty',
  'webhooks',
  // AI Assistant / RAG
  'ai_assistant',
  'ai_knowledge',
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
      logger.log(`Created permission: ${code}`);
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
    logger.log('Created role: SUPER_ADMIN');
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
      logger.log(`Granted ${permission.code} to SUPER_ADMIN`);
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
      logger.log(`Granted ALL scope for ${resource} to SUPER_ADMIN`);
    }
  }

  await AppDataSource.destroy();
  logger.log('RBAC seed complete.');
}

seed().catch((error: unknown) => {
  logScriptFailure('RBAC seed failed', error, logger);
  process.exit(1);
});
