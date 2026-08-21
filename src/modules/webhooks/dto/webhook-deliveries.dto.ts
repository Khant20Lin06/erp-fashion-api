import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { WebhookDelivery } from '../entities/webhook-delivery.entity';
import { WebhookDeliveryStatus } from '../entities/webhook-delivery-status.enum';

export class ListWebhookDeliveriesDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;
}

export interface WebhookDeliveryResponseDto {
  id: string;
  webhookSubscriptionId: string;
  eventId: string;
  eventType: string;
  status: WebhookDeliveryStatus;
  attempt: number;
  responseStatus: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toWebhookDeliveryResponseDto(
  delivery: WebhookDelivery,
): WebhookDeliveryResponseDto {
  return {
    id: delivery.id,
    webhookSubscriptionId: delivery.webhookSubscriptionId,
    eventId: delivery.eventId,
    eventType: delivery.eventType,
    status: delivery.status,
    attempt: delivery.attempt,
    responseStatus: delivery.responseStatus,
    responseBody: delivery.responseBody,
    errorMessage: delivery.errorMessage,
    deliveredAt: delivery.deliveredAt,
    createdAt: delivery.createdAt,
    updatedAt: delivery.updatedAt,
  };
}
