import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** `code` and `currency` are deliberately absent — immutable after creation. */
export class UpdatePriceListDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
