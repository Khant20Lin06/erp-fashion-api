import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { Company } from '../../organization/entities/company.entity';
import { Branch } from '../../organization/entities/branch.entity';
import { AttendanceStatus } from './attendance-status.enum';

@Entity('attendance_records')
@Index(['employeeId', 'attendanceDate'], { unique: true })
@Index(['companyId', 'branchId', 'attendanceDate'])
export class AttendanceRecord extends BaseEntity {
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

  @Column({ name: 'attendance_date', type: 'date' })
  attendanceDate!: string;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: AttendanceStatus,
    default: AttendanceStatus.Present,
  })
  status!: AttendanceStatus;

  @Column({ name: 'check_in_at', type: 'timestamp', nullable: true })
  checkInAt!: Date | null;

  @Column({ name: 'check_out_at', type: 'timestamp', nullable: true })
  checkOutAt!: Date | null;

  @Column({ name: 'note', type: 'varchar', length: 1000, nullable: true })
  note!: string | null;
}
