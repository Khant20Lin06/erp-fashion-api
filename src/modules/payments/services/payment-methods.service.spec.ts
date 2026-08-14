import { Repository, SelectQueryBuilder } from 'typeorm';
import { PaymentMethodsService } from './payment-methods.service';
import { PaymentMethod } from '../entities/payment-method.entity';
import { PaymentMethodStatus } from '../entities/payment-method-status.enum';
import { CompaniesService } from '../../organization/services/companies.service';
import { CompanyStatus } from '../../organization/entities/company-status.enum';
import { ErrorCode } from '../../../core/errors/error-codes';
import { CacheService } from '../../redis/cache.service';
import { CacheKeys } from '../../redis/cache-keys';

describe('PaymentMethodsService', () => {
  let service: PaymentMethodsService;
  let paymentMethodRepository: jest.Mocked<
    Pick<
      Repository<PaymentMethod>,
      'findOne' | 'create' | 'save' | 'createQueryBuilder'
    >
  >;
  let companiesService: jest.Mocked<
    Pick<CompaniesService, 'findActiveByIdOrNull'>
  >;
  let cacheService: jest.Mocked<Pick<CacheService, 'get' | 'set' | 'delete'>>;
  let queryBuilder: jest.Mocked<
    Pick<
      SelectQueryBuilder<PaymentMethod>,
      'where' | 'andWhere' | 'orderBy' | 'skip' | 'take' | 'getManyAndCount'
    >
  >;

  const buildCompany = (overrides: Record<string, unknown> = {}) =>
    ({ id: 'company-a', status: CompanyStatus.Active, ...overrides }) as never;

  const buildPaymentMethod = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'pm-1',
      companyId: 'company-a',
      code: 'CASH',
      name: 'Cash',
      status: PaymentMethodStatus.Active,
      ...overrides,
    }) as PaymentMethod;

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };
    paymentMethodRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    } as never;
    companiesService = { findActiveByIdOrNull: jest.fn() };
    cacheService = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    service = new PaymentMethodsService(
      paymentMethodRepository as unknown as Repository<PaymentMethod>,
      companiesService as unknown as CompaniesService,
      cacheService as unknown as CacheService,
    );
  });

  describe('findByIdInCompany', () => {
    it('returns the payment method when found in the company', async () => {
      const pm = buildPaymentMethod();
      paymentMethodRepository.findOne.mockResolvedValue(pm);

      const result = await service.findByIdInCompany('pm-1', 'company-a');

      expect(result).toBe(pm);
      expect(paymentMethodRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'pm-1', companyId: 'company-a' },
      });
    });

    it('throws NotFound when missing', async () => {
      paymentMethodRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdInCompany('missing', 'company-a'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });

  describe('create', () => {
    it('rejects an inactive/nonexistent company', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(null);

      await expect(
        service.create('company-a', { code: 'CASH', name: 'Cash' }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a duplicate code within the same company (409)', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      paymentMethodRepository.findOne.mockResolvedValue(buildPaymentMethod());

      await expect(
        service.create('company-a', { code: 'CASH', name: 'Cash' }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('creates a payment method defaulting to ACTIVE status', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      paymentMethodRepository.findOne.mockResolvedValue(null);
      (paymentMethodRepository.create as jest.Mock).mockImplementation(
        (data: unknown) => data,
      );
      (paymentMethodRepository.save as jest.Mock).mockImplementation(
        (data: unknown) => Promise.resolve(data),
      );

      const result = await service.create('company-a', {
        code: 'CASH',
        name: 'Cash',
      });

      expect(result.status).toBe(PaymentMethodStatus.Active);
      expect(paymentMethodRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'company-a',
          code: 'CASH',
          name: 'Cash',
          status: PaymentMethodStatus.Active,
        }),
      );
    });

    it('invalidates the default-list cache after a successful create (delete-on-write, after commit)', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      paymentMethodRepository.findOne.mockResolvedValue(null);
      (paymentMethodRepository.create as jest.Mock).mockImplementation(
        (data: unknown) => data,
      );
      (paymentMethodRepository.save as jest.Mock).mockImplementation(
        (data: unknown) => Promise.resolve(data),
      );

      await service.create('company-a', { code: 'CASH', name: 'Cash' });

      expect(cacheService.delete).toHaveBeenCalledWith(
        CacheKeys.paymentMethods('company-a'),
      );
    });
  });

  describe('findAll', () => {
    it('applies companyId/status/search filters and returns paginated results', async () => {
      const pm = buildPaymentMethod();
      queryBuilder.getManyAndCount.mockResolvedValue([[pm], 1]);

      const result = await service.findAll('company-a', {
        status: PaymentMethodStatus.Active,
        search: 'cas',
        page: 1,
        limit: 20,
      } as never);

      expect(result).toEqual({
        data: [pm],
        meta: { page: 1, limit: 20, total: 1 },
      });
      expect(queryBuilder.andWhere).toHaveBeenCalled();
    });

    it('bypasses the cache entirely for a filtered/non-default query', async () => {
      const pm = buildPaymentMethod();
      queryBuilder.getManyAndCount.mockResolvedValue([[pm], 1]);

      await service.findAll('company-a', {
        status: PaymentMethodStatus.Active,
      } as never);

      expect(cacheService.get).not.toHaveBeenCalled();
      expect(cacheService.set).not.toHaveBeenCalled();
    });

    it('returns the cached result for the default query without hitting the DB', async () => {
      const cached = {
        data: [buildPaymentMethod()],
        meta: { page: 1, limit: 20, total: 1 },
      };
      cacheService.get.mockResolvedValue(cached);

      const result = await service.findAll('company-a', {} as never);

      expect(result).toBe(cached);
      expect(paymentMethodRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('populates the cache after a real DB query for the default query', async () => {
      const pm = buildPaymentMethod();
      queryBuilder.getManyAndCount.mockResolvedValue([[pm], 1]);

      await service.findAll('company-a', {} as never);

      expect(cacheService.set).toHaveBeenCalledWith(
        CacheKeys.paymentMethods('company-a'),
        { data: [pm], meta: { page: 1, limit: 20, total: 1 } },
        expect.any(Number),
      );
    });
  });
});
