import {
  Column,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { JsonObject } from '../services/shopping-session';

/** Durable bot state; key includes tenant, authenticated integration and Telegram user. */
@Entity('shopping_sessions')
@Index(['companyId', 'botUserId', 'telegramUserId'], { unique: true })
export class ShoppingSession {
  @PrimaryColumn({ type: 'char', length: 64 }) id!: string;
  @Column({ name: 'company_id', type: 'char', length: 36 }) companyId!: string;
  @Column({ name: 'bot_user_id', type: 'char', length: 36 }) botUserId!: string;
  @Column({ name: 'telegram_user_id', type: 'varchar', length: 64 })
  telegramUserId!: string;
  @Column({ type: 'json' }) state!: JsonObject;
  @Column({
    name: 'active_event_id',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  activeEventId!: string | null;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt!: Date;
}
