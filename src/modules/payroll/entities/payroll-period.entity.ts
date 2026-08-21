import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { User } from '../../users/entities/user.entity';
import { PayrollPeriodStatus } from './payroll-period-status.enum';

/**
 * PayrollPeriod — the calendar window payroll is calculated for (e.g.
 * "August 2026", 2026-08-01 -> 2026-08-31, pay date 2026-09-05). Extends
 * BaseEntity — this is a real transactional/historical record, never hard
 * deleted; CANCELLED (not deletion) is how a mistaken period is undone,
 * matching Sale/PurchaseOrder's own DRAFT/CONFIRMED/CANCELLED discipline.
 *
 * UNIQUE(company_id, start_date, end_date) at the DB level prevents the
 * exact duplicate-period race the spec calls out ("2026-08-01 -> 2026-08-31
 * cannot exist twice for the same company") — enforced by the database
 * itself, not just an application-level check, per the phase's explicit
 * "do not rely only on application-level checks if the database can enforce
 * the invariant" instruction.
 */
@Entity('payroll_periods')
@Index(['companyId', 'startDate', 'endDate'], { unique: true })
export class PayrollPeriod extends BaseEntity {
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ name: 'period_number', type: 'varchar', length: 50 })
  periodNumber!: string;

  @Column({ name: 'name', type: 'varchar', length: 150 })
  name!: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate!: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate!: string;

  @Column({ name: 'pay_date', type: 'date' })
  payDate!: string;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: PayrollPeriodStatus,
    default: PayrollPeriodStatus.Open,
  })
  status!: PayrollPeriodStatus;

  @Column({ name: 'created_by', type: 'char', length: 36 })
  createdBy!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User;

  @Column({ name: 'updated_by', type: 'char', length: 36, nullable: true })
  updatedBy!: string | null;
}
