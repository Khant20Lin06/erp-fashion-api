import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Role } from './role.entity';
import { DataScope } from '../enums/data-scope.enum';

/**
 * Resource-specific data visibility scope for a role. A role has at most one
 * scope per resource — the same role can grant ACCOUNT scope for "sales" and
 * WAREHOUSE scope for "inventory" simultaneously (two rows), which is why
 * scope is never a single field on User/Role/UserRole.
 *
 * scopeValue is reserved for a future concrete scope target (e.g. a specific
 * branch id) once Phase 07/08 introduce those entities; it stays nullable
 * and unused by Phase 06 itself.
 */
@Entity('role_resource_scopes')
@Index(['roleId', 'resource'], { unique: true })
export class RoleResourceScope extends BaseEntity {
  @Column({ name: 'role_id', type: 'char', length: 36 })
  roleId!: string;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  @Column({ name: 'resource', type: 'varchar', length: 100 })
  resource!: string;

  @Column({ name: 'scope', type: 'enum', enum: DataScope })
  scope!: DataScope;

  @Column({ name: 'scope_value', type: 'varchar', length: 150, nullable: true })
  scopeValue!: string | null;
}
