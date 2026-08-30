import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';
import { PurchaseInvoicesService } from '../services/purchase-invoices.service';
import { ListPurchaseInvoicesDto } from '../dto/list-purchase-invoices.dto';
import { PurchaseInvoiceResponseDto } from '../dto/purchase-invoice-response.dto';
import { HttpCode, HttpStatus, Post, Body } from '@nestjs/common';
import { VoidPurchaseInvoiceDto } from '../dto/void-purchase-invoice.dto';

const RESOURCE = 'purchase_invoices';

@ApiTags('Purchase Invoices')
@Controller('purchase-invoices')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PurchaseInvoicesController {
  constructor(
    private readonly purchaseInvoicesService: PurchaseInvoicesService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('purchase_invoices.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPurchaseInvoicesDto,
  ): Promise<{ data: PurchaseInvoiceResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    return this.purchaseInvoicesService.findAll(companyId, query);
  }

  @Get(':id')
  @RequirePermission('purchase_invoices.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PurchaseInvoiceResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    return this.purchaseInvoicesService.findByIdInCompany(id, companyId);
  }

  @Post(':id/post')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('purchase_invoices.confirm')
  async postInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PurchaseInvoiceResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    return this.purchaseInvoicesService.post(id, companyId, user.id);
  }

  @Post(':id/void')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('purchase_invoices.cancel')
  async voidInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidPurchaseInvoiceDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PurchaseInvoiceResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    return this.purchaseInvoicesService.void(id, companyId, user.id, dto);
  }
}
