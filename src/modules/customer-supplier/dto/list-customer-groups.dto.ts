import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { CustomerGroupStatus } from '../entities/customer-group-status.enum';

export class ListCustomerGroupsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsEnum(CustomerGroupStatus)
  status?: CustomerGroupStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
