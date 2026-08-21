import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { Designation } from '../entities/designation.entity';
import { DesignationStatus } from '../entities/designation-status.enum';

export class CreateDesignationDto {
  @IsUUID()
  companyId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateDesignationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}

export class ListDesignationsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsEnum(DesignationStatus)
  status?: DesignationStatus;

  @IsOptional()
  @IsString()
  search?: string;
}

export interface DesignationResponseDto {
  id: string;
  companyId: string;
  name: string;
  code: string | null;
  description: string | null;
  status: DesignationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export function toDesignationResponseDto(
  designation: Designation,
): DesignationResponseDto {
  return {
    id: designation.id,
    companyId: designation.companyId,
    name: designation.name,
    code: designation.code,
    description: designation.description,
    status: designation.status,
    createdAt: designation.createdAt,
    updatedAt: designation.updatedAt,
  };
}
