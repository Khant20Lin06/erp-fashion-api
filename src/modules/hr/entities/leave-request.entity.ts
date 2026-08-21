import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { Company } from '../../organization/entities/company.entity';
import { Branch } from '../../organization/entities/branch.entity';
import { LeaveType } from './leave-type.entity';
import { LeaveRequestStatus } from './leave-request-status.enum';
import { User } from '../../users/entities/user.entity';

@Entity('leave_requests')
@Index(['companyId', 'branchId', 'status'])
@Index(['employeeId', 'fromDate', 'toDate'])
export class LeaveRequest extends BaseEntity {
  @Column({ name: 'employee_id', type: 'char', length: 36 })
  employeeId!: string;

  @ManyToOne(() => Employee, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;

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

  @Column({ name: 'leave_type_id', type: 'char', length: 36 })
  leaveTypeId!: string;

  @ManyToOne(() => LeaveType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'leave_type_id' })
  leaveType!: LeaveType;

  @Column({ name: 'from_date', type: 'date' })
  fromDate!: string;

  @Column({ name: 'to_date', type: 'date' })
  toDate!: string;

  @Column({ name: 'reason', type: 'varchar', length: 1000, nullable: true })
  reason!: string | null;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: LeaveRequestStatus,
    default: LeaveRequestStatus.Pending,
  })
  status!: LeaveRequestStatus;

  @Column({
    name: 'approved_by_user_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  approvedByUserId!: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'approved_by_user_id' })
  approvedByUser?: User | null;

  @Column({
    name: 'rejected_by_user_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  rejectedByUserId!: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'rejected_by_user_id' })
  rejectedByUser?: User | null;

  @Column({ name: 'decision_at', type: 'timestamp', nullable: true })
  decisionAt!: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamp', nullable: true })
  cancelledAt!: Date | null;
}
