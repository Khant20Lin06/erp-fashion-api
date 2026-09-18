import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReceiveBranchTransferItemDto {
  @IsUUID()
  productVariantId!: string;

  @IsInt()
  @Min(0)
  receivedQuantity!: number;
}

export class ReceiveBranchTransferDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveBranchTransferItemDto)
  items?: ReceiveBranchTransferItemDto[];
}
