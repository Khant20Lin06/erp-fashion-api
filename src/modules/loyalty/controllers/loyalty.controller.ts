import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
  CustomerLoyaltyBalanceResponseDto,
  ListLoyaltyTransactionsDto,
  LoyaltyPointTransactionResponseDto,
  RedeemLoyaltyPointsDto,
  toLoyaltyPointTransactionResponseDto,
} from '../dto/loyalty-transactions.dto';
import { LoyaltyService } from '../services/loyalty.service';

const RESOURCE = 'loyalty';

@ApiTags('Loyalty')
@Controller('loyalty/customers')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class LoyaltyController {
  constructor(
    private readonly loyaltyService: LoyaltyService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get(':customerId')
  @RequirePermission('loyalty.read')
  async getBalance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<CustomerLoyaltyBalanceResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const availablePoints = await this.loyaltyService.getAvailableBalance(
      companyId,
      customerId,
    );
    return { customerId, availablePoints };
  }

  @Get(':customerId/transactions')
  @RequirePermission('loyalty.read')
  async getTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Query() query: ListLoyaltyTransactionsDto,
  ): Promise<{ data: LoyaltyPointTransactionResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.loyaltyService.findTransactionsForCustomer(
      companyId,
      customerId,
      query.page,
      query.limit,
    );
    return {
      data: result.data.map(toLoyaltyPointTransactionResponseDto),
      meta: result.meta,
    };
  }

  @Post(':customerId/redeem')
  @RequirePermission('loyalty.redeem')
  async redeem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: RedeemLoyaltyPointsDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<LoyaltyPointTransactionResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.loyaltyService.redeemStandalone(
      companyId,
      customerId,
      user.id,
      dto,
    );
    return toLoyaltyPointTransactionResponseDto(entity);
  }
}
