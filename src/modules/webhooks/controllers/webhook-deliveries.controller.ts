import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import {
  ListWebhookDeliveriesDto,
  WebhookDeliveryResponseDto,
  toWebhookDeliveryResponseDto,
} from '../dto/webhook-deliveries.dto';
import { WebhookSubscriptionsService } from '../services/webhook-subscriptions.service';
import { WebhookDeliveriesService } from '../services/webhook-deliveries.service';

const RESOURCE = 'webhooks';

@ApiTags('Webhooks - Deliveries')
@Controller('webhooks/:webhookId/deliveries')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class WebhookDeliveriesController {
  constructor(
    private readonly webhookSubscriptionsService: WebhookSubscriptionsService,
    private readonly webhookDeliveriesService: WebhookDeliveriesService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('webhooks.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('webhookId', ParseUUIDPipe) webhookId: string,
    @Query() query: ListWebhookDeliveriesDto,
  ): Promise<{ data: WebhookDeliveryResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    // Enforces company isolation: 404s if webhookId doesn't belong to companyId.
    await this.webhookSubscriptionsService.findByIdInCompany(
      webhookId,
      companyId,
    );

    const result = await this.webhookDeliveriesService.findAllForSubscription(
      webhookId,
      query.page,
      query.limit,
    );
    return {
      data: result.data.map(toWebhookDeliveryResponseDto),
      meta: result.meta,
    };
  }
}
