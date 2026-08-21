import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PayrollRunEmployee } from './payroll-run-employee.entity';
import { PayrollComponent } from './payroll-component.entity';
import { PayrollComponentType } from './payroll-component-type.enum';
import { PayrollCalculationType } from './payroll-calculation-type.enum';

/**
 * PayrollRunEmployeeItem — immutable calculation line items, one per
 * applied PayrollComponent (plus a synthetic "unpaid leave deduction" line
 * when PayrollConfiguration.unpaidLeaveCalculation applies — see
 * componentNameSnapshot for that case, payrollComponentId is null since it
 * has no PayrollComponent master-data row). Deliberately does NOT extend
 * BaseEntity — own id+createdAt only, no updatedAt, no soft-delete —
 * matching JournalEntryLine's/SaleItem's exact "immutable child line"
 * shape. Never recalculated dynamically from current PayrollComponent
 * configuration; every *Snapshot field is frozen at calculation time.
 */
@Entity('payroll_run_employee_items')
export class PayrollRunEmployeeItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'payroll_run_employee_id', type: 'char', length: 36 })
  payrollRunEmployeeId!: string;

  @ManyToOne(() => PayrollRunEmployee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payroll_run_employee_id' })
  payrollRunEmployee!: PayrollRunEmployee;

  @Column({
    name: 'payroll_component_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  payrollComponentId!: string | null;

  @ManyToOne(() => PayrollComponent, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'payroll_component_id' })
  payrollComponent?: PayrollComponent | null;

  @Column({ name: 'component_name_snapshot', type: 'varchar', length: 150 })
  componentNameSnapshot!: string;

  @Column({ name: 'component_code_snapshot', type: 'varchar', length: 50 })
  componentCodeSnapshot!: string;

  @Column({
    name: 'type',
    type: 'enum',
    enum: PayrollComponentType,
  })
  type!: PayrollComponentType;

  @Column({
    name: 'calculation_type_snapshot',
    type: 'enum',
    enum: PayrollCalculationType,
  })
  calculationTypeSnapshot!: PayrollCalculationType;

  @Column({
    name: 'amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
  })
  amount!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}
