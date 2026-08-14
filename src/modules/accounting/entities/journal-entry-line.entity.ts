import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { JournalEntry } from './journal-entry.entity';
import { Account } from './account.entity';
import { JournalReferenceType } from './journal-reference-type.enum';

/**
 * JournalEntryLine — the line half of the SOLE accounting source of truth
 * (D1, LOCKED). No independent soft-delete — mirrors PaymentAllocation's
 * own shape exactly (own id/createdAt only, no BaseEntity, no updatedAt): a
 * line is created once, inside the same transaction as its parent
 * JournalEntry, and never updated or deleted afterward once the parent is
 * POSTED (D3).
 *
 * Double-entry invariant (enforced in AccountingPostingService /
 * JournalEntriesService, never a DB CHECK constraint — this codebase has
 * never used one): exactly one of debitAmount/creditAmount is non-zero and
 * positive, the other is exactly zero.
 *
 * referenceType/referenceId (nullable, no FK) is the same polymorphic
 * pointer pattern PaymentAllocation/StockMovement established — lets a
 * line be traced back to its originating Sale/PurchaseOrder/Payment
 * without a join through the JournalEntry header.
 */
@Entity('journal_entry_lines')
@Index(['referenceType', 'referenceId'])
export class JournalEntryLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'journal_entry_id', type: 'char', length: 36 })
  journalEntryId!: string;

  @ManyToOne(() => JournalEntry, (journalEntry) => journalEntry.lines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'journal_entry_id' })
  journalEntry?: JournalEntry;

  @Index()
  @Column({ name: 'account_id', type: 'char', length: 36 })
  accountId!: string;

  @ManyToOne(() => Account, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'account_id' })
  account?: Account;

  @Column({
    name: 'debit_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  debitAmount!: string;

  @Column({
    name: 'credit_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  creditAmount!: string;

  @Column({
    name: 'reference_type',
    type: 'enum',
    enum: JournalReferenceType,
    nullable: true,
  })
  referenceType!: JournalReferenceType | null;

  @Column({ name: 'reference_id', type: 'char', length: 36, nullable: true })
  referenceId!: string | null;

  @Column({
    name: 'description',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  description!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}
