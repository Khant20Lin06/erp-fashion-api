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
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ProductsService } from '../services/products.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ListProductsDto } from '../dto/list-products.dto';
import {
  ProductListResponseDto,
  ProductResponseDto,
  toProductResponseDto,
} from '../dto/product-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';
import { ErrorResponseDto } from '../../../common/swagger/dto/error-response.dto';

const RESOURCE = 'products';

@ApiTags('Products')
@Controller('products')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('products.read')
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({
    summary: 'List products visible within the authenticated user scope',
  })
  @ApiOkResponse({
    type: ProductListResponseDto,
    description:
      'Paginated product list. companyId acts only as a filter; DataScope remains authoritative.',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Validation failed for query parameters.',
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Missing, invalid, expired, or revoked JWT session.',
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description:
      'The authenticated user lacks the required permission or company scope.',
  })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListProductsDto,
  ): Promise<{ data: ProductResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.productsService.findAll(companyId, query);
    return {
      data: result.data.map(toProductResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('products.read')
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({ summary: 'Get a single product by id within scope' })
  @ApiOkResponse({
    type: ProductResponseDto,
    description: 'Product detail if it is visible in the authenticated scope.',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Validation failed for path/query parameters.',
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Missing, invalid, expired, or revoked JWT session.',
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description:
      'The authenticated user lacks the required permission or company scope.',
  })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<ProductResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const product = await this.productsService.findByIdInCompany(id, companyId);
    return toProductResponseDto(product);
  }

  @Post()
  @RequirePermission('products.create')
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({ summary: 'Create a product and its initial variant' })
  @ApiOkResponse({
    type: ProductResponseDto,
    description:
      'Created product. companyId is validated against DataScope before persistence.',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Validation failed for the request body.',
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Missing, invalid, expired, or revoked JWT session.',
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description:
      'The authenticated user lacks the required permission or company scope.',
  })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProductDto,
  ): Promise<ProductResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    const product = await this.productsService.create(companyId, dto);
    return toProductResponseDto(product);
  }

  @Patch(':id')
  @RequirePermission('products.update')
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({ summary: 'Update a product within scope' })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Validation failed for path/query/body parameters.',
  })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<ProductResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const product = await this.productsService.update(id, companyId, dto);
    return toProductResponseDto(product);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('products.update')
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({ summary: 'Activate a product within scope' })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  async activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<ProductResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const product = await this.productsService.activate(id, companyId);
    return toProductResponseDto(product);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('products.update')
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({ summary: 'Deactivate a product within scope' })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  async deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<ProductResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const product = await this.productsService.deactivate(id, companyId);
    return toProductResponseDto(product);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('products.delete')
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({ summary: 'Soft-delete a product within scope' })
  @ApiNoContentResponse({
    description: 'The product was deleted successfully.',
  })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
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
    await this.productsService.remove(id, companyId);
  }
}
