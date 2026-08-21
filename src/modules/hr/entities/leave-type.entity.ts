import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { LeaveTypeStatus } from './leave-type-status.enum';

@Entity('leave_types')
@Index(['companyId', 'name'], { unique: true })
@Index(['companyId', 'code'], { unique: true })
export class LeaveType extends BaseEntity {
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ name: 'name', type: 'varchar', length: 150 })
  name!: string;

  @Column({ name: 'code', type: 'varchar', length: 50 })
  code!: string;

  @Column({ name: 'description', type: 'varchar', length: 500, nullable: true })
  description!: string | null;

  @Column({ name: 'is_paid', type: 'boolean', default: false })
  isPaid!: boolean;

  @Column({
    name: 'default_days',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  defaultDays!: string | null;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: LeaveTypeStatus,
    default: LeaveTypeStatus.Active,
  })
  status!: LeaveTypeStatus;
}
