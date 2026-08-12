import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { PriceListStatus } from '../entities/price-list-status.enum';

export class ListPriceListsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsEnum(PriceListStatus)
  status?: PriceListStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
