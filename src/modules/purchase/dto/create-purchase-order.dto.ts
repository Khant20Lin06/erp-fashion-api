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
import { PurchaseType } from '../entities/purchase-type.enum';
import { CreatePurchaseOrderItemDto } from './create-purchase-order-item.dto';

/** ISO-4217 3-letter currency code, matching CreateSaleDto's own pattern. */
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export class CreatePurchaseOrderDto {
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
  @IsEnum(PurchaseType)
  purchaseType?: PurchaseType;

  @IsUUID()
  supplierId!: string;

  @IsOptional()
  @IsUUID()
  paymentTermId?: string;

  @IsOptional()
  @IsUUID()
  sourceSupplierQuotationId?: string;

  @IsOptional()
  @IsDateString()
  transactionDate?: string;

  @IsOptional()
  @IsDateString()
  expectedDeliveryDate?: string;

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
  @Type(() => CreatePurchaseOrderItemDto)
  items!: CreatePurchaseOrderItemDto[];
}
