import { Repository } from 'typeorm';
import { SettingsService } from './settings.service';
import { SettingDefinition } from '../entities/setting-definition.entity';
import { SettingValue } from '../entities/setting-value.entity';
import { SettingDataType } from '../entities/setting-data-type.enum';
import { SettingScopeType } from '../entities/setting-scope-type.enum';
import { CacheService } from '../../redis/cache.service';
import { Branch } from '../../organization/entities/branch.entity';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('SettingsService', () => {
  let service: SettingsService;
  let definitionRepository: jest.Mocked<
    Pick<Repository<SettingDefinition>, 'find' | 'findOne'>
  >;
  let valueRepository: jest.Mocked<
    Pick<Repository<SettingValue>, 'findOne' | 'create' | 'save'>
  >;
  let branchRepository: jest.Mocked<Pick<Repository<Branch>, 'findOne'>>;
  let cacheService: jest.Mocked<Pick<CacheService, 'get' | 'set' | 'delete'>>;

  const definition = {
    id: 'def-1',
    key: 'reports.dashboard.default_range_days',
    category: 'reports',
    dataType: SettingDataType.Integer,
    description: null,
    defaultValue: 30,
    allowedScopes: [
      SettingScopeType.System,
      SettingScopeType.Company,
      SettingScopeType.User,
    ],
    isActive: true,
  } as SettingDefinition;

  beforeEach(() => {
    definitionRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
    };
    valueRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    branchRepository = {
      findOne: jest.fn(),
    };
    cacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    };

    service = new SettingsService(
      definitionRepository as unknown as Repository<SettingDefinition>,
      valueRepository as unknown as Repository<SettingValue>,
      branchRepository as unknown as Repository<Branch>,
      cacheService as unknown as CacheService,
    );
  });

  it('resolves company value before falling back to default', async () => {
    definitionRepository.find.mockResolvedValue([definition]);
    cacheService.get.mockResolvedValue(undefined);
    valueRepository.findOne.mockResolvedValueOnce({
      value: 14,
    } as SettingValue);

    const result = await service.listCompany('company-a');

    expect(result).toEqual([
      expect.objectContaining({
        key: definition.key,
        value: 14,
        sourceScope: SettingScopeType.Company,
        sourceScopeId: 'company-a',
      }),
    ]);
    expect(cacheService.set).toHaveBeenCalled();
  });

  it('falls back to the definition default when no scoped value exists', async () => {
    definitionRepository.find.mockResolvedValue([definition]);
    cacheService.get.mockResolvedValue(undefined);
    valueRepository.findOne.mockResolvedValue(null);

    const result = await service.listSystem();

    expect(result[0]).toEqual(
      expect.objectContaining({
        key: definition.key,
        value: 30,
        sourceScope: 'DEFAULT',
      }),
    );
  });

  it('rejects invalid setting types on update', async () => {
    definitionRepository.findOne.mockResolvedValue(definition);

    await expect(
      service.updateCompany('company-a', definition.key, 'thirty'),
    ).rejects.toMatchObject({
      errorCode: ErrorCode.ValidationError,
    });
  });

  it('invalidates the exact scope cache key after a successful update', async () => {
    definitionRepository.findOne.mockResolvedValue(definition);
    valueRepository.findOne.mockResolvedValue(null);
    valueRepository.create.mockReturnValue({
      definitionId: definition.id,
      scopeType: SettingScopeType.Company,
      scopeId: 'company-a',
      value: 45,
    } as SettingValue);
    valueRepository.save.mockResolvedValue({
      definitionId: definition.id,
      scopeType: SettingScopeType.Company,
      scopeId: 'company-a',
      value: 45,
    } as SettingValue);

    await service.updateCompany('company-a', definition.key, 45);

    expect(cacheService.delete).toHaveBeenCalledWith(
      'erp:cache:settings:company:company-a:reports.dashboard.default_range_days',
    );
  });
});
