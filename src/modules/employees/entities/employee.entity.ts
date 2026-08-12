import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { EmployeeStatus } from './employee-status.enum';
import { User } from '../../users/entities/user.entity';
import { Company } from '../../organization/entities/company.entity';
import { Branch } from '../../organization/entities/branch.entity';

/**
 * Business/personnel identity, deliberately separate from User (login
 * identity) — Phase 08 §4-6. userId is nullable and unique: an Employee can
 * exist without a login (§4-5), and a User can exist without an Employee
 * (e.g. a system administrator, §79). Never stores authentication
 * credentials (§10) — email/phone here are business contact info, distinct
 * from User's login email (§67-68).
 */
@Entity('employees')
export class Employee extends BaseEntity {
  @Column({ name: 'employee_code', type: 'varchar', length: 50 })
  employeeCode!: string;

  @Column({ name: 'first_name', type: 'varchar', length: 100 })
  firstName!: string;

  @Column({ name: 'last_name', type: 'varchar', length: 100 })
  lastName!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 200 })
  displayName!: string;

  @Column({ name: 'phone', type: 'varchar', length: 50, nullable: true })
  phone!: string | null;

  @Column({ name: 'email', type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ name: 'user_id', type: 'char', length: 36, nullable: true })
  userId!: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

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

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: EmployeeStatus,
    default: EmployeeStatus.Active,
  })
  status!: EmployeeStatus;

  @Column({ name: 'joined_at', type: 'timestamp', nullable: true })
  joinedAt!: Date | null;

  @Column({ name: 'terminated_at', type: 'timestamp', nullable: true })
  terminatedAt!: Date | null;
}
