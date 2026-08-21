import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { LeaveRequest } from '../entities/leave-request.entity';
import { LeaveRequestStatus } from '../entities/leave-request-status.enum';

export class CreateLeaveRequestDto {
  @IsUUID()
  employeeId!: string;

  @IsUUID()
  leaveTypeId!: string;

  @IsDateString()
  fromDate!: string;

  @IsDateString()
  toDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class UpdateLeaveRequestDto {
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string | null;
}

export class ListLeaveRequestsDto extends PaginationDto {
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
  @IsEnum(LeaveRequestStatus)
  status?: LeaveRequestStatus;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export interface LeaveRequestResponseDto {
  id: string;
  employeeId: string;
  companyId: string;
  branchId: string;
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  reason: string | null;
  status: LeaveRequestStatus;
  approvedByUserId: string | null;
  rejectedByUserId: string | null;
  decisionAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toLeaveRequestResponseDto(
  entity: LeaveRequest,
): LeaveRequestResponseDto {
  return {
    id: entity.id,
    employeeId: entity.employeeId,
    companyId: entity.companyId,
    branchId: entity.branchId,
    leaveTypeId: entity.leaveTypeId,
    fromDate: entity.fromDate,
    toDate: entity.toDate,
    reason: entity.reason,
    status: entity.status,
    approvedByUserId: entity.approvedByUserId,
    rejectedByUserId: entity.rejectedByUserId,
    decisionAt: entity.decisionAt,
    cancelledAt: entity.cancelledAt,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
