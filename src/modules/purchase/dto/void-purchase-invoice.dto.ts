import { IsString, MaxLength } from 'class-validator';

export class VoidPurchaseInvoiceDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
}
