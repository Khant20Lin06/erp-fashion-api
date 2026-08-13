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
import { Customer } from '../../customer-supplier/entities/customer.entity';
import { SalesAccount } from '../../sales-accounts/entities/sales-account.entity';
import { User } from '../../users/entities/user.entity';
import { SaleItem } from './sale-item.entity';
import { SaleStatus } from './sale-status.enum';
import { SaleType } from './sale-type.enum';

/**
 * Sale header (Phase 12 locked decisions). Company-scoped as the primary
 * tenancy key (companyId required, RESTRICT), matching every prior phase's
 * company-scope pattern. branchId/warehouseId are optional, validated
 * against the resolved company (and, for warehouse, the resolved branch)
 * exactly like Warehouse (Phase 07) does for Branch. customerId is
 * required — every Sale belongs to exactly one Customer, RESTRICT so a
 * Customer can never be hard-deleted out from under historical sales
 * (Customer itself is soft-delete only, matching Phase 11's own
 * convention). salesAccountId is nullable and transaction-level only — see
 * docs/SALES_ARCHITECTURE.md "SalesAccount Integration"; no permanent
 * Customer<->SalesAccount table exists (Phase 11 locked decision §10,
 * carried into Phase 12 as the resolving phase).
 *
 * Money columns use DECIMAL(14,2), matching Customer's own precision
 * (Phase 11), not Product/PriceList's narrower DECIMAL(12,2) — a Sale's
 * grandTotal sums multiple line totals and can exceed any single product's
 * price, so the wider Customer-level precision is the more defensible
 * choice (documented in docs/SALES_ARCHITECTURE.md "Money Precision").
 *
 * paidAmount/balanceAmount are inert integration-point fields for Phase 16
 * (Payment) — Phase 12 only initializes balanceAmount = grandTotal and
 * paidAmount = 0 at creation; nothing in this phase ever writes to them
 * again. No approval workflow, no tax engine, no audit log exist in this
 * phase — see docs/SALES_ARCHITECTURE.md for the explicit boundary
 * statements.
 */
@Entity('sales')
@Index(['companyId', 'saleNumber'], { unique: true })
export class Sale extends BaseEntity {
  @Column({ name: 'sale_number', type: 'varchar', length: 50 })
  saleNumber!: string;

  @Index()
  @Column({
    name: 'sale_type',
    type: 'enum',
    enum: SaleType,
    default: SaleType.Retail,
  })
  saleType!: SaleType;

  @Index()
  @Column({ name: 'customer_id', type: 'char', length: 36 })
  customerId!: string;

  @ManyToOne(() => Customer, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer;

  @Index()
  @Column({
    name: 'sales_account_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  salesAccountId!: string | null;

  @ManyToOne(() => SalesAccount, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'sales_account_id' })
  salesAccount?: SalesAccount | null;

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
  @Column({ name: 'transaction_date', type: 'timestamp' })
  transactionDate!: Date;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: SaleStatus,
    default: SaleStatus.Draft,
  })
  status!: SaleStatus;

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

  @OneToMany(() => SaleItem, (item) => item.sale)
  items?: SaleItem[];
}
