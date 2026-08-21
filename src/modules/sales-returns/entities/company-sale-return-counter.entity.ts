import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Company } from '../../organization/entities/company.entity';

/**
 * Per-(company, year) sale-return-number sequence — exact structural mirror
 * of CompanySaleCounter/CompanyPaymentCounter. Return numbers look like
 * RET-2026-000001, generated via the same upsert-then-SELECT...FOR-UPDATE
 * pattern every prior document-numbering phase uses.
 */
@Entity('company_sale_return_counters')
@Index(['companyId', 'year'], { unique: true })
export class CompanySaleReturnCounter {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ name: 'year', type: 'int' })
  year!: number;

  @Column({ name: 'last_sequence', type: 'int', default: 0 })
  lastSequence!: number;
}
