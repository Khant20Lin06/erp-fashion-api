import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { BrandStatus } from './brand-status.enum';

/**
 * Company-scoped catalog reference (Phase 09 §5, LOCKED). `logoUrl` from
 * the frontend type is deliberately omitted — presentation metadata, not
 * business data, per the project's own "icon/color/UI metadata should
 * remain frontend concerns" convention (no media-storage architecture
 * exists yet to back a real asset reference either).
 */
@Entity('brands')
@Index(['companyId', 'code'], { unique: true })
export class Brand extends BaseEntity {
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

  @Column({ name: 'country', type: 'varchar', length: 100, nullable: true })
  country!: string | null;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: BrandStatus,
    default: BrandStatus.Active,
  })
  status!: BrandStatus;
}
