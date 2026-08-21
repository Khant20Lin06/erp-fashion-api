import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { EmployeeAssignment } from '../entities/employee-assignment.entity';
import { EmployeeAssignmentStatus } from '../entities/employee-assignment-status.enum';

export class CreateEmployeeAssignmentDto {
  @IsUUID()
  employeeId!: string;

  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  designationId?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export class UpdateEmployeeAssignmentDto {
  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsUUID()
  designationId?: string | null;

  @IsOptional()
  @IsUUID()
  warehouseId?: string | null;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null;

  @IsOptional()
  @IsEnum(EmployeeAssignmentStatus)
  status?: EmployeeAssignmentStatus;
}

export class ListEmployeeAssignmentsDto extends PaginationDto {
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
  @IsEnum(EmployeeAssignmentStatus)
  status?: EmployeeAssignmentStatus;
}

export interface EmployeeAssignmentResponseDto {
  id: string;
  employeeId: string;
  companyId: string;
  branchId: string;
  departmentId: string | null;
  designationId: string | null;
  warehouseId: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: EmployeeAssignmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export function toEmployeeAssignmentResponseDto(
  assignment: EmployeeAssignment,
): EmployeeAssignmentResponseDto {
  return {
    id: assignment.id,
    employeeId: assignment.employeeId,
    companyId: assignment.companyId,
    branchId: assignment.branchId,
    departmentId: assignment.departmentId,
    designationId: assignment.designationId,
    warehouseId: assignment.warehouseId,
    effectiveFrom: assignment.effectiveFrom,
    effectiveTo: assignment.effectiveTo,
    status: assignment.status,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
  };
}
