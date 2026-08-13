import { Repository, SelectQueryBuilder } from 'typeorm';
import { PaymentTermsService } from './payment-terms.service';
import { PaymentTerm } from '../entities/payment-term.entity';
import { PaymentTermStatus } from '../entities/payment-term-status.enum';
import { Customer } from '../entities/customer.entity';
import { Supplier } from '../entities/supplier.entity';
import { CompaniesService } from '../../organization/services/companies.service';
import { Company } from '../../organization/entities/company.entity';
import { CompanyStatus } from '../../organization/entities/company-status.enum';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('PaymentTermsService', () => {
  let service: PaymentTermsService;
  let paymentTermRepository: jest.Mocked<
    Pick<
      Repository<PaymentTerm>,
      'findOne' | 'create' | 'save' | 'softRemove' | 'createQueryBuilder'
    >
  >;
  let customerRepository: jest.Mocked<Pick<Repository<Customer>, 'count'>>;
  let supplierRepository: jest.Mocked<Pick<Repository<Supplier>, 'count'>>;
  let companiesService: jest.Mocked<
    Pick<CompaniesService, 'findActiveByIdOrNull'>
  >;
  let queryBuilder: jest.Mocked<
    Pick<
      SelectQueryBuilder<PaymentTerm>,
      'where' | 'andWhere' | 'orderBy' | 'skip' | 'take' | 'getManyAndCount'
    >
  >;

  const buildCompany = (overrides: Partial<Company> = {}): Company =>
    ({
      id: 'company-a',
      status: CompanyStatus.Active,
      ...overrides,
    }) as Company;

  const buildTerm = (overrides: Partial<PaymentTerm> = {}): PaymentTerm =>
    ({
      id: 'term-1',
      companyId: 'company-a',
      code: 'NET30',
      name: 'Net 30',
      description: null,
      dueDays: 30,
      status: PaymentTermStatus.Active,
      ...overrides,
    }) as PaymentTerm;

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };
    paymentTermRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    customerRepository = { count: jest.fn() };
    supplierRepository = { count: jest.fn() };
    companiesService = { findActiveByIdOrNull: jest.fn() };

    service = new PaymentTermsService(
      paymentTermRepository as unknown as Repository<PaymentTerm>,
      customerRepository as unknown as Repository<Customer>,
      supplierRepository as unknown as Repository<Supplier>,
      companiesService as unknown as CompaniesService,
    );
  });

  describe('create', () => {
    it('creates a payment term when company is active and code is unique', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      paymentTermRepository.findOne.mockResolvedValue(null);
      const created = buildTerm();
      paymentTermRepository.create.mockReturnValue(created);
      paymentTermRepository.save.mockResolvedValue(created);

      const result = await service.create('company-a', {
        code: 'NET30',
        name: 'Net 30',
        dueDays: 30,
      });

      expect(result).toBe(created);
    });

    it('rejects when companyId does not reference an active company', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(null);

      await expect(
        service.create('missing', {
          code: 'NET30',
          name: 'Net 30',
          dueDays: 30,
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a duplicate code within the same company (409)', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      paymentTermRepository.findOne.mockResolvedValue(buildTerm());

      await expect(
        service.create('company-a', {
          code: 'NET30',
          name: 'Dup',
          dueDays: 30,
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });
  });

  describe('findByIdInCompany — cross-company isolation', () => {
    it('throws NotFound for a term belonging to a different company', async () => {
      paymentTermRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdInCompany('term-1', 'company-b'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });

  describe('remove', () => {
    it('soft-deletes the payment term when unreferenced', async () => {
      const term = buildTerm();
      paymentTermRepository.findOne.mockResolvedValue(term);
      customerRepository.count.mockResolvedValue(0);
      supplierRepository.count.mockResolvedValue(0);

      await service.remove('term-1', 'company-a');

      expect(paymentTermRepository.softRemove).toHaveBeenCalledWith(term);
    });

    it('rejects (409) when a customer still references the term', async () => {
      paymentTermRepository.findOne.mockResolvedValue(buildTerm());
      customerRepository.count.mockResolvedValue(1);
      supplierRepository.count.mockResolvedValue(0);

      await expect(service.remove('term-1', 'company-a')).rejects.toMatchObject(
        {
          errorCode: ErrorCode.Conflict,
        },
      );
    });

    it('rejects (409) when a supplier still references the term', async () => {
      paymentTermRepository.findOne.mockResolvedValue(buildTerm());
      customerRepository.count.mockResolvedValue(0);
      supplierRepository.count.mockResolvedValue(1);

      await expect(service.remove('term-1', 'company-a')).rejects.toMatchObject(
        {
          errorCode: ErrorCode.Conflict,
        },
      );
    });
  });

  describe('activate / deactivate', () => {
    it('deactivate sets status to INACTIVE', async () => {
      paymentTermRepository.findOne.mockResolvedValue(buildTerm());
      paymentTermRepository.save.mockImplementation((input) =>
        Promise.resolve(input as PaymentTerm),
      );

      const result = await service.deactivate('term-1', 'company-a');

      expect(result.status).toBe(PaymentTermStatus.Inactive);
    });
  });
});
