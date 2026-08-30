import { IsString, MaxLength } from 'class-validator';

export class ReversePaymentDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
}
