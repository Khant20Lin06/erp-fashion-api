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
import { Warehouse } from '../../organization/entities/warehouse.entity';
import { Supplier } from '../../customer-supplier/entities/supplier.entity';
import { PaymentTerm } from '../../customer-supplier/entities/payment-term.entity';
import { User } from '../../users/entities/user.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';
import { PurchaseOrderStatus } from './purchase-order-status.enum';
import { PurchaseType } from './purchase-type.enum';
import { SupplierQuotation } from './supplier-quotation.entity';

/**
 * PurchaseOrder header (Phase 13 locked decisions). Company-scoped as the
 * primary tenancy key (companyId required, RESTRICT), mirroring Sale's
 * (Phase 12) own company-scope pattern exactly. branchId/warehouseId are
 * optional, validated against the resolved company (and, for warehouse,
 * the resolved branch) the same way Sale validates them. supplierId is
 * required — every PurchaseOrder belongs to exactly one Supplier, RESTRICT
 * so a Supplier can never be hard-deleted out from under historical
 * purchase orders (Supplier itself is soft-delete only, Phase 11). No
 * purchaserId/buyerId/requesterId field exists (Decision #9, LOCKED) —
 * Purchase is deliberately independent of SalesAccount/buyer attribution.
 *
 * Money columns use DECIMAL(14,2), matching Sale's own precision (Phase
 * 12) and Customer/Supplier's whole-transaction precision (Phase 11) — a
 * PurchaseOrder's grandTotal sums multiple line totals and can exceed any
 * single ProductVariant.costPrice, so the wider precision is the
 * defensible choice, consistent with docs/SALES_ARCHITECTURE.md "Money
 * Precision".
 *
 * paidAmount/balanceAmount are inert integration-point fields for Phase 16
 * (Payment) — Phase 13 only initializes balanceAmount = grandTotal and
 * paidAmount = 0 at creation; nothing in this phase ever writes to them
 * again. No Goods Receipt, no approval workflow, no tax engine, no audit
 * log exist in this phase — see docs/PURCHASE_ARCHITECTURE.md for the
 * explicit boundary statements.
 */
@Entity('purchase_orders')
@Index(['companyId', 'purchaseOrderNumber'], { unique: true })
export class PurchaseOrder extends BaseEntity {
  @Column({ name: 'purchase_order_number', type: 'varchar', length: 50 })
  purchaseOrderNumber!: string;

  @Index()
  @Column({
    name: 'purchase_type',
    type: 'enum',
    enum: PurchaseType,
    default: PurchaseType.Standard,
  })
  purchaseType!: PurchaseType;

  @Index()
  @Column({ name: 'supplier_id', type: 'char', length: 36 })
  supplierId!: string;

  @ManyToOne(() => Supplier, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplier_id' })
  supplier!: Supplier;

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
  @Column({ name: 'warehouse_id', type: 'char', length: 36, nullable: true })
  warehouseId!: string | null;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse?: Warehouse | null;

  @Index()
  @Column({ name: 'payment_term_id', type: 'char', length: 36, nullable: true })
  paymentTermId!: string | null;

  @ManyToOne(() => PaymentTerm, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'payment_term_id' })
  paymentTerm?: PaymentTerm | null;

  @Index()
  @Column({
    name: 'source_supplier_quotation_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  sourceSupplierQuotationId!: string | null;

  @ManyToOne(() => SupplierQuotation, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'source_supplier_quotation_id' })
  sourceSupplierQuotation?: SupplierQuotation | null;

  @Index()
  @Column({ name: 'transaction_date', type: 'timestamp' })
  transactionDate!: Date;

  @Column({
    name: 'expected_delivery_date',
    type: 'timestamp',
    nullable: true,
  })
  expectedDeliveryDate!: Date | null;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: PurchaseOrderStatus,
    default: PurchaseOrderStatus.Draft,
  })
  status!: PurchaseOrderStatus;

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

  /** Inert Phase 16 (Payment) integration field — never written to after creation in this phase. */
  @Column({
    name: 'paid_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  paidAmount!: string;

  /** Inert Phase 16 (Payment) integration field — initialized to grandTotal, never recalculated in this phase. */
  @Column({
    name: 'balance_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
  })
  balanceAmount!: string;

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

  @Column({ name: 'submitted_at', type: 'timestamp', nullable: true })
  submittedAt!: Date | null;

  @Column({ name: 'submitted_by', type: 'char', length: 36, nullable: true })
  submittedBy!: string | null;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt!: Date | null;

  @Column({ name: 'approved_by', type: 'char', length: 36, nullable: true })
  approvedBy!: string | null;

  @Column({ name: 'rejected_at', type: 'timestamp', nullable: true })
  rejectedAt!: Date | null;

  @Column({ name: 'rejected_by', type: 'char', length: 36, nullable: true })
  rejectedBy!: string | null;

  @Column({ name: 'rejected_reason', type: 'varchar', length: 500, nullable: true })
  rejectedReason!: string | null;

  @Column({ name: 'closed_at', type: 'timestamp', nullable: true })
  closedAt!: Date | null;

  @Column({ name: 'closed_by', type: 'char', length: 36, nullable: true })
  closedBy!: string | null;

  @Column({ name: 'close_reason', type: 'varchar', length: 500, nullable: true })
  closeReason!: string | null;

  @OneToMany(() => PurchaseOrderItem, (item) => item.purchaseOrder)
  items?: PurchaseOrderItem[];

  /** Query-only relation count populated by list queries when needed. */
  itemCount?: number;
}
