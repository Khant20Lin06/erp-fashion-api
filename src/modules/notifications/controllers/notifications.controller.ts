import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NotificationsService } from '../services/notifications.service';
import { ListNotificationsDto } from '../dto/list-notifications.dto';
import {
  NotificationResponseDto,
  toNotificationResponseDto,
} from '../dto/notification-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';

const RESOURCE = 'notifications';

/**
 * Phase 21 — Notifications read API. GET (list+detail) + PATCH :id/read
 * only (locked scope: no POST /notifications — every Notification is
 * created exclusively by NotificationEventConsumer reacting to a Kafka
 * event, never directly via the API; no queue/Kafka management endpoint of
 * any kind). Mirrors PaymentMethodsController's/InventoryLedgerController's
 * DataScope-enforced, company-scoped read pattern exactly.
 */
@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('notifications.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListNotificationsDto,
  ): Promise<{ data: NotificationResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.notificationsService.findAll(companyId, query);
    return {
      data: result.data.map(toNotificationResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('notifications.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<NotificationResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.notificationsService.findByIdInCompany(
      id,
      companyId,
    );
    return toNotificationResponseDto(entity);
  }

  @Patch(':id/read')
  @RequirePermission('notifications.update')
  async markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<NotificationResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.notificationsService.markRead(id, companyId);
    return toNotificationResponseDto(entity);
  }
}
