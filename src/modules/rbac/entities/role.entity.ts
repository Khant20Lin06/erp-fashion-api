import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { RoleStatus } from './role-status.enum';
import { RolePermission } from './role-permission.entity';
import { RoleResourceScope } from './role-resource-scope.entity';

@Entity('roles')
export class Role extends BaseEntity {
  @Column({ name: 'name', type: 'varchar', length: 150 })
  name!: string;

  @Column({ name: 'code', type: 'varchar', length: 100, unique: true })
  code!: string;

  @Column({ name: 'description', type: 'varchar', length: 500, nullable: true })
  description!: string | null;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: RoleStatus,
    default: RoleStatus.Active,
  })
  status!: RoleStatus;

  /**
   * System roles (e.g. SUPER_ADMIN) are seeded by the platform and are
   * protected from destructive changes (delete, code change) regardless of
   * the acting user's permissions. This protects the role *definition*, not
   * its *assignment* — a system role can still be assigned to/removed from
   * users through the normal UserRole flow.
   */
  @Column({ name: 'is_system_role', type: 'boolean', default: false })
  isSystemRole!: boolean;

  @OneToMany(() => RolePermission, (rolePermission) => rolePermission.role)
  rolePermissions?: RolePermission[];

  @OneToMany(() => RoleResourceScope, (scope) => scope.role)
  resourceScopes?: RoleResourceScope[];
}
