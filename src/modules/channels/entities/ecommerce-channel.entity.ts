import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Company } from '../../organization/entities/company.entity';
import { EcommerceChannelStatus } from './ecommerce-channel-status.enum';

@Entity('ecommerce_channels')
@Unique(['companyId', 'code'])
export class EcommerceChannel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ name: 'code', type: 'varchar', length: 50 })
  code!: string; // e.g. 'TIKTOK', 'FACEBOOK', 'TELEGRAM', 'CUSTOM_WEBHOOK'

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name!: string;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: EcommerceChannelStatus,
    default: EcommerceChannelStatus.Active,
  })
  status!: EcommerceChannelStatus;

  @Column({ name: 'api_key', type: 'varchar', length: 255, nullable: true })
  apiKey!: string | null;

  @Column({ name: 'webhook_secret', type: 'varchar', length: 255, nullable: true })
  webhookSecret!: string | null;

  @Column({ name: 'stock_buffer', type: 'int', default: 0 })
  stockBuffer!: number;

  @Column({ name: 'last_synced_at', type: 'timestamp', nullable: true })
  lastSyncedAt!: Date | null;

  @Column({ name: 'synced_orders_count', type: 'int', default: 0 })
  syncedOrdersCount!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
