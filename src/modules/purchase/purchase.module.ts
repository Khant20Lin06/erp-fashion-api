import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { CompanyPurchaseCounter } from './entities/company-purchase-counter.entity';
import { GoodsReceipt } from '../inventory/entities/goods-receipt.entity';
import { PurchaseOrdersService } from './services/purchase-orders.service';
import { PurchaseOrdersController } from './controllers/purchase-orders.controller';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { OrganizationModule } from '../organization/organization.module';
import { CustomerSupplierModule } from '../customer-supplier/customer-supplier.module';
import { ProductsModule } from '../products/products.module';

/**
 * Phase 13 — Purchase (Purchase Order only). A single flat module
 * directory (`src/modules/purchase/`), consistent with Phase 12 (Sales)'s
 * own module shape. Depends on OrganizationModule (Company/Branch/
 * Warehouse), CustomerSupplierModule (Supplier/PaymentTerm), and
 * ProductsModule (ProductVariant) — every dependency reused, none
 * duplicated. Deliberately does NOT depend on SalesAccountsModule — Phase
 * 13 has no buyer/purchaser/requester attribution concept (Decision #9,
 * LOCKED), keeping Purchase fully independent of SalesAccount.
 *
 * Phase 14 addition: `GoodsReceipt` is registered here too (repository
 * only, not the whole InventoryModule, avoiding a circular module
 * dependency) so `PurchaseOrdersService.cancel()` can check whether any
 * GoodsReceipt already exists against the target PurchaseOrder before
 * allowing cancellation (Phase 14 locked decision, additive to Phase 13's
 * own lifecycle — see docs/INVENTORY_ARCHITECTURE.md).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PurchaseOrder,
      PurchaseOrderItem,
      CompanyPurchaseCounter,
      GoodsReceipt,
    ]),
    AuthModule,
    RbacModule,
    OrganizationModule,
    CustomerSupplierModule,
    ProductsModule,
  ],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService],
  exports: [PurchaseOrdersService],
})
export class PurchaseModule {}
