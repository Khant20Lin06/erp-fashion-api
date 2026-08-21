import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { AttendanceRecord } from '../entities/attendance-record.entity';
import { AttendanceStatus } from '../entities/attendance-status.enum';

export class CreateAttendanceRecordDto {
  @IsUUID()
  employeeId!: string;

  @IsDateString()
  attendanceDate!: string;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @IsOptional()
  @IsDateString()
  checkInAt?: string;

  @IsOptional()
  @IsDateString()
  checkOutAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class UpdateAttendanceRecordDto {
  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @IsOptional()
  @IsDateString()
  checkInAt?: string | null;

  @IsOptional()
  @IsDateString()
  checkOutAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

export class ListAttendanceRecordsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @IsOptional()
  @IsDateString()
  attendanceDateFrom?: string;

  @IsOptional()
  @IsDateString()
  attendanceDateTo?: string;
}

export interface AttendanceRecordResponseDto {
  id: string;
  employeeId: string;
  companyId: string;
  branchId: string;
  attendanceDate: string;
  status: AttendanceStatus;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toAttendanceRecordResponseDto(
  entity: AttendanceRecord,
): AttendanceRecordResponseDto {
  return {
    id: entity.id,
    employeeId: entity.employeeId,
    companyId: entity.companyId,
    branchId: entity.branchId,
    attendanceDate: entity.attendanceDate,
    status: entity.status,
    checkInAt: entity.checkInAt,
    checkOutAt: entity.checkOutAt,
    note: entity.note,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
