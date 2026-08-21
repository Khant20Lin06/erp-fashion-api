import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { Company } from '../../organization/entities/company.entity';
import { Branch } from '../../organization/entities/branch.entity';
import { Warehouse } from '../../organization/entities/warehouse.entity';
import { Department } from './department.entity';
import { Designation } from './designation.entity';
import { EmployeeAssignmentStatus } from './employee-assignment-status.enum';

@Entity('employee_assignments')
@Index(['employeeId', 'effectiveFrom'])
@Index(['companyId', 'branchId'])
export class EmployeeAssignment extends BaseEntity {
  @Column({ name: 'employee_id', type: 'char', length: 36 })
  employeeId!: string;

  @ManyToOne(() => Employee, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;

  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ name: 'branch_id', type: 'char', length: 36 })
  branchId!: string;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branch_id' })
  branch!: Branch;

  @Column({ name: 'department_id', type: 'char', length: 36, nullable: true })
  departmentId!: string | null;

  @ManyToOne(() => Department, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'department_id' })
  department?: Department | null;

  @Column({ name: 'designation_id', type: 'char', length: 36, nullable: true })
  designationId!: string | null;

  @ManyToOne(() => Designation, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'designation_id' })
  designation?: Designation | null;

  @Column({ name: 'warehouse_id', type: 'char', length: 36, nullable: true })
  warehouseId!: string | null;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse?: Warehouse | null;

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom!: string;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo!: string | null;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: EmployeeAssignmentStatus,
    default: EmployeeAssignmentStatus.Active,
  })
  status!: EmployeeAssignmentStatus;
}
