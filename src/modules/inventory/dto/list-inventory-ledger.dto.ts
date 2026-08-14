import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { StockMovementType } from '../entities/stock-movement-type.enum';
import { StockMovementReferenceType } from '../entities/stock-movement-reference-type.enum';

/**
 * Filters for GET /inventory-ledger (Phase 15 locked scope A). Every filter
 * is applied at the database query-builder level in
 * InventoryLedgerService.findAll() — never load-all-then-filter-in-JS.
 *
 * fromDate/toDate are a genuinely new filter shape for this codebase (no
 * prior list DTO — ListSalesDto/ListPurchaseOrdersDto — has date-range
 * filtering yet). Modeled as plain ISO-8601 date/datetime strings via
 * @IsDateString(), consistent with this codebase's existing
 * class-validator-only DTO style (no custom date-range value object). The
 * fromDate > toDate case is rejected with a clear 400 in the service layer,
 * never silently swapped — see InventoryLedgerService.assertValidDateRange().
 */
export class ListInventoryLedgerDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  productVariantId?: string;

  @IsOptional()
  @IsEnum(StockMovementType)
  movementType?: StockMovementType;

  @IsOptional()
  @IsEnum(StockMovementReferenceType)
  referenceType?: StockMovementReferenceType;

  @IsOptional()
  @IsUUID()
  referenceId?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}
