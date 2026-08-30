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
import { CreatePurchaseRfqItemDto } from './create-purchase-rfq-item.dto';

export class CreatePurchaseRfqDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  purchaseRequestId?: string;

  @IsString()
  @MaxLength(160)
  title!: string;

  @IsDateString()
  requiredDate!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  invitedSupplierIds!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseRfqItemDto)
  items!: CreatePurchaseRfqItemDto[];
}
