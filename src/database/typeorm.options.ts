import { DataSourceOptions } from 'typeorm';
import { DatabaseConfig } from '../config/database.config';
import { User } from '../modules/users/entities/user.entity';
import { PasswordResetToken } from '../modules/users/entities/password-reset-token.entity';
import { Role } from '../modules/rbac/entities/role.entity';
import { Permission } from '../modules/rbac/entities/permission.entity';
import { RolePermission } from '../modules/rbac/entities/role-permission.entity';
import { UserRole } from '../modules/rbac/entities/user-role.entity';
import { RoleResourceScope } from '../modules/rbac/entities/role-resource-scope.entity';
import { Company } from '../modules/organization/entities/company.entity';
import { Branch } from '../modules/organization/entities/branch.entity';
import { Warehouse } from '../modules/organization/entities/warehouse.entity';
import { UserCompany } from '../modules/organization/entities/user-company.entity';
import { UserBranch } from '../modules/organization/entities/user-branch.entity';
import { UserWarehouse } from '../modules/organization/entities/user-warehouse.entity';
import { Employee } from '../modules/employees/entities/employee.entity';
import { SalesAccount } from '../modules/sales-accounts/entities/sales-account.entity';
import { SalesAccountAssignment } from '../modules/sales-accounts/entities/sales-account-assignment.entity';
import { Category } from '../modules/master-data/entities/category.entity';
import { Brand } from '../modules/master-data/entities/brand.entity';
import { Collection } from '../modules/master-data/entities/collection.entity';
import { AttributeOption } from '../modules/master-data/entities/attribute-option.entity';
import { Product } from '../modules/products/entities/product.entity';
import { ProductVariant } from '../modules/products/entities/product-variant.entity';
import { ProductVariantAttribute } from '../modules/products/entities/product-variant-attribute.entity';
import { ProductVariantBarcode } from '../modules/products/entities/product-variant-barcode.entity';
import { PriceList } from '../modules/products/entities/price-list.entity';
import { PriceListItem } from '../modules/products/entities/price-list-item.entity';
import { Customer } from '../modules/customer-supplier/entities/customer.entity';
import { Supplier } from '../modules/customer-supplier/entities/supplier.entity';
import { CustomerGroup } from '../modules/customer-supplier/entities/customer-group.entity';
import { SupplierGroup } from '../modules/customer-supplier/entities/supplier-group.entity';
import { PaymentTerm } from '../modules/customer-supplier/entities/payment-term.entity';
import { CustomerAddress } from '../modules/customer-supplier/entities/customer-address.entity';
import { SupplierAddress } from '../modules/customer-supplier/entities/supplier-address.entity';
import { CustomerContact } from '../modules/customer-supplier/entities/customer-contact.entity';
import { SupplierContact } from '../modules/customer-supplier/entities/supplier-contact.entity';
import { Sale } from '../modules/sales/entities/sale.entity';
import { SaleItem } from '../modules/sales/entities/sale-item.entity';
import { CompanySaleCounter } from '../modules/sales/entities/company-sale-counter.entity';
import { PurchaseOrder } from '../modules/purchase/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../modules/purchase/entities/purchase-order-item.entity';
import { CompanyPurchaseCounter } from '../modules/purchase/entities/company-purchase-counter.entity';
import { WarehouseStock } from '../modules/inventory/entities/warehouse-stock.entity';
import { StockMovement } from '../modules/inventory/entities/stock-movement.entity';
import { GoodsReceipt } from '../modules/inventory/entities/goods-receipt.entity';
import { GoodsReceiptItem } from '../modules/inventory/entities/goods-receipt-item.entity';
import { CompanyGoodsReceiptCounter } from '../modules/inventory/entities/company-goods-receipt-counter.entity';
import { StockTransfer } from '../modules/inventory/entities/stock-transfer.entity';
import { StockTransferItem } from '../modules/inventory/entities/stock-transfer-item.entity';
import { CompanyStockTransferCounter } from '../modules/inventory/entities/company-stock-transfer-counter.entity';
import { StockAdjustment } from '../modules/inventory/entities/stock-adjustment.entity';
import { CompanyStockAdjustmentCounter } from '../modules/inventory/entities/company-stock-adjustment-counter.entity';
import { Payment } from '../modules/payments/entities/payment.entity';
import { PaymentAllocation } from '../modules/payments/entities/payment-allocation.entity';
import { PaymentMethod } from '../modules/payments/entities/payment-method.entity';
import { CompanyPaymentCounter } from '../modules/payments/entities/company-payment-counter.entity';
import { Account } from '../modules/accounting/entities/account.entity';
import { CompanyJournalCounter } from '../modules/accounting/entities/company-journal-counter.entity';
import { FiscalYear } from '../modules/accounting/entities/fiscal-year.entity';
import { AccountingPeriod } from '../modules/accounting/entities/accounting-period.entity';
import { JournalEntry } from '../modules/accounting/entities/journal-entry.entity';
import { JournalEntryLine } from '../modules/accounting/entities/journal-entry-line.entity';
import { OutboxEvent } from '../modules/outbox/entities/outbox-event.entity';
import { ProcessedEvent } from '../modules/outbox/entities/processed-event.entity';
import { Notification } from '../modules/notifications/entities/notification.entity';

/**
 * Entities are imported explicitly rather than discovered via a glob.
 * A glob such as `__dirname + '/../**\/*.entity{.ts,.js}'` matches both the
 * bind-mounted TypeScript sources and the compiled dist/ output at once in
 * the Docker development container (nest start --watch runs from dist/ while
 * src/ is also present on disk), loading each entity class twice and
 * producing `EntityMetadataNotFoundError` for repositories injected via the
 * DI-registered (dist/) class identity.
 */
const entities = [
  User,
  PasswordResetToken,
  Role,
  Permission,
  RolePermission,
  UserRole,
  RoleResourceScope,
  Company,
  Branch,
  Warehouse,
  UserCompany,
  UserBranch,
  UserWarehouse,
  Employee,
  SalesAccount,
  SalesAccountAssignment,
  Category,
  Brand,
  Collection,
  AttributeOption,
  Product,
  ProductVariant,
  ProductVariantAttribute,
  ProductVariantBarcode,
  PriceList,
  PriceListItem,
  Customer,
  Supplier,
  CustomerGroup,
  SupplierGroup,
  PaymentTerm,
  CustomerAddress,
  SupplierAddress,
  CustomerContact,
  SupplierContact,
  Sale,
  SaleItem,
  CompanySaleCounter,
  PurchaseOrder,
  PurchaseOrderItem,
  CompanyPurchaseCounter,
  WarehouseStock,
  StockMovement,
  GoodsReceipt,
  GoodsReceiptItem,
  CompanyGoodsReceiptCounter,
  StockTransfer,
  StockTransferItem,
  CompanyStockTransferCounter,
  StockAdjustment,
  CompanyStockAdjustmentCounter,
  Payment,
  PaymentAllocation,
  PaymentMethod,
  CompanyPaymentCounter,
  Account,
  CompanyJournalCounter,
  FiscalYear,
  AccountingPeriod,
  JournalEntry,
  JournalEntryLine,
  OutboxEvent,
  ProcessedEvent,
  Notification,
];

export function buildDataSourceOptions(
  config: DatabaseConfig,
): DataSourceOptions {
  return {
    type: 'mysql',
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    database: config.database,
    charset: 'utf8mb4_unicode_ci',
    // Phase 18 fix: mysql2 (the underlying driver) converts JS `Date`
    // objects to/from SQL DATETIME/TIMESTAMP literals using the Node
    // process's OWN local timezone by default (e.g. Asia/Bangkok, UTC+7 in
    // this environment), NOT the MySQL server's timezone (this server runs
    // UTC — confirmed via `SELECT NOW(), @@global.time_zone` returning
    // SYSTEM/UTC in this stack's docker-compose mysql service). Without
    // `timezone: 'Z'`, a query parameter built from `new Date()` gets
    // serialized 7 hours ahead of the server's own `NOW()`, so any WHERE
    // clause comparing a JS-Date-bound parameter against `NOW()` or a
    // column written from another JS Date silently miscompares by that
    // offset. No prior phase (1-17) ever compared a JS Date against
    // MySQL's own NOW()/CURRENT_TIMESTAMP in a query predicate — every
    // prior use was either a straight column read/write (self-consistent
    // even with the bug, since both sides shift the same way) or handled
    // by MySQL's own DEFAULT CURRENT_TIMESTAMP. OutboxPublisherService's
    // claim query (`availableAt <= NOW()`) is the first code in this
    // codebase to mix a JS-Date-bound parameter with a server-evaluated
    // NOW() in one comparison, which is what surfaced this. `timezone: 'Z'`
    // makes mysql2 treat every Date <-> SQL conversion as UTC, matching the
    // server's actual UTC clock exactly — an additive correctness fix, not
    // a behavior change to any already-correct prior-phase logic.
    timezone: 'Z',
    synchronize: false,
    logging: config.logging,
    poolSize: config.poolSize,
    entities,
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    migrationsTableName: 'migrations',
  };
}
