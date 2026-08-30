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
import { PurchaseRfqsService } from '../services/purchase-rfqs.service';
import { CreatePurchaseRfqDto } from '../dto/create-purchase-rfq.dto';
import { ListPurchaseRfqsDto } from '../dto/list-purchase-rfqs.dto';
import {
  PurchaseRfqResponseDto,
  toPurchaseRfqResponseDto,
} from '../dto/purchase-rfq-response.dto';
import { UpdatePurchaseRfqStatusDto } from '../dto/update-purchase-rfq-status.dto';

const RESOURCE = 'purchase_rfqs';

@ApiTags('Purchase RFQs')
@Controller('purchase-rfqs')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PurchaseRfqsController {
  constructor(
    private readonly purchaseRfqsService: PurchaseRfqsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('purchase_rfqs.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPurchaseRfqsDto,
  ): Promise<{ data: PurchaseRfqResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.purchaseRfqsService.findAll(companyId, query);
    return {
      data: result.data.map(toPurchaseRfqResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('purchase_rfqs.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PurchaseRfqResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.purchaseRfqsService.findByIdInCompany(
      id,
      companyId,
    );
    return toPurchaseRfqResponseDto(entity);
  }

  @Post()
  @RequirePermission('purchase_rfqs.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePurchaseRfqDto,
  ): Promise<PurchaseRfqResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    const entity = await this.purchaseRfqsService.create(
      companyId,
      user.id,
      dto,
    );
    return toPurchaseRfqResponseDto(entity);
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('purchase_rfqs.confirm')
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseRfqStatusDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PurchaseRfqResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.purchaseRfqsService.updateStatus(
      id,
      companyId,
      user.id,
      dto.status,
    );
    return toPurchaseRfqResponseDto(entity);
  }
}
