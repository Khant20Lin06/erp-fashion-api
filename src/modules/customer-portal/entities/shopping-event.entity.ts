import {
  Column,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ShoppingContext } from '../services/shopping-session';

/** Receipts survive process restarts and are never pruned by the cart TTL. */
@Entity('shopping_events')
@Index(['sessionId', 'eventId'], { unique: true })
export class ShoppingEvent {
  @PrimaryColumn({ type: 'char', length: 64 }) id!: string;
  @Column({ name: 'session_id', type: 'char', length: 64 }) sessionId!: string;
  @Column({ name: 'event_id', type: 'varchar', length: 64 }) eventId!: string;
  @Column({ name: 'input_hash', type: 'char', length: 64 }) inputHash!: string;
  @Column({ name: 'update_payload', type: 'json', nullable: true })
  updatePayload!: Record<string, unknown> | null;
  @Column({ type: 'json', nullable: true }) context!: ShoppingContext | null;
  @Column({ name: 'operation_token', type: 'char', length: 36, nullable: true })
  operationToken!: string | null;
  @Column({ name: 'consumed_token', type: 'char', length: 36, nullable: true })
  consumedToken!: string | null;
  @Column({ name: 'response_hash', type: 'char', length: 64, nullable: true })
  responseHash!: string | null;
  @Column({ type: 'boolean', default: false }) completed!: boolean;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt!: Date;
}
