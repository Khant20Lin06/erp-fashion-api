import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class LookupProductDto {
  @IsUUID()
  companyId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  sku!: string;
}
