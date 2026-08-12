import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from './entities/company.entity';
import { Branch } from './entities/branch.entity';
import { Warehouse } from './entities/warehouse.entity';
import { UserCompany } from './entities/user-company.entity';
import { UserBranch } from './entities/user-branch.entity';
import { UserWarehouse } from './entities/user-warehouse.entity';
import { CompaniesService } from './services/companies.service';
import { BranchesService } from './services/branches.service';
import { WarehousesService } from './services/warehouses.service';
import { UserOrganizationService } from './services/user-organization.service';
import { CompaniesController } from './controllers/companies.controller';
import { BranchesController } from './controllers/branches.controller';
import { WarehousesController } from './controllers/warehouses.controller';
import { UserOrganizationController } from './controllers/user-organization.controller';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Company,
      Branch,
      Warehouse,
      UserCompany,
      UserBranch,
      UserWarehouse,
    ]),
    AuthModule,
    RbacModule,
  ],
  controllers: [
    CompaniesController,
    BranchesController,
    WarehousesController,
    UserOrganizationController,
  ],
  providers: [
    CompaniesService,
    BranchesService,
    WarehousesService,
    UserOrganizationService,
  ],
  exports: [
    CompaniesService,
    BranchesService,
    WarehousesService,
    UserOrganizationService,
    TypeOrmModule,
  ],
})
export class OrganizationModule {}
