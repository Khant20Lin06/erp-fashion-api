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
import { CreateBranchTransferItemDto } from './create-branch-transfer-item.dto';

export class CreateBranchTransferDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsUUID()
  sourceBranchId!: string;

  @IsUUID()
  sourceWarehouseId!: string;

  @IsUUID()
  destinationBranchId!: string;

  @IsUUID()
  destinationWarehouseId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateBranchTransferItemDto)
  items!: CreateBranchTransferItemDto[];
}
