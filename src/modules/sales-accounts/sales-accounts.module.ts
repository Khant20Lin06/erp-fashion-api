import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesAccount } from './entities/sales-account.entity';
import { SalesAccountAssignment } from './entities/sales-account-assignment.entity';
import { SalesAccountsService } from './services/sales-accounts.service';
import { SalesAccountAssignmentService } from './services/sales-account-assignment.service';
import { SalesAccountAccessService } from './services/sales-account-access.service';
import { SalesAccountsController } from './controllers/sales-accounts.controller';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { OrganizationModule } from '../organization/organization.module';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SalesAccount, SalesAccountAssignment]),
    AuthModule,
    RbacModule,
    OrganizationModule,
    EmployeesModule,
  ],
  controllers: [SalesAccountsController],
  providers: [
    SalesAccountsService,
    SalesAccountAssignmentService,
    SalesAccountAccessService,
  ],
  exports: [
    SalesAccountsService,
    SalesAccountAssignmentService,
    SalesAccountAccessService,
  ],
})
export class SalesAccountsModule {}
