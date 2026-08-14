import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { Branch } from '../../organization/entities/branch.entity';
import { User } from '../../users/entities/user.entity';
import { AccountingPeriod } from './accounting-period.entity';
import { JournalEntryStatus } from './journal-entry-status.enum';
import { JournalSourceType } from './journal-source-type.enum';
import { JournalEntryLine } from './journal-entry-line.entity';

/**
 * JournalEntry — the header half of the SOLE accounting source of truth
 * (D1, LOCKED). Together with JournalEntryLine, this is the only place
 * financial facts are recorded in this codebase; General Ledger and Trial
 * Balance are read-only query projections over POSTED lines, never a
 * separate physical table (D5).
 *
 * journalNumber is company-scoped unique, generated via
 * CompanyJournalCounter (the same upsert+SELECT...FOR UPDATE numbering
 * idiom every prior document-numbering phase uses).
 *
 * sourceType/sourceId (nullable) is the polymorphic pointer back to
 * whatever caused this journal to be created — MANUAL or null for a
 * user-created journal (D12), PAYMENT for Phase 16's automatic posting
 * (D6/D7/D13). UNIQUE(company_id, source_type, source_id) is the
 * idempotency/duplicate-posting-prevention backstop (D15) — MySQL treats
 * multiple NULLs in a unique index as non-colliding (the same
 * Payment.idempotencyKey precedent from Phase 16), so manual journals with
 * a null sourceType/sourceId never collide with each other or with a
 * source-tagged journal.
 *
 * totalDebit/totalCredit are a denormalized cache, always re-derived from
 * the actual JournalEntryLine rows and re-validated at posting time (D-spec
 * "Double-entry invariants") — never trusted as authoritative on their own.
 *
 * status (D2): DRAFT -> POSTED (terminal, immutable, D3) or DRAFT ->
 * CANCELLED (terminal) — see journal-entry-status.enum.ts's docblock for
 * why CANCELLED was added here but was NOT added for Payment in Phase 16.
 */
@Entity('journal_entries')
@Index(['companyId', 'journalNumber'], { unique: true })
@Index(['companyId', 'sourceType', 'sourceId'], { unique: true })
export class JournalEntry extends BaseEntity {
  @Column({ name: 'journal_number', type: 'varchar', length: 50 })
  journalNumber!: string;

  @Index()
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Index()
  @Column({ name: 'branch_id', type: 'char', length: 36, nullable: true })
  branchId!: string | null;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'branch_id' })
  branch?: Branch | null;

  @Index()
  @Column({ name: 'accounting_period_id', type: 'char', length: 36 })
  accountingPeriodId!: string;

  @ManyToOne(() => AccountingPeriod, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'accounting_period_id' })
  accountingPeriod?: AccountingPeriod;

  @Index()
  @Column({ name: 'entry_date', type: 'timestamp' })
  entryDate!: Date;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: JournalEntryStatus,
    default: JournalEntryStatus.Draft,
  })
  status!: JournalEntryStatus;

  @Index()
  @Column({
    name: 'source_type',
    type: 'enum',
    enum: JournalSourceType,
    nullable: true,
  })
  sourceType!: JournalSourceType | null;

  @Column({ name: 'source_id', type: 'char', length: 36, nullable: true })
  sourceId!: string | null;

  @Column({ name: 'description', type: 'varchar', length: 500 })
  description!: string;

  @Column({
    name: 'total_debit',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  totalDebit!: string;

  @Column({
    name: 'total_credit',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  totalCredit!: string;

  @Column({ name: 'created_by', type: 'char', length: 36 })
  createdBy!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User;

  @Column({ name: 'posted_by', type: 'char', length: 36, nullable: true })
  postedBy!: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'posted_by' })
  postedByUser?: User | null;

  @Column({ name: 'posted_at', type: 'timestamp', nullable: true })
  postedAt!: Date | null;

  @OneToMany(() => JournalEntryLine, (line) => line.journalEntry)
  lines?: JournalEntryLine[];
}
