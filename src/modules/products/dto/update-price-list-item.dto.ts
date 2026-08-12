import { IsISO8601, IsNumberString, IsOptional } from 'class-validator';

/** `productVariantId` and `validFrom` are deliberately absent — immutable after creation (would change the row's identity/history). */
export class UpdatePriceListItemDto {
  @IsOptional()
  @IsNumberString()
  price?: string;

  @IsOptional()
  @IsISO8601()
  validTo?: string;
}
