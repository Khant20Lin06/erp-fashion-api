import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * `email` and `password` are deliberately absent — email changes and
 * password changes are authentication-boundary concerns owned by Phase 05
 * (change-password flow), not exposed through user administration.
 */
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  displayName?: string;
}
