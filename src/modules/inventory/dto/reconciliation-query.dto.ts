import { IsOptional, IsUUID } from 'class-validator';

/**
 * Query params for GET /inventory-ledger/reconciliation (Phase 15 locked
 * scope D). Same shape as StockCardQueryDto — required-together
 * warehouseId/productVariantId enforced in the service layer, not via
 * decorators, for the same reasoning documented there. Kept as a separate
 * class (rather than reusing StockCardQueryDto) so the two endpoints' query
 * contracts can diverge independently later without coupling them.
 */
export class ReconciliationQueryDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  productVariantId?: string;
}
