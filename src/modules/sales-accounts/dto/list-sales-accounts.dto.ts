import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { SalesAccountStatus } from '../entities/sales-account-status.enum';

export class ListSalesAccountsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsEnum(SalesAccountStatus)
  status?: SalesAccountStatus;
}
