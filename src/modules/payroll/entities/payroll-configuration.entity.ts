import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { UnpaidLeaveCalculation } from './unpaid-leave-calculation.enum';

/**
 * PayrollConfiguration — one row per company (a singleton per companyId,
 * enforced via a unique index), holding only the minimal policy switches
 * PayrollCalculationService actually needs. Deliberately NOT a generic
 * settings bag and NOT a tax engine (this phase's explicit non-goals) —
 * just the two things the calculation flow has a real, documented use for:
 * which currency payroll amounts default to, and how unpaid leave affects
 * pay.
 *
 * workingDaysPerMonth is required whenever unpaidLeaveCalculation is
 * DAILY_RATE (validated in the service layer, not a DB constraint) —
 * PayrollCalculationService never falls back to a bare "/ 30" assumption.
 */
@Entity('payroll_configurations')
export class PayrollConfiguration extends BaseEntity {
  @Column({ name: 'company_id', type: 'char', length: 36, unique: true })
  companyId!: string;

  @OneToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ name: 'default_currency', type: 'char', length: 3 })
  defaultCurrency!: string;

  @Column({
    name: 'unpaid_leave_calculation',
    type: 'enum',
    enum: UnpaidLeaveCalculation,
    default: UnpaidLeaveCalculation.None,
  })
  unpaidLeaveCalculation!: UnpaidLeaveCalculation;

  @Column({
    name: 'working_days_per_month',
    type: 'int',
    nullable: true,
  })
  workingDaysPerMonth!: number | null;

  @Column({ name: 'created_by', type: 'char', length: 36, nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'char', length: 36, nullable: true })
  updatedBy!: string | null;
}
