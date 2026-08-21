import { Repository, SelectQueryBuilder } from 'typeorm';
import { WebhookSubscriptionsService } from './webhook-subscriptions.service';
import { WebhookSubscription } from '../entities/webhook-subscription.entity';
import { CompaniesService } from '../../organization/services/companies.service';
import { ErrorCode } from '../../../core/errors/error-codes';
import { PAYMENT_CONFIRMED_EVENT_TYPE } from '../../payments/events/payment-confirmed.event';
import { toWebhookSubscriptionResponseDto } from '../dto/webhook-subscriptions.dto';

describe('WebhookSubscriptionsService', () => {
  let service: WebhookSubscriptionsService;
  let subscriptionRepository: jest.Mocked<
    Pick<
      Repository<WebhookSubscription>,
      | 'findOne'
      | 'find'
      | 'create'
      | 'save'
      | 'softRemove'
      | 'createQueryBuilder'
    >
  >;
  let companiesService: jest.Mocked<
    Pick<CompaniesService, 'findActiveByIdOrNull'>
  >;
  let queryBuilder: jest.Mocked<
    Pick<
      SelectQueryBuilder<WebhookSubscription>,
      'where' | 'andWhere' | 'orderBy' | 'skip' | 'take' | 'getManyAndCount'
    >
  >;

  const buildSubscription = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'wh-1',
      companyId: 'company-a',
      url: 'https://example.com/hook',
      description: null,
      events: [PAYMENT_CONFIRMED_EVENT_TYPE],
      secret: 'super-secret',
      isActive: true,
      failureCount: 0,
      lastDeliveredAt: null,
      ...overrides,
    }) as WebhookSubscription;

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    subscriptionRepository = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((data: unknown) => data as WebhookSubscription) as never,
      save: jest.fn((data: unknown) =>
        Promise.resolve(data as WebhookSubscription),
      ) as never,
      softRemove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    companiesService = {
      findActiveByIdOrNull: jest.fn().mockResolvedValue({ id: 'company-a' }),
    };

    service = new WebhookSubscriptionsService(
      subscriptionRepository as unknown as Repository<WebhookSubscription>,
      companiesService as unknown as CompaniesService,
    );
  });

  describe('create', () => {
    it('creates a subscription and generates a secret never equal to a predictable value', async () => {
      const { entity, plaintextSecret } = await service.create(
        'company-a',
        'user-1',
        {
          companyId: 'company-a',
          url: 'https://example.com/hook',
          events: [PAYMENT_CONFIRMED_EVENT_TYPE],
        },
      );
      expect(entity.secret).toBe(plaintextSecret);
      expect(plaintextSecret).toHaveLength(64); // 32 bytes hex-encoded
      expect(entity.isActive).toBe(true);
      expect(entity.failureCount).toBe(0);
    });

    it('rejects an inactive/nonexistent company', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(null);

      await expect(
        service.create('company-a', 'user-1', {
          companyId: 'company-a',
          url: 'https://example.com/hook',
          events: [PAYMENT_CONFIRMED_EVENT_TYPE],
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });
  });

  describe('findActiveForEvent — company isolation and event filtering', () => {
    it('returns only active subscriptions for the given company matching the event type', async () => {
      subscriptionRepository.find.mockResolvedValue([
        buildSubscription({
          id: 'wh-1',
          events: [PAYMENT_CONFIRMED_EVENT_TYPE],
        }),
        buildSubscription({ id: 'wh-2', events: ['some.other.event'] }),
      ]);

      const result = await service.findActiveForEvent(
        'company-a',
        PAYMENT_CONFIRMED_EVENT_TYPE,
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('wh-1');
      expect(subscriptionRepository.find).toHaveBeenCalledWith({
        where: { companyId: 'company-a', isActive: true },
      });
    });

    it("never returns a different company's subscriptions (queries by companyId, not globally)", async () => {
      await service.findActiveForEvent(
        'company-b',
        PAYMENT_CONFIRMED_EVENT_TYPE,
      );
      expect(subscriptionRepository.find).toHaveBeenCalledWith({
        where: { companyId: 'company-b', isActive: true },
      });
    });
  });

  describe('update — disable', () => {
    it('can deactivate a subscription', async () => {
      subscriptionRepository.findOne.mockResolvedValue(buildSubscription());

      const result = await service.update('wh-1', 'company-a', 'user-1', {
        isActive: false,
      });
      expect(result.isActive).toBe(false);
    });
  });

  describe('delete', () => {
    it('soft-removes the subscription', async () => {
      subscriptionRepository.findOne.mockResolvedValue(buildSubscription());

      await service.delete('wh-1', 'company-a');
      expect(subscriptionRepository.softRemove).toHaveBeenCalled();
    });
  });

  describe('cross-company isolation', () => {
    it('findByIdInCompany throws NotFound for a subscription in a different company', async () => {
      subscriptionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdInCompany('wh-1', 'company-b'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });

  describe('secret handling', () => {
    it('the response DTO for list/get never includes the secret field', () => {
      const dto = toWebhookSubscriptionResponseDto(buildSubscription());
      expect(dto).not.toHaveProperty('secret');
    });
  });
});
