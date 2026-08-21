import { EntityManager, Repository } from 'typeorm';
import { PromotionsService } from './promotions.service';
import { Promotion } from '../entities/promotion.entity';
import { PromotionDiscountType } from '../entities/promotion-discount-type.enum';
import { PromotionStatus } from '../entities/promotion-status.enum';
import { CompaniesService } from '../../organization/services/companies.service';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('PromotionsService', () => {
  let service: PromotionsService;
  let promotionRepository: jest.Mocked<
    Pick<Repository<Promotion>, 'findOne' | 'create' | 'save'>
  >;
  let companiesService: jest.Mocked<
    Pick<CompaniesService, 'findActiveByIdOrNull'>
  >;
  let lockQueryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    setLock: jest.Mock;
    getOne: jest.Mock;
  };
  let manager: { createQueryBuilder: jest.Mock; increment: jest.Mock };

  const buildPromotion = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'promo-1',
      companyId: 'company-a',
      code: 'SAVE10',
      discountType: PromotionDiscountType.Percentage,
      discountValue: '10.0000',
      minimumPurchase: '0.00',
      maximumDiscountAmount: null,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      usageLimit: null,
      usageCount: 0,
      status: PromotionStatus.Active,
      ...overrides,
    }) as Promotion;

  beforeEach(() => {
    promotionRepository = {
      findOne: jest.fn(),
      create: jest.fn((data: unknown) => data as Promotion) as never,
      save: jest.fn((data: unknown) =>
        Promise.resolve(data as Promotion),
      ) as never,
    };
    companiesService = {
      findActiveByIdOrNull: jest.fn().mockResolvedValue({ id: 'company-a' }),
    };
    lockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(buildPromotion()),
    };
    manager = {
      createQueryBuilder: jest.fn().mockReturnValue(lockQueryBuilder),
      increment: jest.fn().mockResolvedValue(undefined),
    };

    service = new PromotionsService(
      promotionRepository as unknown as Repository<Promotion>,
      companiesService as unknown as CompaniesService,
    );
  });

  describe('create — validation', () => {
    it('rejects a PERCENTAGE discountValue above 100', async () => {
      promotionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create('company-a', 'user-1', {
          companyId: 'company-a',
          code: 'BAD',
          name: 'Bad Promo',
          discountType: PromotionDiscountType.Percentage,
          discountValue: '150',
          startDate: '2026-01-01',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects endDate before startDate', async () => {
      promotionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create('company-a', 'user-1', {
          companyId: 'company-a',
          code: 'BAD',
          name: 'Bad Promo',
          discountType: PromotionDiscountType.FixedAmount,
          discountValue: '10.00',
          startDate: '2026-06-01',
          endDate: '2026-01-01',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a duplicate promotion code within the same company', async () => {
      promotionRepository.findOne.mockResolvedValue(buildPromotion());

      await expect(
        service.create('company-a', 'user-1', {
          companyId: 'company-a',
          code: 'SAVE10',
          name: 'Duplicate',
          discountType: PromotionDiscountType.FixedAmount,
          discountValue: '5.00',
          startDate: '2026-01-01',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('creates a valid PERCENTAGE promotion', async () => {
      promotionRepository.findOne.mockResolvedValue(null);

      const result = await service.create('company-a', 'user-1', {
        companyId: 'company-a',
        code: 'SAVE10',
        name: 'Save 10%',
        discountType: PromotionDiscountType.Percentage,
        discountValue: '10',
        startDate: '2026-01-01',
      });
      expect(result.code).toBe('SAVE10');
      expect(result.status).toBe(PromotionStatus.Active);
    });
  });

  describe('resolveAndLockForUse', () => {
    it('resolves an active promotion within its date window and above minimumPurchase', async () => {
      const result = await service.resolveAndLockForUse(
        manager as unknown as EntityManager,
        'company-a',
        'SAVE10',
        100,
        new Date('2026-06-01'),
      );
      expect(result.code).toBe('SAVE10');
      expect(lockQueryBuilder.setLock).toHaveBeenCalledWith(
        'pessimistic_write',
      );
    });

    it('rejects an unknown promotion code', async () => {
      lockQueryBuilder.getOne.mockResolvedValue(null);

      await expect(
        service.resolveAndLockForUse(
          manager as unknown as EntityManager,
          'company-a',
          'NOPE',
          100,
          new Date('2026-06-01'),
        ),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects an inactive promotion', async () => {
      lockQueryBuilder.getOne.mockResolvedValue(
        buildPromotion({ status: PromotionStatus.Inactive }),
      );

      await expect(
        service.resolveAndLockForUse(
          manager as unknown as EntityManager,
          'company-a',
          'SAVE10',
          100,
          new Date('2026-06-01'),
        ),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a promotion outside its date window', async () => {
      await expect(
        service.resolveAndLockForUse(
          manager as unknown as EntityManager,
          'company-a',
          'SAVE10',
          100,
          new Date('2027-01-01'),
        ),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects when order subtotal is below minimumPurchase', async () => {
      lockQueryBuilder.getOne.mockResolvedValue(
        buildPromotion({ minimumPurchase: '500.00' }),
      );

      await expect(
        service.resolveAndLockForUse(
          manager as unknown as EntityManager,
          'company-a',
          'SAVE10',
          100,
          new Date('2026-06-01'),
        ),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a promotion that has reached its usage limit', async () => {
      lockQueryBuilder.getOne.mockResolvedValue(
        buildPromotion({ usageLimit: 5, usageCount: 5 }),
      );

      await expect(
        service.resolveAndLockForUse(
          manager as unknown as EntityManager,
          'company-a',
          'SAVE10',
          100,
          new Date('2026-06-01'),
        ),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });
  });

  describe('computeDiscountAmount — backend-authoritative calculation', () => {
    it('computes a PERCENTAGE discount', () => {
      const promotion = buildPromotion({ discountValue: '10.0000' });
      const discount = service.computeDiscountAmount(promotion, 200);
      expect(discount).toBe(20);
    });

    it('caps a PERCENTAGE discount at maximumDiscountAmount', () => {
      const promotion = buildPromotion({
        discountValue: '50.0000',
        maximumDiscountAmount: '30.00',
      });
      const discount = service.computeDiscountAmount(promotion, 200);
      expect(discount).toBe(30);
    });

    it('computes a FIXED_AMOUNT discount', () => {
      const promotion = buildPromotion({
        discountType: PromotionDiscountType.FixedAmount,
        discountValue: '25.00',
      });
      const discount = service.computeDiscountAmount(promotion, 200);
      expect(discount).toBe(25);
    });

    it('never lets a FIXED_AMOUNT discount exceed the order subtotal (no negative order total)', () => {
      const promotion = buildPromotion({
        discountType: PromotionDiscountType.FixedAmount,
        discountValue: '999.00',
      });
      const discount = service.computeDiscountAmount(promotion, 50);
      expect(discount).toBe(50);
    });
  });

  describe('cross-company isolation', () => {
    it('findByIdInCompany throws NotFound for a promotion in a different company', async () => {
      promotionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdInCompany('promo-1', 'company-b'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });
});
