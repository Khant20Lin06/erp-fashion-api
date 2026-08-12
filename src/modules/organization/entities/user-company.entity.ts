import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { User } from '../../users/entities/user.entity';
import { Company } from './company.entity';
import { MembershipStatus } from './membership-status.enum';

/**
 * User's organizational membership at Company level (Phase 08 §18, §20).
 * Membership does not itself grant permission — it only answers "where can
 * this user operate," combined with Role/Permission (what) and DataScope
 * (which records) at query time. Never collapse into RBAC.
 */
@Entity('user_companies')
@Index(['userId', 'companyId'], { unique: true })
export class UserCompany extends BaseEntity {
  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

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
