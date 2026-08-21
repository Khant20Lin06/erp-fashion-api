import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { OrganizationModule } from '../organization/organization.module';
import { TransactionModule } from '../../core/transaction/transaction.module';

import { Employee } from '../employees/entities/employee.entity';
import { EmployeeAssignment } from '../hr/entities/employee-assignment.entity';
import { Department } from '../hr/entities/department.entity';
import { Designation } from '../hr/entities/designation.entity';
import { LeaveRequest } from '../hr/entities/leave-request.entity';
import { LeaveType } from '../hr/entities/leave-type.entity';

import { Shift } from './entities/shift.entity';
import { EmployeeShiftAssignment } from './entities/employee-shift-assignment.entity';
import { EmployeeCompensation } from './entities/employee-compensation.entity';
import { PayrollComponent } from './entities/payroll-component.entity';
import { EmployeePayrollComponent } from './entities/employee-payroll-component.entity';
import { PayrollConfiguration } from './entities/payroll-configuration.entity';
import { PayrollPeriod } from './entities/payroll-period.entity';
import { CompanyPayrollPeriodCounter } from './entities/company-payroll-period-counter.entity';
import { PayrollRun } from './entities/payroll-run.entity';
import { CompanyPayrollRunCounter } from './entities/company-payroll-run-counter.entity';
import { PayrollRunEmployee } from './entities/payroll-run-employee.entity';
import { PayrollRunEmployeeItem } from './entities/payroll-run-employee-item.entity';

import { ShiftsService } from './services/shifts.service';
import { EmployeeShiftAssignmentsService } from './services/employee-shift-assignments.service';
import { EmployeeCompensationService } from './services/employee-compensation.service';
import { PayrollComponentsService } from './services/payroll-components.service';
import { EmployeePayrollComponentsService } from './services/employee-payroll-components.service';
import { PayrollConfigurationService } from './services/payroll-configuration.service';
import { PayrollPeriodsService } from './services/payroll-periods.service';
import { PayrollRunsService } from './services/payroll-runs.service';

import { ShiftsController } from './controllers/shifts.controller';
import { EmployeeShiftAssignmentsController } from './controllers/employee-shift-assignments.controller';
import { EmployeeCompensationController } from './controllers/employee-compensation.controller';
import { PayrollComponentsController } from './controllers/payroll-components.controller';
import { EmployeePayrollComponentsController } from './controllers/employee-payroll-components.controller';
import { PayrollConfigurationController } from './controllers/payroll-configuration.controller';
import { PayrollPeriodsController } from './controllers/payroll-periods.controller';
import { PayrollRunsController } from './controllers/payroll-runs.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employee,
      EmployeeAssignment,
      Department,
      Designation,
      LeaveRequest,
      LeaveType,
      Shift,
      EmployeeShiftAssignment,
      EmployeeCompensation,
      PayrollComponent,
      EmployeePayrollComponent,
      PayrollConfiguration,
      PayrollPeriod,
      CompanyPayrollPeriodCounter,
      PayrollRun,
      CompanyPayrollRunCounter,
      PayrollRunEmployee,
      PayrollRunEmployeeItem,
    ]),
    AuthModule,
    RbacModule,
    OrganizationModule,
    TransactionModule,
  ],
  providers: [
    ShiftsService,
    EmployeeShiftAssignmentsService,
    EmployeeCompensationService,
    PayrollComponentsService,
    EmployeePayrollComponentsService,
    PayrollConfigurationService,
    PayrollPeriodsService,
    PayrollRunsService,
  ],
  controllers: [
    ShiftsController,
    EmployeeShiftAssignmentsController,
    EmployeeCompensationController,
    PayrollComponentsController,
    EmployeePayrollComponentsController,
    PayrollConfigurationController,
    PayrollPeriodsController,
    PayrollRunsController,
  ],
  exports: [TypeOrmModule],
})
export class PayrollModule {}
