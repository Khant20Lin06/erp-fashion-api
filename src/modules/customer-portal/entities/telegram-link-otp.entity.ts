import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

/**
 * Short-lived OTP proving a Telegram user controls the phone number they
 * claim, before CustomerTelegramLink is written — mirrors
 * PasswordResetToken's own "never store the raw secret, only its hash"
 * pattern (docs/SECURITY_RULES.md #43 Password Reset — same replay/
 * enumeration/expiry concerns apply here). codeHash, never the raw code,
 * is what's persisted; the raw code is only ever held in memory long
 * enough to send it out and is never logged (see CustomerPortalService).
 */
@Entity('telegram_link_otps')
export class TelegramLinkOtp extends BaseEntity {
  @Index()
  @Column({ name: 'telegram_user_id', type: 'varchar', length: 64 })
  telegramUserId!: string;

  @Column({ name: 'phone', type: 'varchar', length: 50 })
  phone!: string;

  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @Column({ name: 'code_hash', type: 'varchar', length: 255 })
  codeHash!: string;

  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attemptCount!: number;

  @Index()
  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt!: Date;

  @Column({ name: 'consumed_at', type: 'timestamp', nullable: true })
  consumedAt!: Date | null;
}
