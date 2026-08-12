import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { ProductVariantAttribute } from './entities/product-variant-attribute.entity';
import { ProductVariantBarcode } from './entities/product-variant-barcode.entity';
import { PriceList } from './entities/price-list.entity';
import { PriceListItem } from './entities/price-list-item.entity';
import { ProductsService } from './services/products.service';
import { ProductVariantsService } from './services/product-variants.service';
import { BarcodesService } from './services/barcodes.service';
import { PriceListsService } from './services/price-lists.service';
import { PriceListItemsService } from './services/price-list-items.service';
import { ProductsController } from './controllers/products.controller';
import { ProductVariantsController } from './controllers/product-variants.controller';
import { BarcodesController } from './controllers/barcodes.controller';
import { PriceListsController } from './controllers/price-lists.controller';
import { PriceListItemsController } from './controllers/price-list-items.controller';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { OrganizationModule } from '../organization/organization.module';
import { MasterDataModule } from '../master-data/master-data.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductVariant,
      ProductVariantAttribute,
      ProductVariantBarcode,
      PriceList,
      PriceListItem,
    ]),
    AuthModule,
    RbacModule,
    OrganizationModule,
    MasterDataModule,
  ],
  controllers: [
    ProductsController,
    ProductVariantsController,
    BarcodesController,
    PriceListsController,
    PriceListItemsController,
  ],
  providers: [
    ProductsService,
    ProductVariantsService,
    BarcodesService,
    PriceListsService,
    PriceListItemsService,
  ],
  exports: [
    ProductsService,
    ProductVariantsService,
    BarcodesService,
    PriceListsService,
    PriceListItemsService,
  ],
})
export class ProductsModule {}
