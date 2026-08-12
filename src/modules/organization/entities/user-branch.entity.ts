import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { User } from '../../users/entities/user.entity';
import { Branch } from './branch.entity';
import { MembershipStatus } from './membership-status.enum';

/**
 * User's organizational membership at Branch level. A Branch membership
 * requires a valid Company membership for the same company (Phase 08 §4,
 * "company-before-branch rule") — enforced in UserOrganizationService, not
 * at the FK level (MySQL cannot express "branch.companyId must match one of
 * this user's other rows" as a single constraint).
 */
@Entity('user_branches')
@Index(['userId', 'branchId'], { unique: true })
export class UserBranch extends BaseEntity {
  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'branch_id', type: 'char', length: 36 })
  branchId!: string;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branch_id' })
  branch!: Branch;

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
