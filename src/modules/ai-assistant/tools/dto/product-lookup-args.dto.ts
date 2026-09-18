import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ProductLookupArgsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  query!: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}
