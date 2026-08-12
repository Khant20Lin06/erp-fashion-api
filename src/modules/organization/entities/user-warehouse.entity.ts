import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { User } from '../../users/entities/user.entity';
import { Warehouse } from './warehouse.entity';
import { MembershipStatus } from './membership-status.enum';

/**
 * User's organizational membership at Warehouse level. Must be consistent
 * with Warehouse -> Branch -> Company (Phase 08 §5) — enforced in
 * UserOrganizationService by requiring an active UserBranch membership for
 * the warehouse's actual parent branch before granting warehouse membership.
 */
@Entity('user_warehouses')
@Index(['userId', 'warehouseId'], { unique: true })
export class UserWarehouse extends BaseEntity {
  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'warehouse_id', type: 'char', length: 36 })
  warehouseId!: string;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse!: Warehouse;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: MembershipStatus,
    default: MembershipStatus.Active,
  })
  status!: MembershipStatus;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary!: boolean;
}
