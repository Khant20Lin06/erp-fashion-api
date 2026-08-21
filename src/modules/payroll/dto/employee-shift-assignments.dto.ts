import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { EmployeeShiftAssignment } from '../entities/employee-shift-assignment.entity';

export class CreateEmployeeShiftAssignmentDto {
  @IsUUID()
  shiftId!: string;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export interface EmployeeShiftAssignmentResponseDto {
  id: string;
  employeeId: string;
  shiftId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: Date;
}

export function toEmployeeShiftAssignmentResponseDto(
  assignment: EmployeeShiftAssignment,
): EmployeeShiftAssignmentResponseDto {
  return {
    id: assignment.id,
    employeeId: assignment.employeeId,
    shiftId: assignment.shiftId,
    effectiveFrom: assignment.effectiveFrom,
    effectiveTo: assignment.effectiveTo,
    createdAt: assignment.createdAt,
  };
}
