import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { PayFrequency } from './pay-frequency.enum';

/**
 * EmployeeCompensation — effective-dated base salary. Deliberately its own
 * entity rather than a column on Employee (D-locked design decision, per
 * this phase's own spec): a salary change must never overwrite the value a
 * already-finalized PayrollRun calculated against. PayrollRunEmployee
 * snapshots baseSalarySnapshot at calculation time specifically so a
 * finalized payslip remains reproducible even after this table's "current"
 * row for that employee changes.
 *
 * Only one row may be effective for a given employee on a given date —
 * enforced via the same Brackets-based overlap query idiom
 * EmployeeAssignmentsService.assertNoOverlap already established.
 *
 * baseSalary uses DECIMAL(14,2), matching Sale/Payment/JournalEntryLine's
 * money convention exactly (not the narrower (12,2) reserved for
 * ProductVariant unit prices).
 */
@Entity('employee_compensations')
@Index(['employeeId', 'effectiveFrom'])
export class EmployeeCompensation extends BaseEntity {
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ name: 'employee_id', type: 'char', length: 36 })
  employeeId!: string;

  @ManyToOne(() => Employee, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom!: string;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo!: string | null;

  @Column({
    name: 'base_salary',
    type: 'decimal',
    precision: 14,
    scale: 2,
  })
  baseSalary!: string;

  @Column({ name: 'currency', type: 'char', length: 3 })
  currency!: string;

  @Column({
    name: 'pay_frequency',
    type: 'enum',
    enum: PayFrequency,
    default: PayFrequency.Monthly,
  })
  payFrequency!: PayFrequency;

  @Column({ name: 'created_by', type: 'char', length: 36, nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'char', length: 36, nullable: true })
  updatedBy!: string | null;
}
