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
import { Sale } from '../../sales/entities/sale.entity';
import { User } from '../../users/entities/user.entity';
import { SaleReturnStatus } from './sale-return-status.enum';
import { SaleReturnItem } from './sale-return-item.entity';

/**
 * SaleReturn — a full or partial return against a CONFIRMED Sale. A
 * dedicated document type, not a Sale status, because Sale's own state
 * machine has no reachable transition out of CONFIRMED (it is terminal) —
 * see sales.service.ts's ALLOWED_TRANSITIONS. Company-scoped as the primary
 * tenancy key, matching every prior transactional-document phase exactly.
 *
 * customerId is denormalized from the parent Sale at creation time (not a
 * live re-read) so a return remains attributable even if Sale.customerId
 * could theoretically change in a future phase — mirrors the "preserve
 * historical facts" instruction directly.
 *
 * subtotal/discountAmount/refundAmount are DECIMAL(14,2), matching Sale's
 * own money precision exactly.
 */
@Entity('sale_returns')
@Index(['companyId', 'returnNumber'], { unique: true })
export class SaleReturn extends BaseEntity {
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
  @Column({ name: 'sale_id', type: 'char', length: 36 })
  saleId!: string;

  @ManyToOne(() => Sale, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sale_id' })
  sale!: Sale;

  @Index()
  @Column({ name: 'customer_id', type: 'char', length: 36 })
  customerId!: string;

  @ManyToOne(() => Customer, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: SaleReturnStatus,
    default: SaleReturnStatus.Draft,
  })
  status!: SaleReturnStatus;

  @Column({ name: 'reason', type: 'varchar', length: 500, nullable: true })
  reason!: string | null;

  @Column({ name: 'notes', type: 'varchar', length: 1000, nullable: true })
  notes!: string | null;

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
    name: 'refund_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
  })
  refundAmount!: string;

  /** Cumulative amount actually paid back via REFUND-direction Payments — mirrors Sale.paidAmount's own "inert until integration writes to it" shape. */
  @Column({
    name: 'refunded_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  refundedAmount!: string;

  @Column({ name: 'currency', type: 'char', length: 3 })
  currency!: string;

  @Column({ name: 'created_by', type: 'char', length: 36, nullable: true })
  createdBy!: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User | null;

  @Column({ name: 'confirmed_by', type: 'char', length: 36, nullable: true })
  confirmedBy!: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'confirmed_by' })
  confirmedByUser?: User | null;

  @Column({ name: 'confirmed_at', type: 'timestamp', nullable: true })
  confirmedAt!: Date | null;

  @OneToMany(() => SaleReturnItem, (item) => item.saleReturn)
  items?: SaleReturnItem[];
}
