import {
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { GlobalExceptionFilter } from './http-exception.filter';
import { REQUEST_ID_HEADER } from '../middleware/request-id.middleware';

interface ErrorResponseBody {
  success: false;
  statusCode: number;
  code: string;
  message: string;
  path: string;
  timestamp: string;
  requestId: string;
}

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockJson: jest.Mock<void, [ErrorResponseBody]>;
  let mockStatus: jest.Mock;
  let mockHost: ArgumentsHost;
  let mockLogger: { warn: jest.Mock; error: jest.Mock };

  beforeEach(() => {
    mockLogger = {
      warn: jest.fn(),
      error: jest.fn(),
    };
    filter = new GlobalExceptionFilter(mockLogger);
    mockJson = jest.fn<void, [ErrorResponseBody]>();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });

    mockHost = {
      switchToHttp: () => ({
        getResponse: () => ({ type: () => ({ status: mockStatus }) }),
        getRequest: () => ({
          method: 'GET',
          originalUrl: '/api/v1/example',
          url: '/api/v1/example',
          headers: { [REQUEST_ID_HEADER]: 'test-request-id' },
        }),
      }),
    } as unknown as ArgumentsHost;
  });

  it('should map HttpException to a safe error response', () => {
    const exception = new BadRequestException('Invalid input');

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        path: '/api/v1/example',
        requestId: 'test-request-id',
      }),
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Client exception on GET /api/v1/example [test-request-id] status=400 code=VALIDATION_ERROR message="Invalid input"',
      ),
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('should map unknown errors to 500 without leaking internal details', () => {
    const exception = new Error('database connection string leaked here');

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = mockJson.mock.calls[0][0];
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(body.message).toBe('Internal server error');
    expect(body.message).not.toContain('database connection string');
    expect(body).not.toHaveProperty('stack');
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Unhandled exception on GET /api/v1/example [test-request-id] status=500 code=INTERNAL_ERROR',
      ),
      exception.stack,
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('should fall back to "unknown" requestId when header is missing', () => {
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => ({ type: () => ({ status: mockStatus }) }),
        getRequest: () => ({
          method: 'GET',
          originalUrl: '/api/v1/example',
          url: '/api/v1/example',
          headers: {},
        }),
      }),
    } as unknown as ArgumentsHost;

    filter.catch(new BadRequestException(), mockHost);

    const body = mockJson.mock.calls[0][0];
    expect(body.requestId).toBe('unknown');
  });

  it('does not warn-log plain not found responses', () => {
    filter.catch(new NotFoundException('Missing route'), mockHost);

    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});
