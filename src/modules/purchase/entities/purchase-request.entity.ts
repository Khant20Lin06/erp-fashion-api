import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { Branch } from '../../organization/entities/branch.entity';
import { User } from '../../users/entities/user.entity';
import { PurchaseRequestItem } from './purchase-request-item.entity';
import { PurchaseRequestStatus } from './purchase-request-status.enum';

@Entity('purchase_requests')
@Index(['companyId', 'requestNumber'], { unique: true })
export class PurchaseRequest extends BaseEntity {
  @Column({ name: 'request_number', type: 'varchar', length: 50 })
  requestNumber!: string;

  @Index()
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Index()
  @Column({ name: 'branch_id', type: 'char', length: 36, nullable: true })
  branchId!: string | null;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'branch_id' })
  branch?: Branch | null;

  @Column({ name: 'department', type: 'varchar', length: 120 })
  department!: string;

  @Column({ name: 'requester_name', type: 'varchar', length: 120 })
  requesterName!: string;

  @Index()
  @Column({ name: 'required_date', type: 'timestamp' })
  requiredDate!: Date;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: PurchaseRequestStatus,
    default: PurchaseRequestStatus.Draft,
  })
  status!: PurchaseRequestStatus;

  @Column({ name: 'notes', type: 'varchar', length: 1000, nullable: true })
  notes!: string | null;

  @Column({ name: 'created_by', type: 'char', length: 36, nullable: true })
  createdBy!: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User | null;

  @Column({ name: 'updated_by', type: 'char', length: 36, nullable: true })
  updatedBy!: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedByUser?: User | null;

  @OneToMany(() => PurchaseRequestItem, (item) => item.purchaseRequest)
  items?: PurchaseRequestItem[];

  itemCount?: number;
}
