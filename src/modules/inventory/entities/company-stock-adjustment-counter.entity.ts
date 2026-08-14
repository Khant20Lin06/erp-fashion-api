import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { PrimaryGeneratedColumn } from 'typeorm';
import { Company } from '../../organization/entities/company.entity';

/** Same shape/purpose as CompanyGoodsReceiptCounter, applied to StockAdjustment numbering. */
@Entity('company_stock_adjustment_counters')
@Index(['companyId', 'year'], { unique: true })
export class CompanyStockAdjustmentCounter {
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
