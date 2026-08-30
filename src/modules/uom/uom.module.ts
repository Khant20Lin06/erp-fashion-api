import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Uom } from './entities/uom.entity';
import { UomsService } from './services/uoms.service';
import { UomsController } from './controllers/uoms.controller';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { OrganizationModule } from '../organization/organization.module';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { ProductVariantUom } from '../products/entities/product-variant-uom.entity';
import { PriceListItem } from '../products/entities/price-list-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Uom,
      ProductVariant,
      ProductVariantUom,
      PriceListItem,
    ]),
    AuthModule,
    RbacModule,
    OrganizationModule,
  ],
  controllers: [UomsController],
  providers: [UomsService],
  exports: [UomsService],
})
export class UomModule {}
