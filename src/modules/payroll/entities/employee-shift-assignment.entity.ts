import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { Shift } from './shift.entity';

/**
 * EmployeeShiftAssignment — effective-dated, mirrors EmployeeAssignment's
 * own shape exactly (same effectiveFrom/effectiveTo/overlap-prevention
 * discipline). Deliberately a SEPARATE entity from EmployeeAssignment
 * (department/designation/warehouse) rather than adding a shiftId column to
 * it — shift scheduling and org-structure assignment are independent
 * concerns that change on independent cadences (per this project's own
 * precedent of keeping single-purpose transactional-adjacent entities
 * narrow, e.g. StockAdjustment/StockTransfer/GoodsReceipt never merged).
 *
 * Only one ACTIVE assignment per employee may exist for any given date —
 * enforced in EmployeeShiftAssignmentsService via the same Brackets-based
 * overlap query EmployeeAssignmentsService.assertNoOverlap already uses.
 * Historical payroll calculation must resolve the assignment valid AS OF
 * the payroll period date, never "the employee's current shift" — this
 * requires a fresh as-of-date resolver (no such resolver exists elsewhere
 * in this codebase to reuse), authored in PayrollCalculationService.
 */
@Entity('employee_shift_assignments')
@Index(['employeeId', 'effectiveFrom'])
export class EmployeeShiftAssignment extends BaseEntity {
  @Column({ name: 'employee_id', type: 'char', length: 36 })
  employeeId!: string;

  @ManyToOne(() => Employee, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;

  @Column({ name: 'shift_id', type: 'char', length: 36 })
  shiftId!: string;

  @ManyToOne(() => Shift, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'shift_id' })
  shift!: Shift;

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom!: string;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo!: string | null;

  @Column({ name: 'created_by', type: 'char', length: 36, nullable: true })
  createdBy!: string | null;
}
