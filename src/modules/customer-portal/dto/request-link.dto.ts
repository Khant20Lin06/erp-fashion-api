import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class RequestLinkDto {
  /**
   * The Telegram user's own numeric id, as a string (Telegram ids can
   * exceed JS's safe integer range) — supplied by the bot's own trusted
   * Telegram Trigger payload, never typed by the end user, so this is
   * infrastructure identity, not untrusted free text.
   */
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  telegramUserId!: string;

  @IsUUID()
  companyId!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(50)
  phone!: string;
}
