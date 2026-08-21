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
 * Per-(company, year) payroll-run-number sequence, same shape/convention as
 * CompanyPayrollPeriodCounter. Run numbers look like PR-2026-000001.
 */
@Entity('company_payroll_run_counters')
@Index(['companyId', 'year'], { unique: true })
export class CompanyPayrollRunCounter {
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
