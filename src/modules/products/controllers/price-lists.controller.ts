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
import { PriceListsService } from '../services/price-lists.service';
import { CreatePriceListDto } from '../dto/create-price-list.dto';
import { UpdatePriceListDto } from '../dto/update-price-list.dto';
import { ListPriceListsDto } from '../dto/list-price-lists.dto';
import {
  PriceListResponseDto,
  toPriceListResponseDto,
} from '../dto/price-list-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';

const RESOURCE = 'price_lists';

@ApiTags('Price Lists')
@Controller('price-lists')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PriceListsController {
  constructor(
    private readonly priceListsService: PriceListsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('price_lists.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPriceListsDto,
  ): Promise<{ data: PriceListResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.priceListsService.findAll(companyId, query);
    return {
      data: result.data.map(toPriceListResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('price_lists.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PriceListResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const priceList = await this.priceListsService.findByIdInCompany(
      id,
      companyId,
    );
    return toPriceListResponseDto(priceList);
  }

  @Post()
  @RequirePermission('price_lists.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePriceListDto,
  ): Promise<PriceListResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    const priceList = await this.priceListsService.create(companyId, dto);
    return toPriceListResponseDto(priceList);
  }

  @Patch(':id')
  @RequirePermission('price_lists.update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePriceListDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PriceListResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const priceList = await this.priceListsService.update(id, companyId, dto);
    return toPriceListResponseDto(priceList);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('price_lists.update')
  async activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PriceListResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const priceList = await this.priceListsService.activate(id, companyId);
    return toPriceListResponseDto(priceList);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('price_lists.update')
  async deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PriceListResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const priceList = await this.priceListsService.deactivate(id, companyId);
    return toPriceListResponseDto(priceList);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('price_lists.delete')
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
    await this.priceListsService.remove(id, companyId);
  }
}
