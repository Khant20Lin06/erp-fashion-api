import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { CompanyPurchaseCounter } from './entities/company-purchase-counter.entity';
import { CompanyPurchaseRequestCounter } from './entities/company-purchase-request-counter.entity';
import { CompanyPurchaseReturnCounter } from './entities/company-purchase-return-counter.entity';
import { CompanyPurchaseRfqCounter } from './entities/company-purchase-rfq-counter.entity';
import { CompanySupplierQuotationCounter } from './entities/company-supplier-quotation-counter.entity';
import { PurchaseRequest } from './entities/purchase-request.entity';
import { PurchaseRequestItem } from './entities/purchase-request-item.entity';
import { PurchaseInvoice } from './entities/purchase-invoice.entity';
import { PurchaseReturn } from './entities/purchase-return.entity';
import { PurchaseReturnItem } from './entities/purchase-return-item.entity';
import { PurchaseRfq } from './entities/purchase-rfq.entity';
import { PurchaseRfqItem } from './entities/purchase-rfq-item.entity';
import { SupplierQuotation } from './entities/supplier-quotation.entity';
import { SupplierQuotationItem } from './entities/supplier-quotation-item.entity';
import { GoodsReceipt } from '../inventory/entities/goods-receipt.entity';
import { GoodsReceiptItem } from '../inventory/entities/goods-receipt-item.entity';
import { WarehouseStock } from '../inventory/entities/warehouse-stock.entity';
import { StockMovement } from '../inventory/entities/stock-movement.entity';
import { Supplier } from '../customer-supplier/entities/supplier.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { PurchaseOrdersService } from './services/purchase-orders.service';
import { PurchaseRequestsService } from './services/purchase-requests.service';
import { PurchaseInvoicesService } from './services/purchase-invoices.service';
import { PurchaseReturnsService } from './services/purchase-returns.service';
import { PurchaseRfqsService } from './services/purchase-rfqs.service';
import { SupplierQuotationsService } from './services/supplier-quotations.service';
import { PurchaseOrdersController } from './controllers/purchase-orders.controller';
import { PurchaseRequestsController } from './controllers/purchase-requests.controller';
import { PurchaseInvoicesController } from './controllers/purchase-invoices.controller';
import { PurchaseReturnsController } from './controllers/purchase-returns.controller';
import { PurchaseRfqsController } from './controllers/purchase-rfqs.controller';
import { SupplierQuotationsController } from './controllers/supplier-quotations.controller';
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
      GoodsReceipt,
      GoodsReceiptItem,
      WarehouseStock,
      StockMovement,
      Supplier,
      ProductVariant,
    ]),
    AuthModule,
    RbacModule,
    OrganizationModule,
    CustomerSupplierModule,
    ProductsModule,
  ],
  controllers: [
    PurchaseOrdersController,
    PurchaseRequestsController,
    PurchaseInvoicesController,
    PurchaseReturnsController,
    PurchaseRfqsController,
    SupplierQuotationsController,
  ],
  providers: [
    PurchaseOrdersService,
    PurchaseRequestsService,
    PurchaseInvoicesService,
    PurchaseReturnsService,
    PurchaseRfqsService,
    SupplierQuotationsService,
  ],
  exports: [
    PurchaseOrdersService,
    PurchaseRequestsService,
    PurchaseInvoicesService,
    PurchaseReturnsService,
    PurchaseRfqsService,
    SupplierQuotationsService,
  ],
})
export class PurchaseModule {}
