import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';

export class ListBranchesDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;
}
