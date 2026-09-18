import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

/**
 * Deliberately narrower than sales/CreateSaleItemDto: no discountAmount,
 * taxAmount, uomId, or priceListId — a bot-placed customer order has no
 * legitimate reason to set any of those, so they are not exposed here
 * rather than accepted and ignored (mass-assignment discipline,
 * docs/SECURITY_RULES.md #21).
 *
 * sku, not productVariantId: the Customer Service Bot's "/order SKU-001
 * x2" command only ever has a SKU string from the Telegram message text —
 * CustomerPortalService resolves it to a real, active ProductVariant
 * server-side (ProductVariantsService.findBySkuInCompany), the same
 * "never trust a client-supplied id, resolve it yourself" pattern used
 * everywhere else in this module.
 */
export class CreateCustomerOrderItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  sku!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}
