import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Customer } from '../../customer-supplier/entities/customer.entity';
import { LinkStatus } from './link-status.enum';

/**
 * Links a Telegram account to exactly one Customer record — the identity
 * boundary the Customer Service Bot uses to decide "whose order/data is
 * this," instead of trusting a client-supplied phone/customerId directly
 * (docs/SECURITY_RULES.md #12 — never trust a client-provided identifier
 * for authorization). A Telegram user proves ownership of a phone number
 * via OTP verification (CustomerPortalService.verifyOtpAndLink) before a
 * row is written here; after that, telegramUserId is the only input the
 * bot integration needs to resolve the caller's own Customer server-side.
 *
 * Exactly one row per Telegram account, ever (unique index on
 * telegramUserId) — re-linking (e.g. the phone number changed) UPDATES
 * this same row's customerId/status/linkedAt in place rather than
 * inserting a second row, since the unique index means a superseded row
 * could never be replaced by a new insert anyway. status distinguishes a
 * currently-usable link (ACTIVE) from one an admin has revoked
 * (REVOKED) — see CustomerPortalService.verifyLinkAndGetCustomer.
 */
@Entity('customer_telegram_links')
@Index(['telegramUserId'], { unique: true })
export class CustomerTelegramLink extends BaseEntity {
  @Column({ name: 'telegram_user_id', type: 'varchar', length: 64 })
  telegramUserId!: string;

  @Column({ name: 'customer_id', type: 'char', length: 36 })
  customerId!: string;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: LinkStatus,
    default: LinkStatus.Active,
  })
  status!: LinkStatus;

  @Column({ name: 'linked_at', type: 'timestamp' })
  linkedAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true })
  revokedAt!: Date | null;
}
