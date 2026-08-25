import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JournalEntry } from '../accounting/entities/journal-entry.entity';
import { JournalEntryLine } from '../accounting/entities/journal-entry-line.entity';
import { Customer } from '../customer-supplier/entities/customer.entity';
import { Supplier } from '../customer-supplier/entities/supplier.entity';
import { Sale } from '../sales/entities/sale.entity';
import { SaleItem } from '../sales/entities/sale-item.entity';
import { PurchaseOrder } from '../purchase/entities/purchase-order.entity';
import { Payment } from '../payments/entities/payment.entity';
import { WarehouseStock } from '../inventory/entities/warehouse-stock.entity';
import { StockMovement } from '../inventory/entities/stock-movement.entity';
import { BalanceSheetService } from './services/balance-sheet.service';
import { ProfitLossService } from './services/profit-loss.service';
import { ArApAgingService } from './services/ar-ap-aging.service';
import { SalesReportsService } from './services/sales-reports.service';
import { PurchaseReportsService } from './services/purchase-reports.service';
import { PaymentReportsService } from './services/payment-reports.service';
import { InventoryReportsService } from './services/inventory-reports.service';
import { DashboardService } from './services/dashboard.service';
import { AccountingAuditLogService } from './services/accounting-audit-log.service';
import { BalanceSheetController } from './controllers/balance-sheet.controller';
import { ProfitLossController } from './controllers/profit-loss.controller';
import { ArApAgingController } from './controllers/ar-ap-aging.controller';
import { SalesReportsController } from './controllers/sales-reports.controller';
import { PurchaseReportsController } from './controllers/purchase-reports.controller';
import { PaymentReportsController } from './controllers/payment-reports.controller';
import { InventoryReportsController } from './controllers/inventory-reports.controller';
import { DashboardController } from './controllers/dashboard.controller';
import { AccountingAuditLogController } from './controllers/accounting-audit-log.controller';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { AccountingModule } from '../accounting/accounting.module';

/**
 * Phase 22 — Reports/Dashboard. A single flat module registering every new
 * report entity's repository (JournalEntry/JournalEntryLine/Customer/
 * Supplier/Sale/PurchaseOrder/Payment/WarehouseStock/StockMovement — all
 * already registered as entities elsewhere; TypeOrmModule.forFeature() here
 * just grants THIS module's services their own repository injection,
 * mirroring how every other cross-cutting module in this codebase
 * re-declares forFeature() for entities it reads rather than owns).
 *
 * Phase 15 adds AccountingAuditLogController/Service — a read projection
 * over JournalEntry/Payment/Sale/PurchaseOrder's existing createdBy/
 * createdAt/postedBy/postedAt/status columns, not a new audit-logging
 * table or write path (see AccountingAuditLogService's own docblock).
 *
 * Trial Balance and General Ledger already exist as Phase 17's own
 * GET /trial-balance and GET /general-ledger endpoints — deliberately NOT
 * duplicated here as reports/* routes (this project's own "do not create
 * duplicate routes if equivalent controllers already exist" instruction).
 * DashboardService imports AccountingModule to reuse TrialBalanceService
 * directly rather than re-deriving its query.
 *
 * No new business-table writes anywhere in this module — every service is
 * a pure read-query composition, matching GeneralLedgerService/
 * TrialBalanceService's own "never a physical report table" contract.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      JournalEntry,
      JournalEntryLine,
      Customer,
      Supplier,
      Sale,
      SaleItem,
      PurchaseOrder,
      Payment,
      WarehouseStock,
      StockMovement,
    ]),
    AuthModule,
    RbacModule,
    AccountingModule,
  ],
  controllers: [
    BalanceSheetController,
    ProfitLossController,
    ArApAgingController,
    SalesReportsController,
    PurchaseReportsController,
    PaymentReportsController,
    InventoryReportsController,
    DashboardController,
    AccountingAuditLogController,
  ],
  providers: [
    BalanceSheetService,
    ProfitLossService,
    ArApAgingService,
    SalesReportsService,
    PurchaseReportsService,
    PaymentReportsService,
    InventoryReportsService,
    DashboardService,
    AccountingAuditLogService,
  ],
  // Exported so AiAssistantModule (Phase 19) can wrap these same real,
  // already-correct report queries as AI tools rather than duplicating
  // their query logic — see each *.tool.ts file's own docblock.
  exports: [
    BalanceSheetService,
    ProfitLossService,
    ArApAgingService,
    SalesReportsService,
    InventoryReportsService,
  ],
})
export class ReportsModule {}
