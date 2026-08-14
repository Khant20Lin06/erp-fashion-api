import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';

export class ListNotificationsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;
}
