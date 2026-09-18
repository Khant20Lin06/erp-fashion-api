import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CustomerPortalService } from '../services/customer-portal.service';
import { RequestLinkDto } from '../dto/request-link.dto';
import { VerifyLinkDto } from '../dto/verify-link.dto';
import { CreateCustomerOrderDto } from '../dto/create-customer-order.dto';
import { UpdateMyInfoDto } from '../dto/update-my-info.dto';
import { GetMyInfoDto } from '../dto/get-my-info.dto';
import { LookupProductDto } from '../dto/lookup-product.dto';
import type {
  RequestLinkResponseDto,
  VerifyLinkResponseDto,
} from '../dto/link-response.dto';
import type { MyInfoResponseDto } from '../dto/my-info-response.dto';
import { SaleResponseDto, toSaleResponseDto } from '../../sales/dto/sale-response.dto';
import {
  OnlineOrderResponseDto,
  toOnlineOrderResponseDto,
} from '../../online-orders/dto/online-orders.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { AuthRateLimitGuard } from '../../auth/guards/auth-rate-limit.guard';
import { AuthRateLimit } from '../../../common/security/auth-rate-limit.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';

/**
 * Reached ONLY by the CUSTOMER_SERVICE_BOT scoped service account (see
 * docs/... RBAC seed) — never by an end customer directly. The
 * telegramUserId/phone/code in these DTOs identify which END CUSTOMER
 * the bot is acting on behalf of; JwtAuthGuard+PermissionGuard authorize
 * the BOT ITSELF to call this API at all. This two-layer identity is
 * deliberate: the bot's own session proves "a legitimate integration is
 * calling," while CustomerPortalService's OTP/link resolution proves
 * "this specific Telegram user is who they claim to be" before any
 * Customer data is read or an order is placed on their behalf.
 */
@ApiTags('Customer Portal (Bot Integration)')
@Controller('customer-portal')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CustomerPortalController {
  constructor(private readonly customerPortalService: CustomerPortalService) {}

  @Post('link/request')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit('telegram-link-request')
  @RequirePermission('customer_portal.link')
  async requestLink(@Body() dto: RequestLinkDto): Promise<RequestLinkResponseDto> {
    return this.customerPortalService.requestLink(
      dto.telegramUserId,
      dto.companyId,
      dto.phone,
    );
  }

  @Post('link/verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit('telegram-link-verify')
  @RequirePermission('customer_portal.link')
  async verifyLink(@Body() dto: VerifyLinkDto): Promise<VerifyLinkResponseDto> {
    const customer = await this.customerPortalService.verifyLinkAndGetCustomer(
      dto.telegramUserId,
      dto.code,
    );
    return { customerId: customer.id, customerName: customer.name };
  }

  @Post('orders')
  @RequirePermission('customer_portal.order.create')
  async createOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCustomerOrderDto,
  ): Promise<{ sale: SaleResponseDto; onlineOrder: OnlineOrderResponseDto }> {
    const { sale, onlineOrder } = await this.customerPortalService.createOrder(
      user.id,
      dto,
    );
    return {
      sale: toSaleResponseDto(sale),
      onlineOrder: toOnlineOrderResponseDto(onlineOrder),
    };
  }

  /**
   * Backs the cart-building step ("/order SKU-001 x2") in the Customer
   * Service Bot — resolves a SKU to a customer-safe {name, sku, unitPrice}
   * line before anything is written. Does not require an existing
   * Telegram link (a customer can browse/build a cart before verifying
   * their phone); order creation itself still re-resolves every SKU
   * server-side and still requires a verified link (see createOrder).
   */
  @Get('products/lookup')
  @RequirePermission('customer_portal.order.create')
  async lookupProduct(
    @Query() query: LookupProductDto,
  ): Promise<{ sku: string; name: string; unitPrice: string } | { found: false }> {
    const product = await this.customerPortalService.lookupProductForCart(
      query.companyId,
      query.sku,
    );
    return product ?? { found: false };
  }

  /**
   * telegramUserId as a query param, not a path segment: this is looked up
   * on behalf of a Telegram user identified by the bot's own message
   * payload, exactly like link/request and link/verify — never a
   * customerId path param, which would let the bot enumerate other
   * customers' info by id.
   */
  @Get('me')
  @RequirePermission('customer_portal.profile')
  async getMyInfo(@Query() query: GetMyInfoDto): Promise<MyInfoResponseDto> {
    const customer = await this.customerPortalService.getMyInfo(
      query.telegramUserId,
    );
    return { customerId: customer.id, name: customer.name, phone: customer.phone };
  }

  @Patch('me')
  @RequirePermission('customer_portal.profile')
  async updateMyInfo(@Body() dto: UpdateMyInfoDto): Promise<MyInfoResponseDto> {
    const customer = await this.customerPortalService.updateMyInfo(
      dto.telegramUserId,
      { name: dto.name, phone: dto.phone },
    );
    return { customerId: customer.id, name: customer.name, phone: customer.phone };
  }

  /**
   * Reached by the Customer Order Bot, not the Customer Service Bot —
   * resolves which Telegram chat to notify when staff change a sale's
   * status. customerId here is safe as a path param: the caller (the
   * Order Bot service account) is trusted staff-side infrastructure, not
   * an end customer, and this only returns a Telegram user id, never
   * customer PII.
   */
  @Get('telegram-link/:customerId')
  @RequirePermission('customer_portal.notify_lookup')
  async getTelegramLinkForCustomer(
    @Param('customerId') customerId: string,
  ): Promise<{ telegramUserId: string | null }> {
    const telegramUserId =
      await this.customerPortalService.findTelegramUserIdForCustomer(customerId);
    return { telegramUserId };
  }
}
