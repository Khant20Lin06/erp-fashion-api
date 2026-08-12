import { Warehouse } from '../entities/warehouse.entity';
import { WarehouseStatus } from '../entities/warehouse-status.enum';
import { WarehouseType } from '../entities/warehouse-type.enum';

export interface WarehouseResponseDto {
  id: string;
  companyId: string;
  branchId: string;
  code: string;
  name: string;
  type: WarehouseType;
  status: WarehouseStatus;
  address: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toWarehouseResponseDto(
  warehouse: Warehouse,
): WarehouseResponseDto {
  return {
    id: warehouse.id,
    companyId: warehouse.companyId,
    branchId: warehouse.branchId,
    code: warehouse.code,
    name: warehouse.name,
    type: warehouse.type,
    status: warehouse.status,
    address: warehouse.address,
    createdAt: warehouse.createdAt,
    updatedAt: warehouse.updatedAt,
  };
}
