import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { Promotion } from '../entities/promotion.entity';
import { PromotionDiscountType } from '../entities/promotion-discount-type.enum';
import { PromotionStatus } from '../entities/promotion-status.enum';

const NON_NEGATIVE_DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;
const PERCENTAGE_PATTERN = /^\d{1,3}(\.\d{1,4})?$/;

export class CreatePromotionDto {
  @IsUUID()
  companyId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsEnum(PromotionDiscountType)
  discountType!: PromotionDiscountType;

  @ValidateIf(
    (dto: CreatePromotionDto) =>
      dto.discountType === PromotionDiscountType.Percentage,
  )
  @Matches(PERCENTAGE_PATTERN, {
    message:
      'discountValue must be a percentage between 0 and 100 when discountType is PERCENTAGE',
  })
  @ValidateIf(
    (dto: CreatePromotionDto) =>
      dto.discountType === PromotionDiscountType.FixedAmount,
  )
  @Matches(NON_NEGATIVE_DECIMAL_PATTERN, {
    message:
      'discountValue must be a non-negative decimal string when discountType is FIXED_AMOUNT',
  })
  discountValue!: string;

  @IsOptional()
  @Matches(NON_NEGATIVE_DECIMAL_PATTERN, {
    message: 'minimumPurchase must be a non-negative decimal string',
  })
  minimumPurchase?: string;

  @IsOptional()
  @Matches(NON_NEGATIVE_DECIMAL_PATTERN, {
    message: 'maximumDiscountAmount must be a non-negative decimal string',
  })
  maximumDiscountAmount?: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;
}

export class UpdatePromotionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @Matches(NON_NEGATIVE_DECIMAL_PATTERN, {
    message: 'minimumPurchase must be a non-negative decimal string',
  })
  minimumPurchase?: string;

  @IsOptional()
  @Matches(NON_NEGATIVE_DECIMAL_PATTERN, {
    message: 'maximumDiscountAmount must be a non-negative decimal string',
  })
  maximumDiscountAmount?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @IsOptional()
  @IsEnum(PromotionStatus)
  status?: PromotionStatus;
}

export class ListPromotionsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsEnum(PromotionStatus)
  status?: PromotionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;
}

export interface PromotionResponseDto {
  id: string;
  companyId: string;
  code: string;
  name: string;
  description: string | null;
  discountType: PromotionDiscountType;
  discountValue: string;
  minimumPurchase: string;
  maximumDiscountAmount: string | null;
  startDate: string;
  endDate: string | null;
  usageLimit: number | null;
  usageCount: number;
  status: PromotionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export function toPromotionResponseDto(
  promotion: Promotion,
): PromotionResponseDto {
  return {
    id: promotion.id,
    companyId: promotion.companyId,
    code: promotion.code,
    name: promotion.name,
    description: promotion.description,
    discountType: promotion.discountType,
    discountValue: promotion.discountValue,
    minimumPurchase: promotion.minimumPurchase,
    maximumDiscountAmount: promotion.maximumDiscountAmount,
    startDate: promotion.startDate,
    endDate: promotion.endDate,
    usageLimit: promotion.usageLimit,
    usageCount: promotion.usageCount,
    status: promotion.status,
    createdAt: promotion.createdAt,
    updatedAt: promotion.updatedAt,
  };
}
