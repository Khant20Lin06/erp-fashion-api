import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Payment } from './payment.entity';
import { PaymentReferenceType } from './payment-reference-type.enum';

/**
 * PaymentAllocation (D3, LOCKED): a single payment may allocate its amount
 * across one or more target documents (Sale or PurchaseOrder), or fully to
 * one. Polymorphic referenceType/referenceId — no FK on referenceId,
 * mirroring StockMovement.referenceId's established precedent (Phase 14)
 * exactly, since a single FK column cannot target two different tables.
 *
 * No BaseEntity — mirrors SaleItem/PurchaseOrderItem's own shape (own id/
 * createdAt only, no updatedAt, no soft-delete): an allocation row is
 * never updated after creation (D5 — confirmed payments are immutable),
 * only ever created. paymentId is ON DELETE CASCADE (allocation rows are
 * meaningless without their parent payment), the one deliberate exception
 * to this codebase's otherwise-universal ON DELETE RESTRICT convention —
 * matching GoodsReceiptItem/StockTransferItem's own CASCADE-to-parent-only
 * pattern (Phase 14).
 */
@Entity('payment_allocations')
@Index(['referenceType', 'referenceId'])
export class PaymentAllocation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'payment_id', type: 'char', length: 36 })
  paymentId!: string;

  @ManyToOne(() => Payment, (payment) => payment.allocations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'payment_id' })
  payment?: Payment;

  @Column({
    name: 'reference_type',
    type: 'enum',
    enum: PaymentReferenceType,
  })
  referenceType!: PaymentReferenceType;

  @Column({ name: 'reference_id', type: 'char', length: 36 })
  referenceId!: string;

  @Column({
    name: 'allocated_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
  })
  allocatedAmount!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}
