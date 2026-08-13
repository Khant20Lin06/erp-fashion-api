import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { SupplierGroupStatus } from '../entities/supplier-group-status.enum';

export class ListSupplierGroupsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsEnum(SupplierGroupStatus)
  status?: SupplierGroupStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
