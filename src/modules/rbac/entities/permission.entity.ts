import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

/**
 * A permission represents one actionable capability against one resource,
 * e.g. resource="roles", action="read", code="roles.read". The code is the
 * stable, deterministic identifier used everywhere else in the system
 * (guards, decorators, RolePermission) — resource/action are kept as
 * separate columns so future admin UI can group/filter by resource without
 * parsing the code string.
 */
@Entity('permissions')
export class Permission extends BaseEntity {
  @Index()
  @Column({ name: 'resource', type: 'varchar', length: 100 })
  resource!: string;

  @Column({ name: 'action', type: 'varchar', length: 50 })
  action!: string;

  @Column({ name: 'code', type: 'varchar', length: 150, unique: true })
  code!: string;

  @Column({ name: 'description', type: 'varchar', length: 500, nullable: true })
  description!: string | null;
}
