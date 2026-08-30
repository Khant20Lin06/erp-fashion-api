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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';
import { SupplierQuotationsService } from '../services/supplier-quotations.service';
import { CreateSupplierQuotationDto } from '../dto/create-supplier-quotation.dto';
import { ListSupplierQuotationsDto } from '../dto/list-supplier-quotations.dto';
import {
  SupplierQuotationResponseDto,
  toSupplierQuotationResponseDto,
} from '../dto/supplier-quotation-response.dto';
import { UpdateSupplierQuotationStatusDto } from '../dto/update-supplier-quotation-status.dto';

const RESOURCE = 'supplier_quotations';

@ApiTags('Supplier Quotations')
@Controller('supplier-quotations')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SupplierQuotationsController {
  constructor(
    private readonly supplierQuotationsService: SupplierQuotationsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('supplier_quotations.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListSupplierQuotationsDto,
  ): Promise<{ data: SupplierQuotationResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.supplierQuotationsService.findAll(
      companyId,
      query,
    );
    return {
      data: result.data.map(toSupplierQuotationResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('supplier_quotations.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<SupplierQuotationResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.supplierQuotationsService.findByIdInCompany(
      id,
      companyId,
    );
    return toSupplierQuotationResponseDto(entity);
  }

  @Post()
  @RequirePermission('supplier_quotations.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSupplierQuotationDto,
  ): Promise<SupplierQuotationResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    const entity = await this.supplierQuotationsService.create(
      companyId,
      user.id,
      dto,
    );
    return toSupplierQuotationResponseDto(entity);
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('supplier_quotations.confirm')
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierQuotationStatusDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<SupplierQuotationResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.supplierQuotationsService.updateStatus(
      id,
      companyId,
      user.id,
      dto.status,
    );
    return toSupplierQuotationResponseDto(entity);
  }
}
