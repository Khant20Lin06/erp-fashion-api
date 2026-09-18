import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { Customer } from '../../customer-supplier/entities/customer.entity';
import { Sale } from '../../sales/entities/sale.entity';
import { OnlineOrderSource } from './online-order-source.enum';
import { OnlineOrderStatus } from './online-order-status.enum';
import { CodStatus } from './cod-status.enum';

/**
 * A bot/online-placed order — a dedicated document type wrapping a Sale,
 * never a Sale field or a SaleStatus value. Mirrors SaleReturn's own
 * precedent exactly (sales-returns/entities/sale-return.entity.ts's
 * docblock: "a dedicated document type... because Sale's own state
 * machine has no reachable transition" for what this concern needs):
 * Sale.status stays DRAFT/CONFIRMED/CANCELLED (locked, Phase 12 §E) and
 * Sale.fulfillmentStatus stays PENDING_SHIPMENT/SHIPPED/DELIVERED
 * (locked, this module's own addition) — this entity's own `status`
 * (OnlineOrderStatus) is a separate, more granular delivery lifecycle
 * that exists ONLY for orders placed through a bot/online channel, with
 * no effect on how a POS-originated Sale is tracked.
 *
 * saleId is unique — exactly one OnlineOrder per Sale, created in a
 * second write immediately after the underlying Sale has committed (see
 * CustomerPortalService.createOrder's own docblock for why this cannot
 * share Sale's transaction) and never retro-fitted onto an existing POS
 * sale.
 *
 * customerId is denormalized from the Sale at creation time (not a live
 * re-read), matching SaleReturn.customerId's own "preserve historical
 * facts" rationale.
 */
@Entity('online_orders')
@Index(['saleId'], { unique: true })
export class OnlineOrder extends BaseEntity {
  @Index()
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

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
    name: 'source',
    type: 'enum',
    enum: OnlineOrderSource,
  })
  source!: OnlineOrderSource;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: OnlineOrderStatus,
    default: OnlineOrderStatus.PendingReview,
  })
  status!: OnlineOrderStatus;

  /** Numeric Telegram chat/user id as a string (can exceed JS safe-integer range) — null for non-Telegram sources. */
  @Column({ name: 'telegram_user_id', type: 'varchar', length: 64, nullable: true })
  telegramUserId!: string | null;

  /** @username at order time — a display convenience only, never used for identity resolution (that is always telegramUserId, see CustomerTelegramLink). Telegram usernames are optional and can be null/changed. */
  @Column({ name: 'telegram_username', type: 'varchar', length: 64, nullable: true })
  telegramUsername!: string | null;

  @Column({ name: 'delivery_address', type: 'varchar', length: 500 })
  deliveryAddress!: string;

  @Column({ name: 'courier_service', type: 'varchar', length: 100, nullable: true })
  courierService!: string | null;

  @Column({ name: 'tracking_number', type: 'varchar', length: 100, nullable: true })
  trackingNumber!: string | null;

  @Column({
    name: 'cod_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: '0.00',
  })
  codAmount!: string;

  @Index()
  @Column({
    name: 'cod_status',
    type: 'enum',
    enum: CodStatus,
    default: CodStatus.None,
  })
  codStatus!: CodStatus;

  @Column({ name: 'rider_name', type: 'varchar', length: 100, nullable: true })
  riderName!: string | null;

  @Column({ name: 'rider_phone', type: 'varchar', length: 50, nullable: true })
  riderPhone!: string | null;

  @Column({ name: 'settled_at', type: 'timestamp', nullable: true })
  settledAt!: Date | null;

  @Column({ name: 'settled_by', type: 'char', length: 36, nullable: true })
  settledBy!: string | null;

  @Column({ name: 'status_updated_at', type: 'timestamp', nullable: true })
  statusUpdatedAt!: Date | null;
}
