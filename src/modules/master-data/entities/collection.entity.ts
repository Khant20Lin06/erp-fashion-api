import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { CollectionStatus } from './collection-status.enum';
import { Season } from './season.enum';

/**
 * Company-scoped fashion collection (Phase 09 §6). `season` is stored as
 * an embedded enum column, never a FK — Season has no standalone table
 * (§7, LOCKED).
 */
@Entity('collections')
@Index(['companyId', 'code'], { unique: true })
export class Collection extends BaseEntity {
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

  @Column({ name: 'season', type: 'enum', enum: Season })
  season!: Season;

  @Column({ name: 'year', type: 'smallint', nullable: true })
  year!: number | null;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: CollectionStatus,
    default: CollectionStatus.Active,
  })
  status!: CollectionStatus;
}
