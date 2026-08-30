import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { REQUEST_ID_HEADER } from '../middleware/request-id.middleware';
import { ErrorCode } from '../../core/errors/error-codes';
import { AppException } from '../../core/errors/app.exception';

interface ErrorResponseBody {
  success: false;
  statusCode: number;
  code: string;
  message: string;
  path: string;
  timestamp: string;
  requestId: string;
}

const STATUS_CODE_TO_ERROR_CODE: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.ValidationError,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.Unauthorized,
  [HttpStatus.FORBIDDEN]: ErrorCode.Forbidden,
  [HttpStatus.NOT_FOUND]: ErrorCode.NotFound,
  [HttpStatus.CONFLICT]: ErrorCode.Conflict,
  [HttpStatus.UNPROCESSABLE_ENTITY]: ErrorCode.UnprocessableEntity,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.RateLimited,
};

type ExceptionLogger = Pick<Logger, 'warn' | 'error'>;

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: ExceptionLogger = new Logger(
      GlobalExceptionFilter.name,
    ),
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = this.resolveRequestId(request);
    const statusCode = this.resolveStatusCode(exception);
    const message = this.resolveMessage(exception, statusCode);
    const code =
      exception instanceof AppException
        ? exception.errorCode
        : (STATUS_CODE_TO_ERROR_CODE[statusCode] ??
          (statusCode >= 500 ? ErrorCode.InternalError : 'ERROR'));

    const body: ErrorResponseBody = {
      success: false,
      statusCode,
      code,
      message,
      path: request.originalUrl ?? request.url,
      timestamp: new Date().toISOString(),
      requestId,
    };

    if (statusCode >= 500) {
      this.logger.error(
        this.buildLogMessage('Unhandled exception', request, body),
        exception instanceof Error ? exception.stack : undefined,
      );
    } else if (this.shouldWarnOnClientError(statusCode)) {
      this.logger.warn(this.buildLogMessage('Client exception', request, body));
    }

    response.status(statusCode).json(body);
  }

  private shouldWarnOnClientError(statusCode: number): boolean {
    return statusCode >= 400 && statusCode < 500 && statusCode !== 404;
  }

  private buildLogMessage(
    prefix: string,
    request: Request,
    body: ErrorResponseBody,
  ): string {
    return `${prefix} on ${request.method} ${body.path} [${body.requestId}] status=${body.statusCode} code=${body.code} message="${body.message}"`;
  }

  private resolveRequestId(request: Request): string {
    const header = request.headers[REQUEST_ID_HEADER];
    return Array.isArray(header) ? header[0] : (header ?? 'unknown');
  }

  private resolveStatusCode(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private resolveMessage(exception: unknown, statusCode: number): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return response;
      }
      if (
        typeof response === 'object' &&
        response !== null &&
        'message' in response
      ) {
        const msg = response.message;
        return Array.isArray(msg) ? msg.join(', ') : String(msg);
      }
      return exception.message;
    }

    if (statusCode >= 500) {
      return 'Internal server error';
    }

    return 'An unexpected error occurred';
  }
}
