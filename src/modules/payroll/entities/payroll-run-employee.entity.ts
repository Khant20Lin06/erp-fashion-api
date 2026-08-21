import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { PayrollRun } from './payroll-run.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { PayrollRunEmployeeStatus } from './payroll-run-employee-status.enum';

/**
 * PayrollRunEmployee — the per-employee payslip result for one PayrollRun.
 * Every *Snapshot field is captured at calculation time and is NEVER
 * re-derived from current Employee/EmployeeAssignment/EmployeeCompensation
 * data afterward — a finalized (or even just-calculated) payslip must
 * remain byte-for-byte reproducible even if the employee's name,
 * department, designation, or salary later changes. This mirrors Sale/
 * PurchaseOrder's own *Snapshot convention on line items exactly (e.g.
 * SaleItem.productNameSnapshot/skuSnapshot never re-read from the live
 * Product/ProductVariant row).
 *
 * UNIQUE(payroll_run_id, employee_id) prevents the same employee from
 * appearing twice in one run — the exact "double calculation" concurrency
 * risk the phase spec calls out is additionally guarded by the parent
 * PayrollRun's own PROCESSING-status lock (see PayrollRunsService.calculate),
 * with this unique index as a second, DB-enforced backstop.
 */
@Entity('payroll_run_employees')
@Index(['payrollRunId', 'employeeId'], { unique: true })
export class PayrollRunEmployee extends BaseEntity {
  @Column({ name: 'payroll_run_id', type: 'char', length: 36 })
  payrollRunId!: string;

  @ManyToOne(() => PayrollRun, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'payroll_run_id' })
  payrollRun!: PayrollRun;

  @Column({ name: 'employee_id', type: 'char', length: 36 })
  employeeId!: string;

  @ManyToOne(() => Employee, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;

  @Column({ name: 'employee_code_snapshot', type: 'varchar', length: 50 })
  employeeCodeSnapshot!: string;

  @Column({ name: 'employee_name_snapshot', type: 'varchar', length: 200 })
  employeeNameSnapshot!: string;

  @Column({
    name: 'department_snapshot',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  departmentSnapshot!: string | null;

  @Column({
    name: 'designation_snapshot',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  designationSnapshot!: string | null;

  @Column({
    name: 'base_salary_snapshot',
    type: 'decimal',
    precision: 14,
    scale: 2,
  })
  baseSalarySnapshot!: string;

  @Column({
    name: 'gross_pay',
    type: 'decimal',
    precision: 14,
    scale: 2,
  })
  grossPay!: string;

  @Column({
    name: 'total_deductions',
    type: 'decimal',
    precision: 14,
    scale: 2,
  })
  totalDeductions!: string;

  @Column({
    name: 'net_pay',
    type: 'decimal',
    precision: 14,
    scale: 2,
  })
  netPay!: string;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: PayrollRunEmployeeStatus,
    default: PayrollRunEmployeeStatus.Calculated,
  })
  status!: PayrollRunEmployeeStatus;
}
