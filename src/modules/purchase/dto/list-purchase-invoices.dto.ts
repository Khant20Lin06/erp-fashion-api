import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';

export class ListPurchaseInvoicesDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;
}
