import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from './entities/company.entity';
import { Branch } from './entities/branch.entity';
import { Warehouse } from './entities/warehouse.entity';
import { CompaniesService } from './services/companies.service';
import { BranchesService } from './services/branches.service';
import { WarehousesService } from './services/warehouses.service';
import { CompaniesController } from './controllers/companies.controller';
import { BranchesController } from './controllers/branches.controller';
import { WarehousesController } from './controllers/warehouses.controller';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Company, Branch, Warehouse]),
    AuthModule,
    RbacModule,
  ],
  controllers: [CompaniesController, BranchesController, WarehousesController],
  providers: [CompaniesService, BranchesService, WarehousesService],
  exports: [CompaniesService, BranchesService, WarehousesService],
})
export class OrganizationModule {}
