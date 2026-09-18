import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { Branch } from '../../organization/entities/branch.entity';
import { User } from '../../users/entities/user.entity';
import { PosShiftStatus } from './pos-shift-status.enum';

@Entity('pos_shifts')
@Index(['companyId', 'branchId', 'status'])
@Index(['companyId', 'cashierId', 'status'])
export class PosShift extends BaseEntity {
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

  @Column({ name: 'cashier_id', type: 'char', length: 36 })
  cashierId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cashier_id' })
  cashier!: User;

  @Column({ name: 'shift_number', type: 'varchar', length: 50 })
  shiftNumber!: string;

  @Column({
    type: 'enum',
    enum: PosShiftStatus,
    default: PosShiftStatus.Open,
  })
  status!: PosShiftStatus;

  @Column({ name: 'opened_at', type: 'timestamp' })
  openedAt!: Date;

  @Column({ name: 'closed_at', type: 'timestamp', nullable: true })
  closedAt!: Date | null;

  @Column({
    name: 'opening_cash',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: '0.00',
  })
  openingCash!: string;

  @Column({
    name: 'expected_cash',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: '0.00',
  })
  expectedCash!: string;

  @Column({
    name: 'actual_cash',
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  actualCash!: string | null;

  @Column({
    name: 'cash_difference',
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  cashDifference!: string | null;

  @Column({
    name: 'total_sales_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: '0.00',
  })
  totalSalesAmount!: string;

  @Column({ name: 'total_sales_count', type: 'int', default: 0 })
  totalSalesCount!: number;

  @Column({
    name: 'total_returns_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: '0.00',
  })
  totalReturnsAmount!: string;

  @Column({ name: 'payment_summary', type: 'json', nullable: true })
  paymentSummary!: Record<string, number> | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;
}
