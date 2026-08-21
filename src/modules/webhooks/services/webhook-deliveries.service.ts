import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookDelivery } from '../entities/webhook-delivery.entity';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';

@Injectable()
export class WebhookDeliveriesService {
  constructor(
    @InjectRepository(WebhookDelivery)
    private readonly deliveryRepository: Repository<WebhookDelivery>,
  ) {}

  async findAllForSubscription(
    webhookSubscriptionId: string,
    page = DEFAULT_PAGE,
    limit = DEFAULT_LIMIT,
  ): Promise<{
    data: WebhookDelivery[];
    meta: { page: number; limit: number; total: number };
  }> {
    const [data, total] = await this.deliveryRepository.findAndCount({
      where: { webhookSubscriptionId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, meta: { page, limit, total } };
  }
}
