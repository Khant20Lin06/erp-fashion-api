import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** `code` is deliberately absent — immutable after creation. */
export class UpdateBrandDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;
}
