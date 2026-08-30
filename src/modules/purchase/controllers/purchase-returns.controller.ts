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
  CreatePurchaseReturnDto,
  ListPurchaseReturnsDto,
  PurchaseReturnResponseDto,
  toPurchaseReturnResponseDto,
} from '../dto/purchase-returns.dto';
import { PurchaseReturnsService } from '../services/purchase-returns.service';

const RESOURCE = 'purchase_returns';

@ApiTags('Purchase Returns')
@Controller('purchase-returns')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PurchaseReturnsController {
  constructor(
    private readonly purchaseReturnsService: PurchaseReturnsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('purchase_returns.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPurchaseReturnsDto,
  ): Promise<{ data: PurchaseReturnResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.purchaseReturnsService.findAll(companyId, query);
    return {
      data: result.data.map((entry) => toPurchaseReturnResponseDto(entry)),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('purchase_returns.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PurchaseReturnResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.purchaseReturnsService.findByIdInCompany(
      id,
      companyId,
    );
    return toPurchaseReturnResponseDto(entity);
  }

  @Post()
  @RequirePermission('purchase_returns.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePurchaseReturnDto,
  ): Promise<PurchaseReturnResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    const entity = await this.purchaseReturnsService.create(
      companyId,
      user.id,
      dto,
    );
    return toPurchaseReturnResponseDto(entity);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('purchase_returns.confirm')
  async complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PurchaseReturnResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.purchaseReturnsService.complete(
      id,
      companyId,
      user.id,
    );
    return toPurchaseReturnResponseDto(entity);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('purchase_returns.cancel')
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PurchaseReturnResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.purchaseReturnsService.cancel(id, companyId);
    return toPurchaseReturnResponseDto(entity);
  }
}
