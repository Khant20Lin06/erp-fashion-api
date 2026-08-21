import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Company } from '../../organization/entities/company.entity';
import { Customer } from '../../customer-supplier/entities/customer.entity';
import { LoyaltyPointTransactionType } from './loyalty-point-transaction-type.enum';

/**
 * LoyaltyPointTransaction — append-only ledger. A customer's available
 * balance is ALWAYS derived as
 * SUM(EARN + REVERSAL(+) - REDEEM - REVERSAL(-)) — never a mutable
 * `customer.points` counter (LOCKED, per the phase spec's own instruction).
 * No update/delete method exists anywhere in this domain; every state
 * change is a new row.
 *
 * UNIQUE(company_id, source_type, source_id) mirrors JournalEntry's own
 * idempotency-by-source pattern exactly — an EARN transaction's
 * (sourceType=SALE, sourceId=sale.id) pair can only ever exist once,
 * preventing duplicate earning from retries/replays at the DB level, not
 * just an application-level check.
 *
 * pointsDelta is signed (positive for EARN/REVERSAL-that-restores,
 * negative for REDEEM/REVERSAL-that-claws-back) — mirrors
 * StockMovement.quantityChange's own signed-integer precedent exactly, so
 * balance is always `SUM(pointsDelta)`.
 */
@Entity('loyalty_point_transactions')
@Index(['companyId', 'sourceType', 'sourceId'], { unique: true })
@Index(['customerId', 'createdAt'])
export class LoyaltyPointTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Index()
  @Column({ name: 'customer_id', type: 'char', length: 36 })
  customerId!: string;

  @ManyToOne(() => Customer, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer;

  @Index()
  @Column({
    name: 'type',
    type: 'enum',
    enum: LoyaltyPointTransactionType,
  })
  type!: LoyaltyPointTransactionType;

  @Column({ name: 'points_delta', type: 'int' })
  pointsDelta!: number;

  /**
   * Only populated for REDEEM (the currency value the customer received/
   * saved) — DECIMAL(14,2), matches Sale's own money precision. Null for
   * EARN/REVERSAL/ADJUSTMENT (points-only, no direct currency amount).
   */
  @Column({
    name: 'redemption_value',
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  redemptionValue!: string | null;

  /** Polymorphic source discriminator — SALE for EARN, SALE_RETURN for REVERSAL, null for manual REDEEM/ADJUSTMENT. */
  @Column({
    name: 'source_type',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  sourceType!: string | null;

  @Column({ name: 'source_id', type: 'char', length: 36, nullable: true })
  sourceId!: string | null;

  /**
   * For a REVERSAL row, points back to the original EARN transaction being
   * reversed — required by the phase's own "traceable to the original
   * earning transaction" instruction. Null for every other type.
   */
  @Column({
    name: 'reverses_transaction_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  reversesTransactionId!: string | null;

  @Column({ name: 'notes', type: 'varchar', length: 500, nullable: true })
  notes!: string | null;

  @Column({ name: 'created_by', type: 'char', length: 36, nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}
