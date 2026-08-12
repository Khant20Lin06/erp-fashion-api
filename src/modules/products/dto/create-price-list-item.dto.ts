import { IsISO8601, IsNumberString, IsOptional, IsUUID } from 'class-validator';

export class CreatePriceListItemDto {
  @IsUUID()
  productVariantId!: string;

  @IsNumberString()
  price!: string;

  @IsISO8601()
  validFrom!: string;

  @IsOptional()
  @IsISO8601()
  validTo?: string;
}
