import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BranchTransfer } from './branch-transfer.entity';
import { ProductVariant } from '../../products/entities/product-variant.entity';

@Entity('branch_transfer_items')
export class BranchTransferItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'transfer_id', type: 'char', length: 36 })
  transferId!: string;

  @ManyToOne(() => BranchTransfer, (transfer) => transfer.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'transfer_id' })
  transfer!: BranchTransfer;

  @Index()
  @Column({ name: 'product_variant_id', type: 'char', length: 36 })
  productVariantId!: string;

  @ManyToOne(() => ProductVariant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_variant_id' })
  productVariant!: ProductVariant;

  @Column({ name: 'requested_quantity', type: 'int', default: 1 })
  requestedQuantity!: number;

  @Column({ name: 'shipped_quantity', type: 'int', default: 0 })
  shippedQuantity!: number;

  @Column({ name: 'received_quantity', type: 'int', default: 0 })
  receivedQuantity!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}
