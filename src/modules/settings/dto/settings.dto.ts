import {
  Allow,
  IsDefined,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { SettingDataType } from '../entities/setting-data-type.enum';
import { SettingScopeType } from '../entities/setting-scope-type.enum';
import type { SettingStoredValue } from '../entities/setting-definition.entity';

export class SettingsMeQueryDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class UpdateSettingValueDto {
  @IsDefined()
  @Allow()
  value!: SettingStoredValue;
}

export interface ResolvedSettingResponseDto {
  key: string;
  category: string;
  dataType: SettingDataType;
  value: SettingStoredValue;
  sourceScope: SettingScopeType | 'DEFAULT';
  sourceScopeId: string | null;
}

export interface SettingsCollectionResponseDto {
  data: ResolvedSettingResponseDto[];
}

export class SettingKeyParamDto {
  @IsString()
  key!: string;
}
