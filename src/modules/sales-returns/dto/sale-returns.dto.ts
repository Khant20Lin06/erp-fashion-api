import {
  ArrayMinSize,
  IsArray,
  IsEnum,
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
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { SaleReturn } from '../entities/sale-return.entity';
import { SaleReturnStatus } from '../entities/sale-return-status.enum';
import { SaleReturnItem } from '../entities/sale-return-item.entity';
import { SaleReturnItemCondition } from '../entities/sale-return-item-condition.enum';

const NON_NEGATIVE_DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;

export class CreateSaleReturnItemDto {
  @IsUUID()
  saleItemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @Matches(NON_NEGATIVE_DECIMAL_PATTERN, {
    message: 'discountAmount must be a non-negative decimal string',
  })
  discountAmount?: string;

  @IsOptional()
  @IsEnum(SaleReturnItemCondition)
  condition?: SaleReturnItemCondition;
}

export class CreateSaleReturnDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  saleId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleReturnItemDto)
  items!: CreateSaleReturnItemDto[];
}

export class ListSaleReturnsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  saleId?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsEnum(SaleReturnStatus)
  status?: SaleReturnStatus;
}

export interface SaleReturnItemResponseDto {
  id: string;
  saleItemId: string;
  productVariantId: string;
  quantity: number;
  unitPriceSnapshot: string;
  discountAmount: string;
  lineTotal: string;
  condition: SaleReturnItemCondition;
  productNameSnapshot: string;
  skuSnapshot: string;
}

export function toSaleReturnItemResponseDto(
  item: SaleReturnItem,
): SaleReturnItemResponseDto {
  return {
    id: item.id,
    saleItemId: item.saleItemId,
    productVariantId: item.productVariantId,
    quantity: item.quantity,
    unitPriceSnapshot: item.unitPriceSnapshot,
    discountAmount: item.discountAmount,
    lineTotal: item.lineTotal,
    condition: item.condition,
    productNameSnapshot: item.productNameSnapshot,
    skuSnapshot: item.skuSnapshot,
  };
}

export interface SaleReturnResponseDto {
  id: string;
  companyId: string;
  branchId: string | null;
  saleId: string;
  customerId: string;
  returnNumber: string;
  status: SaleReturnStatus;
  reason: string | null;
  notes: string | null;
  subtotal: string;
  discountAmount: string;
  refundAmount: string;
  refundedAmount: string;
  currency: string;
  createdBy: string | null;
  confirmedBy: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items?: SaleReturnItemResponseDto[];
}

export function toSaleReturnResponseDto(
  saleReturn: SaleReturn,
  items?: SaleReturnItem[],
): SaleReturnResponseDto {
  return {
    id: saleReturn.id,
    companyId: saleReturn.companyId,
    branchId: saleReturn.branchId,
    saleId: saleReturn.saleId,
    customerId: saleReturn.customerId,
    returnNumber: saleReturn.returnNumber,
    status: saleReturn.status,
    reason: saleReturn.reason,
    notes: saleReturn.notes,
    subtotal: saleReturn.subtotal,
    discountAmount: saleReturn.discountAmount,
    refundAmount: saleReturn.refundAmount,
    refundedAmount: saleReturn.refundedAmount,
    currency: saleReturn.currency,
    createdBy: saleReturn.createdBy,
    confirmedBy: saleReturn.confirmedBy,
    confirmedAt: saleReturn.confirmedAt,
    createdAt: saleReturn.createdAt,
    updatedAt: saleReturn.updatedAt,
    items: (items ?? saleReturn.items)?.map(toSaleReturnItemResponseDto),
  };
}
