import { IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyLinkDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  telegramUserId!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code!: string;
}
