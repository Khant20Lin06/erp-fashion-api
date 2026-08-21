import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserOrganizationService } from '../services/user-organization.service';
import {
  AssignBranchMembershipDto,
  AssignCompanyMembershipDto,
  AssignWarehouseMembershipDto,
} from '../dto/assign-membership.dto';
import {
  CompanyMembershipResponseDto,
  BranchMembershipResponseDto,
  WarehouseMembershipResponseDto,
  toCompanyMembershipResponseDto,
  toBranchMembershipResponseDto,
  toWarehouseMembershipResponseDto,
} from '../dto/membership-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { AuthorizationService } from '../../rbac/services/authorization.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';

@ApiTags('Organization - User Membership')
@Controller('users/:userId')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class UserOrganizationController {
  constructor(
    private readonly userOrganizationService: UserOrganizationService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  @Get('companies')
  async listCompanies(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<CompanyMembershipResponseDto[]> {
    await this.assertCanReadMemberships(currentUser.id, userId);
    const memberships =
      await this.userOrganizationService.listCompanyMemberships(userId);
    return memberships.map(toCompanyMembershipResponseDto);
  }

  @Post('companies')
  @RequirePermission('user_organizations.assign')
  async assignCompany(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AssignCompanyMembershipDto,
  ): Promise<CompanyMembershipResponseDto> {
    const membership = await this.userOrganizationService.assignCompany(
      userId,
      dto.companyId,
    );
    return toCompanyMembershipResponseDto(membership);
  }

  @Delete('companies/:companyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('user_organizations.remove')
  async removeCompany(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ): Promise<void> {
    await this.userOrganizationService.removeCompanyMembership(
      userId,
      companyId,
    );
  }

  @Get('branches')
  async listBranches(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<BranchMembershipResponseDto[]> {
    await this.assertCanReadMemberships(currentUser.id, userId);
    const memberships =
      await this.userOrganizationService.listBranchMemberships(userId);
    return memberships.map(toBranchMembershipResponseDto);
  }

  @Post('branches')
  @RequirePermission('user_organizations.assign')
  async assignBranch(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AssignBranchMembershipDto,
  ): Promise<BranchMembershipResponseDto> {
    const membership = await this.userOrganizationService.assignBranch(
      userId,
      dto.branchId,
    );
    return toBranchMembershipResponseDto(membership);
  }

  @Delete('branches/:branchId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('user_organizations.remove')
  async removeBranch(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
  ): Promise<void> {
    await this.userOrganizationService.removeBranchMembership(userId, branchId);
  }

  @Get('warehouses')
  async listWarehouses(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<WarehouseMembershipResponseDto[]> {
    await this.assertCanReadMemberships(currentUser.id, userId);
    const memberships =
      await this.userOrganizationService.listWarehouseMemberships(userId);
    return memberships.map(toWarehouseMembershipResponseDto);
  }

  @Post('warehouses')
  @RequirePermission('user_organizations.assign')
  async assignWarehouse(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AssignWarehouseMembershipDto,
  ): Promise<WarehouseMembershipResponseDto> {
    const membership = await this.userOrganizationService.assignWarehouse(
      userId,
      dto.warehouseId,
    );
    return toWarehouseMembershipResponseDto(membership);
  }

  @Delete('warehouses/:warehouseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('user_organizations.remove')
  async removeWarehouse(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
  ): Promise<void> {
    await this.userOrganizationService.removeWarehouseMembership(
      userId,
      warehouseId,
    );
  }

  private async assertCanReadMemberships(
    actorUserId: string,
    targetUserId: string,
  ): Promise<void> {
    if (actorUserId === targetUserId) {
      return;
    }

    const canReadMemberships = await this.authorizationService.can(
      actorUserId,
      'user_organizations.read',
    );

    if (!canReadMemberships) {
      throw new ForbiddenException('Insufficient permission');
    }
  }
}
