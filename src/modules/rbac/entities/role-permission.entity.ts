import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Role } from './role.entity';
import { Permission } from './permission.entity';

@Entity('role_permissions')
@Index(['roleId', 'permissionId'], { unique: true })
export class RolePermission extends BaseEntity {
  @Column({ name: 'role_id', type: 'char', length: 36 })
  roleId!: string;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  @Column({ name: 'permission_id', type: 'char', length: 36 })
  permissionId!: string;

  /**
   * RESTRICT: a permission referenced by at least one role must not be
   * deletable out from under it (see Permission entity's no-casual-delete
   * policy).
   */
  @ManyToOne(() => Permission, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'permission_id' })
  permission!: Permission;
}
