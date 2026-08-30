import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSupplierQuotationItemDto } from './create-supplier-quotation-item.dto';

const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export class CreateSupplierQuotationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsUUID()
  purchaseRfqId!: string;

  @IsUUID()
  supplierId!: string;

  @IsOptional()
  @IsUUID()
  paymentTermId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  leadTimeDays?: number;

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
  @Type(() => CreateSupplierQuotationItemDto)
  items!: CreateSupplierQuotationItemDto[];
}
