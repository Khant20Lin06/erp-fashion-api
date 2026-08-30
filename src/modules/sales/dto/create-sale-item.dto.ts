import { IsInt, IsOptional, IsUUID, Matches, Min } from 'class-validator';

/**
 * Non-negative decimal with up to 2 fraction digits — matches the same
 * pattern Phase 11 uses for creditLimit/openingBalanceAmount. Only
 * discountSnapshot and taxSnapshot are ever accepted from the client; unit
 * price/subtotal/lineTotal are always server-resolved/computed (Phase 12
 * locked decision — "never trust client financial totals"). See
 * docs/SALES_ARCHITECTURE.md "Pricing Snapshot".
 */
const NON_NEGATIVE_DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;

export class CreateSaleItemDto {
  @IsUUID()
  productVariantId!: string;

  @IsOptional()
  @IsUUID()
  uomId?: string;

  @IsInt()
  @Min(1)
  quantity!: number;

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
   * Optional per-line tax amount. Phase 12 has no tax rate engine — this
   * is a server-validated pass-through value, never rate-computed. See
   * docs/SALES_ARCHITECTURE.md "Tax Boundary".
   */
  @IsOptional()
  @Matches(NON_NEGATIVE_DECIMAL_PATTERN, {
    message: 'taxAmount must be a non-negative decimal string',
  })
  taxAmount?: string;

  /**
   * Optional explicit PriceList selection — validated to belong to the
   * resolved company. When omitted, the service resolves the single
   * currently-active PriceList for the company (see
   * docs/SALES_ARCHITECTURE.md "Pricing Snapshot" for the exact
   * resolution rule and its ambiguity-rejection behavior).
   */
  @IsOptional()
  @IsUUID()
  priceListId?: string;
}
