import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sale } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';
import { CompanySaleCounter } from './entities/company-sale-counter.entity';
import { PosShift } from './entities/pos-shift.entity';
import { Payment } from '../payments/entities/payment.entity';
import { SalesService } from './services/sales.service';
import { PosShiftsService } from './services/pos-shifts.service';
import { SalesController } from './controllers/sales.controller';
import { PosShiftsController } from './controllers/pos-shifts.controller';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { OrganizationModule } from '../organization/organization.module';
import { CustomerSupplierModule } from '../customer-supplier/customer-supplier.module';
import { ProductsModule } from '../products/products.module';
import { SalesAccountsModule } from '../sales-accounts/sales-accounts.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { PromotionsModule } from '../promotions/promotions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sale,
      SaleItem,
      CompanySaleCounter,
      PosShift,
      Payment,
    ]),
    AuthModule,
    RbacModule,
    OrganizationModule,
    CustomerSupplierModule,
    ProductsModule,
    SalesAccountsModule,
    LoyaltyModule,
    PromotionsModule,
  ],
  controllers: [SalesController, PosShiftsController],
  providers: [SalesService, PosShiftsService],
  exports: [SalesService, PosShiftsService],
})
export class SalesModule {}
