import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { User } from '../../users/entities/user.entity';
import { NotificationStatus } from './notification-status.enum';
import { NotificationChannel } from './notification-channel.enum';

/**
 * Downstream, async-only effect of `payment.confirmed` (Phase 21, locked
 * scope: no financial mutation ever happens here — this table is never
 * read by any accounting/payment/inventory code path). Written by
 * NotificationEventConsumer (status PENDING, same row NotificationWorker
 * later updates to SENT/FAILED after calling the resolved
 * NotificationProvider) — see that consumer's own docblock for the full
 * Kafka -> Consumer -> BullMQ -> Worker pipeline this row flows through.
 *
 * Recipient model (locked decision, D-level judgment call documented
 * here): `userId` is NULLABLE and this phase always leaves it null — every
 * notification created from a `payment.confirmed` event is a
 * COMPANY-LEVEL notification (visible to any user with `notifications.read`
 * access to that company), not a per-user targeted one. This is the
 * simpler, more evidence-grounded choice: no role/mapping anywhere in this
 * codebase currently expresses "which specific user(s) should be notified
 * about a company's payment," and inventing one would be speculative. The
 * `userId` column exists now (rather than being added later as a breaking
 * schema change) so a future phase can populate it once a real targeting
 * rule exists, without another migration to add the column itself.
 *
 * Idempotency (mirrors ProcessedEvent's own UNIQUE-constraint-as-backstop
 * pattern): UNIQUE(`source_event_id`, `channel`) — chosen over
 * (source_event_id, user_id, channel) because this phase's recipient model
 * is company-level (userId is always null), so a two-column unique key on
 * (source_event_id, user_id, channel) would collapse every row to the same
 * (event, NULL, channel) tuple anyway under MySQL's NULL-distinct-values
 * unique-index semantics being unreliable to depend on for this purpose.
 * When per-user targeting is built, this constraint must be revisited
 * alongside it.
 */
@Entity('notifications')
@Index(['sourceEventId', 'channel'], { unique: true })
export class Notification extends BaseEntity {
  @Index()
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  /** Null = company-level notification (this phase's only recipient model — see class docblock). */
  @Index()
  @Column({ name: 'user_id', type: 'char', length: 36, nullable: true })
  userId!: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @Index()
  @Column({ name: 'event_type', type: 'varchar', length: 150 })
  eventType!: string;

  @Index()
  @Column({
    name: 'channel',
    type: 'enum',
    enum: NotificationChannel,
    default: NotificationChannel.InApp,
  })
  channel!: NotificationChannel;

  @Column({ name: 'title', type: 'varchar', length: 200 })
  title!: string;

  @Column({ name: 'body', type: 'text' })
  body!: string;

  /** Minimal structured data a client can use to deep-link (e.g. { paymentId }) — never a raw entity dump. */
  @Column({ name: 'data', type: 'json' })
  data!: Record<string, unknown>;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.Pending,
  })
  status!: NotificationStatus;

  /** The originating Kafka envelope's `eventId` — the idempotency key this row is deduplicated on (see class docblock). */
  @Column({ name: 'source_event_id', type: 'varchar', length: 36 })
  sourceEventId!: string;

  @Column({ name: 'sent_at', type: 'timestamp', nullable: true })
  sentAt!: Date | null;

  @Column({ name: 'failed_at', type: 'timestamp', nullable: true })
  failedAt!: Date | null;

  @Column({ name: 'last_error', type: 'varchar', length: 1000, nullable: true })
  lastError!: string | null;

  /** Minimal read-tracking (locked decision: nullable timestamp, not a full status-machine state, since no read/unread UI requirement is evidenced beyond "let a client mark one read"). */
  @Column({ name: 'read_at', type: 'timestamp', nullable: true })
  readAt!: Date | null;
}
