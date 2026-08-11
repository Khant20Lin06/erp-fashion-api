import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DataScope } from '../enums/data-scope.enum';

export class RoleResourceScopeInputDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  resource!: string;

  @IsEnum(DataScope)
  scope!: DataScope;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  scopeValue?: string;
}

export class ReplaceRoleScopesDto {
  @IsArray()
  @ArrayUnique((scope: RoleResourceScopeInputDto) => scope.resource)
  @ValidateNested({ each: true })
  @Type(() => RoleResourceScopeInputDto)
  scopes!: RoleResourceScopeInputDto[];
}
