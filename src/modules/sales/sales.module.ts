import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sale } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';
import { CompanySaleCounter } from './entities/company-sale-counter.entity';
import { SalesService } from './services/sales.service';
import { SalesController } from './controllers/sales.controller';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { OrganizationModule } from '../organization/organization.module';
import { CustomerSupplierModule } from '../customer-supplier/customer-supplier.module';
import { ProductsModule } from '../products/products.module';
import { SalesAccountsModule } from '../sales-accounts/sales-accounts.module';

/**
 * Phase 12 — Sales. A single flat module directory
 * (`src/modules/sales/`), consistent with Phase 09/10/11's own module
 * shape. Depends on OrganizationModule (Company/Branch/Warehouse),
 * CustomerSupplierModule (Customer), ProductsModule (ProductVariant/
 * PriceList/PriceListItem), and SalesAccountsModule
 * (SalesAccountAccessService) — every dependency reused, none duplicated,
 * per the locked decisions.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Sale, SaleItem, CompanySaleCounter]),
    AuthModule,
    RbacModule,
    OrganizationModule,
    CustomerSupplierModule,
    ProductsModule,
    SalesAccountsModule,
  ],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
