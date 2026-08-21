import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { User } from '../../users/entities/user.entity';
import { AiKnowledgeScope } from './ai-knowledge-scope.enum';
import { AiKnowledgeStatus } from './ai-knowledge-status.enum';

/**
 * A knowledge-base document ingested for RAG retrieval. Content arrives as
 * plain text/markdown in the request body only (Phase 19 scope decision —
 * no file-upload infrastructure exists in this codebase; building one is
 * out of scope for this phase, see the final report's Remaining Gaps).
 *
 * companyId is nullable ONLY for SYSTEM-scope documents (visible to every
 * company); every COMPANY-scope document must carry a real companyId — this
 * is enforced in AiKnowledgeService.create(), not at the DB constraint
 * level, matching this codebase's convention of nullable-FK-plus-service-
 * level-invariant elsewhere (see Payment.supplierId/customerId).
 *
 * contentHash is the deduplication key (Phase 19 §16): re-ingesting a
 * document whose raw content hasn't changed skips re-chunking/re-embedding
 * — but this is scoped to (companyId, contentHash), never globally, so two
 * different companies uploading identical policy text are NOT merged.
 */
@Entity('ai_knowledge_documents')
@Index(['companyId', 'status'])
@Index(['companyId', 'contentHash'])
export class AiKnowledgeDocument extends BaseEntity {
  @Column({ name: 'company_id', type: 'char', length: 36, nullable: true })
  companyId!: string | null;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'company_id' })
  company!: Company | null;

  @Column({ name: 'scope', type: 'enum', enum: AiKnowledgeScope })
  scope!: AiKnowledgeScope;

  @Column({ name: 'title', type: 'varchar', length: 255 })
  title!: string;

  @Column({ name: 'content', type: 'longtext' })
  content!: string;

  @Column({ name: 'content_hash', type: 'char', length: 64 })
  contentHash!: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: AiKnowledgeStatus,
    default: AiKnowledgeStatus.Pending,
  })
  status!: AiKnowledgeStatus;

  @Column({
    name: 'error_message',
    type: 'varchar',
    length: 1000,
    nullable: true,
  })
  errorMessage!: string | null;

  @Column({ name: 'chunk_count', type: 'int', default: 0 })
  chunkCount!: number;

  @Column({
    name: 'embedding_model',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  embeddingModel!: string | null;

  @Column({ name: 'created_by', type: 'char', length: 36, nullable: true })
  createdBy!: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser!: User | null;
}
