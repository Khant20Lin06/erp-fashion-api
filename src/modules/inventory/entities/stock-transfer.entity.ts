import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Warehouse } from '../../organization/entities/warehouse.entity';
import { Company } from '../../organization/entities/company.entity';
import { User } from '../../users/entities/user.entity';
import { StockTransferItem } from './stock-transfer-item.entity';

/**
 * StockTransfer header (Phase 14 locked decision D9). Single-step atomic —
 * creation IS the whole lifecycle, no state machine, no update/delete
 * endpoint. companyId is stored directly (not only derived by joining
 * through either warehouse) — matches Sale/PurchaseOrder's own pattern of
 * storing companyId as a first-class column even though it is technically
 * re-derivable, per the locked spec's explicit instruction.
 */
@Entity('stock_transfers')
export class StockTransfer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'transfer_number', type: 'varchar', length: 50 })
  transferNumber!: string;

  @Index()
  @Column({ name: 'source_warehouse_id', type: 'char', length: 36 })
  sourceWarehouseId!: string;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'source_warehouse_id' })
  sourceWarehouse!: Warehouse;

  @Index()
  @Column({ name: 'destination_warehouse_id', type: 'char', length: 36 })
  destinationWarehouseId!: string;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'destination_warehouse_id' })
  destinationWarehouse!: Warehouse;

  @Index()
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

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

  @OneToMany(() => StockTransferItem, (item) => item.stockTransfer)
  items?: StockTransferItem[];
}
