import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { Branch } from '../../organization/entities/branch.entity';

/**
 * Shift — a reusable, company-scoped (optionally branch-scoped) working-time
 * template. Mirrors LeaveType/Department's own "simple company-scoped master
 * data" shape exactly (extends BaseEntity for soft-delete, since a Shift
 * referenced by historical EmployeeShiftAssignment rows must never be hard
 * deleted).
 *
 * startTime/endTime are stored as MySQL TIME columns (HH:mm:ss), not
 * DATE/TIMESTAMP — a Shift is a daily template, not a dated event.
 * endTime <= startTime is explicitly ALLOWED and means an overnight shift
 * (e.g. 22:00 -> 06:00); the service layer never assumes endTime > startTime.
 *
 * branchId is nullable — a null branchId means "available company-wide",
 * matching the nullable-FK pattern already used for
 * EmployeeAssignment.departmentId/designationId/warehouseId.
 */
@Entity('shifts')
@Index(['companyId', 'code'], { unique: true })
export class Shift extends BaseEntity {
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ name: 'branch_id', type: 'char', length: 36, nullable: true })
  branchId!: string | null;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'branch_id' })
  branch?: Branch | null;

  @Column({ name: 'name', type: 'varchar', length: 150 })
  name!: string;

  @Column({ name: 'code', type: 'varchar', length: 50 })
  code!: string;

  @Column({ name: 'start_time', type: 'time' })
  startTime!: string;

  @Column({ name: 'end_time', type: 'time' })
  endTime!: string;

  @Column({ name: 'break_minutes', type: 'int', default: 0 })
  breakMinutes!: number;

  @Column({ name: 'grace_minutes', type: 'int', default: 0 })
  graceMinutes!: number;

  @Index()
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_by', type: 'char', length: 36, nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'char', length: 36, nullable: true })
  updatedBy!: string | null;
}
