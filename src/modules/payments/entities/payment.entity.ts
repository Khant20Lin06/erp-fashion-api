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
import { Customer } from '../../customer-supplier/entities/customer.entity';
import { Supplier } from '../../customer-supplier/entities/supplier.entity';
import { User } from '../../users/entities/user.entity';
import { PaymentMethod } from './payment-method.entity';
import { PaymentDirection } from './payment-direction.enum';
import { PaymentStatus } from './payment-status.enum';
import { PaymentAllocation } from './payment-allocation.entity';

/**
 * Payment header (Phase 16 locked decisions D1-D18). Dedicated,
 * authoritative payment record (D1) — never embedded inside Sale/
 * PurchaseOrder. Company-scoped as the primary tenancy key, matching every
 * prior transactional-document phase's pattern exactly (Sale/PurchaseOrder/
 * GoodsReceipt/StockTransfer/StockAdjustment).
 *
 * direction (D2) determines which of customerId/supplierId is set:
 * RECEIPT requires customerId set + supplierId null (customer pays the
 * company, allocatable only against SALE references); PAYMENT requires
 * supplierId set + customerId null (the company pays a supplier,
 * allocatable only against PURCHASE_ORDER references). Enforced in
 * PaymentsService, not a DB CHECK constraint (D-locked: this codebase has
 * never used CHECK constraints, so validation stays in the service layer,
 * consistent with every prior phase's "exactly one of X/Y" rules such as
 * Sale.branchId/warehouseId cross-validation).
 *
 * idempotencyKey (D11) is nullable and unique per company
 * (UNIQUE(company_id, idempotency_key) — MySQL treats multiple NULLs in a
 * unique index as non-colliding, so companies that never supply a key are
 * unaffected). A repeat POST /payments with the same key returns the
 * original payment (200), never a duplicate.
 *
 * No CashAccount/BankAccount/FinancialAccount entity anywhere (D8) — the
 * paymentMethodId FK plus this entity's own free-text `reference` field is
 * the complete money-instrument model. No JournalEntry/GL/ChartOfAccounts
 * integration hook of any kind (D9) — Phase 17's future concern, not even
 * a "prepared" interface here. No refund/reversal/void (D10) — CANCELLED
 * is a real reachable status but nothing in this phase ever transitions a
 * Payment to it (see payment-status.enum.ts's own docblock).
 */
@Entity('payments')
@Index(['companyId', 'paymentNumber'], { unique: true })
@Index(['companyId', 'idempotencyKey'], { unique: true })
export class Payment extends BaseEntity {
  @Column({ name: 'payment_number', type: 'varchar', length: 50 })
  paymentNumber!: string;

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
    name: 'direction',
    type: 'enum',
    enum: PaymentDirection,
  })
  direction!: PaymentDirection;

  @Index()
  @Column({ name: 'customer_id', type: 'char', length: 36, nullable: true })
  customerId!: string | null;

  @ManyToOne(() => Customer, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer?: Customer | null;

  @Index()
  @Column({ name: 'supplier_id', type: 'char', length: 36, nullable: true })
  supplierId!: string | null;

  @ManyToOne(() => Supplier, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'supplier_id' })
  supplier?: Supplier | null;

  @Index()
  @Column({ name: 'payment_method_id', type: 'char', length: 36 })
  paymentMethodId!: string;

  @ManyToOne(() => PaymentMethod, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'payment_method_id' })
  paymentMethod?: PaymentMethod;

  @Column({ name: 'amount', type: 'decimal', precision: 14, scale: 2 })
  amount!: string;

  @Column({ name: 'currency', type: 'char', length: 3 })
  currency!: string;

  @Column({ name: 'reference', type: 'varchar', length: 255, nullable: true })
  reference!: string | null;

  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  idempotencyKey!: string | null;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.Confirmed,
  })
  status!: PaymentStatus;

  @Index()
  @Column({ name: 'payment_date', type: 'timestamp' })
  paymentDate!: Date;

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

  @OneToMany(() => PaymentAllocation, (allocation) => allocation.payment)
  allocations?: PaymentAllocation[];
}
