import { Request, Response } from 'express';
import {
  RequestIdMiddleware,
  REQUEST_ID_HEADER,
} from './request-id.middleware';

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;
  let next: jest.Mock;
  let setHeader: jest.Mock;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
    next = jest.fn();
    setHeader = jest.fn();
  });

  it('should generate a request id when none is provided', () => {
    const req = { headers: {} } as unknown as Request;
    const res = { setHeader } as unknown as Response;

    middleware.use(req, res, next);

    const generatedId = req.headers[REQUEST_ID_HEADER] as string;
    expect(generatedId).toBeDefined();
    expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, generatedId);
    expect(next).toHaveBeenCalled();
  });

  it('should reuse a valid client-provided request id', () => {
    const req = {
      headers: { [REQUEST_ID_HEADER]: 'client-supplied-id-123' },
    } as unknown as Request;
    const res = { setHeader } as unknown as Response;

    middleware.use(req, res, next);

    expect(req.headers[REQUEST_ID_HEADER]).toBe('client-supplied-id-123');
    expect(setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      'client-supplied-id-123',
    );
  });

  it('should reject an unsafe client-provided request id and generate a new one', () => {
    const maliciousId = '<script>alert(1)</script>';
    const req = {
      headers: { [REQUEST_ID_HEADER]: maliciousId },
    } as unknown as Request;
    const res = { setHeader } as unknown as Response;

    middleware.use(req, res, next);

    expect(req.headers[REQUEST_ID_HEADER]).not.toBe(maliciousId);
    expect(next).toHaveBeenCalled();
  });
});
