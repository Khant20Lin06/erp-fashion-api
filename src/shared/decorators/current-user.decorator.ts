import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * Reads the authenticated user attached to the request by an authentication
 * guard. The guard is responsible for populating `request.user` after
 * validating credentials; this decorator only exposes that value.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): unknown => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user?: unknown }>();

    if (!request.user) {
      throw new InternalServerErrorException(
        '@CurrentUser() used outside of an authenticated route. Apply an authentication guard first.',
      );
    }

    return request.user;
  },
);
