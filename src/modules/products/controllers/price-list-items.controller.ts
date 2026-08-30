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
import { PriceListItemsService } from '../services/price-list-items.service';
import { CreatePriceListItemDto } from '../dto/create-price-list-item.dto';
import { UpdatePriceListItemDto } from '../dto/update-price-list-item.dto';
import { ListPriceListItemsDto } from '../dto/list-price-list-items.dto';
import {
  PriceListItemResponseDto,
  toPriceListItemResponseDto,
} from '../dto/price-list-item-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';

const RESOURCE = 'price_list_items';

@ApiTags('Price List Items')
@Controller('price-lists/:priceListId/items')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PriceListItemsController {
  constructor(
    private readonly priceListItemsService: PriceListItemsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('price_list_items.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('priceListId', ParseUUIDPipe) priceListId: string,
    @Query() query: ListPriceListItemsDto,
  ): Promise<{ data: PriceListItemResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.priceListItemsService.findAllForPriceList(
      priceListId,
      companyId,
      query,
    );
    return {
      data: result.data.map(toPriceListItemResponseDto),
      meta: result.meta,
    };
  }

  @Post()
  @RequirePermission('price_list_items.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('priceListId', ParseUUIDPipe) priceListId: string,
    @Body() dto: CreatePriceListItemDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PriceListItemResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const item = await this.priceListItemsService.create(
      priceListId,
      companyId,
      dto,
    );
    return toPriceListItemResponseDto(item);
  }

  @Patch(':id')
  @RequirePermission('price_list_items.update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePriceListItemDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PriceListItemResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const item = await this.priceListItemsService.update(id, companyId, dto);
    return toPriceListItemResponseDto(item);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('price_list_items.update')
  async deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PriceListItemResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const item = await this.priceListItemsService.deactivate(id, companyId);
    return toPriceListItemResponseDto(item);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('price_list_items.delete')
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
    await this.priceListItemsService.remove(id, companyId);
  }
}
