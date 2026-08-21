import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AiKnowledgeDocument } from './ai-knowledge-document.entity';

/**
 * One deterministic chunk of a knowledge document, plus its embedding
 * vector. Storage strategy (Phase 19 scope decision, documented honestly —
 * NOT a permanent architectural claim): MySQL 8.0.40 has no native vector
 * type or ANN index, so `embedding` is a JSON array of floats and
 * similarity search is computed in application code
 * (AiRagService — cosine similarity over each candidate company's chunks).
 * This does not scale to a very large knowledge base; if that becomes a
 * real requirement, introducing a dedicated vector store is a future
 * decision, not an oversight here (see final report §5/§13).
 *
 * companyId is denormalized from the parent document (not just joined)
 * specifically so retrieval can filter chunks at the query/index level by
 * companyId directly — Phase 19 §19's explicit "tenant filtering must
 * happen at the storage/query layer whenever possible" instruction.
 */
@Entity('ai_knowledge_chunks')
@Index(['companyId', 'documentId'])
@Index(['documentId', 'chunkIndex'], { unique: true })
export class AiKnowledgeChunk {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'document_id', type: 'char', length: 36 })
  documentId!: string;

  @ManyToOne(() => AiKnowledgeDocument, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document!: AiKnowledgeDocument;

  /** Denormalized from AiKnowledgeDocument.companyId — see class docblock. Null for SYSTEM-scope document chunks. */
  @Column({ name: 'company_id', type: 'char', length: 36, nullable: true })
  companyId!: string | null;

  @Column({ name: 'chunk_index', type: 'int' })
  chunkIndex!: number;

  @Column({ name: 'content', type: 'text' })
  content!: string;

  @Column({ name: 'embedding', type: 'json' })
  embedding!: number[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}
