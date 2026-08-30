import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { PurchaseRfqStatus } from '../entities/purchase-rfq-status.enum';

export class ListPurchaseRfqsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  purchaseRequestId?: string;

  @IsOptional()
  @IsEnum(PurchaseRfqStatus)
  status?: PurchaseRfqStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
