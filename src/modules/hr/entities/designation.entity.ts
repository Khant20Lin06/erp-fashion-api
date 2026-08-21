import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { DesignationStatus } from './designation-status.enum';

@Entity('designations')
@Index(['companyId', 'name'], { unique: true })
@Index(['companyId', 'code'], { unique: true })
export class Designation extends BaseEntity {
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ name: 'name', type: 'varchar', length: 150 })
  name!: string;

  @Column({ name: 'code', type: 'varchar', length: 50, nullable: true })
  code!: string | null;

  @Column({ name: 'description', type: 'varchar', length: 500, nullable: true })
  description!: string | null;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: DesignationStatus,
    default: DesignationStatus.Active,
  })
  status!: DesignationStatus;
}
