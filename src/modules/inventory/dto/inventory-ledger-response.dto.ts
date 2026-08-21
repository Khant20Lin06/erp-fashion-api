import { StockMovement } from '../entities/stock-movement.entity';
import { StockMovementType } from '../entities/stock-movement-type.enum';
import { StockMovementReferenceType } from '../entities/stock-movement-reference-type.enum';

/**
 * Plain read-only projection of a StockMovement row (Phase 15 scope A/B).
 * No new persisted fields — every field here already exists on the Phase 14
 * StockMovement entity, verbatim.
 */
export interface InventoryLedgerResponseDto {
  id: string;
  warehouseId: string;
  warehouseName: string | null;
  productVariantId: string;
  productName: string | null;
  sku: string | null;
  variantLabel: string | null;
  movementType: StockMovementType;
  quantityChange: number;
  quantityAfter: number;
  referenceType: StockMovementReferenceType;
  referenceId: string;
  referenceNumber: string | null;
  createdAt: Date;
  createdBy: string | null;
  createdByName: string | null;
}

export function toInventoryLedgerResponseDto(
  entity: StockMovement,
  extras: Partial<
    Pick<
      InventoryLedgerResponseDto,
      | 'warehouseName'
      | 'productName'
      | 'sku'
      | 'variantLabel'
      | 'referenceNumber'
      | 'createdByName'
    >
  > = {},
): InventoryLedgerResponseDto {
  return {
    id: entity.id,
    warehouseId: entity.warehouseId,
    warehouseName: extras.warehouseName ?? null,
    productVariantId: entity.productVariantId,
    productName: extras.productName ?? null,
    sku: extras.sku ?? null,
    variantLabel: extras.variantLabel ?? null,
    movementType: entity.movementType,
    quantityChange: entity.quantityChange,
    quantityAfter: entity.quantityAfter,
    referenceType: entity.referenceType,
    referenceId: entity.referenceId,
    referenceNumber: extras.referenceNumber ?? entity.referenceId,
    createdAt: entity.createdAt,
    createdBy: entity.createdBy,
    createdByName: extras.createdByName ?? null,
  };
}
