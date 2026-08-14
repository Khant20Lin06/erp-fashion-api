import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateStockTransferItemDto } from './create-stock-transfer-item.dto';

export class CreateStockTransferDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsUUID()
  sourceWarehouseId!: string;

  @IsUUID()
  destinationWarehouseId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateStockTransferItemDto)
  items!: CreateStockTransferItemDto[];
}
