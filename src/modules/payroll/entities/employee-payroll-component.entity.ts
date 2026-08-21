import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { PayrollComponent } from './payroll-component.entity';

/**
 * EmployeePayrollComponent — effective-dated assignment of a PayrollComponent
 * to an employee, with an optional per-employee override of amount/
 * percentage (nullable — when both are null, the component's own
 * fixedAmount/percentage from PayrollComponent applies). Same overlap-
 * prevention discipline as EmployeeCompensation/EmployeeAssignment: only
 * one assignment of a given component may be effective for an employee on
 * any given date.
 */
@Entity('employee_payroll_components')
@Index(['employeeId', 'payrollComponentId', 'effectiveFrom'])
export class EmployeePayrollComponent extends BaseEntity {
  @Column({ name: 'employee_id', type: 'char', length: 36 })
  employeeId!: string;

  @ManyToOne(() => Employee, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;

  @Column({ name: 'payroll_component_id', type: 'char', length: 36 })
  payrollComponentId!: string;

  @ManyToOne(() => PayrollComponent, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'payroll_component_id' })
  payrollComponent!: PayrollComponent;

  @Column({
    name: 'amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  amount!: string | null;

  @Column({
    name: 'percentage',
    type: 'decimal',
    precision: 7,
    scale: 4,
    nullable: true,
  })
  percentage!: string | null;

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom!: string;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo!: string | null;

  @Column({ name: 'created_by', type: 'char', length: 36, nullable: true })
  createdBy!: string | null;
}
