import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { LeaveType } from '../entities/leave-type.entity';
import { LeaveTypeStatus } from '../entities/leave-type-status.enum';

export class CreateLeaveTypeDto {
  @IsUUID()
  companyId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/)
  defaultDays?: string;
}

export class UpdateLeaveTypeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/)
  defaultDays?: string | null;
}

export class ListLeaveTypesDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsEnum(LeaveTypeStatus)
  status?: LeaveTypeStatus;

  @IsOptional()
  @IsString()
  search?: string;
}

export interface LeaveTypeResponseDto {
  id: string;
  companyId: string;
  name: string;
  code: string;
  description: string | null;
  isPaid: boolean;
  defaultDays: string | null;
  status: LeaveTypeStatus;
  createdAt: Date;
  updatedAt: Date;
}

export function toLeaveTypeResponseDto(
  entity: LeaveType,
): LeaveTypeResponseDto {
  return {
    id: entity.id,
    companyId: entity.companyId,
    name: entity.name,
    code: entity.code,
    description: entity.description,
    isPaid: entity.isPaid,
    defaultDays: entity.defaultDays,
    status: entity.status,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
