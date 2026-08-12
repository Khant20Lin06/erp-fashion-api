import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { SalesAccountStatus } from './sales-account-status.enum';
import { Company } from '../../organization/entities/company.entity';
import { Branch } from '../../organization/entities/branch.entity';
import { Employee } from '../../employees/entities/employee.entity';

/**
 * Sales ownership/portfolio identity (Phase 08 §27-31) — deliberately NOT
 * named "Account" to avoid colliding with the unrelated Accounting/GL
 * Account concept (Phase 17). Answers "who owns this book of sales," never
 * a login identity and never a chart-of-accounts entry. employeeId is
 * nullable: an account can exist unassigned before being staffed.
 */
@Entity('sales_accounts')
@Index(['companyId', 'code'], { unique: true })
export class SalesAccount extends BaseEntity {
  @Column({ name: 'code', type: 'varchar', length: 50 })
  code!: string;

  @Column({ name: 'name', type: 'varchar', length: 200 })
  name!: string;

  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ name: 'branch_id', type: 'char', length: 36 })
  branchId!: string;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branch_id' })
  branch!: Branch;

  @Column({ name: 'employee_id', type: 'char', length: 36, nullable: true })
  employeeId!: string | null;

  @ManyToOne(() => Employee, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'employee_id' })
  employee?: Employee | null;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: SalesAccountStatus,
    default: SalesAccountStatus.Active,
  })
  status!: SalesAccountStatus;
}
