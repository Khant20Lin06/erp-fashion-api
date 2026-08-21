import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { OrganizationModule } from '../organization/organization.module';
import { TransactionModule } from '../../core/transaction/transaction.module';
import { Employee } from '../employees/entities/employee.entity';
import { Branch } from '../organization/entities/branch.entity';
import { Warehouse } from '../organization/entities/warehouse.entity';
import { Department } from './entities/department.entity';
import { Designation } from './entities/designation.entity';
import { EmployeeAssignment } from './entities/employee-assignment.entity';
import { LeaveType } from './entities/leave-type.entity';
import { LeaveRequest } from './entities/leave-request.entity';
import { AttendanceRecord } from './entities/attendance-record.entity';
import { DepartmentsService } from './services/departments.service';
import { DesignationsService } from './services/designations.service';
import { EmployeeAssignmentsService } from './services/employee-assignments.service';
import { LeaveTypesService } from './services/leave-types.service';
import { LeaveRequestsService } from './services/leave-requests.service';
import { AttendanceService } from './services/attendance.service';
import { DepartmentsController } from './controllers/departments.controller';
import { DesignationsController } from './controllers/designations.controller';
import { EmployeeAssignmentsController } from './controllers/employee-assignments.controller';
import { LeaveTypesController } from './controllers/leave-types.controller';
import { LeaveRequestsController } from './controllers/leave-requests.controller';
import { AttendanceController } from './controllers/attendance.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employee,
      Branch,
      Warehouse,
      Department,
      Designation,
      EmployeeAssignment,
      LeaveType,
      LeaveRequest,
      AttendanceRecord,
    ]),
    AuthModule,
    RbacModule,
    OrganizationModule,
    TransactionModule,
  ],
  providers: [
    DepartmentsService,
    DesignationsService,
    EmployeeAssignmentsService,
    LeaveTypesService,
    LeaveRequestsService,
    AttendanceService,
  ],
  controllers: [
    DepartmentsController,
    DesignationsController,
    EmployeeAssignmentsController,
    LeaveTypesController,
    LeaveRequestsController,
    AttendanceController,
  ],
  exports: [TypeOrmModule],
})
export class HrModule {}
