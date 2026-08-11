import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { RequestContextService } from './request-context.service';
import { REQUEST_ID_HEADER } from '../../common/middleware/request-id.middleware';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly requestContext: RequestContextService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const header = req.headers[REQUEST_ID_HEADER];
    const requestId = Array.isArray(header) ? header[0] : (header ?? 'unknown');

    this.requestContext.run({ requestId }, () => next());
  }
}
