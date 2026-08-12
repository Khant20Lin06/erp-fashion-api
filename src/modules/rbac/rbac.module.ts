import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { RolePermission } from './entities/role-permission.entity';
import { UserRole } from './entities/user-role.entity';
import { RoleResourceScope } from './entities/role-resource-scope.entity';
import { UserCompany } from '../organization/entities/user-company.entity';
import { UserBranch } from '../organization/entities/user-branch.entity';
import { UserWarehouse } from '../organization/entities/user-warehouse.entity';
import { AuthorizationService } from './services/authorization.service';
import { DataScopeService } from './services/data-scope.service';
import { RolesService } from './services/roles.service';
import { UserRolesService } from './services/user-roles.service';
import { SuperAdminInvariantService } from './services/super-admin-invariant.service';
import { PermissionGuard } from './guards/permission.guard';
import { RolesController } from './controllers/roles.controller';
import { PermissionsController } from './controllers/permissions.controller';
import { UserRolesController } from './controllers/user-roles.controller';
import { MyPermissionsController } from './controllers/my-permissions.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Role,
      Permission,
      RolePermission,
      UserRole,
      RoleResourceScope,
      UserCompany,
      UserBranch,
      UserWarehouse,
    ]),
    AuthModule,
  ],
  controllers: [
    RolesController,
    PermissionsController,
    UserRolesController,
    MyPermissionsController,
  ],
  providers: [
    AuthorizationService,
    DataScopeService,
    RolesService,
    UserRolesService,
    SuperAdminInvariantService,
    PermissionGuard,
  ],
  exports: [AuthorizationService, DataScopeService, PermissionGuard],
})
export class RbacModule {}
