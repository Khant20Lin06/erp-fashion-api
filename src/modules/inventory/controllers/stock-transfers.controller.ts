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
import { StockTransfersService } from '../services/stock-transfers.service';
import { CreateStockTransferDto } from '../dto/create-stock-transfer.dto';
import { ListStockTransfersDto } from '../dto/list-stock-transfers.dto';
import {
  StockTransferResponseDto,
  toStockTransferResponseDto,
} from '../dto/stock-transfer-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';

const RESOURCE = 'stock_transfers';

/**
 * StockTransfer API (Phase 14 locked decision D9/D22). No PATCH, no
 * DELETE — creation is the whole lifecycle.
 */
@ApiTags('Stock Transfers')
@Controller('stock-transfers')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class StockTransfersController {
  constructor(
    private readonly stockTransfersService: StockTransfersService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('stock_transfers.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListStockTransfersDto,
  ): Promise<{ data: StockTransferResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.stockTransfersService.findAll(companyId, query);
    return {
      data: result.data.map(toStockTransferResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('stock_transfers.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<StockTransferResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.stockTransfersService.findByIdInCompany(
      id,
      companyId,
    );
    return toStockTransferResponseDto(entity);
  }

  @Post()
  @RequirePermission('stock_transfers.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateStockTransferDto,
  ): Promise<StockTransferResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    const entity = await this.stockTransfersService.create(
      companyId,
      user.id,
      dto,
    );
    return toStockTransferResponseDto(entity);
  }
}
