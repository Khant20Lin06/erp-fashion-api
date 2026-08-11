import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from './error-codes';

const ERROR_CODE_TO_STATUS: Record<ErrorCode, HttpStatus> = {
  [ErrorCode.ValidationError]: HttpStatus.BAD_REQUEST,
  [ErrorCode.Unauthorized]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.Forbidden]: HttpStatus.FORBIDDEN,
  [ErrorCode.NotFound]: HttpStatus.NOT_FOUND,
  [ErrorCode.Conflict]: HttpStatus.CONFLICT,
  [ErrorCode.UnprocessableEntity]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.RateLimited]: HttpStatus.TOO_MANY_REQUESTS,
  [ErrorCode.InternalError]: HttpStatus.INTERNAL_SERVER_ERROR,
};

export class AppException extends HttpException {
  readonly errorCode: ErrorCode;

  constructor(errorCode: ErrorCode, message: string) {
    super({ code: errorCode, message }, ERROR_CODE_TO_STATUS[errorCode]);
    this.errorCode = errorCode;
  }
}
