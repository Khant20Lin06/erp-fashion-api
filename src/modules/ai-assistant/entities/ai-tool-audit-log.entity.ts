import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Company } from '../../organization/entities/company.entity';
import { User } from '../../users/entities/user.entity';

export enum AiToolExecutionStatus {
  Success = 'SUCCESS',
  Failed = 'FAILED',
  DeniedPermission = 'DENIED_PERMISSION',
  DeniedGuardrails = 'DENIED_GUARDRAILS',
  ApprovalRequired = 'APPROVAL_REQUIRED',
}

@Entity('ai_tool_audit_logs')
@Index('IDX_ai_tool_audit_comp_tool_created', ['companyId', 'toolName', 'createdAt'])
export class AiToolAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'conversation_id', type: 'varchar', length: 36, nullable: true })
  conversationId!: string | null;

  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ name: 'branch_id', type: 'char', length: 36, nullable: true })
  branchId!: string | null;

  @Column({ name: 'tool_name', type: 'varchar', length: 100 })
  toolName!: string;

  @Column({ name: 'tool_type', type: 'varchar', length: 20, default: 'read' })
  toolType!: string;

  @Column({ name: 'risk_level', type: 'varchar', length: 20, default: 'low' })
  riskLevel!: string;

  @Column({ name: 'arguments', type: 'json' })
  arguments!: unknown;

  @Column({
    name: 'status',
    type: 'enum',
    enum: AiToolExecutionStatus,
    default: AiToolExecutionStatus.Success,
  })
  status!: AiToolExecutionStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ name: 'duration_ms', type: 'int', default: 0 })
  durationMs!: number;

  @Column({ name: 'approved_by', type: 'char', length: 36, nullable: true })
  approvedBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}
