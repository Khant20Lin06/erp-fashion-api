import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { User } from '../../users/entities/user.entity';

/**
 * A persistent AI chat conversation. Always owned by exactly one company
 * and one user (Phase 19 §8: no cross-user shared-conversation mechanism
 * exists elsewhere in this codebase, so none is invented here — every
 * conversation is private to the user who started it). branchId is
 * optional context carried through to DataScope-aware tool calls, not an
 * ownership boundary.
 */
@Entity('ai_conversations')
@Index(['companyId', 'userId', 'createdAt'])
export class AiConversation extends BaseEntity {
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ name: 'branch_id', type: 'char', length: 36, nullable: true })
  branchId!: string | null;

  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'title', type: 'varchar', length: 255, nullable: true })
  title!: string | null;
}
