import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { PayrollComponentType } from './payroll-component-type.enum';
import { PayrollCalculationType } from './payroll-calculation-type.enum';

/**
 * PayrollComponent — a configurable, company-scoped earning/deduction/
 * employer-contribution definition. Master data, extends BaseEntity
 * (soft-delete) exactly like LeaveType/Department — a component referenced
 * by historical EmployeePayrollComponent or PayrollRunEmployeeItem rows
 * must never be hard deleted.
 *
 * Exactly one of fixedAmount/percentage is populated, matching
 * calculationType — enforced in the service layer (this codebase never
 * uses DB CHECK constraints, per Payment.direction's own precedent for
 * "exactly one of X/Y" validation staying application-side).
 */
@Entity('payroll_components')
@Index(['companyId', 'code'], { unique: true })
export class PayrollComponent extends BaseEntity {
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ name: 'name', type: 'varchar', length: 150 })
  name!: string;

  @Column({ name: 'code', type: 'varchar', length: 50 })
  code!: string;

  @Index()
  @Column({
    name: 'type',
    type: 'enum',
    enum: PayrollComponentType,
  })
  type!: PayrollComponentType;

  @Column({
    name: 'calculation_type',
    type: 'enum',
    enum: PayrollCalculationType,
  })
  calculationType!: PayrollCalculationType;

  @Column({
    name: 'fixed_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  fixedAmount!: string | null;

  @Column({
    name: 'percentage',
    type: 'decimal',
    precision: 7,
    scale: 4,
    nullable: true,
  })
  percentage!: string | null;

  @Column({ name: 'is_taxable', type: 'boolean', default: false })
  isTaxable!: boolean;

  @Index()
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_by', type: 'char', length: 36, nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'char', length: 36, nullable: true })
  updatedBy!: string | null;
}
