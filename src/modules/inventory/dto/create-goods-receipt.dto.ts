import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateGoodsReceiptItemDto } from './create-goods-receipt-item.dto';

export class CreateGoodsReceiptDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsUUID()
  purchaseOrderId!: string;

  @IsUUID()
  warehouseId!: string;

  @IsOptional()
  @IsDateString()
  receiptDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateGoodsReceiptItemDto)
  items!: CreateGoodsReceiptItemDto[];
}
