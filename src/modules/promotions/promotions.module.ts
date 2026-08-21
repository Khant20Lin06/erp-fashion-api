import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { OrganizationModule } from '../organization/organization.module';
import { Promotion } from './entities/promotion.entity';
import { PromotionsService } from './services/promotions.service';
import { PromotionsController } from './controllers/promotions.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Promotion]),
    AuthModule,
    RbacModule,
    OrganizationModule,
  ],
  providers: [PromotionsService],
  controllers: [PromotionsController],
  exports: [PromotionsService, TypeOrmModule],
})
export class PromotionsModule {}
