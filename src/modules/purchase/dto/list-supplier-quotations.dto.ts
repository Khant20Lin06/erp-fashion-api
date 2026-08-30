import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { SupplierQuotationStatus } from '../entities/supplier-quotation-status.enum';

export class ListSupplierQuotationsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  purchaseRfqId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsEnum(SupplierQuotationStatus)
  status?: SupplierQuotationStatus;
}
