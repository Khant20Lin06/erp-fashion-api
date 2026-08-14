import { IsOptional, IsUUID } from 'class-validator';

/**
 * Query params for GET /inventory-ledger/stock-card (Phase 15 locked scope
 * C). warehouseId + productVariantId are required — enforced explicitly in
 * InventoryLedgerService.getStockCard() (400 if either is missing), not via
 * @IsNotEmpty() here, since class-validator's decorator-based rejection
 * message is less specific than the service-level check this codebase's
 * existing controllers prefer for cross-field/required-together validation.
 * companyId is optional (resolved server-side via resolveRequestCompanyId()
 * exactly like every other controller since Phase 09).
 */
export class StockCardQueryDto {
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
