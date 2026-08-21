import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';
import { resolveRequestCompanyBranchScope } from '../../master-data/utils/resolve-request-company-branch-scope';
import {
  SettingsMeQueryDto,
  SettingsCollectionResponseDto,
  UpdateSettingValueDto,
} from '../dto/settings.dto';
import { SettingsService } from '../services/settings.service';
import { DataScope } from '../../rbac/enums/data-scope.enum';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';

const SYSTEM_RESOURCE = 'settings_system';
const COMPANY_RESOURCE = 'settings_company';
const BRANCH_RESOURCE = 'settings_branch';
const USER_RESOURCE = 'settings_user';

@ApiTags('Settings')
@Controller('settings')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get('system')
  @RequirePermission('settings.system.read')
  async getSystem(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SettingsCollectionResponseDto> {
    await this.assertSystemScope(user.id, SYSTEM_RESOURCE);
    return { data: await this.settingsService.listSystem() };
  }

  @Patch('system/:key')
  @RequirePermission('settings.system.update')
  async updateSystem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Body() dto: UpdateSettingValueDto,
  ): Promise<SettingsCollectionResponseDto> {
    await this.assertSystemScope(user.id, SYSTEM_RESOURCE);
    const updated = await this.settingsService.updateSystem(key, dto.value);
    return { data: [updated] };
  }

  @Get('company/:companyId')
  @RequirePermission('settings.company.read')
  async getCompany(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyIdParam: string,
  ): Promise<SettingsCollectionResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      COMPANY_RESOURCE,
      companyIdParam,
    );
    return { data: await this.settingsService.listCompany(companyId) };
  }

  @Patch('company/:companyId/:key')
  @RequirePermission('settings.company.update')
  async updateCompany(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyIdParam: string,
    @Param('key') key: string,
    @Body() dto: UpdateSettingValueDto,
  ): Promise<SettingsCollectionResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      COMPANY_RESOURCE,
      companyIdParam,
    );
    const updated = await this.settingsService.updateCompany(
      companyId,
      key,
      dto.value,
    );
    return { data: [updated] };
  }

  @Get('branch/:branchId')
  @RequirePermission('settings.branch.read')
  async getBranch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<SettingsCollectionResponseDto> {
    const scope = await resolveRequestCompanyBranchScope(
      this.dataScopeService,
      user.id,
      BRANCH_RESOURCE,
      companyIdQuery,
      branchId,
    );
    return { data: await this.settingsService.listBranch(scope.branchId!) };
  }

  @Patch('branch/:branchId/:key')
  @RequirePermission('settings.branch.update')
  async updateBranch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('key') key: string,
    @Body() dto: UpdateSettingValueDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<SettingsCollectionResponseDto> {
    const scope = await resolveRequestCompanyBranchScope(
      this.dataScopeService,
      user.id,
      BRANCH_RESOURCE,
      companyIdQuery,
      branchId,
    );
    const updated = await this.settingsService.updateBranch(
      scope.branchId!,
      key,
      dto.value,
    );
    return { data: [updated] };
  }

  @Get('me')
  @RequirePermission('settings.user.read')
  async getMe(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SettingsMeQueryDto,
  ): Promise<SettingsCollectionResponseDto> {
    await this.assertUserScope(user.id);
    const scope =
      query.branchId !== undefined
        ? await resolveRequestCompanyBranchScope(
            this.dataScopeService,
            user.id,
            BRANCH_RESOURCE,
            query.companyId,
            query.branchId,
          )
        : query.companyId
          ? {
              companyId: await resolveRequestCompanyId(
                this.dataScopeService,
                user.id,
                COMPANY_RESOURCE,
                query.companyId,
              ),
              branchId: undefined,
              allowedBranchIds: null,
            }
          : undefined;

    return {
      data: await this.settingsService.listMe(
        user.id,
        scope?.companyId,
        scope?.branchId,
      ),
    };
  }

  @Patch('me/:key')
  @RequirePermission('settings.user.update')
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Body() dto: UpdateSettingValueDto,
    @Query() query: SettingsMeQueryDto,
  ): Promise<SettingsCollectionResponseDto> {
    await this.assertUserScope(user.id);
    const scope =
      query.branchId !== undefined
        ? await resolveRequestCompanyBranchScope(
            this.dataScopeService,
            user.id,
            BRANCH_RESOURCE,
            query.companyId,
            query.branchId,
          )
        : query.companyId
          ? {
              companyId: await resolveRequestCompanyId(
                this.dataScopeService,
                user.id,
                COMPANY_RESOURCE,
                query.companyId,
              ),
              branchId: undefined,
              allowedBranchIds: null,
            }
          : undefined;

    const updated = await this.settingsService.updateUser(
      user.id,
      key,
      dto.value,
      scope?.companyId,
      scope?.branchId,
    );
    return { data: [updated] };
  }

  private async assertSystemScope(
    userId: string,
    resource: string,
  ): Promise<void> {
    const resolved = await this.dataScopeService.resolveScope(userId, resource);
    if (!resolved || resolved.scope !== DataScope.All) {
      throw new AppException(
        ErrorCode.Forbidden,
        'System settings require all-scope access',
      );
    }
  }

  private async assertUserScope(userId: string): Promise<void> {
    const resolved = await this.dataScopeService.resolveScope(
      userId,
      USER_RESOURCE,
    );
    if (!resolved) {
      throw new AppException(
        ErrorCode.Forbidden,
        'No data scope is configured for this resource',
      );
    }
  }
}
