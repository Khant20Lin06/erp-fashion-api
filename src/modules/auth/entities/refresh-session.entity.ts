import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Phase 2 (frontend/backend integration) — opaque refresh-token session.
 * Mirrors PasswordResetToken's hashed-token pattern: the raw token is
 * handed to the client once (in an httpOnly cookie) and never persisted —
 * only its SHA-256 hash is stored, so a database read alone can never mint
 * a session. `revokedAt` (rather than a hard delete) preserves an audit
 * trail and lets reuse-after-rotation be detected instead of merely
 * "not found".
 */
@Entity('refresh_sessions')
export class RefreshSession extends BaseEntity {
  @Index()
  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'token_hash', type: 'varchar', length: 255, unique: true })
  tokenHash!: string;

  @Index()
  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true })
  revokedAt!: Date | null;

  /**
   * Set to the new session's id when this token is rotated out, so a reuse
   * of the old (already-rotated) token can be distinguished from a token
   * that was explicitly revoked via logout — both are rejected identically
   * to the caller, but this lets a future incident review tell them apart.
   */
  @Column({ name: 'replaced_by_id', type: 'char', length: 36, nullable: true })
  replacedById!: string | null;
}
