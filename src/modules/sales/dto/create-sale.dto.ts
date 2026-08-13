import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SaleType } from '../entities/sale-type.enum';
import { CreateSaleItemDto } from './create-sale-item.dto';

/** ISO-4217 3-letter currency code, matching Company.baseCurrency / PriceList.currency's own pattern. */
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export class CreateSaleDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsEnum(SaleType)
  saleType?: SaleType;

  @IsUUID()
  customerId!: string;

  @IsOptional()
  @IsUUID()
  salesAccountId?: string;

  @IsOptional()
  @IsDateString()
  transactionDate?: string;

  @Matches(CURRENCY_PATTERN, {
    message: 'currency must be a 3-letter uppercase ISO-4217 code',
  })
  currency!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items!: CreateSaleItemDto[];
}
