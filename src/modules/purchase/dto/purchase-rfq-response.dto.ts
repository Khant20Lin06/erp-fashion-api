import { PurchaseRfq } from '../entities/purchase-rfq.entity';
import { PurchaseRfqStatus } from '../entities/purchase-rfq-status.enum';
import {
  PurchaseRfqItemResponseDto,
  toPurchaseRfqItemResponseDto,
} from './purchase-rfq-item-response.dto';

export interface PurchaseRfqResponseDto {
  id: string;
  rfqNumber: string;
  companyId: string;
  branchId: string | null;
  purchaseRequestId: string | null;
  title: string;
  requiredDate: Date;
  status: PurchaseRfqStatus;
  invitedSupplierIds: string[];
  notes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  itemCount: number;
  items?: PurchaseRfqItemResponseDto[];
}

export function toPurchaseRfqResponseDto(
  entity: PurchaseRfq,
): PurchaseRfqResponseDto {
  return {
    id: entity.id,
    rfqNumber: entity.rfqNumber,
    companyId: entity.companyId,
    branchId: entity.branchId,
    purchaseRequestId: entity.purchaseRequestId,
    title: entity.title,
    requiredDate: entity.requiredDate,
    status: entity.status,
    invitedSupplierIds: entity.invitedSupplierIds,
    notes: entity.notes,
    createdBy: entity.createdBy,
    updatedBy: entity.updatedBy,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    itemCount: entity.items?.length ?? 0,
    items: entity.items
      ? entity.items.map(toPurchaseRfqItemResponseDto)
      : undefined,
  };
}
