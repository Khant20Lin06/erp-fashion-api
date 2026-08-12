import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { WarehouseType } from '../entities/warehouse-type.enum';

/**
 * `companyId`, `branchId`, and `code` are deliberately absent — both parent
 * FKs are immutable after creation (Phase 07 §64) and code uniqueness is
 * scoped to companyId, so none are exposed for update through this DTO.
 */
export class UpdateWarehouseDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsEnum(WarehouseType)
  type?: WarehouseType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;
}
