import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { CategoryStatus } from './category-status.enum';

/**
 * Self-referencing hierarchy (Phase 09 §22-25, LOCKED) — one table serves
 * both Category and Subcategory via parentId, matching the frontend's own
 * design and avoiding a redundant second table. `code` is a backend
 * addition not present on the frontend's current Category type (Phase 09
 * §2, LOCKED) — added for the same stable-business-code reason every other
 * entity in this codebase already has one (Company/Branch/Warehouse/
 * Employee/SalesAccount/Brand).
 */
@Entity('categories')
@Index(['companyId', 'code'], { unique: true })
export class Category extends BaseEntity {
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

  @Column({ name: 'parent_id', type: 'char', length: 36, nullable: true })
  parentId!: string | null;

  @ManyToOne(() => Category, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: Category | null;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: CategoryStatus,
    default: CategoryStatus.Active,
  })
  status!: CategoryStatus;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;
}
