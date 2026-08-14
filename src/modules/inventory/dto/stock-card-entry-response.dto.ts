import { StockMovement } from '../entities/stock-movement.entity';
import { StockMovementType } from '../entities/stock-movement-type.enum';
import { StockMovementReferenceType } from '../entities/stock-movement-reference-type.enum';

/**
 * One chronological row of a Stock Card (Phase 15 locked scope C).
 * balanceBefore is ALWAYS computed as (quantityAfter - quantityChange) —
 * never stored as a database column, never read from WarehouseStock.
 * balanceAfter is quantityAfter verbatim (the denormalized snapshot Phase
 * 14 already wrote at the moment of that movement). Both are pure
 * derivations of a single already-persisted StockMovement row; no other
 * row is consulted to compute either value.
 */
export interface StockCardEntryResponseDto {
  id: string;
  movementType: StockMovementType;
  quantityChange: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType: StockMovementReferenceType;
  referenceId: string;
  createdAt: Date;
  createdBy: string | null;
}

export function toStockCardEntryResponseDto(
  entity: StockMovement,
): StockCardEntryResponseDto {
  return {
    id: entity.id,
    movementType: entity.movementType,
    quantityChange: entity.quantityChange,
    balanceBefore: entity.quantityAfter - entity.quantityChange,
    balanceAfter: entity.quantityAfter,
    referenceType: entity.referenceType,
    referenceId: entity.referenceId,
    createdAt: entity.createdAt,
    createdBy: entity.createdBy,
  };
}
