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

export class DispatchBranchTransferItemDto {
  @IsUUID()
  productVariantId!: string;

  @IsInt()
  @Min(0)
  shippedQuantity!: number;
}

export class DispatchBranchTransferDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  transitMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  driverName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  driverPhone?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DispatchBranchTransferItemDto)
  items?: DispatchBranchTransferItemDto[];
}
