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
import {
  SaleItemPricingPreview,
  SalesPriceListOption,
  SalesService,
} from '../services/sales.service';
import { CreateSaleDto } from '../dto/create-sale.dto';
import { ListSalesDto } from '../dto/list-sales.dto';
import { PreviewSaleItemPricingDto } from '../dto/preview-sale-item-pricing.dto';
import { SaleResponseDto, toSaleResponseDto } from '../dto/sale-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { AuthorizationService } from '../../rbac/services/authorization.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';

const RESOURCE = 'sales';

/**
 * Sales API (Phase 12, locked decisions). No generic PATCH endpoint that
 * can mutate status or any financial/historical field — status changes
 * only via the dedicated confirm/cancel operations, and there is no
 * update endpoint at all (nothing in this phase requires editing a DRAFT
 * sale beyond recreating it). Reuses resolveRequestCompanyId() /
 * DataScopeService exactly as every controller since Phase 09.
 */
@ApiTags('Sales')
@Controller('sales')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SalesController {
  constructor(
    private readonly salesService: SalesService,
    private readonly dataScopeService: DataScopeService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  @Get()
  @RequirePermission('sales.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListSalesDto,
  ): Promise<{ data: SaleResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.salesService.findAll(companyId, query);
    return { data: result.data.map(toSaleResponseDto), meta: result.meta };
  }

  @Get('pricing/price-lists')
  @RequirePermission('sales.create')
  async listActivePriceLists(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<SalesPriceListOption[]> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    return this.salesService.listActivePriceLists(companyId);
  }

  @Get(':id')
  @RequirePermission('sales.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<SaleResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.salesService.findByIdInCompany(id, companyId);
    return toSaleResponseDto(entity);
  }

  @Post()
  @RequirePermission('sales.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSaleDto,
  ): Promise<SaleResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );

    // Manual/promotion discount gate (Returns/Discounts/Loyalty phase,
    // additive): sales.create alone lets a user record a zero-discount
    // sale; applying ANY discount (a per-item discountAmount > 0 or a
    // promotionCode) additionally requires sales.discount.apply — a
    // dedicated, granular permission, never a hardcoded role check. This
    // mirrors PermissionGuard's own imperative-check escape hatch
    // (AuthorizationService.canAll), used here because the gate is
    // conditional on request BODY content, not just the route.
    const requestsAnyDiscount =
      !!dto.promotionCode ||
      dto.items.some((item) => Number(item.discountAmount ?? '0') > 0);
    if (requestsAnyDiscount) {
      const canApplyDiscount = await this.authorizationService.canAll(user.id, [
        'sales.discount.apply',
      ]);
      if (!canApplyDiscount) {
        throw new AppException(
          ErrorCode.Forbidden,
          'Applying a discount or promotion to a sale requires the sales.discount.apply permission',
        );
      }
    }

    const entity = await this.salesService.create(companyId, user.id, dto);
    return toSaleResponseDto(entity);
  }

  @Post('pricing/preview')
  @RequirePermission('sales.create')
  async previewItemPricing(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PreviewSaleItemPricingDto,
  ): Promise<SaleItemPricingPreview> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    return this.salesService.previewItemPricing(companyId, dto);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales.confirm')
  async confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<SaleResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.salesService.confirm(id, companyId, user.id);
    return toSaleResponseDto(entity);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales.cancel')
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<SaleResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.salesService.cancel(id, companyId, user.id);
    return toSaleResponseDto(entity);
  }
}
