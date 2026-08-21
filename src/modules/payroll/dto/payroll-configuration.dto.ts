import { IsEnum, IsInt, Matches, Max, Min, ValidateIf } from 'class-validator';
import { PayrollConfiguration } from '../entities/payroll-configuration.entity';
import { UnpaidLeaveCalculation } from '../entities/unpaid-leave-calculation.enum';

export class UpsertPayrollConfigurationDto {
  @Matches(/^[A-Z]{3}$/, {
    message: 'defaultCurrency must be a 3-letter ISO code',
  })
  defaultCurrency!: string;

  @IsEnum(UnpaidLeaveCalculation)
  unpaidLeaveCalculation!: UnpaidLeaveCalculation;

  // Required whenever unpaidLeaveCalculation is DAILY_RATE — validated here
  // (not just in the service) so a malformed request is rejected with a
  // clear 400 before any business logic runs. Omitted entirely (undefined)
  // when unpaidLeaveCalculation is NONE.
  @ValidateIf(
    (dto: UpsertPayrollConfigurationDto) =>
      dto.unpaidLeaveCalculation === UnpaidLeaveCalculation.DailyRate,
  )
  @IsInt()
  @Min(1)
  @Max(31)
  workingDaysPerMonth?: number;
}

export interface PayrollConfigurationResponseDto {
  id: string;
  companyId: string;
  defaultCurrency: string;
  unpaidLeaveCalculation: UnpaidLeaveCalculation;
  workingDaysPerMonth: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toPayrollConfigurationResponseDto(
  config: PayrollConfiguration,
): PayrollConfigurationResponseDto {
  return {
    id: config.id,
    companyId: config.companyId,
    defaultCurrency: config.defaultCurrency,
    unpaidLeaveCalculation: config.unpaidLeaveCalculation,
    workingDaysPerMonth: config.workingDaysPerMonth,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}
