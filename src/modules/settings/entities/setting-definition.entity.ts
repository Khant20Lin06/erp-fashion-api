import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { SettingDataType } from './setting-data-type.enum';
import { SettingScopeType } from './setting-scope-type.enum';

export type SettingStoredValue =
  string | number | boolean | Record<string, unknown> | Array<unknown> | null;

@Entity('setting_definitions')
export class SettingDefinition extends BaseEntity {
  @Index({ unique: true })
  @Column({ name: 'key', type: 'varchar', length: 150 })
  key!: string;

  @Column({ name: 'category', type: 'varchar', length: 100 })
  category!: string;

  @Column({
    name: 'data_type',
    type: 'enum',
    enum: SettingDataType,
  })
  dataType!: SettingDataType;

  @Column({ name: 'description', type: 'varchar', length: 500, nullable: true })
  description!: string | null;

  @Column({ name: 'default_value', type: 'json', nullable: true })
  defaultValue!: SettingStoredValue;

  @Column({ name: 'allowed_scopes', type: 'json' })
  allowedScopes!: SettingScopeType[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
