import { Repository, SelectQueryBuilder } from 'typeorm';
import { AttributeOptionsService } from './attribute-options.service';
import { AttributeOption } from '../entities/attribute-option.entity';
import { AttributeOptionStatus } from '../entities/attribute-option-status.enum';
import { AttributeKind } from '../entities/attribute-kind.enum';
import { CompaniesService } from '../../organization/services/companies.service';
import { Company } from '../../organization/entities/company.entity';
import { CompanyStatus } from '../../organization/entities/company-status.enum';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('AttributeOptionsService', () => {
  let service: AttributeOptionsService;
  let attributeOptionRepository: jest.Mocked<
    Pick<
      Repository<AttributeOption>,
      'findOne' | 'create' | 'save' | 'softRemove' | 'createQueryBuilder'
    >
  >;
  let companiesService: jest.Mocked<
    Pick<CompaniesService, 'findActiveByIdOrNull'>
  >;
  let queryBuilder: jest.Mocked<
    Pick<
      SelectQueryBuilder<AttributeOption>,
      'where' | 'andWhere' | 'orderBy' | 'skip' | 'take' | 'getManyAndCount'
    >
  >;

  const buildCompany = (overrides: Partial<Company> = {}): Company =>
    ({
      id: 'company-a',
      status: CompanyStatus.Active,
      ...overrides,
    }) as Company;

  const buildOption = (
    overrides: Partial<AttributeOption> = {},
  ): AttributeOption =>
    ({
      id: 'option-1',
      companyId: 'company-a',
      kind: AttributeKind.Color,
      code: 'BLACK',
      value: 'Black',
      swatch: '#000000',
      sortOrder: 0,
      status: AttributeOptionStatus.Active,
      ...overrides,
    }) as AttributeOption;

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };
    attributeOptionRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    companiesService = { findActiveByIdOrNull: jest.fn() };

    service = new AttributeOptionsService(
      attributeOptionRepository as unknown as Repository<AttributeOption>,
      companiesService as unknown as CompaniesService,
    );
  });

  describe('create', () => {
    it('creates a COLOR option with a swatch', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      attributeOptionRepository.findOne.mockResolvedValue(null);
      const created = buildOption();
      attributeOptionRepository.create.mockReturnValue(created);
      attributeOptionRepository.save.mockResolvedValue(created);

      const result = await service.create('company-a', {
        kind: AttributeKind.Color,
        code: 'BLACK',
        value: 'Black',
        swatch: '#000000',
      });

      expect(result).toBe(created);
    });

    it('rejects a swatch on a non-COLOR kind (§8-9)', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());

      await expect(
        service.create('company-a', {
          kind: AttributeKind.Size,
          code: 'M',
          value: 'Medium',
          swatch: '#ffffff',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects when companyId does not reference an active company', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(null);

      await expect(
        service.create('missing', {
          kind: AttributeKind.Size,
          code: 'M',
          value: 'Medium',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a duplicate code within the same kind and company (409)', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      attributeOptionRepository.findOne.mockResolvedValue(buildOption());

      await expect(
        service.create('company-a', {
          kind: AttributeKind.Color,
          code: 'BLACK',
          value: 'Black (duplicate)',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('allows the SAME code across DIFFERENT kinds (SIZE+M independent from COLOR+M, §9)', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      // No existing COLOR+M row, even though a SIZE+M row might exist —
      // the service queries scoped to (companyId, kind, code), so this
      // mock returning null models that the kind-scoped lookup finds nothing.
      attributeOptionRepository.findOne.mockResolvedValue(null);
      const created = buildOption({
        id: 'option-2',
        kind: AttributeKind.Color,
        code: 'M',
        value: 'Maroon',
        swatch: '#800000',
      });
      attributeOptionRepository.create.mockReturnValue(created);
      attributeOptionRepository.save.mockResolvedValue(created);

      const result = await service.create('company-a', {
        kind: AttributeKind.Color,
        code: 'M',
        value: 'Maroon',
        swatch: '#800000',
      });

      expect(attributeOptionRepository.findOne).toHaveBeenCalledWith({
        where: { companyId: 'company-a', kind: AttributeKind.Color, code: 'M' },
      });
      expect(result.code).toBe('M');
    });
  });

  describe('update', () => {
    it('rejects adding a swatch to an existing non-COLOR option', async () => {
      attributeOptionRepository.findOne.mockResolvedValue(
        buildOption({ kind: AttributeKind.Material, swatch: null }),
      );

      await expect(
        service.update('option-1', 'company-a', { swatch: '#123456' }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });
  });

  describe('findByIdInCompany — cross-company isolation', () => {
    it('throws NotFound for an option belonging to a different company', async () => {
      attributeOptionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdInCompany('option-1', 'company-b'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });
});
