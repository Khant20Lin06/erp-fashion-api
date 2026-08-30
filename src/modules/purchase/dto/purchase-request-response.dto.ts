import {
  PurchaseRequestItemResponseDto,
  toPurchaseRequestItemResponseDto,
} from './purchase-request-item-response.dto';
import { PurchaseRequest } from '../entities/purchase-request.entity';
import { PurchaseRequestStatus } from '../entities/purchase-request-status.enum';

export interface PurchaseRequestResponseDto {
  id: string;
  requestNumber: string;
  companyId: string;
  branchId: string | null;
  department: string;
  requesterName: string;
  requiredDate: Date;
  status: PurchaseRequestStatus;
  notes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  itemCount: number;
  items?: PurchaseRequestItemResponseDto[];
}

export function toPurchaseRequestResponseDto(
  entity: PurchaseRequest,
): PurchaseRequestResponseDto {
  return {
    id: entity.id,
    requestNumber: entity.requestNumber,
    companyId: entity.companyId,
    branchId: entity.branchId,
    department: entity.department,
    requesterName: entity.requesterName,
    requiredDate: entity.requiredDate,
    status: entity.status,
    notes: entity.notes,
    createdBy: entity.createdBy,
    updatedBy: entity.updatedBy,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    itemCount: entity.itemCount ?? entity.items?.length ?? 0,
    items: entity.items
      ? entity.items.map(toPurchaseRequestItemResponseDto)
      : undefined,
  };
}
