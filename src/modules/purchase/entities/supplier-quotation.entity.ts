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
import { Supplier } from '../../customer-supplier/entities/supplier.entity';
import { PaymentTerm } from '../../customer-supplier/entities/payment-term.entity';
import { User } from '../../users/entities/user.entity';
import { PurchaseRfq } from './purchase-rfq.entity';
import { SupplierQuotationStatus } from './supplier-quotation-status.enum';
import { SupplierQuotationItem } from './supplier-quotation-item.entity';

@Entity('supplier_quotations')
@Index(['companyId', 'quotationNumber'], { unique: true })
@Index(['companyId', 'purchaseRfqId', 'supplierId'], { unique: true })
export class SupplierQuotation extends BaseEntity {
  @Column({ name: 'quotation_number', type: 'varchar', length: 50 })
  quotationNumber!: string;

  @Index()
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Index()
  @Column({ name: 'purchase_rfq_id', type: 'char', length: 36 })
  purchaseRfqId!: string;

  @ManyToOne(() => PurchaseRfq, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'purchase_rfq_id' })
  purchaseRfq!: PurchaseRfq;

  @Index()
  @Column({ name: 'supplier_id', type: 'char', length: 36 })
  supplierId!: string;

  @ManyToOne(() => Supplier, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplier_id' })
  supplier!: Supplier;

  @Index()
  @Column({ name: 'payment_term_id', type: 'char', length: 36, nullable: true })
  paymentTermId!: string | null;

  @ManyToOne(() => PaymentTerm, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'payment_term_id' })
  paymentTerm?: PaymentTerm | null;

  @Column({ name: 'lead_time_days', type: 'int', nullable: true })
  leadTimeDays!: number | null;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: SupplierQuotationStatus,
    default: SupplierQuotationStatus.Submitted,
  })
  status!: SupplierQuotationStatus;

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

  @Column({ name: 'currency', type: 'char', length: 3 })
  currency!: string;

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

  @OneToMany(() => SupplierQuotationItem, (item) => item.supplierQuotation)
  items?: SupplierQuotationItem[];
}
