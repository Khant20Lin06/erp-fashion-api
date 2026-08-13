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
import { PaymentTermsService } from '../services/payment-terms.service';
import { CreatePaymentTermDto } from '../dto/create-payment-term.dto';
import { UpdatePaymentTermDto } from '../dto/update-payment-term.dto';
import { ListPaymentTermsDto } from '../dto/list-payment-terms.dto';
import {
  PaymentTermResponseDto,
  toPaymentTermResponseDto,
} from '../dto/payment-term-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';

const RESOURCE = 'payment_terms';

@ApiTags('Customer/Supplier - Payment Terms')
@Controller('payment-terms')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PaymentTermsController {
  constructor(
    private readonly paymentTermsService: PaymentTermsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('payment_terms.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPaymentTermsDto,
  ): Promise<{ data: PaymentTermResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.paymentTermsService.findAll(companyId, query);
    return {
      data: result.data.map(toPaymentTermResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('payment_terms.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PaymentTermResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.paymentTermsService.findByIdInCompany(
      id,
      companyId,
    );
    return toPaymentTermResponseDto(entity);
  }

  @Post()
  @RequirePermission('payment_terms.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePaymentTermDto,
  ): Promise<PaymentTermResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    const entity = await this.paymentTermsService.create(companyId, dto);
    return toPaymentTermResponseDto(entity);
  }

  @Patch(':id')
  @RequirePermission('payment_terms.update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePaymentTermDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PaymentTermResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.paymentTermsService.update(id, companyId, dto);
    return toPaymentTermResponseDto(entity);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('payment_terms.update')
  async activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PaymentTermResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.paymentTermsService.activate(id, companyId);
    return toPaymentTermResponseDto(entity);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('payment_terms.update')
  async deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PaymentTermResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.paymentTermsService.deactivate(id, companyId);
    return toPaymentTermResponseDto(entity);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('payment_terms.delete')
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
    await this.paymentTermsService.remove(id, companyId);
  }
}
