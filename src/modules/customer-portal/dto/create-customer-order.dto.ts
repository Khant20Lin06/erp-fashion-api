import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateCustomerOrderItemDto } from './create-customer-order-item.dto';

/**
 * No companyId/customerId/branchId/warehouseId/currency here — unlike
 * sales/CreateSaleDto, this endpoint is reached only by an authenticated
 * bot service account whose linked Telegram user resolves to exactly one
 * Customer server-side (CustomerPortalService.getLinkedCustomerOrThrow).
 * Trusting a client-supplied customerId here would let one Telegram user
 * place orders under another customer's account (docs/SECURITY_RULES.md
 * #12/#13 — never trust a client-provided id for authorization).
 */
export class CreateCustomerOrderDto {
  /** Optional integration consistency check; customer identity still resolves server-side. */
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  idempotencyKey?: string;

  @IsString()
  @MaxLength(64)
  telegramUserId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  /**
   * Required — an online/bot-placed order has no other way to know where
   * to deliver. Recorded on the OnlineOrder row, never on Sale itself
   * (see OnlineOrder's own docblock for why this is a separate entity).
   */
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  deliveryAddress!: string;

  /** @username at order time, purely a display convenience — see OnlineOrder.telegramUsername's own docblock. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  telegramUsername?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateCustomerOrderItemDto)
  items!: CreateCustomerOrderItemDto[];
}
