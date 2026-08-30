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
import { PurchaseRequest } from './purchase-request.entity';
import { PurchaseRfqStatus } from './purchase-rfq-status.enum';
import { PurchaseRfqItem } from './purchase-rfq-item.entity';
import { SupplierQuotation } from './supplier-quotation.entity';

@Entity('purchase_rfqs')
@Index(['companyId', 'rfqNumber'], { unique: true })
export class PurchaseRfq extends BaseEntity {
  @Column({ name: 'rfq_number', type: 'varchar', length: 50 })
  rfqNumber!: string;

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

  @Index()
  @Column({
    name: 'purchase_request_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  purchaseRequestId!: string | null;

  @ManyToOne(() => PurchaseRequest, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'purchase_request_id' })
  purchaseRequest?: PurchaseRequest | null;

  @Column({ name: 'title', type: 'varchar', length: 160 })
  title!: string;

  @Index()
  @Column({ name: 'required_date', type: 'timestamp' })
  requiredDate!: Date;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: PurchaseRfqStatus,
    default: PurchaseRfqStatus.Draft,
  })
  status!: PurchaseRfqStatus;

  @Column({ name: 'invited_supplier_ids', type: 'simple-json' })
  invitedSupplierIds!: string[];

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

  @OneToMany(() => PurchaseRfqItem, (item) => item.purchaseRfq)
  items?: PurchaseRfqItem[];

  @OneToMany(() => SupplierQuotation, (quotation) => quotation.purchaseRfq)
  quotations?: SupplierQuotation[];
}
