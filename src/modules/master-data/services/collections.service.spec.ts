import { Repository, SelectQueryBuilder } from 'typeorm';
import { CollectionsService } from './collections.service';
import { Collection } from '../entities/collection.entity';
import { CollectionStatus } from '../entities/collection-status.enum';
import { Season } from '../entities/season.enum';
import { CompaniesService } from '../../organization/services/companies.service';
import { Company } from '../../organization/entities/company.entity';
import { CompanyStatus } from '../../organization/entities/company-status.enum';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('CollectionsService', () => {
  let service: CollectionsService;
  let collectionRepository: jest.Mocked<
    Pick<
      Repository<Collection>,
      'findOne' | 'create' | 'save' | 'softRemove' | 'createQueryBuilder'
    >
  >;
  let companiesService: jest.Mocked<
    Pick<CompaniesService, 'findActiveByIdOrNull'>
  >;
  let queryBuilder: jest.Mocked<
    Pick<
      SelectQueryBuilder<Collection>,
      'where' | 'andWhere' | 'orderBy' | 'skip' | 'take' | 'getManyAndCount'
    >
  >;

  const buildCompany = (overrides: Partial<Company> = {}): Company =>
    ({
      id: 'company-a',
      status: CompanyStatus.Active,
      ...overrides,
    }) as Company;

  const buildCollection = (overrides: Partial<Collection> = {}): Collection =>
    ({
      id: 'collection-1',
      companyId: 'company-a',
      code: 'SS26',
      name: 'Spring Summer 2026',
      description: null,
      season: Season.SpringSummer,
      year: 2026,
      status: CollectionStatus.Active,
      ...overrides,
    }) as Collection;

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };
    collectionRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    companiesService = { findActiveByIdOrNull: jest.fn() };

    service = new CollectionsService(
      collectionRepository as unknown as Repository<Collection>,
      companiesService as unknown as CompaniesService,
    );
  });

  describe('create', () => {
    it('creates a collection with an embedded season value (no Season FK, LOCKED §7)', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      collectionRepository.findOne.mockResolvedValue(null);
      const created = buildCollection();
      collectionRepository.create.mockReturnValue(created);
      collectionRepository.save.mockResolvedValue(created);

      const result = await service.create('company-a', {
        code: 'SS26',
        name: 'Spring Summer 2026',
        season: Season.SpringSummer,
        year: 2026,
      });

      expect(result.season).toBe(Season.SpringSummer);
      expect(collectionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ season: Season.SpringSummer }),
      );
    });

    it('rejects when companyId does not reference an active company', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(null);

      await expect(
        service.create('missing', {
          code: 'SS26',
          name: 'X',
          season: Season.SpringSummer,
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a duplicate code within the same company (409)', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      collectionRepository.findOne.mockResolvedValue(buildCollection());

      await expect(
        service.create('company-a', {
          code: 'SS26',
          name: 'Duplicate',
          season: Season.AutumnWinter,
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });
  });

  describe('update', () => {
    it('allows changing the season value', async () => {
      collectionRepository.findOne.mockResolvedValue(buildCollection());
      collectionRepository.save.mockImplementation((input) =>
        Promise.resolve(input as Collection),
      );

      const result = await service.update('collection-1', 'company-a', {
        season: Season.AllSeason,
      });

      expect(result.season).toBe(Season.AllSeason);
    });
  });

  describe('findByIdInCompany — cross-company isolation', () => {
    it('throws NotFound for a collection in a different company', async () => {
      collectionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdInCompany('collection-1', 'company-b'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });
});
