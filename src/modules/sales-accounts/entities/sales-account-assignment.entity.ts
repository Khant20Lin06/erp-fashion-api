import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { SalesAccountAssignmentStatus } from './sales-account-assignment-status.enum';
import { User } from '../../users/entities/user.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { SalesAccount } from './sales-account.entity';

/**
 * Normalized ownership relationship enabling one SalesAccount to be worked
 * by multiple users and one employee to hold multiple accounts (Phase 08
 * §32-36). History is preserved, never overwritten — reassignment creates a
 * new row and deactivates the old one (assignedAt/unassignedAt), so future
 * Sales reporting can answer "who owned this account at the time of sale"
 * (§36). This table grants no permission by itself; it is a business
 * ownership fact that Phase 12 combines with Role/Permission/DataScope.
 */
@Entity('sales_account_assignments')
export class SalesAccountAssignment extends BaseEntity {
  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'employee_id', type: 'char', length: 36 })
  employeeId!: string;

  @ManyToOne(() => Employee, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;

  @Column({ name: 'sales_account_id', type: 'char', length: 36 })
  salesAccountId!: string;

  @ManyToOne(() => SalesAccount, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sales_account_id' })
  salesAccount!: SalesAccount;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: SalesAccountAssignmentStatus,
    default: SalesAccountAssignmentStatus.Active,
  })
  status!: SalesAccountAssignmentStatus;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary!: boolean;

  @Column({ name: 'assigned_at', type: 'timestamp' })
  assignedAt!: Date;

  @Column({ name: 'unassigned_at', type: 'timestamp', nullable: true })
  unassignedAt!: Date | null;
}
