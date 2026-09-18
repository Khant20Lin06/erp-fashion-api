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
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';
import {
  ListOnlineOrdersDto,
  OnlineOrderResponseDto,
  toOnlineOrderResponseDto,
  UpdateOnlineOrderStatusDto,
} from '../dto/online-orders.dto';
import { DispatchOnlineOrderDto } from '../dto/dispatch-online-order.dto';
import { SettleCodDto } from '../dto/settle-cod.dto';
import { OnlineOrdersService } from '../services/online-orders.service';

const RESOURCE = 'online_orders';

/**
 * Admin-facing management of bot/online-placed orders — separate from
 * SalesController exactly because OnlineOrder is a separate document
 * type (see the entity's own docblock). List/detail here surface the
 * Telegram identity and delivery address alongside the underlying Sale,
 * and the status endpoint drives the delivery-lifecycle buttons the
 * Customer Order Bot's inline keyboard calls.
 */
@ApiTags('Online Orders')
@Controller('online-orders')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class OnlineOrdersController {
  constructor(
    private readonly onlineOrdersService: OnlineOrdersService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('online_orders.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListOnlineOrdersDto,
  ): Promise<{ data: OnlineOrderResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.onlineOrdersService.findAll(companyId, query);
    return {
      data: result.data.map((o) => toOnlineOrderResponseDto(o)),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('online_orders.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<OnlineOrderResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.onlineOrdersService.findByIdInCompany(
      id,
      companyId,
    );
    return toOnlineOrderResponseDto(entity);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('online_orders.update_status')
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOnlineOrderStatusDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<OnlineOrderResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.onlineOrdersService.updateStatus(
      id,
      companyId,
      dto.status,
    );
    return toOnlineOrderResponseDto(entity);
  }

  @Post(':id/dispatch')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('online_orders.update_status')
  async dispatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DispatchOnlineOrderDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<OnlineOrderResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.onlineOrdersService.dispatch(
      id,
      companyId,
      dto,
    );
    return toOnlineOrderResponseDto(entity);
  }

  @Post(':id/settle-cod')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('online_orders.update_status')
  async settleCod(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SettleCodDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<OnlineOrderResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.onlineOrdersService.settleCod(
      id,
      companyId,
      user.id,
      dto,
    );
    return toOnlineOrderResponseDto(entity);
  }
}
