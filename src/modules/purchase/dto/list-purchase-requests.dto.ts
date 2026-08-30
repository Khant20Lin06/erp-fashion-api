import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { PurchaseRequestStatus } from '../entities/purchase-request-status.enum';

export class ListPurchaseRequestsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsEnum(PurchaseRequestStatus)
  status?: PurchaseRequestStatus;
}
