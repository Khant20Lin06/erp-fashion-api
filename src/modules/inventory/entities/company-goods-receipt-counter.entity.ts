import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { PrimaryGeneratedColumn } from 'typeorm';
import { Company } from '../../organization/entities/company.entity';

/**
 * One row per (company, year), holding the current receipt-number sequence
 * value for that company/year combination — the exact
 * `company_sale_counters`/`company_purchase_counters` pattern (Phase 12/13)
 * applied to GoodsReceipt numbering. Locked with `SELECT ... FOR UPDATE`
 * inside the same transaction as GoodsReceipt creation — never
 * `SELECT MAX(receipt_number) + 1`.
 *
 * No BaseEntity — pure counter row, no soft-delete/business meaning.
 */
@Entity('company_goods_receipt_counters')
@Index(['companyId', 'year'], { unique: true })
export class CompanyGoodsReceiptCounter {
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
