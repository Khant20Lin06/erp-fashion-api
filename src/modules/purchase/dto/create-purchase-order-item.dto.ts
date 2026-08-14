import { IsInt, IsOptional, IsUUID, Matches, Min } from 'class-validator';

/**
 * Non-negative decimal with up to 2 fraction digits — matches the same
 * pattern Phase 12's CreateSaleItemDto uses for discountAmount/taxAmount,
 * and Phase 11 uses for creditLimit/openingBalanceAmount. Unlike Sale
 * (which resolves unitPriceSnapshot server-side from an active
 * PriceListItem), Purchase has no equivalent pricing engine — the buyer
 * supplies the actual negotiated unitCost for this specific order, and the
 * server only validates it is non-negative. See
 * docs/PURCHASE_ARCHITECTURE.md "Cost Snapshot Strategy".
 */
const NON_NEGATIVE_DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;

export class CreatePurchaseOrderItemDto {
  @IsUUID()
  productVariantId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  /**
   * Client-supplied unit cost for this order — server-validated
   * non-negative, NEVER resolved from ProductVariant.costPrice (that field
   * is reference/default data only, per
   * docs/PRODUCT_VARIANT_PRICING_ARCHITECTURE.md §20).
   */
  @Matches(NON_NEGATIVE_DECIMAL_PATTERN, {
    message: 'unitCost must be a non-negative decimal string',
  })
  unitCost!: string;

  /**
   * Optional per-line discount amount, validated non-negative and clamped
   * against the line's own resolved subtotal by the service — never
   * trusted as the source of a client-supplied lineTotal/subtotal.
   */
  @IsOptional()
  @Matches(NON_NEGATIVE_DECIMAL_PATTERN, {
    message: 'discountAmount must be a non-negative decimal string',
  })
  discountAmount?: string;

  /**
   * Optional per-line tax amount. Phase 13 has no tax rate engine — this
   * is a server-validated pass-through value, never rate-computed. See
   * docs/PURCHASE_ARCHITECTURE.md "Tax Snapshot Strategy".
   */
  @IsOptional()
  @Matches(NON_NEGATIVE_DECIMAL_PATTERN, {
    message: 'taxAmount must be a non-negative decimal string',
  })
  taxAmount?: string;
}
