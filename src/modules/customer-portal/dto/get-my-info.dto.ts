import { IsString, MaxLength, MinLength } from 'class-validator';

export class GetMyInfoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  telegramUserId!: string;
}
