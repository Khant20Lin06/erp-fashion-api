import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Company } from '../../organization/entities/company.entity';

/**
 * Per-(company, year) journal-number sequence — an exact structural mirror
 * of CompanyPaymentCounter/CompanySaleCounter/CompanyPurchaseCounter/
 * CompanyGoodsReceiptCounter/CompanyStockTransferCounter/
 * CompanyStockAdjustmentCounter (Phase 12-16): one row per (company_id,
 * year), UNIQUE(company_id, year), no BaseEntity. Journal numbers look like
 * JE-2026-000001, generated via the same
 * upsert-then-SELECT...FOR-UPDATE-lock idiom every prior document-numbering
 * phase in this codebase uses (see JournalEntriesService.generateJournalNumber()).
 */
@Entity('company_journal_counters')
@Index(['companyId', 'year'], { unique: true })
export class CompanyJournalCounter {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ name: 'year', type: 'int' })
  year!: number;

  @Column({ name: 'last_sequence', type: 'int', default: 0 })
  lastSequence!: number;
}
