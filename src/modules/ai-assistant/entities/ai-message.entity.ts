import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AiConversation } from './ai-conversation.entity';
import { AiMessageRole } from './ai-message-role.enum';

/**
 * One turn in a conversation. No BaseEntity — messages are append-only,
 * system-written (no soft-delete/createdBy; deleting a conversation cascades
 * to its messages, matching WebhookDelivery's own "own id+createdAt, no
 * soft-delete" precedent for system-authored rows).
 *
 * toolCalls/toolResults are stored as-is (JSON) for audit/replay purposes —
 * never re-executed from storage, only ever produced once by the live
 * pipeline. model/promptTokens/completionTokens are populated ONLY from a
 * real provider response; never estimated (Phase 19 §31 "usage unavailable"
 * rule).
 */
@Entity('ai_messages')
@Index(['conversationId', 'createdAt'])
export class AiMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'conversation_id', type: 'char', length: 36 })
  conversationId!: string;

  @ManyToOne(() => AiConversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: AiConversation;

  @Column({ name: 'role', type: 'enum', enum: AiMessageRole })
  role!: AiMessageRole;

  @Column({ name: 'content', type: 'text' })
  content!: string;

  @Column({ name: 'tool_calls', type: 'json', nullable: true })
  toolCalls!: unknown;

  @Column({ name: 'tool_results', type: 'json', nullable: true })
  toolResults!: unknown;

  @Column({ name: 'model', type: 'varchar', length: 150, nullable: true })
  model!: string | null;

  @Column({ name: 'prompt_tokens', type: 'int', nullable: true })
  promptTokens!: number | null;

  @Column({ name: 'completion_tokens', type: 'int', nullable: true })
  completionTokens!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}
