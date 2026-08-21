import { IsBoolean, IsOptional, Matches } from 'class-validator';
import { LoyaltyProgram } from '../entities/loyalty-program.entity';

const RATE_PATTERN = /^\d{1,6}(\.\d{1,4})?$/;
const NON_NEGATIVE_DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;

export class UpsertLoyaltyProgramDto {
  @Matches(RATE_PATTERN, {
    message: 'pointsPerCurrencyUnit must be a non-negative decimal string',
  })
  pointsPerCurrencyUnit!: string;

  @Matches(RATE_PATTERN, {
    message: 'redemptionValuePerPoint must be a non-negative decimal string',
  })
  redemptionValuePerPoint!: string;

  @IsOptional()
  @Matches(NON_NEGATIVE_DECIMAL_PATTERN, {
    message: 'minimumPurchaseForEarning must be a non-negative decimal string',
  })
  minimumPurchaseForEarning?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export interface LoyaltyProgramResponseDto {
  id: string;
  companyId: string;
  pointsPerCurrencyUnit: string;
  redemptionValuePerPoint: string;
  minimumPurchaseForEarning: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toLoyaltyProgramResponseDto(
  program: LoyaltyProgram,
): LoyaltyProgramResponseDto {
  return {
    id: program.id,
    companyId: program.companyId,
    pointsPerCurrencyUnit: program.pointsPerCurrencyUnit,
    redemptionValuePerPoint: program.redemptionValuePerPoint,
    minimumPurchaseForEarning: program.minimumPurchaseForEarning,
    isActive: program.isActive,
    createdAt: program.createdAt,
    updatedAt: program.updatedAt,
  };
}
