import { ErrorCode } from '../../core/errors/error-codes';
import { AppException } from '../../core/errors/app.exception';

/**
 * Validates a client-supplied sort field against an explicit allowlist.
 * Never pass an unvalidated sort field directly into a query.
 */
export function resolveSortField(
  requestedField: string | undefined,
  allowedFields: readonly string[],
  defaultField: string,
): string {
  if (!requestedField) {
    return defaultField;
  }

  if (!allowedFields.includes(requestedField)) {
    throw new AppException(
      ErrorCode.ValidationError,
      `Invalid sort field: ${requestedField}`,
    );
  }

  return requestedField;
}
