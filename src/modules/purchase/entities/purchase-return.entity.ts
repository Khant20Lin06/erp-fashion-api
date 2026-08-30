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
import { Supplier } from '../../customer-supplier/entities/supplier.entity';
import { User } from '../../users/entities/user.entity';
import { PurchaseOrder } from './purchase-order.entity';
import { PurchaseInvoice } from './purchase-invoice.entity';
import { PurchaseReturnStatus } from './purchase-return-status.enum';
import { PurchaseReturnItem } from './purchase-return-item.entity';

@Entity('purchase_returns')
@Index(['companyId', 'returnNumber'], { unique: true })
export class PurchaseReturn extends BaseEntity {
  @Column({ name: 'return_number', type: 'varchar', length: 50 })
  returnNumber!: string;

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
  @Column({ name: 'supplier_id', type: 'char', length: 36 })
  supplierId!: string;

  @ManyToOne(() => Supplier, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplier_id' })
  supplier!: Supplier;

  @Index()
  @Column({ name: 'purchase_order_id', type: 'char', length: 36 })
  purchaseOrderId!: string;

  @ManyToOne(() => PurchaseOrder, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder!: PurchaseOrder;

  @Index()
  @Column({ name: 'purchase_invoice_id', type: 'char', length: 36 })
  purchaseInvoiceId!: string;

  @ManyToOne(() => PurchaseInvoice, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'purchase_invoice_id' })
  purchaseInvoice!: PurchaseInvoice;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: PurchaseReturnStatus,
    default: PurchaseReturnStatus.Draft,
  })
  status!: PurchaseReturnStatus;

  @Column({ name: 'reason', type: 'varchar', length: 255 })
  reason!: string;

  @Column({ name: 'notes', type: 'varchar', length: 1000, nullable: true })
  notes!: string | null;

  @Column({ name: 'subtotal', type: 'decimal', precision: 14, scale: 2 })
  subtotal!: string;

  @Column({
    name: 'credit_applied_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  creditAppliedAmount!: string;

  @Column({
    name: 'supplier_credit_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  supplierCreditAmount!: string;

  @Column({ name: 'currency', type: 'char', length: 3 })
  currency!: string;

  @Column({ name: 'created_by', type: 'char', length: 36, nullable: true })
  createdBy!: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User | null;

  @Column({ name: 'completed_by', type: 'char', length: 36, nullable: true })
  completedBy!: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'completed_by' })
  completedByUser?: User | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt!: Date | null;

  @OneToMany(() => PurchaseReturnItem, (item) => item.purchaseReturn)
  items?: PurchaseReturnItem[];
}
