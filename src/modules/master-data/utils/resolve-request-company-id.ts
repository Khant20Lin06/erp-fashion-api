import { DataScopeService } from '../../rbac/services/data-scope.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';

/**
 * Resolves and validates the companyId a master-data request should
 * operate against. Never trusts the client-supplied value by itself
 * (Phase 09 §12, LOCKED "do not trust client-provided companyId... resolve
 * scope server-side") — it must appear in the user's own resolved allowed
 * company IDs for the given resource. This is a plain function, not a
 * service/class, so it does not introduce a second authorization
 * mechanism (Phase 09 §3, §12, LOCKED) — it is a thin, stateless caller of
 * the existing DataScopeService pipeline built in Phase 06/08.
 */
export async function resolveRequestCompanyId(
  dataScopeService: DataScopeService,
  userId: string,
  resource: string,
  requestedCompanyId: string | undefined,
): Promise<string> {
  const resolved = await dataScopeService.resolveScope(userId, resource);
  if (!resolved) {
    throw new AppException(
      ErrorCode.Forbidden,
      'No data scope is configured for this resource',
    );
  }

  const allowedCompanyIds =
    await dataScopeService.resolveAllowedOrganizationIds(userId, resolved);

  // null means ALL scope — unrestricted, but a target companyId is still
  // required to know which company's data to operate on.
  if (allowedCompanyIds === null) {
    if (!requestedCompanyId) {
      throw new AppException(
        ErrorCode.ValidationError,
        'companyId is required',
      );
    }
    return requestedCompanyId;
  }

  if (allowedCompanyIds.length === 0) {
    throw new AppException(
      ErrorCode.Forbidden,
      'No authorized company access for this resource',
    );
  }

  if (requestedCompanyId) {
    if (!allowedCompanyIds.includes(requestedCompanyId)) {
      throw new AppException(
        ErrorCode.Forbidden,
        'You do not have access to the requested company',
      );
    }
    return requestedCompanyId;
  }

  if (allowedCompanyIds.length === 1) {
    return allowedCompanyIds[0];
  }

  throw new AppException(
    ErrorCode.ValidationError,
    'companyId is required when you have access to multiple companies',
  );
}
