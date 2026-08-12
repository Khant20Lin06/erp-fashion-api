import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from './company.entity';
import { Warehouse } from './warehouse.entity';
import { BranchStatus } from './branch-status.enum';

/**
 * companyId is set on create and never reassigned afterward (Phase 07 §64) —
 * there is no "move branch to another company" endpoint. A real transfer
 * need would be a dedicated, audited operation, not a PATCH.
 */
@Entity('branches')
@Index(['companyId', 'code'], { unique: true })
export class Branch extends BaseEntity {
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ name: 'code', type: 'varchar', length: 50 })
  code!: string;

  @Column({ name: 'name', type: 'varchar', length: 200 })
  name!: string;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: BranchStatus,
    default: BranchStatus.Active,
  })
  status!: BranchStatus;

  @Column({ name: 'phone', type: 'varchar', length: 50, nullable: true })
  phone!: string | null;

  @Column({ name: 'email', type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ name: 'address', type: 'varchar', length: 500, nullable: true })
  address!: string | null;

  @Column({ name: 'timezone', type: 'varchar', length: 100, nullable: true })
  timezone!: string | null;

  @OneToMany(() => Warehouse, (warehouse) => warehouse.branch)
  warehouses?: Warehouse[];
}
