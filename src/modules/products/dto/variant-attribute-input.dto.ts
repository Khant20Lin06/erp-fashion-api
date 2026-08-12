import { IsEnum, IsUUID } from 'class-validator';
import { AttributeKind } from '../../master-data/entities/attribute-kind.enum';

export class VariantAttributeInputDto {
  @IsEnum(AttributeKind)
  kind!: AttributeKind;

  @IsUUID()
  optionId!: string;
}
