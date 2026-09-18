import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Company } from '../../organization/entities/company.entity';
import { Branch } from '../../organization/entities/branch.entity';
import { Warehouse } from '../../organization/entities/warehouse.entity';
import { User } from '../../users/entities/user.entity';
import { BranchTransferStatus } from './branch-transfer-status.enum';
import { BranchTransferItem } from './branch-transfer-item.entity';

@Entity('branch_transfers')
export class BranchTransfer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'transfer_number', type: 'varchar', length: 50 })
  transferNumber!: string;

  @Index()
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Index()
  @Column({ name: 'source_branch_id', type: 'char', length: 36 })
  sourceBranchId!: string;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'source_branch_id' })
  sourceBranch!: Branch;

  @Index()
  @Column({ name: 'source_warehouse_id', type: 'char', length: 36 })
  sourceWarehouseId!: string;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'source_warehouse_id' })
  sourceWarehouse!: Warehouse;

  @Index()
  @Column({ name: 'destination_branch_id', type: 'char', length: 36 })
  destinationBranchId!: string;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'destination_branch_id' })
  destinationBranch!: Branch;

  @Index()
  @Column({ name: 'destination_warehouse_id', type: 'char', length: 36 })
  destinationWarehouseId!: string;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'destination_warehouse_id' })
  destinationWarehouse!: Warehouse;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: BranchTransferStatus,
    default: BranchTransferStatus.Requested,
  })
  status!: BranchTransferStatus;

  @Column({ name: 'transit_method', type: 'varchar', length: 100, nullable: true })
  transitMethod!: string | null;

  @Column({ name: 'tracking_number', type: 'varchar', length: 100, nullable: true })
  trackingNumber!: string | null;

  @Column({ name: 'driver_name', type: 'varchar', length: 100, nullable: true })
  driverName!: string | null;

  @Column({ name: 'driver_phone', type: 'varchar', length: 50, nullable: true })
  driverPhone!: string | null;

  @Column({ name: 'dispatched_at', type: 'timestamp', nullable: true })
  dispatchedAt!: Date | null;

  @Column({ name: 'dispatched_by', type: 'char', length: 36, nullable: true })
  dispatchedBy!: string | null;

  @Column({ name: 'received_at', type: 'timestamp', nullable: true })
  receivedAt!: Date | null;

  @Column({ name: 'received_by', type: 'char', length: 36, nullable: true })
  receivedBy!: string | null;

  @Column({ name: 'notes', type: 'varchar', length: 1000, nullable: true })
  notes!: string | null;

  @Column({ name: 'created_by', type: 'char', length: 36 })
  createdBy!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  createdByUser!: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;

  @OneToMany(() => BranchTransferItem, (item) => item.transfer, {
    cascade: true,
  })
  items!: BranchTransferItem[];
}
