import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import { DataScope } from '../../rbac/enums/data-scope.enum';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { resolveRequestCompanyId } from './resolve-request-company-id';

export interface ResolvedCompanyBranchScope {
  companyId: string;
  branchId: string | undefined;
  allowedBranchIds: string[] | null;
}

/**
 * Request-level scope resolver for report/accounting queries whose source
 * rows may be restricted by branch. Company access is still resolved
 * server-side; when the effective scope itself is BRANCH, callers also get
 * the concrete branch ids they must constrain the query to. WAREHOUSE is
 * rejected here on purpose: broadening a warehouse-scoped permission into a
 * whole-branch financial/reporting read would over-authorize.
 */
export async function resolveRequestCompanyBranchScope(
  dataScopeService: DataScopeService,
  userId: string,
  resource: string,
  requestedCompanyId: string | undefined,
  requestedBranchId: string | undefined,
): Promise<ResolvedCompanyBranchScope> {
  const resolved = await dataScopeService.resolveScope(userId, resource);
  if (!resolved) {
    throw new AppException(
      ErrorCode.Forbidden,
      'No data scope is configured for this resource',
    );
  }

  if (resolved.scope === DataScope.Warehouse) {
    throw new AppException(
      ErrorCode.Forbidden,
      'Warehouse-scoped access is not supported for this resource',
    );
  }

  const companyId = await resolveRequestCompanyId(
    dataScopeService,
    userId,
    resource,
    requestedCompanyId,
  );

  const allowedBranchIds = await dataScopeService.resolveAllowedBranchIds(
    userId,
    resolved,
  );

  if (allowedBranchIds === null) {
    return {
      companyId,
      branchId: requestedBranchId,
      allowedBranchIds: null,
    };
  }

  if (allowedBranchIds.length === 0) {
    throw new AppException(
      ErrorCode.Forbidden,
      'No authorized branch access for this resource',
    );
  }

  if (requestedBranchId) {
    if (!allowedBranchIds.includes(requestedBranchId)) {
      throw new AppException(
        ErrorCode.Forbidden,
        'You do not have access to the requested branch',
      );
    }
    return {
      companyId,
      branchId: requestedBranchId,
      allowedBranchIds: [requestedBranchId],
    };
  }

  return {
    companyId,
    branchId: undefined,
    allowedBranchIds,
  };
}
