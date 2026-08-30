import { IsNumberString, IsOptional, IsUUID } from 'class-validator';

export class CreateSupplierQuotationItemDto {
  @IsUUID()
  purchaseRfqItemId!: string;

  @IsNumberString()
  unitCost!: string;

  @IsOptional()
  @IsNumberString()
  discountAmount?: string;

  @IsOptional()
  @IsNumberString()
  taxAmount?: string;
}
