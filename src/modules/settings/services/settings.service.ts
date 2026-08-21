import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SettingDefinition,
  SettingStoredValue,
} from '../entities/setting-definition.entity';
import { SettingValue } from '../entities/setting-value.entity';
import { SettingScopeType } from '../entities/setting-scope-type.enum';
import { SettingDataType } from '../entities/setting-data-type.enum';
import { CacheService } from '../../redis/cache.service';
import { CacheKeys, CacheTtl } from '../../redis/cache-keys';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import { ResolvedSettingResponseDto } from '../dto/settings.dto';
import { Branch } from '../../organization/entities/branch.entity';

const SYSTEM_SCOPE_ID = 'SYSTEM';

interface ScopeTarget {
  scopeType: SettingScopeType;
  scopeId: string;
}

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(SettingDefinition)
    private readonly definitionRepository: Repository<SettingDefinition>,
    @InjectRepository(SettingValue)
    private readonly valueRepository: Repository<SettingValue>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    private readonly cacheService: CacheService,
  ) {}

  async listSystem(): Promise<ResolvedSettingResponseDto[]> {
    return this.resolveAll([
      { scopeType: SettingScopeType.System, scopeId: SYSTEM_SCOPE_ID },
    ]);
  }

  async listCompany(companyId: string): Promise<ResolvedSettingResponseDto[]> {
    return this.resolveAll([
      { scopeType: SettingScopeType.Company, scopeId: companyId },
      { scopeType: SettingScopeType.System, scopeId: SYSTEM_SCOPE_ID },
    ]);
  }

  async listBranch(branchId: string): Promise<ResolvedSettingResponseDto[]> {
    const branch = await this.findBranch(branchId);
    return this.resolveAll([
      { scopeType: SettingScopeType.Branch, scopeId: branchId },
      { scopeType: SettingScopeType.Company, scopeId: branch.companyId },
      { scopeType: SettingScopeType.System, scopeId: SYSTEM_SCOPE_ID },
    ]);
  }

  async listMe(
    userId: string,
    companyId?: string,
    branchId?: string,
  ): Promise<ResolvedSettingResponseDto[]> {
    const scopes: ScopeTarget[] = [
      { scopeType: SettingScopeType.User, scopeId: userId },
    ];

    if (branchId) {
      scopes.push({ scopeType: SettingScopeType.Branch, scopeId: branchId });
    }
    if (companyId) {
      scopes.push({ scopeType: SettingScopeType.Company, scopeId: companyId });
    } else if (branchId) {
      const branch = await this.findBranch(branchId);
      scopes.push({
        scopeType: SettingScopeType.Company,
        scopeId: branch.companyId,
      });
    }
    scopes.push({
      scopeType: SettingScopeType.System,
      scopeId: SYSTEM_SCOPE_ID,
    });

    return this.resolveAll(scopes);
  }

  async updateSystem(
    key: string,
    value: SettingStoredValue,
  ): Promise<ResolvedSettingResponseDto> {
    return this.updateValue(
      key,
      { scopeType: SettingScopeType.System, scopeId: SYSTEM_SCOPE_ID },
      value,
    );
  }

  async updateCompany(
    companyId: string,
    key: string,
    value: SettingStoredValue,
  ): Promise<ResolvedSettingResponseDto> {
    return this.updateValue(
      key,
      { scopeType: SettingScopeType.Company, scopeId: companyId },
      value,
    );
  }

  async updateBranch(
    branchId: string,
    key: string,
    value: SettingStoredValue,
  ): Promise<ResolvedSettingResponseDto> {
    await this.findBranch(branchId);
    return this.updateValue(
      key,
      { scopeType: SettingScopeType.Branch, scopeId: branchId },
      value,
    );
  }

  async updateUser(
    userId: string,
    key: string,
    value: SettingStoredValue,
    companyId?: string,
    branchId?: string,
  ): Promise<ResolvedSettingResponseDto> {
    const entity = await this.updateValue(
      key,
      { scopeType: SettingScopeType.User, scopeId: userId },
      value,
    );
    return (
      (await this.listMe(userId, companyId, branchId)).find(
        (setting) => setting.key === entity.key,
      ) ?? entity
    );
  }

  private async updateValue(
    key: string,
    scope: ScopeTarget,
    value: SettingStoredValue,
  ): Promise<ResolvedSettingResponseDto> {
    const definition = await this.definitionRepository.findOne({
      where: { key, isActive: true },
    });
    if (!definition) {
      throw new AppException(ErrorCode.ValidationError, 'Invalid setting key');
    }

    if (!definition.allowedScopes.includes(scope.scopeType)) {
      throw new AppException(
        ErrorCode.ValidationError,
        `Setting ${key} cannot be written at ${scope.scopeType} scope`,
      );
    }

    this.assertValueMatchesType(definition.dataType, value);

    let entity = await this.valueRepository.findOne({
      where: {
        definitionId: definition.id,
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
      },
    });

    if (!entity) {
      entity = this.valueRepository.create({
        definitionId: definition.id,
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        value,
      });
    } else {
      entity.value = value;
    }

    await this.valueRepository.save(entity);
    await this.cacheService.delete(
      CacheKeys.settingValue(scope.scopeType, scope.scopeId, key),
    );

    return {
      key: definition.key,
      category: definition.category,
      dataType: definition.dataType,
      value,
      sourceScope: scope.scopeType,
      sourceScopeId: scope.scopeId,
    };
  }

  private async resolveAll(
    scopes: ScopeTarget[],
  ): Promise<ResolvedSettingResponseDto[]> {
    const definitions = await this.definitionRepository.find({
      where: { isActive: true },
      order: { category: 'ASC', key: 'ASC' },
    });

    const resolved: ResolvedSettingResponseDto[] = [];

    for (const definition of definitions) {
      const value = await this.resolveDefinition(definition, scopes);
      if (value) {
        resolved.push(value);
      }
    }

    return resolved;
  }

  private async resolveDefinition(
    definition: SettingDefinition,
    scopes: ScopeTarget[],
  ): Promise<ResolvedSettingResponseDto | null> {
    for (const scope of scopes) {
      if (!definition.allowedScopes.includes(scope.scopeType)) {
        continue;
      }

      const cacheKey = CacheKeys.settingValue(
        scope.scopeType,
        scope.scopeId,
        definition.key,
      );
      const cached = await this.cacheService.get<SettingStoredValue>(cacheKey);
      if (cached !== undefined) {
        return {
          key: definition.key,
          category: definition.category,
          dataType: definition.dataType,
          value: cached,
          sourceScope: scope.scopeType,
          sourceScopeId: scope.scopeId,
        };
      }

      const entity = await this.valueRepository.findOne({
        where: {
          definitionId: definition.id,
          scopeType: scope.scopeType,
          scopeId: scope.scopeId,
        },
      });
      if (entity) {
        await this.cacheService.set(
          cacheKey,
          entity.value,
          CacheTtl.SETTINGS_SECONDS,
        );
        return {
          key: definition.key,
          category: definition.category,
          dataType: definition.dataType,
          value: entity.value,
          sourceScope: scope.scopeType,
          sourceScopeId: scope.scopeId,
        };
      }
    }

    return {
      key: definition.key,
      category: definition.category,
      dataType: definition.dataType,
      value: definition.defaultValue,
      sourceScope: 'DEFAULT',
      sourceScopeId: null,
    };
  }

  private assertValueMatchesType(
    dataType: SettingDataType,
    value: SettingStoredValue,
  ): void {
    if (value === null) {
      return;
    }

    if (dataType === SettingDataType.String && typeof value !== 'string') {
      throw new AppException(
        ErrorCode.ValidationError,
        'Expected a string value',
      );
    }
    if (dataType === SettingDataType.Boolean && typeof value !== 'boolean') {
      throw new AppException(
        ErrorCode.ValidationError,
        'Expected a boolean value',
      );
    }
    if (dataType === SettingDataType.Integer) {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        throw new AppException(
          ErrorCode.ValidationError,
          'Expected an integer value',
        );
      }
    }
    if (dataType === SettingDataType.Decimal) {
      if (typeof value !== 'number' && typeof value !== 'string') {
        throw new AppException(
          ErrorCode.ValidationError,
          'Expected a decimal value',
        );
      }
      if (Number.isNaN(Number(value))) {
        throw new AppException(
          ErrorCode.ValidationError,
          'Expected a decimal value',
        );
      }
    }
    if (dataType === SettingDataType.Json) {
      if (typeof value !== 'object' || Array.isArray(value) === false) {
        // Objects and arrays are both acceptable JSON payloads here.
        if (typeof value !== 'object') {
          throw new AppException(
            ErrorCode.ValidationError,
            'Expected a JSON value',
          );
        }
      }
    }
  }

  private async findBranch(branchId: string): Promise<Branch> {
    const branch = await this.branchRepository.findOne({
      where: { id: branchId },
    });
    if (!branch) {
      throw new AppException(ErrorCode.NotFound, 'Branch not found');
    }
    return branch;
  }
}
