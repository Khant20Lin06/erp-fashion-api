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
import { GoodsReceiptsService } from '../services/goods-receipts.service';
import { CreateGoodsReceiptDto } from '../dto/create-goods-receipt.dto';
import { ListGoodsReceiptsDto } from '../dto/list-goods-receipts.dto';
import {
  GoodsReceiptResponseDto,
  toGoodsReceiptResponseDto,
} from '../dto/goods-receipt-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';

const RESOURCE = 'goods_receipts';

/**
 * GoodsReceipt API (Phase 14 locked decision D2/D21). No PATCH, no DELETE
 * — a GoodsReceipt is immutable once created; receiving is a single
 * atomic step.
 */
@ApiTags('Goods Receipts')
@Controller('goods-receipts')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class GoodsReceiptsController {
  constructor(
    private readonly goodsReceiptsService: GoodsReceiptsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('goods_receipts.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListGoodsReceiptsDto,
  ): Promise<{ data: GoodsReceiptResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.goodsReceiptsService.findAll(companyId, query);
    return {
      data: result.data.map(toGoodsReceiptResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('goods_receipts.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<GoodsReceiptResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.goodsReceiptsService.findByIdInCompany(
      id,
      companyId,
    );
    return toGoodsReceiptResponseDto(entity);
  }

  @Post()
  @RequirePermission('goods_receipts.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGoodsReceiptDto,
  ): Promise<GoodsReceiptResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    const entity = await this.goodsReceiptsService.create(
      companyId,
      user.id,
      dto,
    );
    return toGoodsReceiptResponseDto(entity);
  }
}
