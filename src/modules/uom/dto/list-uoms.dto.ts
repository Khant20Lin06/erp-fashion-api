import { IsBooleanString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { UomCategory } from '../entities/uom-category.enum';

export class ListUomsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsEnum(UomCategory)
  category?: UomCategory;

  @IsOptional()
  @IsBooleanString()
  isActive?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
