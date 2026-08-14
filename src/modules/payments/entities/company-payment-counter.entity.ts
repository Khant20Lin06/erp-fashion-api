import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { PrimaryGeneratedColumn } from 'typeorm';
import { Company } from '../../organization/entities/company.entity';

/**
 * One row per (company, year), holding the current payment-number sequence
 * value for that company/year combination — the exact
 * `company_sale_counters`/`company_purchase_counters`/
 * `company_goods_receipt_counters` pattern (Phase 12/13/14) applied to
 * Payment numbering (D6, LOCKED). Locked with `SELECT ... FOR UPDATE`
 * inside the same transaction as Payment creation — never
 * `SELECT MAX(payment_number) + 1`.
 *
 * No BaseEntity — pure counter row, no soft-delete/business meaning.
 */
@Entity('company_payment_counters')
@Index(['companyId', 'year'], { unique: true })
export class CompanyPaymentCounter {
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
