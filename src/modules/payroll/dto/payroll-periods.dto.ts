import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { PayrollPeriod } from '../entities/payroll-period.entity';
import { PayrollPeriodStatus } from '../entities/payroll-period-status.enum';

export class CreatePayrollPeriodDto {
  @IsUUID()
  companyId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsDateString()
  payDate!: string;
}

export class ListPayrollPeriodsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsEnum(PayrollPeriodStatus)
  status?: PayrollPeriodStatus;
}

export interface PayrollPeriodResponseDto {
  id: string;
  companyId: string;
  periodNumber: string;
  name: string;
  startDate: string;
  endDate: string;
  payDate: string;
  status: PayrollPeriodStatus;
  createdAt: Date;
  updatedAt: Date;
}

export function toPayrollPeriodResponseDto(
  period: PayrollPeriod,
): PayrollPeriodResponseDto {
  return {
    id: period.id,
    companyId: period.companyId,
    periodNumber: period.periodNumber,
    name: period.name,
    startDate: period.startDate,
    endDate: period.endDate,
    payDate: period.payDate,
    status: period.status,
    createdAt: period.createdAt,
    updatedAt: period.updatedAt,
  };
}
