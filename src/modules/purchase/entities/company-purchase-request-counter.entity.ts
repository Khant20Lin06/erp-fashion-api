import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

@Entity('company_purchase_request_counters')
@Index(['companyId', 'year'], { unique: true })
export class CompanyPurchaseRequestCounter extends BaseEntity {
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @Column({ name: 'year', type: 'int' })
  year!: number;

  @Column({ name: 'last_sequence', type: 'int', default: 0 })
  lastSequence!: number;
}
