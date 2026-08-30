import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { CreateSaleItemDto } from './create-sale-item.dto';

export class PreviewSaleItemPricingDto extends CreateSaleItemDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsDateString()
  transactionDate?: string;
}
