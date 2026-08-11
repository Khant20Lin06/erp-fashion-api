import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthorizationService } from '../services/authorization.service';
import {
  PERMISSION_METADATA_KEY,
  PermissionRequirement,
  PermissionRequirementMode,
} from '../decorators/require-permission.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticated-user';

interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}

/**
 * Must run after JwtAuthGuard (which populates request.user). This guard
 * only answers "can this user perform this action at all" — record-level
 * data visibility is a separate concern handled by DataScopeService in the
 * business-module layer, never merged into this guard (Phase 06 §2/§108).
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<
      PermissionRequirement | undefined
    >(PERMISSION_METADATA_KEY, [context.getHandler(), context.getClass()]);

    if (!requirement || requirement.codes.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.user?.id;

    if (!userId) {
      throw new UnauthorizedException('Not authenticated');
    }

    const authorized =
      requirement.mode === PermissionRequirementMode.Any
        ? await this.authorizationService.canAny(userId, requirement.codes)
        : await this.authorizationService.canAll(userId, requirement.codes);

    if (!authorized) {
      throw new ForbiddenException('Insufficient permission');
    }

    return true;
  }
}
