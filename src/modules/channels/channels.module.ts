import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EcommerceChannel } from './entities/ecommerce-channel.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { ProductVariantAttribute } from '../products/entities/product-variant-attribute.entity';
import { WarehouseStock } from '../inventory/entities/warehouse-stock.entity';
import { ChannelsService } from './services/channels.service';
import { ChannelsController } from './controllers/channels.controller';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EcommerceChannel,
      ProductVariant,
      ProductVariantAttribute,
      WarehouseStock,
    ]),
    AuthModule,
    RbacModule,
  ],
  controllers: [ChannelsController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
