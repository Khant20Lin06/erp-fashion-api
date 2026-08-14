import { AppException } from '../../core/errors/app.exception';
import { ErrorCode } from '../../core/errors/error-codes';

export function validateDateRange(
  fromDate: string | undefined,
  toDate: string | undefined,
): void {
  if (!fromDate || !toDate) {
    return;
  }

  if (new Date(fromDate).getTime() > new Date(toDate).getTime()) {
    throw new AppException(
      ErrorCode.ValidationError,
      'fromDate must be less than or equal to toDate',
    );
  }
}
