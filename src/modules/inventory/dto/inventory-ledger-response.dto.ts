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
  productVariantId: string;
  movementType: StockMovementType;
  quantityChange: number;
  quantityAfter: number;
  referenceType: StockMovementReferenceType;
  referenceId: string;
  createdAt: Date;
  createdBy: string | null;
}

export function toInventoryLedgerResponseDto(
  entity: StockMovement,
): InventoryLedgerResponseDto {
  return {
    id: entity.id,
    warehouseId: entity.warehouseId,
    productVariantId: entity.productVariantId,
    movementType: entity.movementType,
    quantityChange: entity.quantityChange,
    quantityAfter: entity.quantityAfter,
    referenceType: entity.referenceType,
    referenceId: entity.referenceId,
    createdAt: entity.createdAt,
    createdBy: entity.createdBy,
  };
}
