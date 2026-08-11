import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';
import { AuthorizationService } from '../services/authorization.service';
import {
  PermissionRequirement,
  PermissionRequirementMode,
} from '../decorators/require-permission.decorator';

describe('PermissionGuard', () => {
  let guard: PermissionGuard;
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
  let authorizationService: jest.Mocked<
    Pick<AuthorizationService, 'can' | 'canAny' | 'canAll'>
  >;

  const buildContext = (userId?: string): ExecutionContext => {
    const request = { user: userId ? { id: userId } : undefined };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    authorizationService = {
      can: jest.fn(),
      canAny: jest.fn(),
      canAll: jest.fn(),
    };
    guard = new PermissionGuard(
      reflector as unknown as Reflector,
      authorizationService as unknown as AuthorizationService,
    );
  });

  it('allows the request when no permission requirement is declared', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(buildContext('user-1'))).resolves.toBe(true);
    expect(authorizationService.canAll).not.toHaveBeenCalled();
  });

  it('throws 401 when the requirement exists but there is no authenticated user', async () => {
    reflector.getAllAndOverride.mockReturnValue({
      codes: ['roles.read'],
      mode: PermissionRequirementMode.All,
    } satisfies PermissionRequirement);

    await expect(guard.canActivate(buildContext(undefined))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws 403 when the user lacks the required permission (ALL mode)', async () => {
    reflector.getAllAndOverride.mockReturnValue({
      codes: ['roles.update'],
      mode: PermissionRequirementMode.All,
    } satisfies PermissionRequirement);
    authorizationService.canAll.mockResolvedValue(false);

    await expect(guard.canActivate(buildContext('user-1'))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows the request when the user holds all required permissions', async () => {
    reflector.getAllAndOverride.mockReturnValue({
      codes: ['roles.read', 'roles.update'],
      mode: PermissionRequirementMode.All,
    } satisfies PermissionRequirement);
    authorizationService.canAll.mockResolvedValue(true);

    await expect(guard.canActivate(buildContext('user-1'))).resolves.toBe(true);
    expect(authorizationService.canAll).toHaveBeenCalledWith('user-1', [
      'roles.read',
      'roles.update',
    ]);
  });

  it('uses canAny for ANY mode', async () => {
    reflector.getAllAndOverride.mockReturnValue({
      codes: ['roles.read', 'roles.update'],
      mode: PermissionRequirementMode.Any,
    } satisfies PermissionRequirement);
    authorizationService.canAny.mockResolvedValue(true);

    await expect(guard.canActivate(buildContext('user-1'))).resolves.toBe(true);
    expect(authorizationService.canAny).toHaveBeenCalledWith('user-1', [
      'roles.read',
      'roles.update',
    ]);
    expect(authorizationService.canAll).not.toHaveBeenCalled();
  });
});
