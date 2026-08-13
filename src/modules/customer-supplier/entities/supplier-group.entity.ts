import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { SupplierGroupStatus } from './supplier-group-status.enum';

/**
 * Real, persisted, configurable classification for Supplier (Phase 11 §8,
 * LOCKED). Mirrors CustomerGroup/Brand exactly — see customer-group.entity.ts.
 * Examples like Local/Import/Fabric/Accessory/Manufacturer Supplier from
 * Phase 11.md §8 are illustrative only — nothing is seeded.
 */
@Entity('supplier_groups')
@Index(['companyId', 'code'], { unique: true })
export class SupplierGroup extends BaseEntity {
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
    enum: SupplierGroupStatus,
    default: SupplierGroupStatus.Active,
  })
  status!: SupplierGroupStatus;
}
