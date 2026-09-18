import { BranchTransfer } from '../entities/branch-transfer.entity';
import { BranchTransferItem } from '../entities/branch-transfer-item.entity';
import { BranchTransferStatus } from '../entities/branch-transfer-status.enum';

export interface BranchTransferItemResponseDto {
  id: string;
  transferId: string;
  productVariantId: string;
  requestedQuantity: number;
  shippedQuantity: number;
  receivedQuantity: number;
  productName: string | null;
  sku: string | null;
  variantLabel: string | null;
}

export interface BranchTransferResponseDto {
  id: string;
  transferNumber: string;
  companyId: string;
  sourceBranchId: string;
  sourceBranchName: string | null;
  sourceWarehouseId: string;
  sourceWarehouseName: string | null;
  destinationBranchId: string;
  destinationBranchName: string | null;
  destinationWarehouseId: string;
  destinationWarehouseName: string | null;
  status: BranchTransferStatus;
  transitMethod: string | null;
  trackingNumber: string | null;
  driverName: string | null;
  driverPhone: string | null;
  dispatchedAt: Date | null;
  dispatchedBy: string | null;
  dispatchedByName: string | null;
  receivedAt: Date | null;
  receivedBy: string | null;
  receivedByName: string | null;
  notes: string | null;
  createdBy: string;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: BranchTransferItemResponseDto[];
}

export function toBranchTransferItemResponseDto(
  entity: BranchTransferItem,
  extras: Partial<
    Pick<
      BranchTransferItemResponseDto,
      'productName' | 'sku' | 'variantLabel'
    >
  > = {},
): BranchTransferItemResponseDto {
  return {
    id: entity.id,
    transferId: entity.transferId,
    productVariantId: entity.productVariantId,
    requestedQuantity: entity.requestedQuantity,
    shippedQuantity: entity.shippedQuantity,
    receivedQuantity: entity.receivedQuantity,
    productName: extras.productName ?? null,
    sku: extras.sku ?? null,
    variantLabel: extras.variantLabel ?? null,
  };
}

export function toBranchTransferResponseDto(
  entity: BranchTransfer,
  extras: Partial<
    Pick<
      BranchTransferResponseDto,
      | 'sourceBranchName'
      | 'sourceWarehouseName'
      | 'destinationBranchName'
      | 'destinationWarehouseName'
      | 'createdByName'
      | 'dispatchedByName'
      | 'receivedByName'
      | 'items'
    >
  > = {},
): BranchTransferResponseDto {
  return {
    id: entity.id,
    transferNumber: entity.transferNumber,
    companyId: entity.companyId,
    sourceBranchId: entity.sourceBranchId,
    sourceBranchName: extras.sourceBranchName ?? null,
    sourceWarehouseId: entity.sourceWarehouseId,
    sourceWarehouseName: extras.sourceWarehouseName ?? null,
    destinationBranchId: entity.destinationBranchId,
    destinationBranchName: extras.destinationBranchName ?? null,
    destinationWarehouseId: entity.destinationWarehouseId,
    destinationWarehouseName: extras.destinationWarehouseName ?? null,
    status: entity.status,
    transitMethod: entity.transitMethod ?? null,
    trackingNumber: entity.trackingNumber ?? null,
    driverName: entity.driverName ?? null,
    driverPhone: entity.driverPhone ?? null,
    dispatchedAt: entity.dispatchedAt ?? null,
    dispatchedBy: entity.dispatchedBy ?? null,
    dispatchedByName: extras.dispatchedByName ?? null,
    receivedAt: entity.receivedAt ?? null,
    receivedBy: entity.receivedBy ?? null,
    receivedByName: extras.receivedByName ?? null,
    notes: entity.notes ?? null,
    createdBy: entity.createdBy,
    createdByName: extras.createdByName ?? null,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    items: extras.items ?? [],
  };
}
