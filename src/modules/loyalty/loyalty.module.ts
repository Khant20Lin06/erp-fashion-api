import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { OrganizationModule } from '../organization/organization.module';
import { CustomerSupplierModule } from '../customer-supplier/customer-supplier.module';
import { TransactionModule } from '../../core/transaction/transaction.module';
import { LoyaltyProgram } from './entities/loyalty-program.entity';
import { LoyaltyPointTransaction } from './entities/loyalty-point-transaction.entity';
import { LoyaltyProgramService } from './services/loyalty-program.service';
import { LoyaltyService } from './services/loyalty.service';
import { LoyaltyProgramController } from './controllers/loyalty-program.controller';
import { LoyaltyController } from './controllers/loyalty.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([LoyaltyProgram, LoyaltyPointTransaction]),
    AuthModule,
    RbacModule,
    OrganizationModule,
    CustomerSupplierModule,
    TransactionModule,
  ],
  providers: [LoyaltyProgramService, LoyaltyService],
  controllers: [LoyaltyProgramController, LoyaltyController],
  exports: [LoyaltyProgramService, LoyaltyService, TypeOrmModule],
})
export class LoyaltyModule {}
