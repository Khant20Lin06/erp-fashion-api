import { CustomerGroup } from '../entities/customer-group.entity';
import { CustomerGroupStatus } from '../entities/customer-group-status.enum';

export interface CustomerGroupResponseDto {
  id: string;
  companyId: string;
  code: string;
  name: string;
  description: string | null;
  status: CustomerGroupStatus;
  createdAt: Date;
  updatedAt: Date;
}

export function toCustomerGroupResponseDto(
  entity: CustomerGroup,
): CustomerGroupResponseDto {
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
