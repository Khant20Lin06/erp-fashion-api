import { Repository } from 'typeorm';
import { CompaniesService } from './companies.service';
import { Company } from '../entities/company.entity';
import { CompanyStatus } from '../entities/company-status.enum';
import { Branch } from '../entities/branch.entity';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';

type MockedRepo<T extends object> = jest.Mocked<
  Pick<
    Repository<T>,
    'findOne' | 'findAndCount' | 'create' | 'save' | 'softRemove' | 'count'
  >
>;

describe('CompaniesService', () => {
  let service: CompaniesService;
  let companyRepository: MockedRepo<Company>;
  let branchRepository: MockedRepo<Branch>;

  const buildCompany = (overrides: Partial<Company> = {}): Company => ({
    id: 'company-1',
    code: 'FASHION-MM',
    name: 'Fashion Myanmar',
    status: CompanyStatus.Active,
    baseCurrency: 'MMK',
    timezone: 'Asia/Yangon',
    country: null,
    phone: null,
    email: null,
    address: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  });

  beforeEach(() => {
    companyRepository = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
      count: jest.fn(),
    };
    branchRepository = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
      count: jest.fn(),
    };

    service = new CompaniesService(
      companyRepository as unknown as Repository<Company>,
      branchRepository as unknown as Repository<Branch>,
    );
  });

  describe('create', () => {
    it('creates a company when the code is unique', async () => {
      companyRepository.findOne.mockResolvedValue(null);
      const created = buildCompany();
      companyRepository.create.mockReturnValue(created);
      companyRepository.save.mockResolvedValue(created);

      const result = await service.create({
        code: 'FASHION-MM',
        name: 'Fashion Myanmar',
        baseCurrency: 'MMK',
        timezone: 'Asia/Yangon',
      });

      expect(result).toBe(created);
      expect(companyRepository.save).toHaveBeenCalledWith(created);
    });

    it('rejects a duplicate company code with 409', async () => {
      companyRepository.findOne.mockResolvedValue(buildCompany());

      await expect(
        service.create({
          code: 'FASHION-MM',
          name: 'Fashion Myanmar 2',
          baseCurrency: 'MMK',
          timezone: 'Asia/Yangon',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('defaults status to ACTIVE when not supplied', async () => {
      companyRepository.findOne.mockResolvedValue(null);
      companyRepository.create.mockImplementation((input) => input as Company);
      companyRepository.save.mockImplementation((input) =>
        Promise.resolve(input as Company),
      );

      const result = await service.create({
        code: 'FASHION-TH',
        name: 'Fashion Thailand',
        baseCurrency: 'THB',
        timezone: 'Asia/Bangkok',
      });

      expect(result.status).toBe(CompanyStatus.Active);
    });
  });

  describe('findById', () => {
    it('returns the company when found', async () => {
      const company = buildCompany();
      companyRepository.findOne.mockResolvedValue(company);

      await expect(service.findById('company-1')).resolves.toBe(company);
    });

    it('throws NotFound when missing', async () => {
      companyRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toMatchObject({
        errorCode: ErrorCode.NotFound,
      });
    });
  });

  describe('findActiveByIdOrNull', () => {
    it('only queries for active companies', async () => {
      companyRepository.findOne.mockResolvedValue(null);

      await service.findActiveByIdOrNull('company-1');

      expect(companyRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'company-1', status: CompanyStatus.Active },
      });
    });
  });

  describe('activate / deactivate', () => {
    it('activate sets status to ACTIVE', async () => {
      const company = buildCompany({ status: CompanyStatus.Inactive });
      companyRepository.findOne.mockResolvedValue(company);
      companyRepository.save.mockImplementation((input) =>
        Promise.resolve(input as Company),
      );

      const result = await service.activate('company-1');

      expect(result.status).toBe(CompanyStatus.Active);
    });

    it('deactivate sets status to INACTIVE', async () => {
      const company = buildCompany({ status: CompanyStatus.Active });
      companyRepository.findOne.mockResolvedValue(company);
      companyRepository.save.mockImplementation((input) =>
        Promise.resolve(input as Company),
      );

      const result = await service.deactivate('company-1');

      expect(result.status).toBe(CompanyStatus.Inactive);
    });
  });

  describe('remove', () => {
    it('soft-deletes a company with no branches', async () => {
      const company = buildCompany();
      companyRepository.findOne.mockResolvedValue(company);
      branchRepository.count.mockResolvedValue(0);

      await service.remove('company-1');

      expect(companyRepository.softRemove).toHaveBeenCalledWith(company);
    });

    it('rejects deletion when active branches exist (409, no orphaning)', async () => {
      const company = buildCompany();
      companyRepository.findOne.mockResolvedValue(company);
      branchRepository.count.mockResolvedValue(2);

      await expect(service.remove('company-1')).rejects.toMatchObject({
        errorCode: ErrorCode.Conflict,
      });
      expect(companyRepository.softRemove).not.toHaveBeenCalled();
    });
  });

  it('propagates AppException instances from findById unchanged', async () => {
    companyRepository.findOne.mockResolvedValue(null);
    await expect(service.findById('x')).rejects.toBeInstanceOf(AppException);
  });
});
