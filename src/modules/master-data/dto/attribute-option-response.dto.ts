import { AttributeOption } from '../entities/attribute-option.entity';
import { AttributeOptionStatus } from '../entities/attribute-option-status.enum';
import { AttributeKind } from '../entities/attribute-kind.enum';

export interface AttributeOptionResponseDto {
  id: string;
  companyId: string;
  kind: AttributeKind;
  code: string;
  value: string;
  swatch: string | null;
  sortOrder: number;
  status: AttributeOptionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export function toAttributeOptionResponseDto(
  option: AttributeOption,
): AttributeOptionResponseDto {
  return {
    id: option.id,
    companyId: option.companyId,
    kind: option.kind,
    code: option.code,
    value: option.value,
    swatch: option.swatch,
    sortOrder: option.sortOrder,
    status: option.status,
    createdAt: option.createdAt,
    updatedAt: option.updatedAt,
  };
}
