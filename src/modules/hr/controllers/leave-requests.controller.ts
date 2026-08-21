import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { resolveRequestCompanyBranchScope } from '../../master-data/utils/resolve-request-company-branch-scope';
import { DataScope } from '../../rbac/enums/data-scope.enum';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  CreateLeaveRequestDto,
  LeaveRequestResponseDto,
  ListLeaveRequestsDto,
  toLeaveRequestResponseDto,
  UpdateLeaveRequestDto,
} from '../dto/leave-requests.dto';
import { LeaveRequestsService } from '../services/leave-requests.service';

const RESOURCE = 'leave_requests';

@ApiTags('HR - Leave Requests')
@Controller('leave-requests')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class LeaveRequestsController {
  constructor(
    private readonly leaveRequestsService: LeaveRequestsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('leave_requests.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListLeaveRequestsDto,
  ): Promise<{ data: LeaveRequestResponseDto[]; meta: unknown }> {
    const resolved = await this.dataScopeService.resolveScope(
      user.id,
      RESOURCE,
    );
    if (!resolved) {
      throw new AppException(
        ErrorCode.Forbidden,
        'No data scope is configured for this resource',
      );
    }

    const result =
      resolved.scope === DataScope.Own
        ? await this.leaveRequestsService.findAll(user.id, query, {
            ownOnly: true,
          })
        : await this.leaveRequestsService.findAll(
            user.id,
            query,
            await resolveRequestCompanyBranchScope(
              this.dataScopeService,
              user.id,
              RESOURCE,
              query.companyId,
              query.branchId,
            ),
          );

    return {
      data: result.data.map(toLeaveRequestResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('leave_requests.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<LeaveRequestResponseDto> {
    const resolved = await this.dataScopeService.resolveScope(
      user.id,
      RESOURCE,
    );
    if (!resolved) {
      throw new AppException(
        ErrorCode.Forbidden,
        'No data scope is configured for this resource',
      );
    }

    const entity =
      resolved.scope === DataScope.Own
        ? await this.leaveRequestsService.findById(id, user.id, {
            ownOnly: true,
          })
        : await this.leaveRequestsService.findById(
            id,
            user.id,
            await resolveRequestCompanyBranchScope(
              this.dataScopeService,
              user.id,
              RESOURCE,
              companyIdQuery,
              undefined,
            ),
          );
    return toLeaveRequestResponseDto(entity);
  }

  @Post()
  @RequirePermission('leave_requests.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLeaveRequestDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<LeaveRequestResponseDto> {
    const resolved = await this.dataScopeService.resolveScope(
      user.id,
      RESOURCE,
    );
    if (!resolved) {
      throw new AppException(
        ErrorCode.Forbidden,
        'No data scope is configured for this resource',
      );
    }

    const ownOnly = resolved.scope === DataScope.Own;
    const scope = ownOnly
      ? undefined
      : await resolveRequestCompanyBranchScope(
          this.dataScopeService,
          user.id,
          RESOURCE,
          companyIdQuery,
          undefined,
        );

    const entity = await this.leaveRequestsService.create(
      user.id,
      scope?.companyId,
      dto,
      ownOnly,
    );
    return toLeaveRequestResponseDto(entity);
  }

  @Patch(':id')
  @RequirePermission('leave_requests.update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeaveRequestDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<LeaveRequestResponseDto> {
    const resolved = await this.dataScopeService.resolveScope(
      user.id,
      RESOURCE,
    );
    if (!resolved) {
      throw new AppException(
        ErrorCode.Forbidden,
        'No data scope is configured for this resource',
      );
    }
    const ownOnly = resolved.scope === DataScope.Own;
    const scope = ownOnly
      ? { companyId: undefined, ownOnly: true }
      : await resolveRequestCompanyBranchScope(
          this.dataScopeService,
          user.id,
          RESOURCE,
          companyIdQuery,
          undefined,
        );
    const existing = await this.leaveRequestsService.findById(
      id,
      user.id,
      scope,
    );
    const companyId = existing.companyId;
    const entity = await this.leaveRequestsService.update(
      id,
      user.id,
      companyId,
      dto,
      ownOnly,
    );
    return toLeaveRequestResponseDto(entity);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('leave_requests.approve')
  async approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<LeaveRequestResponseDto> {
    const scope = await resolveRequestCompanyBranchScope(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
      undefined,
    );
    await this.leaveRequestsService.findById(id, user.id, scope);
    const entity = await this.leaveRequestsService.approve(
      id,
      user.id,
      scope.companyId,
    );
    return toLeaveRequestResponseDto(entity);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('leave_requests.reject')
  async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<LeaveRequestResponseDto> {
    const scope = await resolveRequestCompanyBranchScope(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
      undefined,
    );
    await this.leaveRequestsService.findById(id, user.id, scope);
    const entity = await this.leaveRequestsService.reject(
      id,
      user.id,
      scope.companyId,
    );
    return toLeaveRequestResponseDto(entity);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('leave_requests.cancel')
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<LeaveRequestResponseDto> {
    const existing = companyIdQuery
      ? await this.leaveRequestsService.findById(id, user.id, {
          companyId: companyIdQuery,
        })
      : await this.leaveRequestsService.findById(id, user.id, {
          ownOnly: true,
        });
    const entity = await this.leaveRequestsService.cancel(
      id,
      user.id,
      existing.companyId,
    );
    return toLeaveRequestResponseDto(entity);
  }
}
