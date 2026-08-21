import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { SettingDefinition } from './setting-definition.entity';
import type { SettingStoredValue } from './setting-definition.entity';
import { SettingScopeType } from './setting-scope-type.enum';

@Entity('setting_values')
@Index(['definitionId', 'scopeType', 'scopeId'], { unique: true })
export class SettingValue extends BaseEntity {
  @Column({ name: 'definition_id', type: 'char', length: 36 })
  definitionId!: string;

  @ManyToOne(() => SettingDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'definition_id' })
  definition!: SettingDefinition;

  @Column({
    name: 'scope_type',
    type: 'enum',
    enum: SettingScopeType,
  })
  scopeType!: SettingScopeType;

  @Column({ name: 'scope_id', type: 'varchar', length: 64 })
  scopeId!: string;

  @Column({ name: 'value', type: 'json', nullable: true })
  value!: SettingStoredValue;
}
