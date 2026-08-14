import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { FiscalYear } from './fiscal-year.entity';
import { AccountingPeriodStatus } from './accounting-period-status.enum';

/**
 * Minimal AccountingPeriod (D10, LOCKED) — belongs to exactly one
 * FiscalYear, OPEN/LOCKED status only. Journal posting resolves the period
 * by companyId (via the fiscal year) + entryDate falling within
 * [startDate, endDate]; a LOCKED period or a period under a CLOSED fiscal
 * year rejects posting (see AccountingPostingService.resolveOpenPeriod()).
 * No POST /accounting-periods endpoint exists (D22) — see
 * fiscal-year.entity.ts's docblock for the lazy-creation answer.
 */
@Entity('accounting_periods')
@Index(['fiscalYearId', 'startDate', 'endDate'])
export class AccountingPeriod extends BaseEntity {
  @Column({ name: 'fiscal_year_id', type: 'char', length: 36 })
  fiscalYearId!: string;

  @ManyToOne(() => FiscalYear, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'fiscal_year_id' })
  fiscalYear!: FiscalYear;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate!: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate!: string;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: AccountingPeriodStatus,
    default: AccountingPeriodStatus.Open,
  })
  status!: AccountingPeriodStatus;
}
