import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthorizationService } from '../services/authorization.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { ErrorResponseDto } from '../../../common/swagger/dto/error-response.dto';

export class MyPermissionsResponseDto {
  @ApiProperty({
    type: [String],
    example: ['SUPER_ADMIN'],
  })
  roleCodes: string[];

  @ApiProperty({
    type: [String],
    example: ['products.read', 'payments.create', 'reports.dashboard.read'],
  })
  permissionCodes: string[];
}

/**
 * Exposes the current user's own effective permissions/roles. Separate from
 * AuthController (Phase 05) rather than added to it, keeping authentication
 * and authorization as distinct modules per the Phase 06 architecture
 * principle — this endpoint only requires JwtAuthGuard, not PermissionGuard,
 * since every authenticated user is allowed to know their own access.
 */
@ApiTags('RBAC - My Permissions')
@Controller('auth/me/permissions')
@UseGuards(JwtAuthGuard)
export class MyPermissionsController {
  constructor(private readonly authorizationService: AuthorizationService) {}

  @Get()
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({
    summary: 'Return the authenticated user effective roles and permissions',
  })
  @ApiOkResponse({
    type: MyPermissionsResponseDto,
    description:
      'Role codes and effective permission codes calculated from the active RBAC graph.',
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Missing, invalid, expired, or revoked JWT session.',
  })
  async getMyPermissions(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<MyPermissionsResponseDto> {
    const [roleCodes, permissionCodes] = await Promise.all([
      this.authorizationService.getActiveRoleCodes(currentUser.id),
      this.authorizationService.getEffectivePermissionCodes(currentUser.id),
    ]);

    return {
      roleCodes: Array.from(roleCodes),
      permissionCodes: Array.from(permissionCodes),
    };
  }
}
