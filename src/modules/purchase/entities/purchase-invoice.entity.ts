import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { Supplier } from '../../customer-supplier/entities/supplier.entity';
import { User } from '../../users/entities/user.entity';
import { PurchaseOrder } from './purchase-order.entity';
import { PurchaseInvoiceStatus } from './purchase-invoice-status.enum';

@Entity('purchase_invoices')
@Index(['companyId', 'invoiceNumber'], { unique: true })
@Index(['companyId', 'purchaseOrderId'])
export class PurchaseInvoice extends BaseEntity {
  @Column({ name: 'invoice_number', type: 'varchar', length: 50 })
  invoiceNumber!: string;

  @Index()
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

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
  @Column({ name: 'invoice_date', type: 'timestamp' })
  invoiceDate!: Date;

  @Index()
  @Column({ name: 'due_date', type: 'timestamp' })
  dueDate!: Date;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: PurchaseInvoiceStatus,
    default: PurchaseInvoiceStatus.Draft,
  })
  status!: PurchaseInvoiceStatus;

  @Column({ name: 'subtotal', type: 'decimal', precision: 14, scale: 2 })
  subtotal!: string;

  @Column({
    name: 'discount_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  discountAmount!: string;

  @Column({
    name: 'tax_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  taxAmount!: string;

  @Column({ name: 'grand_total', type: 'decimal', precision: 14, scale: 2 })
  grandTotal!: string;

  @Column({
    name: 'paid_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  paidAmount!: string;

  @Column({
    name: 'credited_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  creditedAmount!: string;

  @Column({
    name: 'balance_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
  })
  balanceAmount!: string;

  @Column({ name: 'currency', type: 'char', length: 3 })
  currency!: string;

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

  @Column({ name: 'posted_at', type: 'timestamp', nullable: true })
  postedAt!: Date | null;

  @Column({ name: 'posted_by', type: 'char', length: 36, nullable: true })
  postedBy!: string | null;

  @Column({ name: 'voided_at', type: 'timestamp', nullable: true })
  voidedAt!: Date | null;

  @Column({ name: 'voided_by', type: 'char', length: 36, nullable: true })
  voidedBy!: string | null;

  @Column({ name: 'void_reason', type: 'varchar', length: 500, nullable: true })
  voidReason!: string | null;
}
