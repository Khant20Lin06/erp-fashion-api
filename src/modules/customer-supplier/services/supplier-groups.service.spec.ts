import { Repository, SelectQueryBuilder } from 'typeorm';
import { SupplierGroupsService } from './supplier-groups.service';
import { SupplierGroup } from '../entities/supplier-group.entity';
import { SupplierGroupStatus } from '../entities/supplier-group-status.enum';
import { Supplier } from '../entities/supplier.entity';
import { CompaniesService } from '../../organization/services/companies.service';
import { Company } from '../../organization/entities/company.entity';
import { CompanyStatus } from '../../organization/entities/company-status.enum';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('SupplierGroupsService', () => {
  let service: SupplierGroupsService;
  let groupRepository: jest.Mocked<
    Pick<
      Repository<SupplierGroup>,
      'findOne' | 'create' | 'save' | 'softRemove' | 'createQueryBuilder'
    >
  >;
  let supplierRepository: jest.Mocked<Pick<Repository<Supplier>, 'count'>>;
  let companiesService: jest.Mocked<
    Pick<CompaniesService, 'findActiveByIdOrNull'>
  >;
  let queryBuilder: jest.Mocked<
    Pick<
      SelectQueryBuilder<SupplierGroup>,
      'where' | 'andWhere' | 'orderBy' | 'skip' | 'take' | 'getManyAndCount'
    >
  >;

  const buildCompany = (overrides: Partial<Company> = {}): Company =>
    ({
      id: 'company-a',
      status: CompanyStatus.Active,
      ...overrides,
    }) as Company;

  const buildGroup = (overrides: Partial<SupplierGroup> = {}): SupplierGroup =>
    ({
      id: 'group-1',
      companyId: 'company-a',
      code: 'IMPORT',
      name: 'Import Supplier',
      description: null,
      status: SupplierGroupStatus.Active,
      ...overrides,
    }) as SupplierGroup;

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
    supplierRepository = { count: jest.fn() };
    companiesService = { findActiveByIdOrNull: jest.fn() };

    service = new SupplierGroupsService(
      groupRepository as unknown as Repository<SupplierGroup>,
      supplierRepository as unknown as Repository<Supplier>,
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
        code: 'IMPORT',
        name: 'Import Supplier',
      });

      expect(result).toBe(created);
    });

    it('rejects a duplicate code within the same company (409)', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      groupRepository.findOne.mockResolvedValue(buildGroup());

      await expect(
        service.create('company-a', { code: 'IMPORT', name: 'Dup' }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });
  });

  describe('remove', () => {
    it('rejects (409) when a supplier still references the group', async () => {
      groupRepository.findOne.mockResolvedValue(buildGroup());
      supplierRepository.count.mockResolvedValue(1);

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
