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
import { PurchaseRequestsService } from '../services/purchase-requests.service';
import { CreatePurchaseRequestDto } from '../dto/create-purchase-request.dto';
import { ListPurchaseRequestsDto } from '../dto/list-purchase-requests.dto';
import {
  PurchaseRequestResponseDto,
  toPurchaseRequestResponseDto,
} from '../dto/purchase-request-response.dto';
import { UpdatePurchaseRequestStatusDto } from '../dto/update-purchase-request-status.dto';

const RESOURCE = 'purchase_requests';

@ApiTags('Purchase Requests')
@Controller('purchase-requests')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PurchaseRequestsController {
  constructor(
    private readonly purchaseRequestsService: PurchaseRequestsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('purchase_requests.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPurchaseRequestsDto,
  ): Promise<{ data: PurchaseRequestResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.purchaseRequestsService.findAll(companyId, query);
    return {
      data: result.data.map(toPurchaseRequestResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('purchase_requests.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PurchaseRequestResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.purchaseRequestsService.findByIdInCompany(
      id,
      companyId,
    );
    return toPurchaseRequestResponseDto(entity);
  }

  @Post()
  @RequirePermission('purchase_requests.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePurchaseRequestDto,
  ): Promise<PurchaseRequestResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    const entity = await this.purchaseRequestsService.create(
      companyId,
      user.id,
      dto,
    );
    return toPurchaseRequestResponseDto(entity);
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('purchase_requests.confirm')
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseRequestStatusDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PurchaseRequestResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.purchaseRequestsService.updateStatus(
      id,
      companyId,
      user.id,
      dto.status,
    );
    return toPurchaseRequestResponseDto(entity);
  }
}
