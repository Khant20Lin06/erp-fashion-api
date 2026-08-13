import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { CustomerGroupStatus } from './customer-group-status.enum';

/**
 * Real, persisted, configurable classification for Customer (Phase 11 §7,
 * LOCKED — "Do not hard-code business groups"). Mirrors the Phase 09
 * Brand/Collection company-scoped CRUD pattern exactly: `code` unique per
 * company, two-value ACTIVE/INACTIVE status, soft delete via BaseEntity.
 * Examples like Retail/Wholesale/VIP/Corporate/Online from Phase 11.md §7
 * are illustrative only — nothing is seeded here (Phase 11 locked
 * constraint: no business master-data is seeded, only authorization seed
 * data).
 */
@Entity('customer_groups')
@Index(['companyId', 'code'], { unique: true })
export class CustomerGroup extends BaseEntity {
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ name: 'code', type: 'varchar', length: 50 })
  code!: string;

  @Column({ name: 'name', type: 'varchar', length: 200 })
  name!: string;

  @Column({ name: 'description', type: 'varchar', length: 500, nullable: true })
  description!: string | null;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: CustomerGroupStatus,
    default: CustomerGroupStatus.Active,
  })
  status!: CustomerGroupStatus;
}
