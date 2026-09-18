import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { ProductVariantAttribute } from './entities/product-variant-attribute.entity';
import { ProductVariantBarcode } from './entities/product-variant-barcode.entity';
import { ProductVariantUom } from './entities/product-variant-uom.entity';
import { PriceList } from './entities/price-list.entity';
import { PriceListItem } from './entities/price-list-item.entity';
import { ProductsService } from './services/products.service';
import { ProductVariantsService } from './services/product-variants.service';
import { ProductVariantUomsService } from './services/product-variant-uoms.service';
import { BarcodesService } from './services/barcodes.service';
import { PriceListsService } from './services/price-lists.service';
import { PriceListItemsService } from './services/price-list-items.service';
import { ProductsController } from './controllers/products.controller';
import { ProductVariantsController } from './controllers/product-variants.controller';
import { ProductVariantUomsController } from './controllers/product-variant-uoms.controller';
import { BarcodesController } from './controllers/barcodes.controller';
import { PriceListsController } from './controllers/price-lists.controller';
import { PriceListItemsController } from './controllers/price-list-items.controller';
import { ProductImagesController } from './controllers/product-images.controller';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { OrganizationModule } from '../organization/organization.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { PurchaseOrderItem } from '../purchase/entities/purchase-order-item.entity';
import { Uom } from '../uom/entities/uom.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductVariant,
      ProductVariantAttribute,
      ProductVariantBarcode,
      ProductVariantUom,
      PriceList,
      PriceListItem,
      PurchaseOrderItem,
      Uom,
    ]),
    AuthModule,
    RbacModule,
    OrganizationModule,
    MasterDataModule,
  ],
  controllers: [
    ProductsController,
    ProductVariantsController,
    ProductVariantUomsController,
    BarcodesController,
    PriceListsController,
    PriceListItemsController,
    ProductImagesController,
  ],
  providers: [
    ProductsService,
    ProductVariantsService,
    ProductVariantUomsService,
    BarcodesService,
    PriceListsService,
    PriceListItemsService,
  ],
  exports: [
    ProductsService,
    ProductVariantsService,
    ProductVariantUomsService,
    BarcodesService,
    PriceListsService,
    PriceListItemsService,
  ],
})
export class ProductsModule {}
