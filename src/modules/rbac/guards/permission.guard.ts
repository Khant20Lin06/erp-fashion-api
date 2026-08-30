import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
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
 *
 * Deny-by-default (docs/SECURITY_RULES.md #1): a route protected by this
 * guard but missing @RequirePermission/@RequireAnyPermission is rejected
 * rather than silently allowed. A controller that only needs authentication
 * (no permission check) must not apply PermissionGuard at all — see
 * MyPermissionsController/AuthController, which use JwtAuthGuard alone.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<
      PermissionRequirement | undefined
    >(PERMISSION_METADATA_KEY, [context.getHandler(), context.getClass()]);

    const request = context.switchToHttp().getRequest<RequestWithUser>();

    if (!requirement || requirement.codes.length === 0) {
      this.logger.error(
        `PermissionGuard applied without @RequirePermission/@RequireAnyPermission on ${request.method} ${request.originalUrl ?? request.url} — denying by default. Add the decorator, or remove PermissionGuard if only authentication is required.`,
      );
      throw new ForbiddenException('Insufficient permission');
    }

    const userId = request.user?.id;

    if (!userId) {
      throw new UnauthorizedException('Not authenticated');
    }

    const authorized =
      requirement.mode === PermissionRequirementMode.Any
        ? await this.authorizationService.canAny(userId, requirement.codes)
        : await this.authorizationService.canAll(userId, requirement.codes);

    if (!authorized) {
      this.logger.warn(
        `Forbidden request ${request.method} ${request.originalUrl ?? request.url} for user ${userId}`,
      );
      throw new ForbiddenException('Insufficient permission');
    }

    return true;
  }
}
