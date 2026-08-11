import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { User } from '../../users/entities/user.entity';
import { Role } from './role.entity';

@Entity('user_roles')
@Index(['userId', 'roleId'], { unique: true })
export class UserRole extends BaseEntity {
  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Index()
  @Column({ name: 'role_id', type: 'char', length: 36 })
  roleId!: string;

  /**
   * RESTRICT: a role with active user assignments must not be deletable by
   * a cascading FK delete — role deletion goes through the service layer's
   * explicit "check active assignments" flow (see RolesService), not an
   * implicit cascade.
   */
  @ManyToOne(() => Role, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'role_id' })
  role!: Role;
}
