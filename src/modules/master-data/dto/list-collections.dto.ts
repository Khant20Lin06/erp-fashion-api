import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { CollectionStatus } from '../entities/collection-status.enum';
import { Season } from '../entities/season.enum';

export class ListCollectionsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsEnum(CollectionStatus)
  status?: CollectionStatus;

  @IsOptional()
  @IsEnum(Season)
  season?: Season;

  @IsOptional()
  @IsString()
  search?: string;
}
