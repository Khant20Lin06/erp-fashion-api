import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';
import { CustomerCatalogService } from '../services/customer-catalog.service';
import {
  CatalogQueryDto,
  CatalogListResponse,
  CatalogProduct,
  CatalogDiscoveryQueryDto,
  CatalogDiscoveryResponse,
} from '../dto/catalog.dto';

@ApiTags('Customer Portal (Bot Integration)')
@ApiBearerAuth('bearerAuth')
@Controller('customer-portal/catalog')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CustomerCatalogController {
  constructor(
    private readonly catalog: CustomerCatalogService,
    private readonly dataScope: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('products.read')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CatalogQueryDto,
  ): Promise<CatalogListResponse> {
    const companyId = await resolveRequestCompanyId(
      this.dataScope,
      user.id,
      'products',
      query.companyId,
    );
    return this.catalog.list(companyId, query.query);
  }

  @Get('discover')
  @RequirePermission('products.read')
  async discover(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CatalogDiscoveryQueryDto,
  ): Promise<CatalogDiscoveryResponse> {
    const companyId = await resolveRequestCompanyId(
      this.dataScope,
      user.id,
      'products',
      query.companyId,
    );
    return this.catalog.discover(companyId, query);
  }

  @Get('popular')
  @RequirePermission('products.read')
  async popular(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CatalogDiscoveryQueryDto,
  ): Promise<CatalogDiscoveryResponse> {
    const companyId = await resolveRequestCompanyId(
      this.dataScope,
      user.id,
      'products',
      query.companyId,
    );
    return this.catalog.popular(companyId, query);
  }

  @Get(':productId')
  @RequirePermission('products.read')
  async detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Query() query: CatalogQueryDto,
  ): Promise<CatalogProduct> {
    const companyId = await resolveRequestCompanyId(
      this.dataScope,
      user.id,
      'products',
      query.companyId,
    );
    return this.catalog.detail(companyId, productId);
  }
}
