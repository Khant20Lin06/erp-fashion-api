import { IsDateString, IsOptional, IsUUID, Matches } from 'class-validator';
import { EmployeePayrollComponent } from '../entities/employee-payroll-component.entity';

const NON_NEGATIVE_DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;
const PERCENTAGE_PATTERN = /^\d{1,3}(\.\d{1,4})?$/;

export class CreateEmployeePayrollComponentDto {
  @IsUUID()
  payrollComponentId!: string;

  @IsOptional()
  @Matches(NON_NEGATIVE_DECIMAL_PATTERN, {
    message: 'amount must be a non-negative decimal string',
  })
  amount?: string;

  @IsOptional()
  @Matches(PERCENTAGE_PATTERN, {
    message: 'percentage must be a non-negative decimal string (0-100)',
  })
  percentage?: string;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export interface EmployeePayrollComponentResponseDto {
  id: string;
  employeeId: string;
  payrollComponentId: string;
  amount: string | null;
  percentage: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: Date;
}

export function toEmployeePayrollComponentResponseDto(
  assignment: EmployeePayrollComponent,
): EmployeePayrollComponentResponseDto {
  return {
    id: assignment.id,
    employeeId: assignment.employeeId,
    payrollComponentId: assignment.payrollComponentId,
    amount: assignment.amount,
    percentage: assignment.percentage,
    effectiveFrom: assignment.effectiveFrom,
    effectiveTo: assignment.effectiveTo,
    createdAt: assignment.createdAt,
  };
}
