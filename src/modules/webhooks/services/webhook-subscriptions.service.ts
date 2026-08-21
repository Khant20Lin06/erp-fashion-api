import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookSubscription } from '../entities/webhook-subscription.entity';
import { CompaniesService } from '../../organization/services/companies.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { randomUUID } from 'crypto';
import { generateWebhookSecret } from '../utils/webhook-signature';
import { postSignedWebhook, WebhookPostResult } from '../utils/webhook-http';
import {
  CreateWebhookSubscriptionDto,
  ListWebhookSubscriptionsDto,
  UpdateWebhookSubscriptionDto,
} from '../dto/webhook-subscriptions.dto';

/** The reserved eventType used only by the test-delivery endpoint — never a real domain event, never matched by any subscription's `events` filter. */
export const WEBHOOK_TEST_EVENT_TYPE = 'webhook.test';

@Injectable()
export class WebhookSubscriptionsService {
  constructor(
    @InjectRepository(WebhookSubscription)
    private readonly subscriptionRepository: Repository<WebhookSubscription>,
    private readonly companiesService: CompaniesService,
  ) {}

  async findAll(
    companyId: string,
    query: ListWebhookSubscriptionsDto,
  ): Promise<{
    data: WebhookSubscription[];
    meta: { page: number; limit: number; total: number };
  }> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const qb = this.subscriptionRepository
      .createQueryBuilder('subscription')
      .where('subscription.companyId = :companyId', { companyId });

    if (query.isActive !== undefined) {
      qb.andWhere('subscription.isActive = :isActive', {
        isActive: query.isActive,
      });
    }

    qb.orderBy('subscription.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<WebhookSubscription> {
    const entity = await this.subscriptionRepository.findOne({
      where: { id, companyId },
    });
    if (!entity) {
      throw new AppException(
        ErrorCode.NotFound,
        'Webhook subscription not found',
      );
    }
    return entity;
  }

  /**
   * Loads every ACTIVE subscription for a company that lists the given
   * event type — the exact query WebhookDispatchConsumer runs per
   * incoming event. Filters at the database level on (companyId,
   * isActive) via the entity's own composite index, then narrows by event
   * membership in application code (the `events` JSON array is small and
   * never large enough to justify a join table or JSON_CONTAINS index —
   * see the entity's own docblock).
   */
  async findActiveForEvent(
    companyId: string,
    eventType: string,
  ): Promise<WebhookSubscription[]> {
    const active = await this.subscriptionRepository.find({
      where: { companyId, isActive: true },
    });
    return active.filter((subscription) =>
      subscription.events.includes(eventType),
    );
  }

  async create(
    companyId: string,
    userId: string,
    dto: CreateWebhookSubscriptionDto,
  ): Promise<{ entity: WebhookSubscription; plaintextSecret: string }> {
    const company = await this.companiesService.findActiveByIdOrNull(companyId);
    if (!company) {
      throw new AppException(
        ErrorCode.ValidationError,
        'companyId does not reference an active company',
      );
    }

    const plaintextSecret = generateWebhookSecret();
    const entity = this.subscriptionRepository.create({
      companyId,
      url: dto.url,
      description: dto.description ?? null,
      events: dto.events,
      secret: plaintextSecret,
      isActive: true,
      failureCount: 0,
      lastDeliveredAt: null,
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await this.subscriptionRepository.save(entity);
    return { entity: saved, plaintextSecret };
  }

  async update(
    id: string,
    companyId: string,
    userId: string,
    dto: UpdateWebhookSubscriptionDto,
  ): Promise<WebhookSubscription> {
    const entity = await this.findByIdInCompany(id, companyId);

    if (dto.url !== undefined) entity.url = dto.url;
    if (dto.description !== undefined) {
      entity.description = dto.description?.trim() || null;
    }
    if (dto.events !== undefined) entity.events = dto.events;
    if (dto.isActive !== undefined) entity.isActive = dto.isActive;
    entity.updatedBy = userId;

    return this.subscriptionRepository.save(entity);
  }

  async delete(id: string, companyId: string): Promise<void> {
    const entity = await this.findByIdInCompany(id, companyId);
    await this.subscriptionRepository.softRemove(entity);
  }

  /**
   * Sends a real, signed HTTP POST to the subscription's URL using a
   * clearly-identifiable synthetic event (type "webhook.test", a fresh
   * random eventId, no real domain payload) — exercises the exact same
   * signing/POST path as production delivery (postSignedWebhook, shared
   * with WebhookDeliveryWorker) but writes NO WebhookDelivery row (a test
   * send is not a real delivery attempt and must not appear in delivery
   * history or affect failureCount/lastDeliveredAt) and does not go
   * through the queue (the caller gets a synchronous result, per the
   * phase's "must not modify real domain data" + practical UX
   * requirement for a manual test button).
   */
  async sendTestDelivery(
    id: string,
    companyId: string,
  ): Promise<WebhookPostResult> {
    const subscription = await this.findByIdInCompany(id, companyId);
    const rawBody = JSON.stringify({
      id: randomUUID(),
      type: WEBHOOK_TEST_EVENT_TYPE,
      occurredAt: new Date().toISOString(),
      companyId: subscription.companyId,
    });
    return postSignedWebhook(subscription.url, subscription.secret, rawBody);
  }
}
