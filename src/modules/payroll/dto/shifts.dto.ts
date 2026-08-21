import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { Shift } from '../entities/shift.entity';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

export class CreateShiftDto {
  @IsUUID()
  companyId!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code!: string;

  @Matches(TIME_PATTERN, { message: 'startTime must be HH:mm or HH:mm:ss' })
  startTime!: string;

  @Matches(TIME_PATTERN, { message: 'endTime must be HH:mm or HH:mm:ss' })
  endTime!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  breakMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  graceMinutes?: number;
}

export class UpdateShiftDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'startTime must be HH:mm or HH:mm:ss' })
  startTime?: string;

  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'endTime must be HH:mm or HH:mm:ss' })
  endTime?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  breakMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  graceMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListShiftsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export interface ShiftResponseDto {
  id: string;
  companyId: string;
  branchId: string | null;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  graceMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toShiftResponseDto(shift: Shift): ShiftResponseDto {
  return {
    id: shift.id,
    companyId: shift.companyId,
    branchId: shift.branchId,
    name: shift.name,
    code: shift.code,
    startTime: shift.startTime,
    endTime: shift.endTime,
    breakMinutes: shift.breakMinutes,
    graceMinutes: shift.graceMinutes,
    isActive: shift.isActive,
    createdAt: shift.createdAt,
    updatedAt: shift.updatedAt,
  };
}
