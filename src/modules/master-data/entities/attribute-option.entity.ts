import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { AttributeOptionStatus } from './attribute-option-status.enum';
import { AttributeKind } from './attribute-kind.enum';

/**
 * One unified table for Color/Size/Style/Material (Phase 09 §8-9, LOCKED)
 * rather than four near-identical tables — kind-scoped uniqueness means
 * SIZE+"M" and COLOR+"M" never collide. `swatch` is only meaningful for
 * kind=COLOR; validated at the DTO/service layer, not enforced by a DB
 * constraint (MySQL cannot express "column X is required only when column
 * Y equals a specific value").
 */
@Entity('attribute_options')
@Index(['companyId', 'kind', 'code'], { unique: true })
export class AttributeOption extends BaseEntity {
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Index()
  @Column({ name: 'kind', type: 'enum', enum: AttributeKind })
  kind!: AttributeKind;

  @Column({ name: 'code', type: 'varchar', length: 50 })
  code!: string;

  @Column({ name: 'value', type: 'varchar', length: 200 })
  value!: string;

  @Column({ name: 'swatch', type: 'varchar', length: 20, nullable: true })
  swatch!: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: AttributeOptionStatus,
    default: AttributeOptionStatus.Active,
  })
  status!: AttributeOptionStatus;
}
