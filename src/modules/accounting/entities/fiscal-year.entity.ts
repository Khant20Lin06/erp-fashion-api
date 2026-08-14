import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { FiscalYearStatus } from './fiscal-year-status.enum';

/**
 * Minimal FiscalYear (D10, LOCKED) — company-scoped, OPEN/CLOSED status
 * only, no automatic closing workflow. No POST /fiscal-years endpoint
 * exists on the locked API surface (D22 does not list one); see
 * AccountingPeriodResolverService for how a FiscalYear/AccountingPeriod
 * pair is lazily auto-created the first time a journal entry needs to post
 * into a period that does not exist yet for its company/date — the
 * documented, deliberate answer to D10's own "you will need to decide how
 * a period gets created in the first place" delegation.
 */
@Entity('fiscal_years')
@Index(['companyId', 'startDate', 'endDate'])
export class FiscalYear extends BaseEntity {
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

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
    enum: FiscalYearStatus,
    default: FiscalYearStatus.Open,
  })
  status!: FiscalYearStatus;
}
