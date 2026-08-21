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
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { PaymentsService } from '../services/payments.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { ListPaymentsDto } from '../dto/list-payments.dto';
import {
  PaymentListResponseDto,
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
import { ErrorResponseDto } from '../../../common/swagger/dto/error-response.dto';

const RESOURCE = 'payments';

/**
 * Payment API (D14, LOCKED): GET /payments, GET /payments/:id,
 * POST /payments only. No PATCH/DELETE/refund/reverse/void/summary/
 * reconciliation/export endpoint of any kind. No POST /payments/:id/confirm
 * because every Payment is created directly CONFIRMED.
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
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({
    summary: 'List payments visible within the authenticated user scope',
  })
  @ApiOkResponse({
    type: PaymentListResponseDto,
    description:
      'Paginated payment list. companyId acts only as a filter; DataScope remains authoritative.',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Validation failed for query parameters.',
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Missing, invalid, expired, or revoked JWT session.',
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description:
      'The authenticated user lacks the required permission or company scope.',
  })
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
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({ summary: 'Get a single payment by id within scope' })
  @ApiOkResponse({
    type: PaymentResponseDto,
    description: 'Payment detail if it is visible in the authenticated scope.',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Validation failed for path/query parameters.',
  })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
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
   * Honors an optional Idempotency-Key request header. A repeat request
   * with the same key returns the original payment with 200 instead of
   * creating a duplicate.
   */
  @Post()
  @RequirePermission('payments.create')
  @ApiBearerAuth('bearerAuth')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      'Optional idempotency key. Reusing the same key returns the existing payment instead of creating a duplicate.',
  })
  @ApiOperation({
    summary:
      'Create a confirmed payment and trigger the downstream accounting/outbox flow',
  })
  @ApiCreatedResponse({
    type: PaymentResponseDto,
    description: 'New payment created successfully.',
  })
  @ApiOkResponse({
    type: PaymentResponseDto,
    description:
      'Existing payment returned because the supplied idempotency key was already used.',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Validation failed for the request body.',
  })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
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
