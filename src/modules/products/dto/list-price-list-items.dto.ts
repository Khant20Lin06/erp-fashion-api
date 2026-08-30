import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { PriceListItemStatus } from '../entities/price-list-item-status.enum';

export class ListPriceListItemsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  productVariantId?: string;

  @IsOptional()
  @IsUUID()
  uomId?: string;

  @IsOptional()
  @IsEnum(PriceListItemStatus)
  status?: PriceListItemStatus;
}
