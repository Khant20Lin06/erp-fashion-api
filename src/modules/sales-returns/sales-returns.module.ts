import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { OrganizationModule } from '../organization/organization.module';
import { TransactionModule } from '../../core/transaction/transaction.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { Sale } from '../sales/entities/sale.entity';
import { SaleItem } from '../sales/entities/sale-item.entity';
import { SaleReturn } from './entities/sale-return.entity';
import { SaleReturnItem } from './entities/sale-return-item.entity';
import { CompanySaleReturnCounter } from './entities/company-sale-return-counter.entity';
import { SaleReturnsService } from './services/sale-returns.service';
import { SaleReturnsController } from './controllers/sale-returns.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sale,
      SaleItem,
      SaleReturn,
      SaleReturnItem,
      CompanySaleReturnCounter,
    ]),
    AuthModule,
    RbacModule,
    OrganizationModule,
    TransactionModule,
    LoyaltyModule,
  ],
  providers: [SaleReturnsService],
  controllers: [SaleReturnsController],
  exports: [SaleReturnsService, TypeOrmModule],
})
export class SalesReturnsModule {}
