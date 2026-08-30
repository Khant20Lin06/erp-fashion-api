import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from './entities/employee.entity';
import { EmployeesService } from './services/employees.service';
import { EmployeesController } from './controllers/employees.controller';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { OrganizationModule } from '../organization/organization.module';
import { EmployeeAssignment } from '../hr/entities/employee-assignment.entity';
import { Branch } from '../organization/entities/branch.entity';
import { Department } from '../hr/entities/department.entity';
import { Designation } from '../hr/entities/designation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employee,
      EmployeeAssignment,
      Branch,
      Department,
      Designation,
    ]),
    AuthModule,
    RbacModule,
    OrganizationModule,
  ],
  controllers: [EmployeesController],
  providers: [EmployeesService],
  exports: [TypeOrmModule, EmployeesService],
})
export class EmployeesModule {}
