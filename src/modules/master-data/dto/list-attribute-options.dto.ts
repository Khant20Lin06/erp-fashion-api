import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { AttributeOptionStatus } from '../entities/attribute-option-status.enum';
import { AttributeKind } from '../entities/attribute-kind.enum';

export class ListAttributeOptionsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsEnum(AttributeKind)
  kind?: AttributeKind;

  @IsOptional()
  @IsEnum(AttributeOptionStatus)
  status?: AttributeOptionStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
