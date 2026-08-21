import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { User } from '../../users/entities/user.entity';
import { PayrollPeriod } from './payroll-period.entity';
import { PayrollRunStatus } from './payroll-run-status.enum';

/**
 * PayrollRun — one calculation/execution attempt against a PayrollPeriod.
 * UNIQUE(company_id, payroll_period_id) on the ACTIVE (non-CANCELLED) run
 * is enforced at the application layer inside a locked transaction (see
 * PayrollRunsService.create) rather than a DB partial-unique-index, since
 * MySQL 8.0 has no native partial/filtered unique index — the same
 * constraint-design tradeoff this codebase already accepts elsewhere (e.g.
 * Payment.idempotencyKey relies on MySQL's "multiple NULLs don't collide"
 * behavior rather than a partial index). A CANCELLED run does not block a
 * fresh run being created for the same period, exactly mirroring how a
 * CANCELLED PurchaseOrder doesn't block re-ordering.
 *
 * totalGrossPay/totalDeductions/totalNetPay are a denormalized cache,
 * always re-derived from the real PayrollRunEmployee rows at
 * calculate-time and re-validated before finalize — never trusted as
 * independently authoritative, matching JournalEntry.totalDebit/
 * totalCredit's own documented "denormalized cache, always re-derived"
 * precedent exactly.
 */
@Entity('payroll_runs')
export class PayrollRun extends BaseEntity {
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Index()
  @Column({ name: 'payroll_period_id', type: 'char', length: 36 })
  payrollPeriodId!: string;

  @ManyToOne(() => PayrollPeriod, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'payroll_period_id' })
  payrollPeriod!: PayrollPeriod;

  @Column({ name: 'run_number', type: 'varchar', length: 50 })
  runNumber!: string;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: PayrollRunStatus,
    default: PayrollRunStatus.Draft,
  })
  status!: PayrollRunStatus;

  @Column({ name: 'employee_count', type: 'int', default: 0 })
  employeeCount!: number;

  @Column({
    name: 'total_gross_pay',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  totalGrossPay!: string;

  @Column({
    name: 'total_deductions',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  totalDeductions!: string;

  @Column({
    name: 'total_net_pay',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  totalNetPay!: string;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'finalized_at', type: 'timestamp', nullable: true })
  finalizedAt!: Date | null;

  @Column({ name: 'created_by', type: 'char', length: 36 })
  createdBy!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User;

  @Column({ name: 'finalized_by', type: 'char', length: 36, nullable: true })
  finalizedBy!: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'finalized_by' })
  finalizedByUser?: User | null;
}
