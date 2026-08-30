import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { UomCategory } from './uom-category.enum';

@Entity('uoms')
@Index(['companyId', 'code'], { unique: true })
@Index(['companyId', 'name'], { unique: true })
export class Uom extends BaseEntity {
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ name: 'code', type: 'varchar', length: 20 })
  code!: string;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'symbol', type: 'varchar', length: 20, nullable: true })
  symbol!: string | null;

  @Column({
    name: 'category',
    type: 'enum',
    enum: UomCategory,
  })
  category!: UomCategory;

  @Column({ name: 'decimal_places', type: 'int', default: 0 })
  decimalPlaces!: number;

  @Index()
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
