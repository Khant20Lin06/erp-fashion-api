import { SupplierGroup } from '../entities/supplier-group.entity';
import { SupplierGroupStatus } from '../entities/supplier-group-status.enum';

export interface SupplierGroupResponseDto {
  id: string;
  companyId: string;
  code: string;
  name: string;
  description: string | null;
  status: SupplierGroupStatus;
  createdAt: Date;
  updatedAt: Date;
}

export function toSupplierGroupResponseDto(
  entity: SupplierGroup,
): SupplierGroupResponseDto {
  return {
    id: entity.id,
    companyId: entity.companyId,
    code: entity.code,
    name: entity.name,
    description: entity.description,
    status: entity.status,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
