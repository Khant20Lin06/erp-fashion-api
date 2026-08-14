import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PurchaseOrdersService } from '../services/purchase-orders.service';
import { CreatePurchaseOrderDto } from '../dto/create-purchase-order.dto';
import { ListPurchaseOrdersDto } from '../dto/list-purchase-orders.dto';
import {
  PurchaseOrderResponseDto,
  toPurchaseOrderResponseDto,
} from '../dto/purchase-order-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';

const RESOURCE = 'purchase_orders';

/**
 * Purchase Order API (Phase 13, locked decisions). No generic PATCH
 * endpoint that can mutate status or any financial/historical field —
 * status changes only via the dedicated confirm/cancel operations, and
 * there is no update endpoint at all, mirroring SalesController (Phase
 * 12) exactly. Reuses resolveRequestCompanyId() / DataScopeService exactly
 * as every controller since Phase 09.
 */
@ApiTags('Purchase Orders')
@Controller('purchase-orders')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PurchaseOrdersController {
  constructor(
    private readonly purchaseOrdersService: PurchaseOrdersService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('purchase_orders.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPurchaseOrdersDto,
  ): Promise<{ data: PurchaseOrderResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.purchaseOrdersService.findAll(companyId, query);
    return {
      data: result.data.map(toPurchaseOrderResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('purchase_orders.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PurchaseOrderResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.purchaseOrdersService.findByIdInCompany(
      id,
      companyId,
    );
    return toPurchaseOrderResponseDto(entity);
  }

  @Post()
  @RequirePermission('purchase_orders.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePurchaseOrderDto,
  ): Promise<PurchaseOrderResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    const entity = await this.purchaseOrdersService.create(
      companyId,
      user.id,
      dto,
    );
    return toPurchaseOrderResponseDto(entity);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('purchase_orders.confirm')
  async confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PurchaseOrderResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.purchaseOrdersService.confirm(
      id,
      companyId,
      user.id,
    );
    return toPurchaseOrderResponseDto(entity);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('purchase_orders.cancel')
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PurchaseOrderResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.purchaseOrdersService.cancel(
      id,
      companyId,
      user.id,
    );
    return toPurchaseOrderResponseDto(entity);
  }
}
