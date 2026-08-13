import { Repository, SelectQueryBuilder } from 'typeorm';
import { CustomerGroupsService } from './customer-groups.service';
import { CustomerGroup } from '../entities/customer-group.entity';
import { CustomerGroupStatus } from '../entities/customer-group-status.enum';
import { Customer } from '../entities/customer.entity';
import { CompaniesService } from '../../organization/services/companies.service';
import { Company } from '../../organization/entities/company.entity';
import { CompanyStatus } from '../../organization/entities/company-status.enum';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('CustomerGroupsService', () => {
  let service: CustomerGroupsService;
  let groupRepository: jest.Mocked<
    Pick<
      Repository<CustomerGroup>,
      'findOne' | 'create' | 'save' | 'softRemove' | 'createQueryBuilder'
    >
  >;
  let customerRepository: jest.Mocked<Pick<Repository<Customer>, 'count'>>;
  let companiesService: jest.Mocked<
    Pick<CompaniesService, 'findActiveByIdOrNull'>
  >;
  let queryBuilder: jest.Mocked<
    Pick<
      SelectQueryBuilder<CustomerGroup>,
      'where' | 'andWhere' | 'orderBy' | 'skip' | 'take' | 'getManyAndCount'
    >
  >;

  const buildCompany = (overrides: Partial<Company> = {}): Company =>
    ({
      id: 'company-a',
      status: CompanyStatus.Active,
      ...overrides,
    }) as Company;

  const buildGroup = (overrides: Partial<CustomerGroup> = {}): CustomerGroup =>
    ({
      id: 'group-1',
      companyId: 'company-a',
      code: 'VIP',
      name: 'VIP',
      description: null,
      status: CustomerGroupStatus.Active,
      ...overrides,
    }) as CustomerGroup;

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };
    groupRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    customerRepository = { count: jest.fn() };
    companiesService = { findActiveByIdOrNull: jest.fn() };

    service = new CustomerGroupsService(
      groupRepository as unknown as Repository<CustomerGroup>,
      customerRepository as unknown as Repository<Customer>,
      companiesService as unknown as CompaniesService,
    );
  });

  describe('create', () => {
    it('creates a group when company is active and code is unique', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      groupRepository.findOne.mockResolvedValue(null);
      const created = buildGroup();
      groupRepository.create.mockReturnValue(created);
      groupRepository.save.mockResolvedValue(created);

      const result = await service.create('company-a', {
        code: 'VIP',
        name: 'VIP',
      });

      expect(result).toBe(created);
    });

    it('rejects when companyId does not reference an active company', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(null);

      await expect(
        service.create('missing', { code: 'VIP', name: 'VIP' }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a duplicate code within the same company (409)', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      groupRepository.findOne.mockResolvedValue(buildGroup());

      await expect(
        service.create('company-a', { code: 'VIP', name: 'Dup' }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });
  });

  describe('remove', () => {
    it('soft-deletes when unreferenced', async () => {
      const group = buildGroup();
      groupRepository.findOne.mockResolvedValue(group);
      customerRepository.count.mockResolvedValue(0);

      await service.remove('group-1', 'company-a');

      expect(groupRepository.softRemove).toHaveBeenCalledWith(group);
    });

    it('rejects (409) when a customer still references the group', async () => {
      groupRepository.findOne.mockResolvedValue(buildGroup());
      customerRepository.count.mockResolvedValue(1);

      await expect(
        service.remove('group-1', 'company-a'),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.Conflict,
      });
    });
  });

  describe('findByIdInCompany — cross-company isolation', () => {
    it('throws NotFound for a group belonging to a different company', async () => {
      groupRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdInCompany('group-1', 'company-b'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });
});
