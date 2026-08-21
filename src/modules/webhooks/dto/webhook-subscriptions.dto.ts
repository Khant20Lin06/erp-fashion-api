import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { WebhookSubscription } from '../entities/webhook-subscription.entity';
import { SUPPORTED_WEBHOOK_EVENT_TYPES } from '../webhook-event-types';

export class CreateWebhookSubscriptionDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsString()
  @MaxLength(500)
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(SUPPORTED_WEBHOOK_EVENT_TYPES, { each: true })
  events!: string[];
}

export class UpdateWebhookSubscriptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(SUPPORTED_WEBHOOK_EVENT_TYPES, { each: true })
  events?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListWebhookSubscriptionsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * Never includes `secret` (LOCKED — the phase's own explicit "never
 * return plaintext secret after creation... never expose secret in
 * list/get endpoints" rule). See WebhookSubscriptionCreatedResponseDto for
 * the ONE-TIME exception at creation.
 */
export interface WebhookSubscriptionResponseDto {
  id: string;
  companyId: string;
  url: string;
  description: string | null;
  events: string[];
  isActive: boolean;
  failureCount: number;
  lastDeliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toWebhookSubscriptionResponseDto(
  subscription: WebhookSubscription,
): WebhookSubscriptionResponseDto {
  return {
    id: subscription.id,
    companyId: subscription.companyId,
    url: subscription.url,
    description: subscription.description,
    events: subscription.events,
    isActive: subscription.isActive,
    failureCount: subscription.failureCount,
    lastDeliveredAt: subscription.lastDeliveredAt,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  };
}

/**
 * Returned ONLY from the create endpoint's response, exactly once — the
 * only place `secret` is ever serialized. Every other read of a
 * WebhookSubscription (list/get/update) uses
 * WebhookSubscriptionResponseDto, which has no secret field at all.
 */
export interface WebhookSubscriptionCreatedResponseDto extends WebhookSubscriptionResponseDto {
  secret: string;
}
