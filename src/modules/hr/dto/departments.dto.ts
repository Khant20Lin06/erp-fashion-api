import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { Department } from '../entities/department.entity';
import { DepartmentStatus } from '../entities/department-status.enum';

export class CreateDepartmentDto {
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

export class UpdateDepartmentDto {
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

export class ListDepartmentsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsEnum(DepartmentStatus)
  status?: DepartmentStatus;

  @IsOptional()
  @IsString()
  search?: string;
}

export interface DepartmentResponseDto {
  id: string;
  companyId: string;
  name: string;
  code: string | null;
  description: string | null;
  status: DepartmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export function toDepartmentResponseDto(
  department: Department,
): DepartmentResponseDto {
  return {
    id: department.id,
    companyId: department.companyId,
    name: department.name,
    code: department.code,
    description: department.description,
    status: department.status,
    createdAt: department.createdAt,
    updatedAt: department.updatedAt,
  };
}
