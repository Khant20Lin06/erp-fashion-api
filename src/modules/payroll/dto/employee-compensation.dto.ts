import { IsDateString, IsEnum, IsOptional, Matches } from 'class-validator';
import { EmployeeCompensation } from '../entities/employee-compensation.entity';
import { PayFrequency } from '../entities/pay-frequency.enum';

const NON_NEGATIVE_DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;

export class CreateEmployeeCompensationDto {
  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @Matches(NON_NEGATIVE_DECIMAL_PATTERN, {
    message: 'baseSalary must be a non-negative decimal string',
  })
  baseSalary!: string;

  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter ISO code' })
  currency!: string;

  @IsOptional()
  @IsEnum(PayFrequency)
  payFrequency?: PayFrequency;
}

export interface EmployeeCompensationResponseDto {
  id: string;
  companyId: string;
  employeeId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  baseSalary: string;
  currency: string;
  payFrequency: PayFrequency;
  createdAt: Date;
  updatedAt: Date;
}

export function toEmployeeCompensationResponseDto(
  compensation: EmployeeCompensation,
): EmployeeCompensationResponseDto {
  return {
    id: compensation.id,
    companyId: compensation.companyId,
    employeeId: compensation.employeeId,
    effectiveFrom: compensation.effectiveFrom,
    effectiveTo: compensation.effectiveTo,
    baseSalary: compensation.baseSalary,
    currency: compensation.currency,
    payFrequency: compensation.payFrequency,
    createdAt: compensation.createdAt,
    updatedAt: compensation.updatedAt,
  };
}
