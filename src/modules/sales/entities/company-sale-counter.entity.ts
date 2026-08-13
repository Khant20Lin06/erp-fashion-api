import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { PrimaryGeneratedColumn } from 'typeorm';
import { Company } from '../../organization/entities/company.entity';

/**
 * One row per (company, year), holding the current sale-number sequence
 * value for that company/year combination (Phase 12 locked decision §F).
 * The sequence resets to 1 at the start of each calendar year (matching
 * the SAL-<year>-<sequence> format), which is why the counter is keyed on
 * (company_id, year) rather than company_id alone.
 *
 * Concurrency safety is achieved by locking the specific counter row with
 * `SELECT ... FOR UPDATE` (via TypeORM's `setLock('pessimistic_write')`)
 * inside the SAME transaction as Sale creation — never
 * `SELECT MAX(sale_number) + 1`, which races under concurrent inserts. See
 * docs/SALES_ARCHITECTURE.md "Sale Number Architecture" for the full
 * mechanism and the concurrency e2e test that proves it.
 *
 * No BaseEntity — this is a pure counter row with no soft-delete/business
 * meaning of its own, so createdAt/updatedAt/deletedAt would be noise.
 */
@Entity('company_sale_counters')
@Index(['companyId', 'year'], { unique: true })
export class CompanySaleCounter {
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
