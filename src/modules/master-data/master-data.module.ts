import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { Brand } from './entities/brand.entity';
import { Collection } from './entities/collection.entity';
import { AttributeOption } from './entities/attribute-option.entity';
import { CategoriesService } from './services/categories.service';
import { BrandsService } from './services/brands.service';
import { CollectionsService } from './services/collections.service';
import { AttributeOptionsService } from './services/attribute-options.service';
import { CategoriesController } from './controllers/categories.controller';
import { BrandsController } from './controllers/brands.controller';
import { CollectionsController } from './controllers/collections.controller';
import { AttributeOptionsController } from './controllers/attribute-options.controller';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { OrganizationModule } from '../organization/organization.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Category, Brand, Collection, AttributeOption]),
    AuthModule,
    RbacModule,
    OrganizationModule,
  ],
  controllers: [
    CategoriesController,
    BrandsController,
    CollectionsController,
    AttributeOptionsController,
  ],
  providers: [
    CategoriesService,
    BrandsService,
    CollectionsService,
    AttributeOptionsService,
  ],
  exports: [
    CategoriesService,
    BrandsService,
    CollectionsService,
    AttributeOptionsService,
  ],
})
export class MasterDataModule {}
