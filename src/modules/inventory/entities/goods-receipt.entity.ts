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
import { PurchaseOrder } from '../../purchase/entities/purchase-order.entity';
import { Warehouse } from '../../organization/entities/warehouse.entity';
import { Supplier } from '../../customer-supplier/entities/supplier.entity';
import { User } from '../../users/entities/user.entity';
import { GoodsReceiptItem } from './goods-receipt-item.entity';

/**
 * GoodsReceipt header (Phase 14 locked decision D2). Receiving against a
 * CONFIRMED PurchaseOrder is a single-step, immutable, atomic event — no
 * DRAFT/APPROVED/CONFIRMED/CANCELLED lifecycle. No `status` column at all:
 * a GoodsReceipt row existing IS the completed receipt (simpler and more
 * honest than a single-value enum that can never be anything else). No
 * update/delete endpoint exists — createdAt/updatedAt exist purely for
 * consistency/auditability, never actually mutated after creation.
 *
 * purchaseOrderId/warehouseId/supplierId are all RESTRICT — a GoodsReceipt
 * is a permanent historical record of a real stock-increasing event and
 * must never be orphaned by a parent deletion. supplierId is denormalized
 * from the PurchaseOrder at receipt time (the PO's own supplierId never
 * changes post-creation, but denormalizing here keeps GoodsReceipt
 * self-describing without a join, mirroring the snapshot precedent
 * SaleItem/PurchaseOrderItem already established for their own parents).
 */
@Entity('goods_receipts')
export class GoodsReceipt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'receipt_number', type: 'varchar', length: 50 })
  receiptNumber!: string;

  @Index()
  @Column({ name: 'purchase_order_id', type: 'char', length: 36 })
  purchaseOrderId!: string;

  @ManyToOne(() => PurchaseOrder, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder!: PurchaseOrder;

  @Index()
  @Column({ name: 'warehouse_id', type: 'char', length: 36 })
  warehouseId!: string;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse!: Warehouse;

  @Index()
  @Column({ name: 'supplier_id', type: 'char', length: 36 })
  supplierId!: string;

  @ManyToOne(() => Supplier, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplier_id' })
  supplier!: Supplier;

  @Index()
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @Index()
  @Column({ name: 'receipt_date', type: 'timestamp' })
  receiptDate!: Date;

  @Column({ name: 'notes', type: 'varchar', length: 1000, nullable: true })
  notes!: string | null;

  @Column({ name: 'received_by', type: 'char', length: 36 })
  receivedBy!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'received_by' })
  receivedByUser!: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;

  @OneToMany(() => GoodsReceiptItem, (item) => item.goodsReceipt)
  items?: GoodsReceiptItem[];
}
