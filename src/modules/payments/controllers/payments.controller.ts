import {
  Body,
  Controller,
  Get,
  Headers,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PaymentsService } from '../services/payments.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { ListPaymentsDto } from '../dto/list-payments.dto';
import {
  PaymentResponseDto,
  toPaymentResponseDto,
} from '../dto/payment-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';

const RESOURCE = 'payments';

/**
 * Payment API (D14, LOCKED): GET /payments, GET /payments/:id,
 * POST /payments only. No PATCH/DELETE/refund/reverse/void/summary/
 * reconciliation/export endpoint of any kind — D4/D5/D10, LOCKED. No
 * POST /payments/:id/confirm — every Payment is created directly
 * CONFIRMED (see PaymentsService's own docblock and
 * docs/PAYMENT_ARCHITECTURE.md "Lifecycle Decision" for the full D4
 * reasoning), so there is no DRAFT state a separate confirm step would
 * transition out of.
 */
@ApiTags('Payments')
@Controller('payments')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('payments.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPaymentsDto,
  ): Promise<{ data: PaymentResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.paymentsService.findAll(companyId, query);
    return {
      data: result.data.map(toPaymentResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('payments.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PaymentResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.paymentsService.findByIdInCompany(id, companyId);
    return toPaymentResponseDto(entity);
  }

  /**
   * D11 (LOCKED): honors an optional Idempotency-Key request header. A
   * repeat request with the same key returns the original payment with
   * 200 (not 201) instead of creating a duplicate.
   */
  @Post()
  @RequirePermission('payments.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePaymentDto,
    @Res({ passthrough: true }) response: Response,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<PaymentResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    const { payment, wasExisting } = await this.paymentsService.create(
      companyId,
      user.id,
      dto,
      idempotencyKey,
    );
    response.status(wasExisting ? HttpStatus.OK : HttpStatus.CREATED);
    return toPaymentResponseDto(payment);
  }
}
