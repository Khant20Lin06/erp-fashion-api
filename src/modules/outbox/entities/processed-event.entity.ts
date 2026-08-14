import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Consumer-side idempotency ledger (Phase 18 D6, LOCKED). At-least-once
 * Kafka delivery means a consumer group can see the same eventId more than
 * once (redelivery after a crash before offset commit, rebalance, etc.) —
 * this table is the durable, DB-table-backed idempotency check every
 * consumer must perform BEFORE doing its side effect, never an in-memory
 * Set (which would not survive a process restart and would not be shared
 * across consumer instances).
 *
 * UNIQUE(event_id, consumer_name): a given event may legitimately be
 * processed once per distinct consumer (e.g. an audit consumer AND some
 * future different consumer both process the same payment.confirmed event,
 * each exactly once), but never twice by the SAME consumer. No FK to
 * outbox_events — event_id here is the envelope's eventId as received off
 * Kafka, which a consumer processes independently of the producer's own
 * outbox_events row (a consumer may run in a different service entirely in
 * principle, even though today it's in-process).
 */
@Entity('processed_events')
@Index(['eventId', 'consumerName'], { unique: true })
export class ProcessedEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_id', type: 'char', length: 36 })
  eventId!: string;

  @Column({ name: 'consumer_name', type: 'varchar', length: 150 })
  consumerName!: string;

  @Column({ name: 'processed_at', type: 'timestamp' })
  processedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}
