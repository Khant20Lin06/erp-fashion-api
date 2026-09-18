import { CustomerCatalogController } from './customer-catalog.controller';
import { CustomerCatalogService } from '../services/customer-catalog.service';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { DataScope } from '../../rbac/enums/data-scope.enum';
import { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  PERMISSION_METADATA_KEY,
  PermissionRequirement,
} from '../../rbac/decorators/require-permission.decorator';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';

describe('CustomerCatalogController', () => {
  const user: AuthenticatedUser = { id: 'bot-user' };
  const catalog = {
    list: jest.fn((companyId: string) =>
      Promise.resolve({
        products: [{ id: companyId }],
        hasMore: false,
      }),
    ),
    detail: jest.fn((companyId: string) => Promise.resolve({ id: companyId })),
  };
  const scope = {
    resolveScope: jest.fn(),
    resolveAllowedCompanyIds: jest.fn(),
  };
  const controller = new CustomerCatalogController(
    catalog as unknown as CustomerCatalogService,
    scope as unknown as DataScopeService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    scope.resolveScope.mockResolvedValue({
      scope: DataScope.Company,
      scopeValue: null,
    });
    scope.resolveAllowedCompanyIds.mockResolvedValue(['company-a']);
  });
  it('guards both catalog endpoints with JWT and products.read', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, CustomerCatalogController),
    ).toEqual([JwtAuthGuard, PermissionGuard]);
    // Read decorator metadata from the original method functions without invoking them.
    for (const handler of [
      // eslint-disable-next-line @typescript-eslint/unbound-method
      controller.list,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      controller.detail,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      controller.discover,
    ]) {
      const requirement = Reflect.getMetadata(
        PERMISSION_METADATA_KEY,
        handler,
      ) as PermissionRequirement;
      expect(requirement.codes).toEqual(['products.read']);
    }
  });
  it('resolves company scope before returning a catalog', async () => {
    expect(await controller.list(user, {})).toEqual({
      products: [{ id: 'company-a' }],
      hasMore: false,
    });
  });
  it('rejects another company on both list and detail', async () => {
    await expect(
      controller.list(user, { companyId: 'company-b' }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.Forbidden });
    await expect(
      controller.detail(user, 'p1', { companyId: 'company-b' }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.Forbidden });
    await expect(
      controller.discover(user, { companyId: 'company-b', query: 'pants' }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.Forbidden });
    expect(catalog.list).not.toHaveBeenCalled();
    expect(catalog.detail).not.toHaveBeenCalled();
  });
  it('denies missing resource scope', async () => {
    scope.resolveScope.mockResolvedValue(null);
    await expect(
      controller.list(user, { companyId: 'company-a' }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.Forbidden });
  });
});
