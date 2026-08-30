import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';

@Entity('company_purchase_rfq_counters')
@Index(['companyId', 'year'], { unique: true })
export class CompanyPurchaseRfqCounter extends BaseEntity {
  @Index()
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ type: 'int' })
  year!: number;

  @Column({ name: 'last_sequence', type: 'int', default: 0 })
  lastSequence!: number;
}
