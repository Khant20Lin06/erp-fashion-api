import { DataSourceOptions } from 'typeorm';
import { DatabaseConfig } from '../config/database.config';
import { User } from '../modules/users/entities/user.entity';
import { PasswordResetToken } from '../modules/users/entities/password-reset-token.entity';
import { RefreshSession } from '../modules/auth/entities/refresh-session.entity';
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
import { ProductVariantUom } from '../modules/products/entities/product-variant-uom.entity';
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
import { CustomerNote } from '../modules/customer-supplier/entities/customer-note.entity';
import { SupplierContact } from '../modules/customer-supplier/entities/supplier-contact.entity';
import { Sale } from '../modules/sales/entities/sale.entity';
import { SaleItem } from '../modules/sales/entities/sale-item.entity';
import { PosShift } from '../modules/sales/entities/pos-shift.entity';
import { CompanySaleCounter } from '../modules/sales/entities/company-sale-counter.entity';
import { PurchaseOrder } from '../modules/purchase/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../modules/purchase/entities/purchase-order-item.entity';
import { CompanyPurchaseCounter } from '../modules/purchase/entities/company-purchase-counter.entity';
import { CompanyPurchaseRequestCounter } from '../modules/purchase/entities/company-purchase-request-counter.entity';
import { CompanyPurchaseReturnCounter } from '../modules/purchase/entities/company-purchase-return-counter.entity';
import { CompanyPurchaseRfqCounter } from '../modules/purchase/entities/company-purchase-rfq-counter.entity';
import { CompanySupplierQuotationCounter } from '../modules/purchase/entities/company-supplier-quotation-counter.entity';
import { PurchaseRequest } from '../modules/purchase/entities/purchase-request.entity';
import { PurchaseRequestItem } from '../modules/purchase/entities/purchase-request-item.entity';
import { PurchaseInvoice } from '../modules/purchase/entities/purchase-invoice.entity';
import { PurchaseReturn } from '../modules/purchase/entities/purchase-return.entity';
import { PurchaseReturnItem } from '../modules/purchase/entities/purchase-return-item.entity';
import { PurchaseRfq } from '../modules/purchase/entities/purchase-rfq.entity';
import { PurchaseRfqItem } from '../modules/purchase/entities/purchase-rfq-item.entity';
import { SupplierQuotation } from '../modules/purchase/entities/supplier-quotation.entity';
import { SupplierQuotationItem } from '../modules/purchase/entities/supplier-quotation-item.entity';
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
import { Department } from '../modules/hr/entities/department.entity';
import { Designation } from '../modules/hr/entities/designation.entity';
import { EmployeeAssignment } from '../modules/hr/entities/employee-assignment.entity';
import { AttendanceRecord } from '../modules/hr/entities/attendance-record.entity';
import { LeaveType } from '../modules/hr/entities/leave-type.entity';
import { LeaveRequest } from '../modules/hr/entities/leave-request.entity';
import { SettingDefinition } from '../modules/settings/entities/setting-definition.entity';
import { SettingValue } from '../modules/settings/entities/setting-value.entity';
import { Shift } from '../modules/payroll/entities/shift.entity';
import { EmployeeShiftAssignment } from '../modules/payroll/entities/employee-shift-assignment.entity';
import { EmployeeCompensation } from '../modules/payroll/entities/employee-compensation.entity';
import { PayrollComponent } from '../modules/payroll/entities/payroll-component.entity';
import { EmployeePayrollComponent } from '../modules/payroll/entities/employee-payroll-component.entity';
import { PayrollConfiguration } from '../modules/payroll/entities/payroll-configuration.entity';
import { PayrollPeriod } from '../modules/payroll/entities/payroll-period.entity';
import { CompanyPayrollPeriodCounter } from '../modules/payroll/entities/company-payroll-period-counter.entity';
import { PayrollRun } from '../modules/payroll/entities/payroll-run.entity';
import { CompanyPayrollRunCounter } from '../modules/payroll/entities/company-payroll-run-counter.entity';
import { PayrollRunEmployee } from '../modules/payroll/entities/payroll-run-employee.entity';
import { PayrollRunEmployeeItem } from '../modules/payroll/entities/payroll-run-employee-item.entity';
import { Promotion } from '../modules/promotions/entities/promotion.entity';
import { LoyaltyProgram } from '../modules/loyalty/entities/loyalty-program.entity';
import { LoyaltyPointTransaction } from '../modules/loyalty/entities/loyalty-point-transaction.entity';
import { SaleReturn } from '../modules/sales-returns/entities/sale-return.entity';
import { SaleReturnItem } from '../modules/sales-returns/entities/sale-return-item.entity';
import { CompanySaleReturnCounter } from '../modules/sales-returns/entities/company-sale-return-counter.entity';
import { WebhookSubscription } from '../modules/webhooks/entities/webhook-subscription.entity';
import { WebhookDelivery } from '../modules/webhooks/entities/webhook-delivery.entity';
import { AiConversation } from '../modules/ai-assistant/entities/ai-conversation.entity';
import { AiMessage } from '../modules/ai-assistant/entities/ai-message.entity';
import { AiKnowledgeDocument } from '../modules/ai-assistant/entities/ai-knowledge-document.entity';
import { AiKnowledgeChunk } from '../modules/ai-assistant/entities/ai-knowledge-chunk.entity';
import { AiToolAuditLog } from '../modules/ai-assistant/entities/ai-tool-audit-log.entity';
import { Uom } from '../modules/uom/entities/uom.entity';

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
  RefreshSession,
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
  ProductVariantUom,
  PriceList,
  PriceListItem,
  Uom,
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
  CompanyPurchaseRequestCounter,
  CompanyPurchaseReturnCounter,
  CompanyPurchaseRfqCounter,
  CompanySupplierQuotationCounter,
  PurchaseRequest,
  PurchaseRequestItem,
  PurchaseInvoice,
  PurchaseReturn,
  PurchaseReturnItem,
  PurchaseRfq,
  PurchaseRfqItem,
  SupplierQuotation,
  SupplierQuotationItem,
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
  Department,
  Designation,
  EmployeeAssignment,
  AttendanceRecord,
  LeaveType,
  LeaveRequest,
  SettingDefinition,
  SettingValue,
  Shift,
  EmployeeShiftAssignment,
  EmployeeCompensation,
  PayrollComponent,
  EmployeePayrollComponent,
  PayrollConfiguration,
  PayrollPeriod,
  CompanyPayrollPeriodCounter,
  PayrollRun,
  CompanyPayrollRunCounter,
  PayrollRunEmployee,
  PayrollRunEmployeeItem,
  Promotion,
  LoyaltyProgram,
  LoyaltyPointTransaction,
  SaleReturn,
  SaleReturnItem,
  CompanySaleReturnCounter,
  WebhookSubscription,
  WebhookDelivery,
  AiConversation,
  AiMessage,
  AiKnowledgeDocument,
  AiKnowledgeChunk,
  AiToolAuditLog,
  CustomerNote,
  PosShift,
];

export function buildDataSourceOptions(
  config: DatabaseConfig,
): DataSourceOptions {
  return {
    type: 'mysql',
    url: config.url,
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
    extra: {
      connectTimeout: config.connectTimeoutMs ?? 10000,
    },
    entities,
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    migrationsTableName: 'migrations',
  };
}
