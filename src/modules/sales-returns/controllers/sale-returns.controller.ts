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
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';
import {
  CreateSaleReturnDto,
  ListSaleReturnsDto,
  SaleReturnResponseDto,
  toSaleReturnResponseDto,
} from '../dto/sale-returns.dto';
import { SaleReturnsService } from '../services/sale-returns.service';

const RESOURCE = 'sales_returns';

@ApiTags('Sales Returns')
@Controller('returns')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SaleReturnsController {
  constructor(
    private readonly saleReturnsService: SaleReturnsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('sales_returns.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListSaleReturnsDto,
  ): Promise<{ data: SaleReturnResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.saleReturnsService.findAll(companyId, query);
    return {
      data: result.data.map((r) => toSaleReturnResponseDto(r)),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('sales_returns.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<SaleReturnResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.saleReturnsService.findByIdInCompany(
      id,
      companyId,
    );
    return toSaleReturnResponseDto(entity);
  }

  @Post()
  @RequirePermission('sales_returns.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSaleReturnDto,
  ): Promise<SaleReturnResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    const entity = await this.saleReturnsService.create(
      companyId,
      user.id,
      dto,
    );
    return toSaleReturnResponseDto(entity);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales_returns.confirm')
  async confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<SaleReturnResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.saleReturnsService.confirm(
      id,
      companyId,
      user.id,
    );
    return toSaleReturnResponseDto(entity);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales_returns.cancel')
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<SaleReturnResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.saleReturnsService.cancel(id, companyId);
    return toSaleReturnResponseDto(entity);
  }
}
