import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WarehouseStock } from './entities/warehouse-stock.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { GoodsReceipt } from './entities/goods-receipt.entity';
import { GoodsReceiptItem } from './entities/goods-receipt-item.entity';
import { CompanyGoodsReceiptCounter } from './entities/company-goods-receipt-counter.entity';
import { StockTransfer } from './entities/stock-transfer.entity';
import { StockTransferItem } from './entities/stock-transfer-item.entity';
import { CompanyStockTransferCounter } from './entities/company-stock-transfer-counter.entity';
import { StockAdjustment } from './entities/stock-adjustment.entity';
import { CompanyStockAdjustmentCounter } from './entities/company-stock-adjustment-counter.entity';
import { BranchTransfer } from './entities/branch-transfer.entity';
import { BranchTransferItem } from './entities/branch-transfer-item.entity';
import { WarehouseStockService } from './services/warehouse-stock.service';
import { GoodsReceiptsService } from './services/goods-receipts.service';
import { StockTransfersService } from './services/stock-transfers.service';
import { BranchTransfersService } from './services/branch-transfers.service';
import { StockAdjustmentsService } from './services/stock-adjustments.service';
import { InventoryLedgerService } from './services/inventory-ledger.service';
import { WarehouseStockController } from './controllers/warehouse-stock.controller';
import { GoodsReceiptsController } from './controllers/goods-receipts.controller';
import { StockTransfersController } from './controllers/stock-transfers.controller';
import { BranchTransfersController } from './controllers/branch-transfers.controller';
import { StockAdjustmentsController } from './controllers/stock-adjustments.controller';
import { InventoryLedgerController } from './controllers/inventory-ledger.controller';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { OrganizationModule } from '../organization/organization.module';
import { ProductsModule } from '../products/products.module';
import { Warehouse } from '../organization/entities/warehouse.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { ProductVariantAttribute } from '../products/entities/product-variant-attribute.entity';
import { User } from '../users/entities/user.entity';
import { Sale } from '../sales/entities/sale.entity';
import { SaleReturn } from '../sales-returns/entities/sale-return.entity';
import { PurchaseReturn } from '../purchase/entities/purchase-return.entity';

/**
 * Phase 14 — Inventory. A single flat module directory
 * (`src/modules/inventory/`), consistent with Phase 12/13's own module
 * shape. Depends on OrganizationModule (Warehouse), ProductsModule
 * (ProductVariant) — every dependency reused, none duplicated. Does NOT
 * import PurchaseModule/SalesModule — GoodsReceiptsService reads
 * PurchaseOrder/PurchaseOrderItem directly via the transactional
 * EntityManager (the same "reference the entity, not the module's
 * service" pattern already used for ProductVariant inside
 * SalesService/PurchaseOrdersService's own transactions) to avoid a
 * circular module dependency, since PurchaseModule will in turn need to
 * reference GoodsReceipt for the cancel() guard.
 *
 * Phase 15 — Inventory Ledger addition (additive only): InventoryLedgerService/
 * InventoryLedgerController were added to this same module — no new entity,
 * no new TypeOrmModule.forFeature() registration, since Phase 15 only reads
 * the StockMovement/WarehouseStock entities Phase 14 already registered
 * above. See docs/INVENTORY_ARCHITECTURE.md §17.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
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
      BranchTransfer,
      BranchTransferItem,
      Warehouse,
      ProductVariant,
      ProductVariantAttribute,
      User,
      Sale,
      SaleReturn,
      PurchaseReturn,
    ]),
    AuthModule,
    RbacModule,
    OrganizationModule,
    ProductsModule,
  ],
  controllers: [
    WarehouseStockController,
    GoodsReceiptsController,
    StockTransfersController,
    BranchTransfersController,
    StockAdjustmentsController,
    InventoryLedgerController,
  ],
  providers: [
    WarehouseStockService,
    GoodsReceiptsService,
    StockTransfersService,
    BranchTransfersService,
    StockAdjustmentsService,
    InventoryLedgerService,
  ],
  exports: [
    WarehouseStockService,
    GoodsReceiptsService,
    StockTransfersService,
    BranchTransfersService,
    StockAdjustmentsService,
    InventoryLedgerService,
  ],
})
export class InventoryModule {}
