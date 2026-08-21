import {
  Body,
  Controller,
  Delete,
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
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';
import {
  CreateWebhookSubscriptionDto,
  ListWebhookSubscriptionsDto,
  UpdateWebhookSubscriptionDto,
  WebhookSubscriptionCreatedResponseDto,
  WebhookSubscriptionResponseDto,
  toWebhookSubscriptionResponseDto,
} from '../dto/webhook-subscriptions.dto';
import { WebhookSubscriptionsService } from '../services/webhook-subscriptions.service';

const RESOURCE = 'webhooks';

@ApiTags('Webhooks')
@Controller('webhooks')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class WebhookSubscriptionsController {
  constructor(
    private readonly webhookSubscriptionsService: WebhookSubscriptionsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('webhooks.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListWebhookSubscriptionsDto,
  ): Promise<{ data: WebhookSubscriptionResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.webhookSubscriptionsService.findAll(
      companyId,
      query,
    );
    return {
      data: result.data.map(toWebhookSubscriptionResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('webhooks.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<WebhookSubscriptionResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.webhookSubscriptionsService.findByIdInCompany(
      id,
      companyId,
    );
    return toWebhookSubscriptionResponseDto(entity);
  }

  @Post()
  @RequirePermission('webhooks.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWebhookSubscriptionDto,
  ): Promise<WebhookSubscriptionCreatedResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    const { entity, plaintextSecret } =
      await this.webhookSubscriptionsService.create(companyId, user.id, dto);
    return {
      ...toWebhookSubscriptionResponseDto(entity),
      secret: plaintextSecret,
    };
  }

  @Patch(':id')
  @RequirePermission('webhooks.update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWebhookSubscriptionDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<WebhookSubscriptionResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.webhookSubscriptionsService.update(
      id,
      companyId,
      user.id,
      dto,
    );
    return toWebhookSubscriptionResponseDto(entity);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('webhooks.delete')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<void> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    await this.webhookSubscriptionsService.delete(id, companyId);
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('webhooks.update')
  async test(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<{ status: number; body: string | null }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    return this.webhookSubscriptionsService.sendTestDelivery(id, companyId);
  }
}
