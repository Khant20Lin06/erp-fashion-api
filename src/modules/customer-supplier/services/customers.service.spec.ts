import { Repository, SelectQueryBuilder } from 'typeorm';
import { CustomersService } from './customers.service';
import { Customer } from '../entities/customer.entity';
import { CustomerStatus } from '../entities/customer-status.enum';
import { CustomerGroupStatus } from '../entities/customer-group-status.enum';
import { PaymentTermStatus } from '../entities/payment-term-status.enum';
import { CompaniesService } from '../../organization/services/companies.service';
import { BranchesService } from '../../organization/services/branches.service';
import { CustomerGroupsService } from './customer-groups.service';
import { PaymentTermsService } from './payment-terms.service';
import { Company } from '../../organization/entities/company.entity';
import { CompanyStatus } from '../../organization/entities/company-status.enum';
import { Branch } from '../../organization/entities/branch.entity';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('CustomersService', () => {
  let service: CustomersService;
  let customerRepository: jest.Mocked<
    Pick<
      Repository<Customer>,
      'findOne' | 'create' | 'save' | 'softRemove' | 'createQueryBuilder'
    >
  >;
  let companiesService: jest.Mocked<
    Pick<CompaniesService, 'findActiveByIdOrNull'>
  >;
  let branchesService: jest.Mocked<
    Pick<BranchesService, 'findActiveByIdOrNull'>
  >;
  let customerGroupsService: jest.Mocked<
    Pick<CustomerGroupsService, 'findByIdInCompany'>
  >;
  let paymentTermsService: jest.Mocked<
    Pick<PaymentTermsService, 'findByIdInCompany'>
  >;
  let queryBuilder: jest.Mocked<
    Pick<
      SelectQueryBuilder<Customer>,
      'where' | 'andWhere' | 'orderBy' | 'skip' | 'take' | 'getManyAndCount'
    >
  >;

  const buildCompany = (overrides: Partial<Company> = {}): Company =>
    ({
      id: 'company-a',
      status: CompanyStatus.Active,
      ...overrides,
    }) as Company;

  const buildBranch = (overrides: Partial<Branch> = {}): Branch =>
    ({ id: 'branch-1', companyId: 'company-a', ...overrides }) as Branch;

  const buildCustomer = (overrides: Partial<Customer> = {}): Customer =>
    ({
      id: 'cust-1',
      companyId: 'company-a',
      branchId: null,
      customerCode: 'CUST001',
      name: 'Acme',
      displayName: null,
      phone: null,
      email: null,
      customerGroupId: null,
      paymentTermId: null,
      creditLimit: '0.00',
      creditDays: 0,
      openingBalanceAmount: '0.00',
      receivableAccountId: null,
      status: CustomerStatus.Active,
      notes: null,
      ...overrides,
    }) as Customer;

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };
    customerRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    companiesService = { findActiveByIdOrNull: jest.fn() };
    branchesService = { findActiveByIdOrNull: jest.fn() };
    customerGroupsService = { findByIdInCompany: jest.fn() };
    paymentTermsService = { findByIdInCompany: jest.fn() };

    service = new CustomersService(
      customerRepository as unknown as Repository<Customer>,
      companiesService as unknown as CompaniesService,
      branchesService as unknown as BranchesService,
      customerGroupsService as unknown as CustomerGroupsService,
      paymentTermsService as unknown as PaymentTermsService,
    );
  });

  describe('create', () => {
    it('creates a customer with default credit/opening-balance values when omitted', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      customerRepository.findOne.mockResolvedValue(null);
      const created = buildCustomer();
      customerRepository.create.mockReturnValue(created);
      customerRepository.save.mockResolvedValue(created);

      const result = await service.create('company-a', {
        customerCode: 'CUST001',
        name: 'Acme',
      });

      expect(result).toBe(created);
      expect(customerRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          creditLimit: '0.00',
          creditDays: 0,
          openingBalanceAmount: '0.00',
          status: CustomerStatus.Active,
        }),
      );
    });

    it('persists a supplied openingBalanceAmount verbatim as master data', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      customerRepository.findOne.mockResolvedValue(null);
      customerRepository.create.mockImplementation(
        (input) => input as Customer,
      );
      customerRepository.save.mockImplementation((input) =>
        Promise.resolve(input as Customer),
      );

      const result = await service.create('company-a', {
        customerCode: 'CUST002',
        name: 'Acme 2',
        openingBalanceAmount: '1500.50',
      });

      expect(result.openingBalanceAmount).toBe('1500.50');
    });

    it('rejects when companyId does not reference an active company', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(null);

      await expect(
        service.create('missing', { customerCode: 'CUST001', name: 'Acme' }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a duplicate customerCode within the same company (409)', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      customerRepository.findOne.mockResolvedValue(buildCustomer());

      await expect(
        service.create('company-a', { customerCode: 'CUST001', name: 'Dup' }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('accepts a branchId that belongs to the same company', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      branchesService.findActiveByIdOrNull.mockResolvedValue(buildBranch());
      customerRepository.findOne.mockResolvedValue(null);
      const created = buildCustomer({ branchId: 'branch-1' });
      customerRepository.create.mockReturnValue(created);
      customerRepository.save.mockResolvedValue(created);

      const result = await service.create('company-a', {
        customerCode: 'CUST001',
        name: 'Acme',
        branchId: 'branch-1',
      });

      expect(result.branchId).toBe('branch-1');
    });

    it('rejects a branchId belonging to a different company (cross-company integrity)', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      branchesService.findActiveByIdOrNull.mockResolvedValue(
        buildBranch({ companyId: 'company-b' }),
      );

      await expect(
        service.create('company-a', {
          customerCode: 'CUST001',
          name: 'Acme',
          branchId: 'branch-1',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a nonexistent/inactive branchId', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      branchesService.findActiveByIdOrNull.mockResolvedValue(null);

      await expect(
        service.create('company-a', {
          customerCode: 'CUST001',
          name: 'Acme',
          branchId: 'branch-missing',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects an inactive customerGroupId', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      customerGroupsService.findByIdInCompany.mockResolvedValue({
        status: CustomerGroupStatus.Inactive,
      } as never);

      await expect(
        service.create('company-a', {
          customerCode: 'CUST001',
          name: 'Acme',
          customerGroupId: 'group-1',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects an inactive paymentTermId', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      paymentTermsService.findByIdInCompany.mockResolvedValue({
        status: PaymentTermStatus.Inactive,
      } as never);

      await expect(
        service.create('company-a', {
          customerCode: 'CUST001',
          name: 'Acme',
          paymentTermId: 'term-1',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });
  });

  describe('block / activate / deactivate', () => {
    it('block sets status to BLOCKED', async () => {
      customerRepository.findOne.mockResolvedValue(buildCustomer());
      customerRepository.save.mockImplementation((input) =>
        Promise.resolve(input as Customer),
      );

      const result = await service.block('cust-1', 'company-a');

      expect(result.status).toBe(CustomerStatus.Blocked);
    });
  });

  describe('findByIdInCompany — cross-company isolation', () => {
    it('throws NotFound for a customer belonging to a different company', async () => {
      customerRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdInCompany('cust-1', 'company-b'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });

  describe('remove', () => {
    it('soft-deletes the customer (historical integrity, never hard-deleted)', async () => {
      const customer = buildCustomer();
      customerRepository.findOne.mockResolvedValue(customer);

      await service.remove('cust-1', 'company-a');

      expect(customerRepository.softRemove).toHaveBeenCalledWith(customer);
    });
  });
});
