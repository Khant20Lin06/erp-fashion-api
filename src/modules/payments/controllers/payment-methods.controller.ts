import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ParseUUIDPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaymentMethodsService } from '../services/payment-methods.service';
import { CreatePaymentMethodDto } from '../dto/create-payment-method.dto';
import { ListPaymentMethodsDto } from '../dto/list-payment-methods.dto';
import {
  PaymentMethodResponseDto,
  toPaymentMethodResponseDto,
} from '../dto/payment-method-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';

const RESOURCE = 'payment_methods';

/**
 * PaymentMethod API (D14, LOCKED minimal scope): GET (list+detail) +
 * POST only — no PATCH/activate/deactivate/DELETE, since the locked spec's
 * own API surface for PaymentMethod stops at read+create (unlike Brand/
 * Category, whose full CRUD scope was set explicitly in Phase 09).
 */
@ApiTags('Payment Methods')
@Controller('payment-methods')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PaymentMethodsController {
  constructor(
    private readonly paymentMethodsService: PaymentMethodsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('payment_methods.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPaymentMethodsDto,
  ): Promise<{ data: PaymentMethodResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.paymentMethodsService.findAll(companyId, query);
    return {
      data: result.data.map(toPaymentMethodResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('payment_methods.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PaymentMethodResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.paymentMethodsService.findByIdInCompany(
      id,
      companyId,
    );
    return toPaymentMethodResponseDto(entity);
  }

  @Post()
  @RequirePermission('payment_methods.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePaymentMethodDto,
  ): Promise<PaymentMethodResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    const entity = await this.paymentMethodsService.create(companyId, dto);
    return toPaymentMethodResponseDto(entity);
  }
}
